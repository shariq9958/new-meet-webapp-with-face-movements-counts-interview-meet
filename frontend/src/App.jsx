import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaPhoneSlash, FaDesktop, FaUsers, FaRegWindowClose,
  FaPaperPlane, FaComments, FaUserCircle,
  FaUserSecret, FaThumbtack,
  FaCopy, FaCheckCircle // Added for copy room ID
} from 'react-icons/fa';
import ChatInput from './ChatInput'; // Ensure ChatInput.jsx exists

const SOCKET_SERVER_URL = 'http://localhost:5001';
const peerConnectionConfig = {
  iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ],
};

function App() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [userName, setUserName] = useState(
    location.state?.userName || `User(${Math.random().toString(36).substring(2,6)})`
  );

  // --- State Variables ---
  const [localStream, setLocalStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStreamForPreview, setScreenStreamForPreview] = useState(null);

  const [socket, setSocket] = useState(null);
  const [mySid, setMySid] = useState(null);
  const [myName, setMyName] = useState(userName);

  const [peerConnections, setPeerConnections] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [pinnedParticipantSid, setPinnedParticipantSid] = useState(null); // Pinning state activated
  const hasJoinedRoomRef = useRef(false);

  // State for locked room / admission control
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [joinRequestMessage, setJoinRequestMessage] = useState('');
  const [pendingJoinRequests, setPendingJoinRequests] = useState([]); // For host
  const [isHost, setIsHost] = useState(false);
  const [roomCreatorSid, setRoomCreatorSid] = useState(null);
  const [roomCopiedMessage, setRoomCopiedMessage] = useState(''); // For copy feedback
  const [meetingEndedMessage, setMeetingEndedMessage] = useState(null); // For end call message

  // For sending video to server for analysis
  const analysisSendPcRef = useRef(null); 
  const [isSendingAnalysisStream, setIsSendingAnalysisStream] = useState(false);

  // Host-specific state for managing analysis
  const [analyzingSids, setAnalyzingSids] = useState({}); // { sid: true/false }
  const [analysisResults, setAnalysisResults] = useState({}); // { sid: { status_text: "..."} }

  const [messages, setMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsPanelOpen, setIsParticipantsPanelOpen] = useState(false);

  // --- Refs ---
  const selfVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const peerConnectionsRef = useRef(peerConnections);
  const chatMessagesContainerRef = useRef(null);
  const socketRef = useRef(null);

  // Add both the state and ref
  const [analysisButtonDisabled, setAnalysisButtonDisabled] = useState({});
  const analysisButtonDisabledRef = useRef({});

  // Add this with other state variables
  const [analysisConnectionState, setAnalysisConnectionState] = useState({});

  // Helper function to format detail keys for display
  const formatDetailKey = (key) => {
    if (!key) return '';
    return key
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/([A-Z]+)/g, ' $1') // Add space before uppercase letter sequences
      .replace(/(\b[a-z](?!\s))/g, (char) => char.toUpperCase()) // Capitalize first letter of each word
      .trim(); // Remove leading/trailing spaces
  };

  useEffect(() => {
    setMyName(location.state?.userName || `User(${mySid?.substring(0,4) || 'anon'})`);
  }, [location.state?.userName, mySid]);

  useEffect(() => {
    peerConnectionsRef.current = peerConnections;
  }, [peerConnections]);

  // Socket Initialization & Core Event Listeners
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => console.log(`[Socket] Connected. Potential SID: ${newSocket.id}`));
    newSocket.on('disconnect', (reason) => {
        console.warn(`[Socket] Disconnected: ${reason}. Cleaning up.`);
        socketRef.current = null;
        setMySid(null); setMyName('');
        Object.values(peerConnectionsRef.current || {}).forEach(pc => pc?.close());
        setPeerConnections({}); setRemoteStreams({}); hasJoinedRoomRef.current = false;
        localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
        screenShareStreamRef.current?.getTracks().forEach(track => track.stop()); screenShareStreamRef.current = null;
        setLocalStream(null); setScreenStreamForPreview(null); setIsScreenSharing(false);
        setMessages([]); setIsChatOpen(false);
        setParticipants([]); setIsParticipantsPanelOpen(false);
        // Clear analysis states on disconnect
        setAnalyzingSids({});
        setAnalysisResults({});
        setAnalysisConnectionState({});
        analysisButtonDisabledRef.current = {};
        setAnalysisButtonDisabled({});
    });
    newSocket.on('connection_success', (data) => { setMySid(data.sid); });
    newSocket.on('new_message', (message) => { setMessages(prev => [...prev, message]); });

    // Admission control listeners
    newSocket.on('waiting_for_approval', (data) => {
      console.log('[Socket Event] Received waiting_for_approval:', data); // Debug log
      setIsWaitingForApproval(true);
      setJoinRequestMessage(data.message || 'Waiting for host approval...');
    });

    newSocket.on('admission_denied', (data) => {
      setIsWaitingForApproval(true); // Keep overlay active to show message
      setJoinRequestMessage(data.message || 'Your request to join was denied.');
      // Consider adding a button here to navigate back or retry
    });

    // Listener for host receiving a join request
    newSocket.on('join_request_received', (requestData) => {
      // Ensure not to add duplicate requests if event fires multiple times for same user
      setPendingJoinRequests(prevRequests => {
        if (!prevRequests.find(req => req.requester_sid === requestData.requester_sid)) {
          return [...prevRequests, requestData];
        }
        return prevRequests;
      });
    });

    // Listener for host after processing a request (to update UI)
    newSocket.on('join_request_processed', (responseData) => {
      setPendingJoinRequests(prevRequests => 
        prevRequests.filter(req => req.requester_sid !== responseData.requester_sid)
      );
    });

    // --- Analysis Stream to Server --- 
    newSocket.on('server_offer_for_analysis', async (data) => {
      console.log('[ANALYSIS] Received server_offer_for_analysis:', data);
      console.log('[ANALYSIS] Current state:', {
        isSendingAnalysisStream,
        hasLocalStream: !!localStreamRef.current,
        mySid,
        targetSid: data.analysis_target_sid,
        localStreamTracks: localStreamRef.current?.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState
        }))
      });

      if (isSendingAnalysisStream || !localStreamRef.current) {
        console.warn('[ANALYSIS] Received offer but already sending or no local stream:', {
          isSendingAnalysisStream,
          hasLocalStream: !!localStreamRef.current
        });
        return;
      }

      try {
        console.log('[ANALYSIS] Creating new RTCPeerConnection for analysis');
        const pc = new RTCPeerConnection({
          ...peerConnectionConfig,
          iceTransportPolicy: 'all', // Try both UDP and TCP
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        });
        analysisSendPcRef.current = pc;

        // Log ICE gathering state changes
        pc.onicegatheringstatechange = () => {
          console.log(`[ANALYSIS] ICE gathering state changed to: ${pc.iceGatheringState}`);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('[ANALYSIS] Generated ICE candidate:', {
              type: event.candidate.type,
              protocol: event.candidate.protocol,
              address: event.candidate.address,
              port: event.candidate.port,
              tcpType: event.candidate.tcpType
            });
            if (socketRef.current && socketRef.current.connected) {
              const currentClientSid = mySid || socketRef.current.id;
              socketRef.current.emit('client_ice_candidate_for_analysis', {
                candidate: event.candidate.toJSON(),
                analysis_target_sid: currentClientSid
              });
            } else {
              console.error('[ANALYSIS] Cannot send ICE candidate: Socket ref is null or not connected.');
            }
          } else {
            console.log('[ANALYSIS] ICE candidate gathering completed');
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log(`[ANALYSIS] ICE connection state changed to: ${pc.iceConnectionState}`);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            console.log('[ANALYSIS] ICE connection established');
            setIsSendingAnalysisStream(true);
          } else if (['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
            console.log('[ANALYSIS] ICE connection failed or closed:', pc.iceConnectionState);
            setIsSendingAnalysisStream(false);
          }
        };

        // Log signaling state changes
        pc.onsignalingstatechange = () => {
          console.log(`[ANALYSIS] Signaling state changed to: ${pc.signalingState}`);
        };

        console.log('[ANALYSIS] Adding video track to PC');
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          console.log('[ANALYSIS] Adding video track:', {
            id: videoTrack.id,
            enabled: videoTrack.enabled,
            readyState: videoTrack.readyState,
            settings: videoTrack.getSettings()
          });
          pc.addTrack(videoTrack, localStreamRef.current);
        } else {
          console.warn('[ANALYSIS] No video track found in local stream');
        }

        console.log('[ANALYSIS] Setting remote description');
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('[ANALYSIS] Creating answer');
        const answer = await pc.createAnswer();
        console.log('[ANALYSIS] Setting local description');
        await pc.setLocalDescription(answer);

        console.log('[ANALYSIS] Socket object before emitting answer:', socketRef.current);
        if (socketRef.current && socketRef.current.connected) {
          console.log('[ANALYSIS] Sending answer to server');
          const currentClientSid = mySid || socketRef.current.id;
          socketRef.current.emit('client_answer_for_analysis', {
            answer: pc.localDescription.toJSON(),
            analysis_target_sid: currentClientSid
          });
        } else {
          console.error('[ANALYSIS] Cannot send answer: Socket ref is null or not connected.', {socketRefExists: !!socketRef.current, connected: socketRef.current?.connected });
        }

      } catch (error) {
        console.error('[ANALYSIS] Error handling server offer:', error);
        if(analysisSendPcRef.current) {
          console.log('[ANALYSIS] Cleaning up failed PC');
          analysisSendPcRef.current.close();
          analysisSendPcRef.current = null;
        }
        setIsSendingAnalysisStream(false);
      }
    });

    newSocket.on('server_ice_candidate_for_analysis', async (data) => {
      if (analysisSendPcRef.current && data.candidate) {
        try {
          const candidate = new RTCIceCandidate(data.candidate);
          await analysisSendPcRef.current.addIceCandidate(candidate);
          console.log('[ANALYSIS] Added server ICE candidate to client send PC');
        } catch (error) {
          console.error('[ANALYSIS] Error adding server ICE candidate:', error);
        }
      }
    });

    newSocket.on('analysis_stopped_notification', (data) => {
      if (data.target_sid === mySid && analysisSendPcRef.current) {
        console.log('[ANALYSIS] Received stop notification from server. Closing send PC.');
        analysisSendPcRef.current.close();
        analysisSendPcRef.current = null;
        setIsSendingAnalysisStream(false);
      }
    });

    // Listener for when the host leaves abruptly
    newSocket.on('host_left_abruptly', (data) => {
      if (data.room_id === roomId) { // Ensure it's for the current room
        console.log(`[Socket Event] Host left abruptly for room: ${data.room_id}. Message: ${data.message}`);
        performLocalCleanupAndRedirect(data.message || "The host has disconnected. The meeting will now end.");
      }
    });

    // --- Host listeners for analysis updates ---
    // Removed 'analysis_update' listener

    // New listener for the final conclusion
    newSocket.on('analysis_final_conclusion', (data) => {
      // Check if the current socket ID matches the host SID that initiated this specific analysis
      if (socketRef.current && data.expected_host_sid === socketRef.current.id) {
        console.log('[ANALYSIS] Received final conclusion for', data.analyzed_sid, ' (expected_host_sid matched current SID). Conclusion:', data.conclusion);
        setAnalysisResults(prevResults => ({
          ...prevResults,
          [data.analyzed_sid]: data.conclusion
        }));
        setAnalyzingSids(prev => {
          const updated = {...prev};
          delete updated[data.analyzed_sid]; 
          return updated;
        });
        analysisButtonDisabledRef.current[data.analyzed_sid] = false;
        setAnalysisButtonDisabled(prev => ({ ...prev, [data.analyzed_sid]: false }));
        setAnalysisConnectionState(prev => ({ ...prev, [data.analyzed_sid]: 'concluded' }));
      } else {
        console.warn('[ANALYSIS] Received final_conclusion. Expected host SID:', data.expected_host_sid, 'Current socket ID:', socketRef.current?.id, 'isHost state:', isHost, 'Data:', data);
      }
    });

    newSocket.on('analysis_stopped_for_host_ui', (data) => {
      // Check if the current socket ID matches the host SID that initiated this specific analysis session
      if (socketRef.current && data.expected_host_sid === socketRef.current.id) {
        console.log('[ANALYSIS] Received analysis_stopped_for_host_ui for target:', data.target_sid, ' (expected_host_sid matched current SID)');
        setAnalyzingSids(prev => {
          const updated = {...prev};
          delete updated[data.target_sid];
          return updated;
        });
        analysisButtonDisabledRef.current[data.target_sid] = false;
        setAnalysisButtonDisabled(prev => ({ ...prev, [data.target_sid]: false }));
        setAnalysisConnectionState(prev => {
            if (prev[data.target_sid] !== 'concluded') {
                return { ...prev, [data.target_sid]: data.error ? 'failed' : 'stopped_remotely' };
            }
            return prev;
        });
      } else {
        console.warn('[ANALYSIS] Received analysis_stopped_for_host_ui. Expected host SID:', data.expected_host_sid, 'Current socket ID:', socketRef.current?.id, 'isHost state:', isHost, 'Data:', data);
      }
    });

    const updateParticipantList = (allParticipantsData) => {
        console.log("[Participants] Received updated list:", allParticipantsData);
        setParticipants(allParticipantsData || []);
    };
    newSocket.on('user_left', (data) => {
        if (data.allParticipants) updateParticipantList(data.allParticipants);
        else setParticipants(prev => prev.filter(p => p.id !== data.sid));
        if (pinnedParticipantSid === data.sid) setPinnedParticipantSid(null); // Unpin if pinned user leaves
        
        const userWhoLeftSid = data.sid;
        
        const pcToClose = peerConnectionsRef.current[userWhoLeftSid];
        if (pcToClose) { pcToClose.close(); setPeerConnections(prev => { const u = { ...prev }; delete u[userWhoLeftSid]; return u; });}
        setRemoteStreams(prev => { const u = { ...prev }; delete u[userWhoLeftSid]; return u; });

        // Clean up analysis states for the user who left
        if (isHost) {
          setAnalyzingSids(prev => { const updated = {...prev}; delete updated[userWhoLeftSid]; return updated; });
          setAnalysisResults(prev => { const updated = {...prev}; delete updated[userWhoLeftSid]; return updated; });
          setAnalysisConnectionState(prev => { const updated = {...prev}; delete updated[userWhoLeftSid]; return updated; });
          if (analysisButtonDisabledRef.current[userWhoLeftSid]) {
            delete analysisButtonDisabledRef.current[userWhoLeftSid];
            setAnalysisButtonDisabled(prev => { const u = {...prev}; delete u[userWhoLeftSid]; return u; });
          }
        }
    });
    newSocket.on('new_user_joined', (data) => {
        if (data.allParticipants) updateParticipantList(data.allParticipants);
    });

    // Update the socket event handlers for analysis
    newSocket.on('analysis_connection_established', (data) => {
      console.log('[ANALYSIS] Connection established for:', data.target_sid);
      setAnalysisConnectionState(prev => ({
        ...prev,
        [data.target_sid]: 'connected'
      }));
      // Re-enable button only after connection is established
      analysisButtonDisabledRef.current[data.target_sid] = false;
      setAnalysisButtonDisabled(prev => ({ ...prev, [data.target_sid]: false }));
    });

    newSocket.on('analysis_connection_failed', (data) => {
      console.log('[ANALYSIS] Connection failed for:', data.target_sid);
      setAnalysisConnectionState(prev => ({
        ...prev,
        [data.target_sid]: 'failed'
      }));
      // Re-enable button if connection fails
      analysisButtonDisabledRef.current[data.target_sid] = false;
      setAnalysisButtonDisabled(prev => ({ ...prev, [data.target_sid]: false }));
      // Clear analyzing state because the connection attempt failed
      setAnalyzingSids(prev => {
        const updated = {...prev};
        delete updated[data.target_sid];
        return updated;
      });
      // Do not clear results here, as failure might happen after a conclusion was shown.
      // Or, if a conclusion was never reached, results would be empty anyway.
    });

    // New socket event listener for 'meeting_ended_by_host'
    newSocket.on('meeting_ended_by_host', (data) => {
      console.log(`[Socket Event] Meeting ended by host for room: ${data.room_id}`);
      // Ensure this client is not the host themselves triggering this flow redundantly
      if (!isHost) { 
        performLocalCleanupAndRedirect("The host has ended the meeting. Redirecting...");
      }
    });

    return () => {
        newSocket.off('new_message'); newSocket.off('user_left'); newSocket.off('new_user_joined');
        newSocket.off('analysis_connection_established');
        newSocket.off('analysis_connection_failed');
        newSocket.off('meeting_ended_by_host');
        // Removed 'analysis_update' from cleanup
        newSocket.off('analysis_final_conclusion'); // Add new event to cleanup
        newSocket.off('analysis_stopped_for_host_ui');
        newSocket.off('connection_success');
        newSocket.off('waiting_for_approval');
        newSocket.off('admission_denied');
        newSocket.off('join_request_received');
        newSocket.off('join_request_processed');
        newSocket.off('server_offer_for_analysis');
        newSocket.off('server_ice_candidate_for_analysis');
        newSocket.off('analysis_stopped_notification');
        newSocket.off('host_left_abruptly'); // Add to cleanup

        if (newSocket) newSocket.disconnect();
        socketRef.current = null;
     };
  }, []);

  // Chat scroll effect
  useEffect(() => {
    if (chatMessagesContainerRef.current) {
      chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
    }
  }, [messages]); // Run only when messages change

  // Media Effect (Default OFF)
  useEffect(() => {
    let isMounted = true;
    const startLocalMedia = async () => {
      if (isScreenSharing || localStreamRef.current) {
        if (localStreamRef.current && !isScreenSharing && isMounted) {
           setLocalStream(localStreamRef.current);
           setIsMicOn(localStreamRef.current.getAudioTracks()[0]?.enabled ?? false);
           setIsVideoOn(localStreamRef.current.getVideoTracks()[0]?.enabled ?? false);
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (isMounted) {
          stream.getVideoTracks().forEach(track => { track.enabled = false; });
          stream.getAudioTracks().forEach(track => { track.enabled = false; });
          localStreamRef.current = stream; setLocalStream(stream);
          setIsMicOn(false); setIsVideoOn(false);
        } else { stream.getTracks().forEach(track => track.stop()); }
      } catch (error) { console.error('[Media Effect] Error getting camera/mic:', error); }
    };
    startLocalMedia();
    return () => { isMounted = false; };
  }, [isScreenSharing]);

  // WebRTC Effect
  useEffect(() => {
    // This effect should only run when its core dependencies change
    if (!socket || !localStream || !mySid || !myName || !roomId || !socket.connected) return;
    let isEffectMounted = true;
    
    // --- WebRTC Core Logic (getOrCreatePcForUser, handleRoomJoined, Offer, Answer, Candidate) ---
    if (!hasJoinedRoomRef.current) {
      // Get create_locked_room flag from location state, default to false
      const shouldCreateLocked = location.state?.create_locked_room || false;
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('join_room', { 
          room_id: roomId, 
          userName: myName,
          create_locked_room: shouldCreateLocked
        });
      }
      if (isEffectMounted) hasJoinedRoomRef.current = true;
    }
    const getOrCreatePcForUser = (targetSid) => {
        if (peerConnectionsRef.current[targetSid]) return peerConnectionsRef.current[targetSid];
        const newPc = new RTCPeerConnection(peerConnectionConfig);
        newPc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current && socketRef.current.connected && isEffectMounted) {
            socketRef.current.emit('candidate', { room_id: roomId, target_sid: targetSid, candidate: event.candidate });
            }
        };
        newPc.oniceconnectionstatechange = () => {
            if (!isEffectMounted) return;
            if (['failed', 'disconnected', 'closed'].includes(newPc.iceConnectionState)) {
            if (isEffectMounted) {
                newPc.close();
                setPeerConnections(prev => { const u = { ...prev }; delete u[targetSid]; return u; });
                setRemoteStreams(prev => { const u = { ...prev }; delete u[targetSid]; return u; });
            }
            }
        };
        newPc.ontrack = (event) => {
            if (isEffectMounted) setRemoteStreams(prev => ({ ...prev, [targetSid]: event.streams[0] }));
        };
        if (localStream) {
            localStream.getTracks().forEach(track => {
            try { newPc.addTrack(track, localStream); } catch (e) { console.error(`AddTrack Error for ${targetSid}:`, e); }
            });
        }
        if (isEffectMounted) setPeerConnections(prev => ({ ...prev, [targetSid]: newPc }));
        return newPc;
    };
    const handleRoomJoined = async (data) => {
      if (!isEffectMounted || data.room_id !== roomId ) return; // Simpler check
      // If this client is the one who just got approved or joined normally
      if (data.sid === mySid || data.sid === undefined) { // data.sid might be undefined if it's a general room_joined after self-join
        setMyName(data.name || myName); // Use existing myName if data.name is not present
        setRoomCreatorSid(data.creator_sid); // Expect creator_sid from backend
        if (mySid && data.creator_sid === mySid) {
          setIsHost(true);
          console.log('[isHost Check] Set isHost to TRUE. mySid:', mySid, 'creator_sid:', data.creator_sid);
        } else {
          setIsHost(false);
          console.log('[isHost Check] Set isHost to FALSE. mySid:', mySid, 'creator_sid:', data.creator_sid, 'Expected mySid to be defined and match creator_sid.');
        }
        setIsWaitingForApproval(false); // Clear waiting state if joined/approved
      }

      if (data.allParticipants) setParticipants(data.allParticipants);
      
      // For the user who just joined/got approved and needs to connect to others
      if ((data.sid === mySid || data.sid === undefined) && data.otherParticipants) { 
      data.otherParticipants?.forEach(async (participant) => {
        const otherUserSid = participant.id;
        if (otherUserSid === mySid) return;
        const pc = getOrCreatePcForUser(otherUserSid);
        if (pc && pc.signalingState === 'stable') {
          try {
            const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
              if (isEffectMounted && socketRef.current && socketRef.current.connected) socketRef.current.emit('offer', { room_id: roomId, target_sid: otherUserSid, offer_sdp: pc.localDescription });
          } catch (err) { console.error(`Offer Error for ${otherUserSid}:`, err); }
        }
      });
      }
    };
    const handleOffer = async (data) => {
      console.log(`[WebRTC] Received offer from ${data.from_sid}`);
      if (!isEffectMounted || data.room_id !== roomId || data.from_sid === mySid) return;
      
      const fromSid = data.from_sid;
      console.log(`[WebRTC] Creating/getting peer connection for offer from ${fromSid}`);
      const pc = getOrCreatePcForUser(fromSid);
      if (!pc) {
        console.error(`[WebRTC] No peer connection for ${fromSid}`);
        return;
      }
      
      try {
        console.log(`[WebRTC] Setting remote description from offer by ${fromSid}`);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer_sdp));
        
        console.log(`[WebRTC] Creating answer for ${fromSid}`);
        const answer = await pc.createAnswer();
        
        console.log(`[WebRTC] Setting local description (answer) for ${fromSid}`);
        await pc.setLocalDescription(answer);
        
        if (isEffectMounted && socketRef.current && socketRef.current.connected) {
          console.log(`[WebRTC] Sending answer to ${fromSid}`);
          socketRef.current.emit('answer', { 
            room_id: roomId, 
            target_sid: fromSid, 
            answer_sdp: pc.localDescription 
          });
        }
      } catch (err) { 
        console.error(`[WebRTC] Handle Offer Error for ${fromSid}:`, err);
      }
    };
    
    const handleAnswer = async (data) => {
      console.log(`[WebRTC] Received answer from ${data.from_sid}`);
      if (!isEffectMounted || data.room_id !== roomId || data.from_sid === mySid) return;
      
      const fromSid = data.from_sid;
      const pc = peerConnectionsRef.current[fromSid];
      
      if (pc) {
        try {
          console.log(`[WebRTC] Setting remote description from answer by ${fromSid}`);
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer_sdp));
          console.log(`[WebRTC] Connection with ${fromSid} established successfully`);
        } catch (err) {
          console.error(`[WebRTC] Handle Answer Error for ${fromSid}:`, err);
        }
      } else {
        console.warn(`[WebRTC] Received answer from ${fromSid} but no PC exists`);
      }
    };
    
    const handleCandidate = async (data) => {
      if (!isEffectMounted || data.room_id !== roomId || data.from_sid === mySid) return;
      
      const fromSid = data.from_sid;
      console.log(`[WebRTC] Received ICE candidate from ${fromSid}`);
      
      const pc = peerConnectionsRef.current[fromSid];
      if (pc && data.candidate) {
        try {
          console.log(`[WebRTC] Adding ICE candidate from ${fromSid}`);
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error(`[WebRTC] Add ICE Candidate Error from ${fromSid}:`, e);
        }
      } else {
        console.warn(`[WebRTC] Cannot add ICE candidate from ${fromSid} - PC: ${!!pc}, candidate: ${!!data.candidate}`);
      }
    };

    socketRef.current.on('room_joined', handleRoomJoined);
    // New: admission_approved event should trigger similar logic to room_joined for the approved user.
    socketRef.current.on('admission_approved', (data) => {
      console.log("[Admission] Approved! Data:", data);
      // Essentially, treat this like a room_joined event for the approved client
      handleRoomJoined(data); 
    });
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('candidate', handleCandidate);
    return () => {
      isEffectMounted = false;
      // Check if socketRef.current exists before calling .off()
      if (socketRef.current) {
        socketRef.current.off('room_joined', handleRoomJoined);
        socketRef.current.off('admission_approved', handleRoomJoined); // Ensure this is also cleaned up
        socketRef.current.off('offer', handleOffer);
        socketRef.current.off('answer', handleAnswer);
        socketRef.current.off('candidate', handleCandidate);
      }
    };
  }, [socket, localStream, mySid, myName, roomId]); // Core dependencies for WebRTC logic


  // Media Control Functions
  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
      if (isScreenSharing && localStream) {
        const activeAudioTrack = localStream.getAudioTracks().find(t => t.id === audioTrack.id);
        if (activeAudioTrack) activeAudioTrack.enabled = audioTrack.enabled;
      }
    }
  };
  const toggleVideo = async () => {
    // If screen sharing is active, this button should stop screen sharing first.
    if (isScreenSharing) {
      await stopScreenShare();
      // After stopScreenShare, isScreenSharing state is false.
      // We want to ensure the camera turns ON.
      if (localStreamRef.current) {
        const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (cameraVideoTrack) {
          if (!cameraVideoTrack.enabled) {
            cameraVideoTrack.enabled = true; // Enable the track
          }
          // Ensure UI state reflects camera is on
          if (!isVideoOn) { 
            setIsVideoOn(true);
          }
        } else {
          console.warn("[toggleVideo] No camera track in localStreamRef after stopping screen share. Video will remain off.");
          if (isVideoOn) { // If UI thought video was on, correct it
            setIsVideoOn(false);
          }
        }
      } else {
        console.warn("[toggleVideo] localStreamRef.current is null after stopping screen share. Video will remain off.");
        if (isVideoOn) { // If UI thought video was on, correct it
          setIsVideoOn(false);
        }
      }
      return;
    }

    if (!localStreamRef.current) {
      console.warn("[toggleVideo] No local stream available.");
      return;
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
      console.log(`[toggleVideo] Video track ${videoTrack.id} enabled: ${videoTrack.enabled}`);
      // No replaceTrackForPeers call here for simple mute/unmute.
      // The enabled state change should be signaled to peers automatically.
    } else {
      console.warn("[toggleVideo] No video track found in local stream.");
    }
  };
  const replaceTrackForPeers = async (newTrack, kind) => {
    for (const peerSid in peerConnectionsRef.current) {
        const pc = peerConnectionsRef.current[peerSid];
        const sender = pc.getSenders().find(s => s.track?.kind === kind);
        if (sender) {
            try { await sender.replaceTrack(newTrack); }
            catch (error) { console.error(`ReplaceTrack Error for ${peerSid} (${kind}):`, error); }
        } else if (newTrack && localStream) {
            try { pc.addTrack(newTrack, localStream); }
            catch (e) { console.error(`AddTrack during replace error for ${peerSid} (${kind}):`, e); }
        }
    }
  };
  const startScreenShare = async () => {
    if (!localStreamRef.current) { return; }
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenVideoTrack = displayStream.getVideoTracks()[0];
      if (!screenVideoTrack) { return; }
      screenShareStreamRef.current = displayStream;
      const compositeStream = new MediaStream([screenVideoTrack]);
      const micAudioTrack = localStreamRef.current.getAudioTracks()[0];
      if (micAudioTrack) {
          compositeStream.addTrack(micAudioTrack);
          micAudioTrack.enabled = isMicOn;
      }
      setLocalStream(compositeStream);
      setScreenStreamForPreview(displayStream);
      setIsScreenSharing(true); setIsVideoOn(true);
      await replaceTrackForPeers(screenVideoTrack, 'video');
      screenVideoTrack.onended = () => stopScreenShare();
    } catch (err) { console.error("Error starting screen share:", err); setIsScreenSharing(false); }
  };
  const stopScreenShare = async () => {
    screenShareStreamRef.current?.getTracks().forEach(track => track.stop());
    screenShareStreamRef.current = null;
    setScreenStreamForPreview(null);
    setLocalStream(localStreamRef.current); // Revert to camera/mic stream
    const cameraVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    await replaceTrackForPeers(cameraVideoTrack?.enabled ? cameraVideoTrack : null, 'video');
    setIsVideoOn(cameraVideoTrack?.enabled ?? false);
    setIsScreenSharing(false);
  };
  const handleShare = () => { if (!isScreenSharing) startScreenShare(); else stopScreenShare(); };

  // New helper function for cleanup
  const performLocalCleanupAndRedirect = (customMessage) => {
    setMeetingEndedMessage(customMessage || "The meeting has ended. Redirecting...");

    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    screenShareStreamRef.current?.getTracks().forEach(track => track.stop());
    screenShareStreamRef.current = null;
    
    setLocalStream(null);
    setScreenStreamForPreview(null);
    setIsScreenSharing(false);
    setIsMicOn(false);
    setIsVideoOn(false);

    // Close all peer connections
    Object.values(peerConnectionsRef.current || {}).forEach(pc => pc?.close());
    setPeerConnections({});
    setRemoteStreams({});
    
    // Clear other states
    setParticipants([]);
    setPinnedParticipantSid(null);
    setMessages([]);
    setIsChatOpen(false);
    setIsParticipantsPanelOpen(false);
    setIsWaitingForApproval(false);
    setJoinRequestMessage('');
    setPendingJoinRequests([]);
    // isHost and roomCreatorSid will be reset naturally on next join or if app is reloaded
    // setRoomCopiedMessage(''); // This is minor, can be left or cleared
    hasJoinedRoomRef.current = false;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setTimeout(() => {
    navigate('/');
      setMeetingEndedMessage(null); 
    }, 2500); 
  };

  const handleEndCall = () => {
    if (isHost && socketRef.current && socketRef.current.connected) {
      console.log("[EndCall] Host is ending the meeting for everyone.");
      socketRef.current.emit('host_ended_meeting_request', { room_id: roomId });
      performLocalCleanupAndRedirect("You have ended the meeting for all participants. Redirecting...");
    } else {
      console.log("[EndCall] Participant is leaving the meeting.");
      performLocalCleanupAndRedirect("You have left the meeting. Redirecting...");
    }
  };

  // Panel Toggles & Chat
  const handleToggleChat = () => { setIsChatOpen(prev => !prev); if (!isChatOpen && isParticipantsPanelOpen) setIsParticipantsPanelOpen(false); };
  const handleToggleParticipantsPanel = () => { setIsParticipantsPanelOpen(prev => !prev); if (!isParticipantsPanelOpen && isChatOpen) setIsChatOpen(false); };
  const handleSendMessage = (messageText) => {
    if (messageText && socketRef.current && socketRef.current.connected && mySid && roomId) {
      socketRef.current.emit('send_message', { room_id: roomId, message_text: messageText });
    }
  };
  const formatTimestamp = (timestamp) => !timestamp ? '' : new Date(timestamp * 1000).toLocaleTimeString([],{ hour: '2-digit', minute: '2-digit' });
  const handlePinParticipant = (sidToPin) => {
    setPinnedParticipantSid(prevSid => (prevSid === sidToPin ? null : sidToPin));
  };

  const handleCopyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId)
        .then(() => {
          setRoomCopiedMessage('Room ID Copied!');
          setTimeout(() => setRoomCopiedMessage(''), 2000); // Clear message after 2s
        })
        .catch(err => {
          console.error('Failed to copy Room ID: ', err);
          setRoomCopiedMessage('Failed to copy!');
          setTimeout(() => setRoomCopiedMessage(''), 2000);
        });
    }
  };

  const handleAdmissionRequest = (requesterSid, room, decision) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('admission_decision', { 
        room_id: room, 
        requester_sid: requesterSid,
        decision: decision
      });
    }
  };

  // --- Analysis Control Functions (Host) ---
  const requestStartAnalysis = (targetSid) => {
    console.log(`[ANALYSIS Start] Host requesting to start analysis for: ${targetSid}`);
    console.log(`[ANALYSIS Start] Current analyzingSids state:`, analyzingSids);
    console.log(`[ANALYSIS Start] Button disabled state:`, analysisButtonDisabledRef.current[targetSid]);
    
    if (socketRef.current && socketRef.current.connected && isHost && mySid) {
      socketRef.current.emit('start_analysis_request', { 
        target_sid: targetSid,
        requesting_host_sid: mySid
      });
      setAnalyzingSids(prev => {
        console.log(`[ANALYSIS Start] Updating analyzingSids for ${targetSid}`);
        return { ...prev, [targetSid]: true };
      });
    }
  };

  const requestStopAnalysis = (targetSid) => {
    console.log(`[ANALYSIS Stop] Host requesting to stop analysis for: ${targetSid}`);
    console.log(`[ANALYSIS Stop] Current analyzingSids state:`, analyzingSids);
    console.log(`[ANALYSIS Stop] Button disabled state:`, analysisButtonDisabledRef.current[targetSid]);
    
    if (socketRef.current && socketRef.current.connected && isHost) {
      socketRef.current.emit('stop_analysis_request', { target_sid: targetSid });
      // setAnalyzingSids is now handled by 'analysis_final_conclusion' or 'analysis_stopped_for_host_ui'
      // Do NOT clear analysisResults here. The backend will send a final conclusion,
      // or 'analysis_stopped_for_host_ui' will be received if it stops without conclusion.
    }
  };

  // Effect to update self-view video source
  useEffect(() => {
    let sourceToUse = null;
    if (isScreenSharing && screenStreamForPreview) {
      sourceToUse = screenStreamForPreview;
    } else if (localStreamRef.current) {
      sourceToUse = localStreamRef.current;
    }
    if (selfVideoRef.current && selfVideoRef.current.srcObject !== sourceToUse) {
      selfVideoRef.current.srcObject = sourceToUse;
    }
  }, [isScreenSharing, screenStreamForPreview, localStreamRef.current]); // isVideoOn removed as placeholder handles visual state

  const remoteParticipants = participants.filter(p => p.id !== mySid);
  let pinnedParticipant = null;
  let galleryParticipants = remoteParticipants;

  if (pinnedParticipantSid) {
    pinnedParticipant = remoteParticipants.find(p => p.id === pinnedParticipantSid);
    if (pinnedParticipant) {
      galleryParticipants = remoteParticipants.filter(p => p.id !== pinnedParticipantSid);
    } else {
      // Pinned participant left or ID is invalid, clear pinning.
      // This case should ideally be handled by the user_left socket event clearing pinnedParticipantSid
      // but as a fallback:
      // setPinnedParticipantSid(null); // Avoid calling setState in render logic directly
      // For now, we rely on the user_left handler. If pinnedParticipant is null, layout defaults to gallery.
    }
  }

  const numGalleryParticipants = galleryParticipants.length;
  // Defines the class for the video-area container in gallery mode (e.g., participant-count-1)
  const videoAreaLayoutClass = `participant-count-${numGalleryParticipants > 6 ? 'many' : numGalleryParticipants}`;
  // Defines the class for individual items within the gallery (e.g., stream-count-1)
  const galleryItemSizingClass = `stream-count-${numGalleryParticipants > 6 ? 'many' : numGalleryParticipants}`;


  // Updated renderParticipantVideo function
  const renderParticipantVideo = (participant, isPinnedView = false, isSelf = false) => {
    const streamToUse = isSelf ? 
                       (isScreenSharing ? screenStreamForPreview : localStreamRef.current) :
                       (participant ? remoteStreams[participant.id] : null);
    
    const nameToDisplay = isSelf ? 
                          (myName || 'You') :
                          (participant ? (participant.name || `User (${participant.id.substring(0,4)})`) : '');

    let videoLabel = nameToDisplay;
    if (isSelf) {
      videoLabel = `${nameToDisplay}${isScreenSharing ? " (Screen)" : (isVideoOn ? "" : " (Cam Off)")}`;
    }
    // For remote, we update placeholderText instead of videoLabel for this specific case.

    const videoRef = isSelf ? selfVideoRef : (el => { 
      if (el && streamToUse && el.srcObject !== streamToUse) el.srcObject = streamToUse;
      else if (el && !streamToUse && el.srcObject) el.srcObject = null; 
    });
    
    let showPlaceholder = false;
    let PlaceholderIcon = FaUserCircle; 
    let placeholderText = nameToDisplay;

    if (isSelf) {
      showPlaceholder = (!isVideoOn && !isScreenSharing && localStreamRef.current);
      PlaceholderIcon = FaUserSecret;
      // placeholderText is already nameToDisplay which is correct for self.
    } else if (participant) { // For remote participants
      const remoteVideoTrack = streamToUse?.getVideoTracks()[0];
      
      if (!streamToUse || !remoteVideoTrack) {
        // No stream or no video track at all
        showPlaceholder = true;
      } else if (remoteVideoTrack.muted === true) {
        // Track exists but is muted (e.g. sender disabled it, or network issues)
        showPlaceholder = true;
        placeholderText = `${nameToDisplay} (Camera Off)`; // Or some other indicator
      } else if (remoteVideoTrack.readyState === 'ended'){
        // Track exists but has ended
        showPlaceholder = true;
        placeholderText = `${nameToDisplay} (Video Ended)`;
      }
      // If showPlaceholder is still false here, it means we have a live, unmuted video track.
    }

    const wrapperClass = isSelf ? "self-view-wrapper" : `participant-view-wrapper ${!isPinnedView ? galleryItemSizingClass : ''}`;
    const containerClass = isSelf ? "self-view-container" : "participant-view-container";
    const videoElementClass = isSelf ? "self-view" : "participant-view";
    
    return (
      <div key={isSelf ? 'self-view' : (participant ? participant.id : 'empty-slot')} className={`video-item-wrapper ${wrapperClass}`}>
        <div className={`video-container ${containerClass}`}>
          {showPlaceholder || !streamToUse ? ( // Added !streamToUse here for robustness
            <div className={`video-element ${videoElementClass} camera-off-placeholder`}>
              <PlaceholderIcon />
              <p>{placeholderText}</p> {/* This will now show the name / status */}
            </div>
          ) : (
            <video
              ref={videoRef}
              className={`video-element ${videoElementClass}`}
              autoPlay
              playsInline
              muted={isSelf} 
            />
          )}
          {!isSelf && participant && ( 
            <button
              onClick={() => handlePinParticipant(participant.id)}
              className={`pin-button ${pinnedParticipantSid === participant.id ? 'pinned' : ''}`}
              aria-label={pinnedParticipantSid === participant.id ? 'Unpin participant' : 'Pin participant'}
              title={pinnedParticipantSid === participant.id ? 'Unpin participant' : 'Pin participant'}
            >
              <FaThumbtack />
            </button>
          )}
        </div>
        <p className="video-label below-video">{isSelf ? videoLabel : nameToDisplay}</p> {/* Simpler label for remote here */}
      </div>
    );
  };


  // Console log to check panel state and data
  useEffect(() => {
    if (isChatOpen) {
        console.log("Chat panel open. Messages:", messages);
    }
    if (isParticipantsPanelOpen) {
        console.log("Participants panel open. Participants:", participants);
    }
  }, [isChatOpen, isParticipantsPanelOpen, messages, participants]);

  // Replace the debounceAnalysisAction function
  const debounceAnalysisAction = (action, targetSid) => {
    console.log(`[ANALYSIS Debounce] Attempting ${action === requestStartAnalysis ? 'start' : 'stop'} for ${targetSid}`);
    console.log(`[ANALYSIS Debounce] Button disabled state:`, analysisButtonDisabledRef.current[targetSid]);
    console.log(`[ANALYSIS Debounce] Connection state:`, analysisConnectionState[targetSid]);
    
    if (analysisButtonDisabledRef.current[targetSid]) {
      console.log(`[ANALYSIS Debounce] Action blocked - button is disabled for ${targetSid}`);
      return;
    }
    
    console.log(`[ANALYSIS Debounce] Setting button disabled for ${targetSid}`);
    analysisButtonDisabledRef.current[targetSid] = true;
    setAnalysisButtonDisabled(prev => ({ ...prev, [targetSid]: true }));
    
    // For stop action, we can re-enable after 2 seconds
    if (action === requestStopAnalysis) {
      console.log(`[ANALYSIS Debounce] Scheduling re-enable for stop action in 2s`);
      setTimeout(() => {
        console.log(`[ANALYSIS Debounce] Re-enabling button after stop`);
        analysisButtonDisabledRef.current[targetSid] = false;
        setAnalysisButtonDisabled(prev => ({ ...prev, [targetSid]: false }));
      }, 2000);
    }
    
    console.log(`[ANALYSIS Debounce] Executing action for ${targetSid}`);
    action(targetSid);
  };

  return (
    <div className="app-container">
      {isWaitingForApproval && (
        <div className="waiting-approval-overlay">
          <h2>{joinRequestMessage}</h2>
          {joinRequestMessage.toLowerCase().includes("denied") && (
            <button onClick={() => navigate('/')} className="control-button">
              Back to Join Page
            </button>
          )}
        </div>
      )}

      {meetingEndedMessage && (
        <div className="meeting-ended-overlay">
          <h2>{meetingEndedMessage}</h2>
        </div>
      )}

      <main className={`meeting-view ${isChatOpen || isParticipantsPanelOpen ? 'panel-is-open' : ''}`}>
        <div className={`video-area ${pinnedParticipant ? 'pinned-active' : videoAreaLayoutClass}`}>
          {pinnedParticipant ? (
            <>
              {/* Pinned Participant Stage */}
              <div className="pinned-video-stage">
                {renderParticipantVideo(pinnedParticipant, true)}
              </div>

              {/* Thumbnail Gallery (Self-view + Other Remote Participants) */}
              <div className="thumbnail-gallery">
                {renderParticipantVideo(null, false, true)} {/* Self View */}
                {galleryParticipants.map(p => renderParticipantVideo(p, false))}
              </div>
            </>
          ) : (
            <>
              {/* ---- Original Gallery Layout ---- */}
              {/* Self Video Item Wrapper (absolutely positioned in CSS by default) */}
              {renderParticipantVideo(null, false, true)}

              {/* Remote Participants Gallery */}
              {galleryParticipants.map(p => renderParticipantVideo(p, false))}

              {/* Placeholder when no remote participants and local stream exists */}
              {numGalleryParticipants === 0 && localStreamRef.current && (
                <div className="main-participant-placeholder-wrapper">
                  <div className="video-placeholder main-participant-placeholder">Waiting for others to join...</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Panels - Apply 'is-active' class based on state */}
        <div className={`chat-panel side-panel ${isChatOpen ? 'is-active' : ''}`}>
            <div className="panel-header">
                <h3>Room Chat</h3>
                <button onClick={handleToggleChat} className="panel-close-button" aria-label="Close Chat">
                    <FaRegWindowClose />
                </button>
            </div>
            {/* IMPORTANT: Ensure this container has flex-grow and overflow */}
            <div className="chat-messages-container" ref={chatMessagesContainerRef}>
                {messages.length === 0 && <p className="no-messages">No messages yet.</p>}
                {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message-wrapper ${msg.sender_sid === mySid ? 'my-message-wrapper' : (msg.type === 'system' ? 'system-message-wrapper' : 'other-message-wrapper')}`}>
                        <div className={`chat-message ${msg.sender_sid === mySid ? 'my-message' : (msg.type === 'system' ? 'system-message' : 'other-message')}`}>
                            <span className="message-sender">{msg.type === 'system' ? msg.sender_name : (msg.sender_sid === mySid ? 'You' : msg.sender_name)}{msg.type !== 'system' && ':'}</span>
                            <span className="message-text">{msg.text}</span>
                            <span className="message-timestamp">{msg.type !== 'system' && formatTimestamp(msg.timestamp)}</span>
                        </div>
                    </div>
                ))}
            </div>
            {/* IMPORTANT: Ensure ChatInput is outside the scrollable container */}
            <ChatInput onSendMessage={handleSendMessage} />
        </div>

        <div className={`participants-panel side-panel ${isParticipantsPanelOpen ? 'is-active' : ''}`}>
            <div className="panel-header">
                <h3>Participants ({participants.length})</h3>
                {isHost && (
                  <div className="host-room-info">
                    <span>Room ID: {roomId}</span>
                    <button onClick={handleCopyRoomId} className="copy-room-id-button">
                      {roomCopiedMessage ? <FaCheckCircle /> : <FaCopy />}
                    </button>
                    {roomCopiedMessage && <span className="copy-feedback">{roomCopiedMessage}</span>}
                  </div>
                )}
                <button onClick={handleToggleParticipantsPanel} className="panel-close-button" aria-label="Close Participants List">
                    <FaRegWindowClose />
                </button>
            </div>
            {isHost && pendingJoinRequests.length > 0 && (
              <div className="pending-requests-section">
                <h4>Pending Join Requests:</h4>
                <ul className="pending-requests-list">
                  {pendingJoinRequests.map(req => (
                    <li key={req.requester_sid} className="pending-request-item">
                      <span>{req.requester_name || `User (${req.requester_sid.substring(0,6)})`}</span>
                      <div>
                        <button onClick={() => handleAdmissionRequest(req.requester_sid, req.room_id, 'accept')} className="admission-button accept">
                          Accept
                        </button>
                        <button onClick={() => handleAdmissionRequest(req.requester_sid, req.room_id, 'deny')} className="admission-button deny">
                          Deny
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* IMPORTANT: Ensure this list has flex-grow and overflow */}
            <ul className="participants-list">
                {participants.length === 0 && <li className="no-participants">Connecting...</li>}
                {participants.map(p => (
                    <li key={p.id} className="participant-item">
                        <FaUserCircle className="participant-icon" />
                        <div className="participant-info">
                            <span className="participant-name">
                                {p.id === mySid ? `${p.name || 'You'} (You)` : (p.name || `User (${p.id.substring(0,6)})`)}
                            </span>
                            {isHost && analysisResults[p.id] && (
                                <div className="analysis-results">
                                    <div className="analysis-status">
                                        Status: {analysisResults[p.id].status_text || 'Analyzing...'}
                                    </div>
                                    {analysisResults[p.id].details && (
                                        <div className="analysis-details">
                                            {/* Explicitly display score */}
                                            {typeof analysisResults[p.id].details.suspicion_score_final !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Suspicion Score: {analysisResults[p.id].details.suspicion_score_final}
                                                </div>
                                            )}
                                            {/* Display Trust Score */}
                                            {typeof analysisResults[p.id].details.trust_score !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Trust Score: {analysisResults[p.id].details.trust_score} / 100
                                                </div>
                                            )}
                                            {/* Explicitly display Gaze Deflection Count */}
                                            {typeof analysisResults[p.id].details.gaze_deflection_count !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Gaze Deflections: {analysisResults[p.id].details.gaze_deflection_count}
                                                </div>
                                            )}
                                            {/* Explicitly display Head Turn Count */}
                                            {typeof analysisResults[p.id].details.head_turn_count !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Head Turns Away: {analysisResults[p.id].details.head_turn_count}
                                                </div>
                                            )}
                                            {/* Display Total Frames Analyzed */}
                                            {typeof analysisResults[p.id].details.total_frames_analyzed !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Total Frames Analyzed: {analysisResults[p.id].details.total_frames_analyzed}
                                                </div>
                                            )}
                                            {/* Display Duration Analyzed */}
                                            {typeof analysisResults[p.id].details.duration_analyzed_seconds !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Duration Analyzed (s): {analysisResults[p.id].details.duration_analyzed_seconds}
                                                </div>
                                            )}
                                            {/* Display Average Analysis FPS */}
                                            {typeof analysisResults[p.id].details.fps_analyzed !== 'undefined' && (
                                                <div className="analysis-detail-item">
                                                    Avg. Analysis FPS: {analysisResults[p.id].details.fps_analyzed}
                                                </div>
                                            )}

                                            {/* Handle key_events_triggered array separately */}
                                            {analysisResults[p.id].details.key_events_triggered && Array.isArray(analysisResults[p.id].details.key_events_triggered) && (
                                                <div className="analysis-detail-item nested-list-container">
                                                    <strong>Key Events Triggered:</strong>
                                                    {analysisResults[p.id].details.key_events_triggered.length > 0 ? (
                                                        <ul className="nested-list">
                                                            {analysisResults[p.id].details.key_events_triggered.map((event, index) => (
                                                                <li key={index} className="nested-list-item">
                                                                    {event.type}: {event.details} (at {new Date(event.timestamp * 1000).toLocaleTimeString()})
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <span> None</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {isHost && p.id !== mySid && (
                            <div className="host-participant-actions">
                                {!analyzingSids[p.id] ? (
                                    <button 
                                        onClick={() => debounceAnalysisAction(requestStartAnalysis, p.id)} 
                                        className={`analysis-action-button start ${analysisButtonDisabled[p.id] ? 'disabled' : ''} ${analysisConnectionState[p.id] === 'failed' ? 'failed' : ''}`}
                                        disabled={analysisButtonDisabled[p.id]}
                                        title={
                                          analysisButtonDisabled[p.id] ? 'Please wait...' :
                                          analysisConnectionState[p.id] === 'failed' ? 'Connection failed. Try again.' :
                                          analysisConnectionState[p.id] === 'concluded' ? 'View Last Conclusion / Re-analyze' :
                                          analysisConnectionState[p.id] === 'stopped_remotely' ? 'Analysis stopped. Try again.' :
                                          'Start analysis'
                                        }
                                    >
                                        <span className="button-content">
                                            {analysisButtonDisabled[p.id] && analysisConnectionState[p.id] !== 'concluded' ? 'Starting...' : 
                                             analysisConnectionState[p.id] === 'failed' ? 'Retry Analysis' :
                                             analysisConnectionState[p.id] === 'concluded' ? 'Re-Analyze' :
                                             analysisConnectionState[p.id] === 'stopped_remotely' ? 'Retry Analysis' :
                                             'Analyze'}
                                            {analysisButtonDisabled[p.id] && analysisConnectionState[p.id] !== 'concluded' && <span className="loading-dot">.</span>}
                                        </span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => debounceAnalysisAction(requestStopAnalysis, p.id)} 
                                        className={`analysis-action-button stop ${analysisButtonDisabled[p.id] ? 'disabled' : ''}`}
                                        disabled={analysisButtonDisabled[p.id]}
                                        title={analysisButtonDisabled[p.id] ? 'Please wait...' : 'Stop analysis'}
                                    >
                                        <span className="button-content">
                                            {analysisButtonDisabled[p.id] ? 'Stopping...' : 'Stop Analysis'}
                                            {analysisButtonDisabled[p.id] && <span className="loading-dot">.</span>}
                                        </span>
                                    </button>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
      </main>

      <div className="controls-bar">
         {/* Buttons using is-off / is-active classes */}
        <button onClick={toggleMic} className={`control-button ${!isMicOn ? 'is-off' : ''}`} aria-label={isMicOn ? "Mute" : "Unmute"}> {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />} </button>
        <button onClick={toggleVideo} className={`control-button ${!isVideoOn && !isScreenSharing ? 'is-off' : ''}`} aria-label={isVideoOn && !isScreenSharing ? "Cam Off" : "Cam On"}> {isVideoOn && !isScreenSharing ? <FaVideo /> : <FaVideoSlash />} </button>
        <button onClick={handleShare} className={`control-button ${isScreenSharing ? 'is-active' : ''}`} aria-label={isScreenSharing ? "Stop Sharing" : "Share Screen"}> <FaDesktop /> {isScreenSharing && <span className="sharing-indicator-dot"></span>} </button>
        <button onClick={handleToggleChat} className={`control-button ${isChatOpen ? 'is-active' : ''}`} aria-label="Toggle Chat"> <FaComments /> </button>
        <button onClick={handleToggleParticipantsPanel} className={`control-button ${isParticipantsPanelOpen ? 'is-active' : ''}`} aria-label="Toggle Participants List"> <FaUsers /> </button>
        <button onClick={handleEndCall} className="control-button end-call" aria-label="End Call"> <FaPhoneSlash /> </button>
      </div>
    </div>
  )
}
export default App