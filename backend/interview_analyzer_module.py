# backend/interview_analyzer_module.py
import cv2
import dlib
import numpy as np
import math # For angle calculations
import time # For CheatingMonitor (though not used in current simple update_metrics)

# --- 0. Configuration and Model Loading ---
DLIB_LANDMARK_PREDICTOR_PATH = "shape_predictor_68_face_landmarks.dat" # Expect in same dir
OPENCV_FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'

face_detector_cv = None
dlib_face_detector = None
dlib_landmark_predictor = None
models_loaded = False

def load_models():
    global face_detector_cv, dlib_face_detector, dlib_landmark_predictor, models_loaded
    if models_loaded:
        return True
    try:
        # Using dlib's detector is generally good for subsequent landmark detection
        dlib_face_detector = dlib.get_frontal_face_detector()
        dlib_landmark_predictor = dlib.shape_predictor(DLIB_LANDMARK_PREDICTOR_PATH)
        # OpenCV's Haar can be an alternative or for other uses
        face_detector_cv = cv2.CascadeClassifier(OPENCV_FACE_CASCADE_PATH)
        if dlib_face_detector is None or dlib_landmark_predictor is None or face_detector_cv.empty():
             print("Error: One or more models failed to load correctly (dlib detector/predictor or OpenCV cascade).")
             models_loaded = False
             return False
        print("Vision models loaded successfully for interview_analyzer_module.")
        models_loaded = True
        return True
    except Exception as e:
        print(f"Error loading models in interview_analyzer_module: {e}")
        print("Please ensure 'shape_predictor_68_face_landmarks.dat' is in the backend directory.")
        models_loaded = False
        return False

# --- 1. Feature Extraction Functions ---

def get_landmarks(image_gray, face_rect_dlib):
    if not models_loaded: return None
    try:
        shape = dlib_landmark_predictor(image_gray, face_rect_dlib)
        landmarks = np.array([[p.x, p.y] for p in shape.parts()])
        return landmarks
    except Exception as e:
        print(f"Error in get_landmarks: {e}")
        return None

def estimate_gaze_direction_rudimentary(landmarks, frame_width):
    # (Same as previously defined, ensure it handles None landmarks)
    if landmarks is None: return "Gaze Error (No LMs)"
    try:
        left_eye_pts = landmarks[36:42]
        right_eye_pts = landmarks[42:48]
        left_eye_center = left_eye_pts.mean(axis=0)
        right_eye_center = right_eye_pts.mean(axis=0)
        eye_mid_x = (left_eye_center[0] + right_eye_center[0]) / 2
        face_center_x = landmarks[27][0] # Nose bridge top
        
        # More robust: calculate relative to eye width or inter-eye distance
        eye_span = np.linalg.norm(landmarks[39] - landmarks[36]) # Approx width of one eye
        if eye_span < 1: eye_span = 10 # Avoid division by zero if landmarks are bad

        gaze_threshold_factor = 0.4 # Tunable: Pupil center deviates by 40% of eye_span from eye center considered deflection

        # Consider left eye horizontal center: (landmarks[36][0] + landmarks[39][0]) / 2
        # This simplified version looks at average eye position vs a face center point
        # It does not properly calculate gaze angle.
        
        # A very simplified check based on eye_mid_x relative to a point on the nose
        # This doesn't account for head turn.
        deviation = eye_mid_x - face_center_x
        # Consider a "neutral zone" around face_center_x. Let's use eye_span as a measure.
        if deviation < -eye_span * gaze_threshold_factor: # Looking left of center
            return "Looking Left"
        elif deviation > eye_span * gaze_threshold_factor: # Looking right of center
            return "Looking Right"
        else:
            return "Looking Center/Forward"
    except Exception as e:
        # print(f"Gaze estimation error: {e}")
        return "Gaze Error"


def get_head_pose_angles_solvepnp(landmarks, frame_shape):
    # (Same as previously defined, ensure it handles None landmarks)
    if landmarks is None: return None, None, None
    try:
        image_points = np.array([
            landmarks[30], landmarks[8], landmarks[36],
            landmarks[45], landmarks[48], landmarks[54]
        ], dtype="double")

        model_points = np.array([
            (0.0, 0.0, 0.0), (0.0, -330.0, -65.0), (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0), (-150.0, -150.0, -125.0), (150.0, -150.0, -125.0)
        ])

        focal_length = frame_shape[1]
        center = (frame_shape[1]/2, frame_shape[0]/2)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]], dtype="double"
        )
        dist_coeffs = np.zeros((4, 1))

        (success, rotation_vector, _) = cv2.solvePnP(
            model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_EPNP # EPNP is often faster
        )

        if success:
            rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
            sy = math.sqrt(rotation_matrix[0,0]**2 + rotation_matrix[1,0]**2)
            singular = sy < 1e-6
            if not singular:
                x_angle = math.atan2(rotation_matrix[2,1], rotation_matrix[2,2])
                y_angle = math.atan2(-rotation_matrix[2,0], sy)
                z_angle = math.atan2(rotation_matrix[1,0], rotation_matrix[0,0])
            else:
                x_angle = math.atan2(-rotation_matrix[1,2], rotation_matrix[1,1])
                y_angle = math.atan2(-rotation_matrix[2,0], sy)
                z_angle = 0
            return math.degrees(y_angle), math.degrees(x_angle), math.degrees(z_angle) # Yaw, Pitch, Roll
    except Exception as e:
        # print(f"Head pose estimation error: {e}")
        pass
    return None, None, None

# --- 2. Cheating Detection Logic ---
class CheatingMonitor:
    # (Same as previously defined)
    def __init__(self):
        self.gaze_deflection_frames = 0 # Renamed for clarity
        self.head_turned_away_frames = 0
        self.suspicion_score = 0
        
        self.GAZE_DEFLECTION_FRAMES_LIMIT = 5 * 10 # 5 seconds at 10 FPS analysis rate
        self.HEAD_AWAY_FRAMES_LIMIT = 3 * 10 # 3 seconds at 10 FPS analysis rate
        self.YAW_THRESHOLD = 30 # degrees
        self.PITCH_THRESHOLD_LOOKING_AWAY = 20 # degrees (looking down/up a lot)
        self.SUSPICION_THRESHOLD_SCORE = 50 # Arbitrary score threshold

        # New attributes for final conclusion
        self.total_frames_processed = 0
        self.analysis_start_time = time.time()
        self.event_history = [] # To store notable events
        self.gaze_deflected_total_frames = 0
        self.head_turned_total_frames = 0

    def update_metrics(self, gaze, head_yaw, head_pitch):
        self.total_frames_processed += 1
        # Gaze
        if gaze == "Looking Left" or gaze == "Looking Right":
            self.gaze_deflection_frames += 1
            self.gaze_deflected_total_frames += 1
            if self.gaze_deflection_frames == self.GAZE_DEFLECTION_FRAMES_LIMIT + 1: # Log when limit just crossed
                self.event_history.append({
                    "timestamp": time.time(),
                    "type": "Sustained Gaze Deflection",
                    "details": f"Gaze deflected for approx. {self.GAZE_DEFLECTION_FRAMES_LIMIT/10:.1f}s"
                })
        else:
            self.gaze_deflection_frames = max(0, self.gaze_deflection_frames - 2)

        # Head Pose
        turned_away_this_frame = False
        # Diagnostic prints for head pose
        print(f"[Debug Head Pose] Yaw: {head_yaw}, Pitch: {head_pitch}, YAW_THRESH: {self.YAW_THRESHOLD}, PITCH_THRESH: {self.PITCH_THRESHOLD_LOOKING_AWAY}")

        condition_yaw = abs(head_yaw) > self.YAW_THRESHOLD
        if condition_yaw:
            print(f"[Debug Head Pose] YAW triggered. abs(head_yaw)={abs(head_yaw)}")

        # Revised pitch condition:
        # Assumes neutral pitch is ~ +/-180 degrees.
        # Looking away means pitch moves towards 0/90 from that +/-180 baseline.
        # PITCH_THRESHOLD_LOOKING_AWAY (e.g., 20) defines how much deviation from +/-180 (towards 0) is allowed.
        # So, if abs(head_pitch) is less than (180 - threshold), it's considered a turn.
        pitch_away_boundary = 180 - self.PITCH_THRESHOLD_LOOKING_AWAY
        condition_pitch = abs(head_pitch) < pitch_away_boundary
        
        if condition_pitch:
            print(f"[Debug Head Pose] PITCH triggered. abs(head_pitch)={abs(head_pitch)} is < {pitch_away_boundary}")
        
        turned_away_this_frame = condition_yaw or condition_pitch
        print(f"[Debug Head Pose] condition_yaw: {condition_yaw}, condition_pitch: {condition_pitch}, turned_away_this_frame: {turned_away_this_frame}")

        if turned_away_this_frame:
            self.head_turned_away_frames +=1
            self.head_turned_total_frames +=1
            print(f"[Debug Head Pose] head_turned_total_frames incremented to: {self.head_turned_total_frames}")
            if self.head_turned_away_frames == self.HEAD_AWAY_FRAMES_LIMIT + 1: # Log when limit just crossed
                 self.event_history.append({
                    "timestamp": time.time(),
                    "type": "Sustained Head Turn Away",
                    "details": f"Head turned for approx. {self.HEAD_AWAY_FRAMES_LIMIT/10:.1f}s"
                })
        else:
            self.head_turned_away_frames = max(0, self.head_turned_away_frames -2)
        
    def assess_status(self):
        # (Same as previously defined, can be enhanced)
        current_suspicion_triggers = []
        normalized_score_increment = 10 # How much each trigger event adds to score

        if self.gaze_deflection_frames > self.GAZE_DEFLECTION_FRAMES_LIMIT:
            current_suspicion_triggers.append("Gaze")
            self.suspicion_score += normalized_score_increment
        
        if self.head_turned_away_frames > self.HEAD_AWAY_FRAMES_LIMIT:
            current_suspicion_triggers.append("Head Pose")
            self.suspicion_score += normalized_score_increment

        if not current_suspicion_triggers: # If no current triggers, decay score
            self.suspicion_score = max(0, self.suspicion_score - (normalized_score_increment // 2)) # Decay slower

        self.suspicion_score = min(self.suspicion_score, self.SUSPICION_THRESHOLD_SCORE * 2) # Cap score

        if self.suspicion_score > self.SUSPICION_THRESHOLD_SCORE:
             return f"Potential Cheating ({(', '.join(current_suspicion_triggers))}) Score: {self.suspicion_score}"
        
        return f"Normal. Score: {self.suspicion_score}. GazeFrames: {self.gaze_deflection_frames}, HeadFrames: {self.head_turned_away_frames}"

    def get_final_conclusion(self):
        analysis_duration_seconds = time.time() - self.analysis_start_time
        
        # --- FPS Calculation ---
        fps_analyzed = 0
        if analysis_duration_seconds > 0 and self.total_frames_processed > 0:
            fps_analyzed = round(self.total_frames_processed / analysis_duration_seconds, 2)
        
        # --- Suspicion Score Calculation (as before) ---
        calculated_suspicion_score = 0
        if self.total_frames_processed > 0:
            MAX_POINTS_GAZE_SUSPICION = 50
            MAX_POINTS_HEAD_SUSPICION = 50
            gaze_ratio = self.gaze_deflected_total_frames / self.total_frames_processed
            head_turn_ratio = self.head_turned_total_frames / self.total_frames_processed
            gaze_score_component = gaze_ratio * MAX_POINTS_GAZE_SUSPICION
            head_score_component = head_turn_ratio * MAX_POINTS_HEAD_SUSPICION
            calculated_suspicion_score = min(100, round(gaze_score_component + head_score_component))
        else:
            calculated_suspicion_score = 0

        # --- Trust Score Calculation ---
        trust_score = 0
        if self.total_frames_processed > 0:
            MAX_DEDUCTION_GAZE_TRUST = 50
            MAX_DEDUCTION_HEAD_TRUST = 50
            # Ratios are the same as for suspicion score
            gaze_penalty = gaze_ratio * MAX_DEDUCTION_GAZE_TRUST
            head_penalty = head_turn_ratio * MAX_DEDUCTION_HEAD_TRUST
            trust_score = max(0, round(100 - gaze_penalty - head_penalty))
        elif analysis_duration_seconds > 0 : # No frames, but analysis ran (e.g. black screen) - lowest trust
            trust_score = 0
        else: # No frames and no duration (should not happen if analysis started)
            trust_score = 100 # Or some other default for an edge case

        # --- Determine Final Status Text based on the calculated_suspicion_score ---
        HIGH_CONCERN_THRESHOLD_FINAL = 70
        MODERATE_CONCERN_THRESHOLD_FINAL = 35

        final_status_text = "Analysis Complete." # Default
        if calculated_suspicion_score > HIGH_CONCERN_THRESHOLD_FINAL:
            final_status_text = f"High Concern (Suspicion: {calculated_suspicion_score})."
        elif calculated_suspicion_score > MODERATE_CONCERN_THRESHOLD_FINAL:
            final_status_text = f"Moderate Concern (Suspicion: {calculated_suspicion_score})."
        elif self.gaze_deflected_total_frames > 0 or self.head_turned_total_frames > 0:
            final_status_text = f"Low Concern (Suspicion: {calculated_suspicion_score}). Some deviations noted."
        else:
            final_status_text = f"Low Concern (Suspicion: {calculated_suspicion_score}). No significant deviations."

        return {
            "status_text": final_status_text,
            "details": {
                "duration_analyzed_seconds": round(analysis_duration_seconds, 2),
                "total_frames_analyzed": self.total_frames_processed,
                "suspicion_score_final": calculated_suspicion_score,
                "trust_score": trust_score, # Added Trust Score
                "fps_analyzed": fps_analyzed, # Added FPS
                "gaze_deflection_count": self.gaze_deflected_total_frames,
                "head_turn_count": self.head_turned_total_frames,
                "key_events_triggered": self.event_history
            }
        }

# --- 3. Main processing function for a single frame ---
def analyze_frame(frame, monitor_instance):
    """
    Processes a single frame to detect face, landmarks, gaze, head pose,
    and updates the CheatingMonitor.
    Returns the annotated frame and the status text.
    """
    if not models_loaded:
        if not load_models(): # Try to load them if not already
            return frame, "Error: Models not loaded."

    frame_copy_for_processing = frame.copy()
    gray = cv2.cvtColor(frame_copy_for_processing, cv2.COLOR_BGR2GRAY)
    
    faces_dlib = dlib_face_detector(gray)
    
    gaze_direction = "N/A"
    head_yaw, head_pitch = None, None
    analysis_data = {
        "face_detected": False,
        "gaze": gaze_direction,
        "head_yaw": None,
        "head_pitch": None,
        "head_roll": None,
        "status_text": "No face detected"
    }

    if len(faces_dlib) > 0:
        face = faces_dlib[0]
        cv2.rectangle(frame, (face.left(), face.top()), (face.right(), face.bottom()), (0, 255, 0), 2)
        
        landmarks = get_landmarks(gray, face)
        if landmarks is not None:
            analysis_data["face_detected"] = True
            for (x, y) in landmarks:
                cv2.circle(frame, (x, y), 1, (0, 0, 255), -1)

            gaze_direction = estimate_gaze_direction_rudimentary(landmarks, frame.shape[1])
            yaw, pitch, roll = get_head_pose_angles_solvepnp(landmarks, frame.shape)
            
            analysis_data["gaze"] = gaze_direction
            analysis_data["head_yaw"] = yaw
            analysis_data["head_pitch"] = pitch
            analysis_data["head_roll"] = roll
            head_yaw, head_pitch = yaw, pitch # For monitor

            monitor_instance.update_metrics(gaze_direction, head_yaw, head_pitch)
            
            if yaw is not None:
                 cv2.putText(frame, f"Head Yaw: {yaw:.1f}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,0), 1)
            if pitch is not None:
                 cv2.putText(frame, f"Head Pitch: {pitch:.1f}", (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,0), 1)

    status_text = monitor_instance.assess_status()
    analysis_data["status_text"] = status_text
    cv2.putText(frame, f"Gaze: {gaze_direction}", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,0), 1)
    cv2.putText(frame, f"Status: {status_text}", (10, frame.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    return frame, analysis_data # Return annotated frame and structured data


# --- Main execution for standalone testing ---
if __name__ == '__main__':
    if not load_models():
        print("Exiting due to model loading failure.")
        exit()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Cannot open camera.")
        exit()

    monitor = CheatingMonitor()
    print("Starting standalone webcam analysis. Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Can't receive frame. Exiting.")
            break

        annotated_frame, _ = analyze_frame(frame, monitor) # We get structured data too if needed
        
        cv2.imshow('Interview Monitor (Standalone Test - Press Q to quit)', annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Standalone analysis stopped.") 