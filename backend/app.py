# --- Core ASGI/FastAPI Setup ---
import asyncio
import socketio # Use standard python-socketio
import uvicorn # For running the server
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# --- WebRTC & Analysis ---
from aiortc import RTCIceCandidate, RTCPeerConnection, RTCSessionDescription
import interview_analyzer_module # Your analysis module
from aioice.candidate import Candidate as AIoIceCandidate # Add this import

# --- Standard Libs ---
import time
import uuid
import logging 

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("Configuring FastAPI backend...")

# Custom middleware to handle CORS for non-Socket.IO paths
class SocketIOCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/socket.io/"):
            # Let Socket.IO handle its own CORS
            return await call_next(request)
        
        # For all other paths, use FastAPI's CORS
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Running FastAPI startup event...")
    try:
        if not interview_analyzer_module.load_models():
            logger.critical("Failed to load computer vision models. Analysis will not work.")
        else:
            logger.info("Computer vision models loaded successfully.")
    except Exception as e:
        logger.critical(f"Exception during model loading: {e}", exc_info=True)
    
    yield  # This is where FastAPI serves the application
    
    # Shutdown (if needed)
    logger.info("Shutting down FastAPI application...")

# --- FastAPI App Initialization ---
app = FastAPI(lifespan=lifespan)

# Add our custom CORS middleware
app.add_middleware(SocketIOCORSMiddleware)

# --- Socket.IO Async Server Setup ---
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["http://localhost:5173"],
    allow_upgrades=True,
    ping_timeout=60,
    ping_interval=25,
    async_handlers=True
)

# Create Socket.IO ASGI app
sio_app = socketio.ASGIApp(
    socketio_server=sio,
    socketio_path='socket.io'
)

# Mount Socket.IO app
app.mount('/socket.io', sio_app)

# --- Global Data Stores ---
rooms = {}
analysis_pcs = {} # Stores {target_sid: RTCPeerConnection_instance}
analysis_monitors = {} # Stores {target_sid: {'monitor': CheatingMonitor_instance, 'host_initiator_sid': str}}
analysis_sessions_being_cleaned = set() # To prevent double cleanup race conditions

# --- FastAPI Root Endpoint (Optional) ---
@app.get("/")
async def read_root():
    return {"message": "InterviewMeet Backend (FastAPI)"}

# --- Helper Functions ---
def get_participants_list_for_client(room_id):
    if room_id in rooms:
        # Ensure participant data structure matches what's stored
        return [{'id': sid, 'name': p_data['name']} for sid, p_data in rooms[room_id]['participants'].items()]
    return []

# --- Socket.IO Event Handlers ---

@sio.event
async def connect(sid, environ, auth): # Added auth, though not used currently
    # environ contains request details if needed
    logger.info(f'[Socket Connect] Client connected: {sid}')
    await sio.emit('connection_success', {'message': 'Successfully connected!', 'sid': sid}, room=sid)

@sio.event
async def disconnect(sid):
    logger.info(f'[Socket Disconnect] Client disconnected: {sid}')
    user_name = "Someone"
    room_left_id = None
    was_host_of_room = False # Flag to check if disconnected SID was a host

    # Find which room the user was in
    for room_id, room_data in list(rooms.items()): # Iterate over a copy for safe modification
        if sid in room_data.get('participants', {}):
            user_name = room_data['participants'][sid].get('name', sid[:6])
            original_creator_sid = room_data.get('creator_sid')
            
            del room_data['participants'][sid]
            room_left_id = room_id
            # No need to explicitly call leave_room for the disconnecting 'sid', sio handles it.
            logger.info(f'User {user_name} ({sid}) removed from room {room_left_id}')

            # Check if the disconnected user was the creator of this room
            if original_creator_sid == sid:
                was_host_of_room = True
                logger.info(f"Host {user_name} ({sid}) of room {room_left_id} has disconnected.")
                # Host disconnected, notify remaining participants and clean up the room.
                
                remaining_sids_in_room = list(room_data.get('participants', {}).keys())
                if remaining_sids_in_room:
                    logger.info(f"Notifying {len(remaining_sids_in_room)} remaining participants in room {room_left_id} about host leaving abruptly.")
                    for participant_sid_in_room in remaining_sids_in_room:
                        await sio.emit('host_left_abruptly', {
                            'room_id': room_left_id,
                            'message': 'The host has disconnected abruptly. The meeting will now end.'
                        }, room=participant_sid_in_room)
                        # Force participant out of server-side room
                        await sio.leave_room(participant_sid_in_room, room_left_id)
                        logger.info(f"Forced participant {participant_sid_in_room} to leave Socket.IO room {room_left_id}.")
                        # Clean up analysis for this participant if they were being analyzed
                        # The cleanup_analysis_session takes the target_sid (the one being analyzed)
                        if participant_sid_in_room in analysis_monitors:
                             logger.info(f"Cleaning up analysis session for participant {participant_sid_in_room} in room {room_left_id} due to host disconnect.")
                             await cleanup_analysis_session(participant_sid_in_room, "Host disconnected abruptly")

                # After handling all participants, remove the room as it's now defunct.
                if room_id in rooms: # Check again in case it was removed by another concurrent process (unlikely here)
                    del rooms[room_id]
                    logger.info(f"Room {room_left_id} has been closed and removed due to host disconnect.")
                
            else:
                # Disconnected user was not the host, just a regular participant.
                # Notify others that this participant left.
                remaining_participants_list = get_participants_list_for_client(room_id)
                await sio.emit('user_left', {
                    'sid': sid,
                    'name': user_name,
                    'room': room_left_id,
                    'allParticipants': remaining_participants_list
                }, room=room_id) # Emitting to the room (excluding the leaver, as they are gone)

                # System chat message for regular user leaving
                left_message = {
                    'id': str(uuid.uuid4()), 'type': 'system', 'sender_sid': 'SYSTEM',
                    'sender_name': 'System', 'text': f'{user_name} has left the meeting.',
                    'timestamp': time.time()
                }
                await sio.emit('new_message', left_message, room=room_id)

                if not room_data['participants']:
                    logger.info(f'Room {room_left_id} is now empty (after non-host left) and removed.')
                    if room_id in rooms: # Check again
                        del rooms[room_id]
                else:
                    logger.info(f'Users remaining in room {room_left_id}: {list(room_data["participants"].keys())}')
            
            break # Exit loop once user is found and processed

    # General cleanup for the disconnected user, regardless of whether they were in a room or a host.
    # This part handles if the user was being analyzed but was not necessarily in a room list (e.g., during setup)
    # or if they were a host and the analysis cleanup for them specifically is needed.
    if sid in analysis_monitors: # If the disconnected SID was a target of analysis
        logger.info(f"[Disconnect Cleanup] Cleaning up analysis session for target_sid {sid} as they disconnected.")
        await cleanup_analysis_session(sid, "User disconnected")
    
    # Also check if the disconnected SID was a host *initiating* any analyses
    # This is more complex if not already handled by room closure.
    # For now, the room closure due to host disconnect should cover analysis initiated by that host *within that room*.
    # If a host could analyze someone not in their room (not current design), this would need more.

    # logger.info(f"Finished disconnect event for {sid}.") # General log at end of disconnect

@sio.event
async def join_room(sid, data):
    room_id = data.get('room_id')
    user_name = data.get('userName', f'User ({sid[:6]})')
    create_locked = data.get('create_locked_room', False)

    if not room_id:
        logger.warning(f"No room_id provided by {sid}")
        return

    if room_id not in rooms:
        rooms[room_id] = {
            'participants': {},
            'creator_sid': sid,
            'is_locked': create_locked,
            'pending_requests': {}
        }
        logger.info(f"Room {room_id} created by {user_name} ({sid}). Locked: {create_locked}")
    
    current_room = rooms[room_id]

    # Check lock status
    if current_room['is_locked'] and sid != current_room['creator_sid'] and sid not in current_room['participants']:
        if sid in current_room['pending_requests']:
            await sio.emit('waiting_for_approval', {'room_id': room_id, 'message': 'You are still awaiting approval.'}, room=sid)
            logger.info(f"User {user_name} ({sid}) already pending for locked room {room_id}. Resent waiting signal.")
            return

        current_room['pending_requests'][sid] = {'name': user_name}
        logger.info(f"User {user_name} ({sid}) requesting to join locked room {room_id}. Notifying host {current_room['creator_sid']}.")
        
        await sio.emit('join_request_received', 
                       {'requester_sid': sid, 'requester_name': user_name, 'room_id': room_id},
                       room=current_room['creator_sid'])
        
        await sio.emit('waiting_for_approval', {'room_id': room_id, 'message': 'Your request to join has been sent to the host.'}, room=sid)
        return

    # ---- If allowed to join (not locked, creator, or already participant/approved) ----
    current_room['participants'][sid] = {'name': user_name, 'sid': sid} # Store basic info
    await sio.enter_room(sid, room_id)  # Add await here
    logger.info(f"User {user_name} ({sid}) entered room {room_id}. Total participants: {len(current_room['participants'])}")

    all_participants_in_room = get_participants_list_for_client(room_id)
    
    # Prepare list of other participants for WebRTC signaling
    other_participants_data = [p for p in all_participants_in_room if p['id'] != sid]

    # Notify the user who just joined
    await sio.emit('room_joined', {
        'room_id': room_id,
        'sid': sid, 
        'name': user_name,
        'allParticipants': all_participants_in_room, 
        'otherParticipants': other_participants_data,
        'creator_sid': current_room['creator_sid']
    }, room=sid)

    # Notify existing users in the room
    await sio.emit('new_user_joined', {
        'sid': sid, 
        'name': user_name, 
        'allParticipants': all_participants_in_room
    }, room=room_id, skip_sid=sid)

@sio.event
async def host_ended_meeting_request(sid, data):
    room_id = data.get('room_id')
    host_sid = sid # The SID of the user claiming to be the host and ending the meeting

    logger.info(f"[Host End Meeting] Received request from {host_sid} to end room {room_id}")

    if not room_id:
        logger.warning(f"[Host End Meeting] No room_id provided by {host_sid}. Aborting.")
        return

    if room_id not in rooms:
        logger.warning(f"[Host End Meeting] Room {room_id} not found. Possibly already ended or never existed. SID: {host_sid}")
        # Optionally, still tell this SID the meeting is over if they think they are in it.
        # await sio.emit('meeting_ended_by_host', {'room_id': room_id, 'message': 'Meeting not found, assuming ended.'}, room=host_sid)
        return

    current_room_data = rooms[room_id]

    if current_room_data.get('creator_sid') != host_sid:
        logger.warning(f"[Host End Meeting] Unauthorized attempt by {host_sid} to end room {room_id}. Actual creator: {current_room_data.get('creator_sid')}.")
        # Optionally, inform the requester they are not authorized, though this might be abusable.
        # await sio.emit('error_message', {'message': 'You are not authorized to end this meeting.'}, room=host_sid)
        return

    logger.info(f"[Host End Meeting] Host {host_sid} confirmed. Ending room {room_id} for all participants.")

    # Notify all participants (including the host, their client will handle it gracefully)
    # Collect all SIDs that were in the room to ensure everyone is notified even if they are in pending_requests
    all_sids_in_room = list(current_room_data.get('participants', {}).keys()) 
    # It's unlikely pending requests would be left if room is active, but good to be thorough or clean them.
    # For simplicity, we focus on active participants. If pending requests need notification, add them.

    for participant_sid in all_sids_in_room:
        try:
            logger.info(f"[Host End Meeting] Notifying participant {participant_sid} in room {room_id} that meeting is ending.")
            await sio.emit('meeting_ended_by_host', {'room_id': room_id, 'message': 'The host has ended the meeting.'}, room=participant_sid)
        except Exception as e:
            logger.error(f"[Host End Meeting] Error notifying participant {participant_sid}: {e}")

    # Clean up the room from the server
    try:
        del rooms[room_id]
        logger.info(f"[Host End Meeting] Room {room_id} has been deleted from server memory.")
    except KeyError:
        logger.warning(f"[Host End Meeting] Attempted to delete room {room_id} but it was already gone.")
    except Exception as e:
        logger.error(f"[Host End Meeting] Unexpected error deleting room {room_id}: {e}")

# --- WebRTC Signaling Handlers ---
@sio.event
async def offer(sid, data):
    target_sid = data.get('target_sid')
    room_id = data.get('room_id') # Get room_id for context
    # logger.info(f"Relaying offer from {sid[:6]} to {target_sid[:6] if target_sid else 'N/A'} in room {room_id}")
    await sio.emit('offer', {'from_sid': sid, 'offer_sdp': data.get('offer_sdp'), 'room_id': room_id}, room=target_sid)

@sio.event
async def answer(sid, data):
    target_sid = data.get('target_sid')
    room_id = data.get('room_id')
    # logger.info(f"Relaying answer from {sid[:6]} to {target_sid[:6] if target_sid else 'N/A'} in room {room_id}")
    await sio.emit('answer', {'from_sid': sid, 'answer_sdp': data.get('answer_sdp'), 'room_id': room_id}, room=target_sid)

@sio.event
async def candidate(sid, data):
    target_sid = data.get('target_sid')
    room_id = data.get('room_id')
    # logger.info(f"Relaying candidate from {sid[:6]} to {target_sid[:6] if target_sid else 'N/A'} in room {room_id}")
    await sio.emit('candidate', {'from_sid': sid, 'candidate': data.get('candidate'), 'room_id': room_id}, room=target_sid)

# --- Chat Handler ---
@sio.event
async def send_message(sid, data):
    room_id = data.get('room_id')
    message_text = data.get('message_text')

    if not room_id or not message_text or room_id not in rooms or sid not in rooms[room_id].get('participants', {}):
        logger.warning(f"Invalid message/user/room from {sid}: {data}")
        return

    user_name = rooms[room_id]['participants'][sid].get('name', f'User ({sid[:6]})')
    logger.info(f"User {user_name} sending message to room {room_id}")
    
    message_payload = {
        'id': str(uuid.uuid4()), 'type': 'user', 'sender_sid': sid,
        'sender_name': user_name, 'text': message_text, 'timestamp': time.time()
    }
    await sio.emit('new_message', message_payload, room=room_id)

# --- Admission Control Handlers ---
@sio.event
async def admission_decision(sid, data): # sid here is the host making the decision
    host_sid = sid
    room_id = data.get('room_id')
    requester_sid = data.get('requester_sid')
    decision = data.get('decision')

    if not all([room_id, requester_sid, decision]):
        logger.warning(f"Invalid admission_decision data from {host_sid}: {data}")
        return

    if room_id not in rooms:
        logger.warning(f"Room {room_id} not found for decision by {host_sid}.")
        return

    current_room = rooms[room_id]

    if host_sid != current_room.get('creator_sid'):
        logger.warning(f"Unauthorized attempt by {host_sid} to make admission decision.")
        return

    if requester_sid not in current_room.get('pending_requests', {}):
        logger.warning(f"Requester {requester_sid} not found in pending requests for room {room_id}.")
        return

    requester_info = current_room['pending_requests'].pop(requester_sid)
    requester_name = requester_info.get('name', f'User ({requester_sid[:6]})')

    if decision == 'accept':
        logger.info(f"Host {host_sid} ACCEPTED {requester_name} ({requester_sid}) for room {room_id}.")
        # Add to participants & enter Socket.IO room
        current_room['participants'][requester_sid] = {'name': requester_name, 'sid': requester_sid}
        await sio.enter_room(requester_sid, room_id)  # Add await here
        
        all_participants_in_room = get_participants_list_for_client(room_id)
        other_participants_data = [p for p in all_participants_in_room if p['id'] != requester_sid]

        # 1. Notify the approved user they are in
        await sio.emit('admission_approved', {
            'room_id': room_id, 
            'sid': requester_sid, 
            'name': requester_name,
            'allParticipants': all_participants_in_room,
            'otherParticipants': other_participants_data,
            'creator_sid': current_room['creator_sid']
        }, room=requester_sid)

        # 2. Notify everyone else
        await sio.emit('new_user_joined', {
            'sid': requester_sid, 
            'name': requester_name, 
            'allParticipants': all_participants_in_room
        }, room=room_id, skip_sid=requester_sid)

        # System chat message
        joined_message = {
            'id': str(uuid.uuid4()), 'type': 'system', 'sender_sid': 'SYSTEM',
            'sender_name': 'System', 'text': f'{requester_name} has joined the meeting.',
            'timestamp': time.time()
        }
        await sio.emit('new_message', joined_message, room=room_id)

    elif decision == 'deny':
        logger.info(f"Host {host_sid} DENIED {requester_name} ({requester_sid}) for room {room_id}.")
        await sio.emit('admission_denied', {'room_id': room_id, 'message': 'Your request to join the room was denied.'}, room=requester_sid)
    
    else:
        logger.warning(f"Unknown decision '{decision}' by host {host_sid}.")

    await sio.emit('join_request_processed', {'requester_sid': requester_sid, 'room_id': room_id, 'decision': decision}, room=host_sid)

# --- Video Analysis Handlers & Helpers ---

async def consume_video_track(track, target_sid):
    logger.info(f"[ANALYSIS {target_sid}] Consumer started.")
    monitor_info = analysis_monitors.get(target_sid)
    if not monitor_info:
        logger.error(f"[ANALYSIS {target_sid}] Error: No monitor found.")
        return
    
    frame_count = 0 # This local frame_count is for FPS calculation here, monitor has its own.
    start_time = time.time()

    while True:
        try:
            frame = await track.recv() # aiortc.VideoFrame
            img = frame.to_ndarray(format="bgr24")
            frame_count += 1

            # The monitor_instance (monitor) is updated internally by analyze_frame
            _annotated_frame, _analysis_data_per_frame = interview_analyzer_module.analyze_frame(img, monitor_info['monitor'])
            
            # REMOVED: No longer sending streaming updates
            # host_sid_for_room = None
            # for room_id, room_data in rooms.items():
            #     if target_sid in room_data.get('participants', {}):
            #         host_sid_for_room = room_data.get('creator_sid')
            #         break
            # if host_sid_for_room:
            #     logger.info(f"[ANALYSIS {target_sid}] Sending results to host {host_sid_for_room}: {analysis_results}")
            #     await sio.emit('analysis_update', {
            #         'analyzed_sid': target_sid,
            #         'results': analysis_results, # This was analysis_data_per_frame
            #         'timestamp': time.time()
            #     }, room=host_sid_for_room)

        except asyncio.CancelledError:
            logger.info(f"[ANALYSIS {target_sid}] Consumer task cancelled.")
            break
        except Exception as e:
            logger.error(f"[ANALYSIS {target_sid}] Error processing frame: {e}", exc_info=True)
            break
            
    end_time = time.time()
    duration = end_time - start_time
    fps = frame_count / duration if duration > 0 else 0
    logger.info(f"[ANALYSIS {target_sid}] Consumer stopped. Processed {frame_count} frames in {duration:.2f}s ({fps:.1f} FPS).")
    # Ensure cleanup is called if the loop breaks unexpectedly or track ends, 
    # though on_ended should also cover this.
    # However, direct call to cleanup might be redundant if on_ended always fires.
    # For safety, let's ensure cleanup happens, stop_analysis_request handles redundancy.
    # await cleanup_analysis_session(target_sid) # This might be too aggressive here

@sio.event
async def start_analysis_request(sid, data): # sid is the host
    host_sid = sid # This is the SID of the socket that sent the request
    target_sid = data.get('target_sid')
    # Get the requesting_host_sid from the payload, which should match host_sid if client is consistent
    # This is useful if we want to ensure the original initiator gets the result, even if their SID changes due to reconnect.
    # However, for emitting, we target the SID that *initiated* the analysis session.
    initiating_host_sid_from_payload = data.get('requesting_host_sid', host_sid) 

    logger.info(f"[ANALYSIS Start] Received request from socket {host_sid} (claimed host SID {initiating_host_sid_from_payload}) for {target_sid}.")

    if not target_sid:
        logger.warning(f"[ANALYSIS Error] Host {host_sid} did not specify target_sid.")
        return

    if target_sid in analysis_pcs:
        logger.warning(f"[ANALYSIS Warn] Analysis already in progress/requested for {target_sid}.")
        return

    logger.info(f"[ANALYSIS] Creating PC for {target_sid}..." )
    try:
        pc = RTCPeerConnection()
        analysis_pcs[target_sid] = pc
        # Store the monitor instance AND the SID of the host who initiated this analysis
        analysis_monitors[target_sid] = {
            'monitor': interview_analyzer_module.CheatingMonitor(),
            'host_initiator_sid': initiating_host_sid_from_payload 
        }
        logger.info(f"[ANALYSIS] PC created for {target_sid}, original initiating host SID {initiating_host_sid_from_payload}.")
    except Exception as e:
        logger.error(f"[ANALYSIS Error] Failed to create PC for {target_sid}: {e}", exc_info=True)
        return

    analysis_task_ref = {"task": None} # Use a mutable dict to share task ref with closures

    @pc.on("icecandidate")
    async def on_icecandidate(candidate):
        if candidate:
            logger.info(f"[PC ICE {target_sid}] Generated ICE candidate, sending to {target_sid}")
            await sio.emit('server_ice_candidate_for_analysis', 
                          {'candidate': candidate.to_json(), 'analysis_target_sid': target_sid},
                          room=target_sid)
    
    @pc.on("track")
    async def on_track(track):
        logger.info(f"[PC TRACK {target_sid}] Track {track.kind} received.")
        if track.kind == "video":
            logger.info(f"[PC TRACK {target_sid}] Starting consumer task for video track...")
            analysis_task_ref["task"] = asyncio.create_task(consume_video_track(track, target_sid))
            # Notify that connection is established
            await sio.emit('analysis_connection_established', {'target_sid': target_sid}, room=host_sid)
        
        @track.on("ended")
        async def on_ended():
            logger.info(f"[PC TRACK {target_sid}] Track ended.")
            task = analysis_task_ref.get("task")
            if task:
                task.cancel() # This will lead to CancelledError in consume_video_track
            # Call cleanup_analysis_session when the track ends to send final conclusion
            await cleanup_analysis_session(target_sid) 
            # No need to emit analysis_connection_failed here as cleanup will handle notifications

    logger.info(f"[ANALYSIS] Adding transceiver for {target_sid}...")
    try:
        pc.addTransceiver("video", direction="recvonly")
        logger.info(f"[ANALYSIS] Transceiver added for {target_sid}.")
    except Exception as e:
        logger.error(f"[ANALYSIS Error] Failed to add transceiver for {target_sid}: {e}", exc_info=True)
        await cleanup_analysis_session(target_sid)
        return

    logger.info(f"[ANALYSIS] Creating offer for {target_sid}...")
    try:
        offer = await pc.createOffer()
        logger.info(f"[ANALYSIS] Offer created for {target_sid}, setting local description...")
        await pc.setLocalDescription(offer)
        logger.info(f"[ANALYSIS] Local description set for {target_sid}, sending offer to client...")
        
        # Fix: Convert RTCSessionDescription to dict instead of using to_json()
        offer_dict = {
            'type': pc.localDescription.type,
            'sdp': pc.localDescription.sdp
        }
        
        await sio.emit('server_offer_for_analysis', 
                      {'offer': offer_dict, 'analysis_target_sid': target_sid},
                      room=target_sid)
        logger.info(f"[ANALYSIS] Offer sent to client {target_sid}.")
    except Exception as e:
        logger.error(f"[ANALYSIS Error] Failed during offer/setLocalDescription for {target_sid}: {e}", exc_info=True)
        await cleanup_analysis_session(target_sid)

@sio.event
async def client_answer_for_analysis(sid, data): # sid is the target client
    target_sid = sid 
    answer_dict = data.get('answer')

    if not answer_dict:
        logger.warning(f"[ANALYSIS] Invalid client_answer_for_analysis data from {target_sid}: {data}")
        await sio.emit('analysis_connection_failed', {'target_sid': target_sid}, room=host_sid)
        return

    pc = analysis_pcs.get(target_sid)
    if not pc:
        logger.warning(f"[ANALYSIS] No PeerConnection found for {target_sid} to set answer.")
        await sio.emit('analysis_connection_failed', {'target_sid': target_sid}, room=host_sid)
        return

    try:
        answer = RTCSessionDescription(sdp=answer_dict['sdp'], type=answer_dict['type'])
        await pc.setRemoteDescription(answer)
        logger.info(f"[ANALYSIS] Remote description (answer) set for {target_sid}.")
    except Exception as e:
        logger.error(f"[ANALYSIS Error] Error setting remote description for {target_sid}: {e}", exc_info=True)
        await sio.emit('analysis_connection_failed', {'target_sid': target_sid}, room=host_sid)
        await cleanup_analysis_session(target_sid)

@sio.event
async def client_ice_candidate_for_analysis(sid, data):
    """
    Handles ICE candidates sent by the client for an analysis peer connection.
    """
    # The 'analysis_target_sid' is the SID of the client *being analyzed*, 
    # which is the one that has the analysis PC on the server and will receive server_ice_candidate_for_analysis.
    # The 'sid' argument of this function is the client *sending* this candidate, 
    # which should be the client being analyzed itself (after it generated a candidate for the analysis PC).
    
    analysis_client_sid = data.get('analysis_target_sid') # This is the client whose stream is being analyzed
                                                       # and for whom the server holds the analysis PC.
    
    # Validate that 'sid' (the sender of this event) is the same as 'analysis_target_sid'
    if sid != analysis_client_sid:
        logger.warning(f"[ANALYSIS ICE] Mismatch: Event sender SID '{sid}' is not the analysis_target_sid '{analysis_client_sid}'. Ignoring.")
        return

    logger.info(f"[ANALYSIS ICE] Received ICE candidate from client {analysis_client_sid} for its analysis session.")

    # Correctly retrieve the RTCPeerConnection instance.
    # Based on start_analysis_request, analysis_pcs[target_sid] *is* the pc.
    pc_analysis = analysis_pcs.get(analysis_client_sid) 
    if not pc_analysis:
        logger.error(f"[ANALYSIS ICE Error] No analysis PC found for analysis_client_sid {analysis_client_sid} when adding ICE candidate.")
        return

    candidate_obj_from_client = data.get('candidate')

    if candidate_obj_from_client is None: # Handles the case where candidate gathering is complete (candidate is null)
        logger.info(f"[ANALYSIS ICE] End of candidates signaled from client {analysis_client_sid} (candidate is null).")
        try:
            await pc_analysis.addIceCandidate(None) # Signal end of candidates to aiortc
        except Exception as e:
            logger.error(f"[ANALYSIS ICE Error] Error adding null ICE candidate for {analysis_client_sid}: {e}", exc_info=True)
        return

    if not isinstance(candidate_obj_from_client, dict):
        logger.warning(f"[ANALYSIS ICE Warning] Received non-dictionary candidate object from client {analysis_client_sid}: {candidate_obj_from_client}")
        return
    
    cand_str = candidate_obj_from_client.get('candidate')
    if not cand_str: # An empty candidate string is invalid for parsing.
        logger.warning(f"[ANALYSIS ICE Warning] 'candidate' string missing or empty in candidate object for {analysis_client_sid}.")
        return

    try:
        logger.debug(f"[ANALYSIS ICE] Parsing candidate string for {analysis_client_sid}: {cand_str}")
        aioice_cand = AIoIceCandidate.from_sdp(cand_str)
        logger.debug(f"[ANALYSIS ICE] Parsed aioice_cand for {analysis_client_sid}: component={aioice_cand.component}, foundation={aioice_cand.foundation}, host={aioice_cand.host}, port={aioice_cand.port}, prio={aioice_cand.priority}, proto={aioice_cand.transport}, type={aioice_cand.type}")

        sdp_m_line_index_val = candidate_obj_from_client.get('sdpMLineIndex')
        parsed_sdp_m_line_index = None
        if sdp_m_line_index_val is not None:
            try:
                parsed_sdp_m_line_index = int(sdp_m_line_index_val)
            except (ValueError, TypeError):
                logger.error(f"[ANALYSIS ICE Error] sdpMLineIndex '{sdp_m_line_index_val}' could not be parsed to int for {analysis_client_sid}. Using None.")
        
        # Ensure all necessary numeric fields from aioice_cand are integers.
        # aioice.Candidate typically stores them as correct types (e.g., port, priority as int).
        # relatedPort is Optional[int].

        rtc_candidate = RTCIceCandidate( # This is the critical instantiation
            component=aioice_cand.component,
            foundation=aioice_cand.foundation,
            ip=aioice_cand.host,
            port=int(aioice_cand.port), # Ensure port is int
            priority=int(aioice_cand.priority), # Ensure priority is int
            protocol=aioice_cand.transport, # Correct: RTCIceCandidate expects 'protocol', aioice.Candidate provides it as 'transport'
            type=aioice_cand.type,
            relatedAddress=aioice_cand.related_address, # Corrected: aioice_cand uses related_address
            relatedPort=int(aioice_cand.related_port) if aioice_cand.related_port is not None else None, # Ensure relatedPort is int or None
            sdpMid=candidate_obj_from_client.get('sdpMid'),
            sdpMLineIndex=parsed_sdp_m_line_index,
            tcpType=aioice_cand.tcptype
        )
        
        logger.info(f"[ANALYSIS ICE] Successfully created RTCIceCandidate for {analysis_client_sid}. Adding to PC.")
        await pc_analysis.addIceCandidate(rtc_candidate)
        logger.info(f"[ANALYSIS ICE] Candidate added to PC for {analysis_client_sid}.")

    except Exception as e:
        logger.error(f"[ANALYSIS ICE Error] Error processing ICE candidate for {analysis_client_sid}: {e}", exc_info=True)
        logger.error(f"[ANALYSIS ICE Debug] Candidate object from client that caused error: {candidate_obj_from_client}")

@sio.event
async def stop_analysis_request(sid, data): # sid is the host requesting stop
    host_sid = sid
    target_sid = data.get('target_sid')
    logger.info(f"[ANALYSIS Stop] Host {host_sid} requested stop for {target_sid}.")
    
    # The task cancellation for consume_video_track will be handled by pc.close() in cleanup.
    # Or, if already ended, cleanup will just proceed.
    await cleanup_analysis_session(target_sid)

async def cleanup_analysis_session(target_sid):
    if target_sid in analysis_sessions_being_cleaned:
        logger.info(f"[ANALYSIS Cleanup] Session for {target_sid} is already being processed for cleanup. Skipping redundant call.")
        return

    analysis_sessions_being_cleaned.add(target_sid)
    logger.info(f"[ANALYSIS Cleanup] Starting cleanup for session {target_sid}.")
    
    pc = None
    monitor_info = None
    final_conclusion = None
    host_sid_for_room = None # This will be the host who initiated this specific analysis

    try:
        pc = analysis_pcs.pop(target_sid, None)
        monitor_info = analysis_monitors.pop(target_sid, None)

        if monitor_info:
            monitor_instance = monitor_info.get('monitor')
            host_sid_for_room = monitor_info.get('host_initiator_sid') # Get the initiating host SID
            if monitor_instance:
                try:
                    final_conclusion = monitor_instance.get_final_conclusion()
                    logger.info(f"[ANALYSIS Cleanup {target_sid}] Generated final conclusion for host {host_sid_for_room}: {final_conclusion}")
                except Exception as e:
                    logger.error(f"[ANALYSIS Cleanup {target_sid}] Error getting final conclusion: {e}", exc_info=True)
                    final_conclusion = {"status_text": "Error generating final report.", "details": {}}
            else:
                logger.warning(f"[ANALYSIS Cleanup {target_sid}] Monitor object missing in monitor_info for host {host_sid_for_room}.")
        else:
            logger.warning(f"[ANALYSIS Cleanup {target_sid}] No analysis monitor_info found. Conclusion cannot be generated.")

        # No need to find host_sid_for_room separately anymore if we got it from monitor_info
        # If host_sid_for_room is still None here, it means monitor_info was missing, which is an issue.
        if not host_sid_for_room and pc: # If we have a PC but no host, log a warning.
             logger.warning(f"[ANALYSIS Cleanup {target_sid}] PC existed but no initiating host SID found. Cannot send conclusion.")

        # Close PC 
        if pc:
            try:
                await pc.close()
                logger.info(f"[ANALYSIS Cleanup] Closed PC for {target_sid}.")
            except Exception as e:
                logger.error(f"[ANALYSIS Cleanup] Error closing PC for {target_sid}: {e}")
                # If PC closing fails, and we haven't formed a conclusion, this is a connection failure.
                if host_sid_for_room and not final_conclusion:
                     await sio.emit('analysis_connection_failed', {'target_sid': target_sid}, room=host_sid_for_room)
                     logger.info(f"[ANALYSIS Cleanup {target_sid}] Notified host {host_sid_for_room} of connection failure due to PC close error.")

        # Notify client being analyzed that it's stopped
        # This should happen regardless of whether a host was found or conclusion generated
        await sio.emit('analysis_stopped_notification', {'target_sid': target_sid}, room=target_sid)
        logger.info(f"[ANALYSIS Cleanup {target_sid}] Sent stopped_notification to target client.")
        
        # Notify host with final conclusion or about the stop/failure
        if host_sid_for_room:
            if final_conclusion:
                await sio.emit('analysis_final_conclusion', 
                               {'analyzed_sid': target_sid, 'conclusion': final_conclusion, 'expected_host_sid': host_sid_for_room},
                               room=host_sid_for_room)
                logger.info(f"[ANALYSIS Cleanup {target_sid}] Sent final conclusion to host {host_sid_for_room}.")
            elif not pc: # If no PC, it means start_analysis_request failed early or already cleaned.
                logger.warning(f"[ANALYSIS Cleanup {target_sid}] No PC found during cleanup, likely already handled or failed early.")
                # Emitting a generic stop, as specific failure might have been sent earlier.
            # else: (if no final_conclusion but PC existed and closed okay, it implies normal stop without specific error)
                # logger.info(f"[ANALYSIS Cleanup {target_sid}] Analysis stopped, no specific error, no conclusion generated (monitor was missing).")
            
            # Always send analysis_stopped_for_host_ui so frontend can update button state correctly.
            await sio.emit('analysis_stopped_for_host_ui', {'target_sid': target_sid, 'expected_host_sid': host_sid_for_room}, room=host_sid_for_room)
            logger.info(f"[ANALYSIS Cleanup {target_sid}] Sent stopped_for_host_ui to host {host_sid_for_room}.")
        else:
            logger.warning(f"[ANALYSIS Cleanup {target_sid}] No host found to send final conclusion or stop UI update.")

    except Exception as e:
        logger.error(f"[ANALYSIS Cleanup {target_sid}] Unexpected error during cleanup: {e}", exc_info=True)
        # Fallback notification to host if an unexpected error occurs mid-cleanup
        if host_sid_for_room:
            try:
                await sio.emit('analysis_stopped_for_host_ui', {'target_sid': target_sid, 'error': True, 'expected_host_sid': host_sid_for_room}, room=host_sid_for_room)
                logger.info(f"[ANALYSIS Cleanup {target_sid}] Sent emergency stopped_for_host_ui due to error to host {host_sid_for_room}.")
            except Exception as e_emit:
                logger.error(f"[ANALYSIS Cleanup {target_sid}] Failed to send emergency stop notification: {e_emit}")
    finally:
        if target_sid in analysis_sessions_being_cleaned: # Ensure it's removed only if added by this call
            analysis_sessions_being_cleaned.discard(target_sid)
        logger.info(f"[ANALYSIS Cleanup] Finished cleanup processing for session {target_sid}.")

# --- Main Server Execution (for running with uvicorn directly) ---
if __name__ == "__main__":
    if not interview_analyzer_module.load_models():
        logger.critical("CRITICAL: Computer vision models failed to load. Analysis features will NOT work.")
    uvicorn.run(app, host="0.0.0.0", port=5001, log_level="info")