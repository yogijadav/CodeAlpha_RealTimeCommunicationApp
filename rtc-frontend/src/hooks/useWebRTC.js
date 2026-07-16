import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { io } from 'socket.io-client';
import { iceConfiguration } from '../webrtcConfig';

export function useWebRTC() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [isAudioActive, setIsAudioActive] = useState(true);
  const [isVideoActive, setIsVideoActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [chatLog, setChatLog] = useState([]);
  const [displayName, setDisplayName] = useState('');
  const [remoteStreams, setRemoteStreams] = useState([]);

  // Phase 5: Whiteboard tracking sync state
  const [incomingDraw, setIncomingDraw] = useState(null);

  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnections = useRef({});
  const dataChannels = useRef({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) setDisplayName(activeUser.email.split('@')[0]);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) setDisplayName(activeUser.email.split('@')[0]);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGlobalLogout = async () => {
    cleanUpConnections();
    await supabase.auth.signOut();
  };

  const cleanUpConnections = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    Object.keys(peerConnections.current).forEach(id => {
      if (peerConnections.current[id]) peerConnections.current[id].close();
    });
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    peerConnections.current = {};
    dataChannels.current = {};
    setRemoteStreams([]);
    setJoinedRoom(false);
    setChatLog([]);
    setIsScreenSharing(false);
    setIsAudioActive(true);
    setIsVideoActive(true);
    setIncomingDraw(null);
  };

  const updateMeetingName = (newName) => {
    setDisplayName(newName);
    const payload = JSON.stringify({ type: 'name-update', name: newName });
    Object.keys(dataChannels.current).forEach(id => {
      if (dataChannels.current[id].readyState === 'open') dataChannels.current[id].send(payload);
    });
  };

  const broadcastDrawing = (drawData) => {
    Object.keys(dataChannels.current).forEach(id => {
      if (dataChannels.current[id].readyState === 'open') {
        dataChannels.current[id].send(JSON.stringify({ type: 'draw', data: drawData }));
      }
    });
  };

  // NEW PHASE 5 CAPABILITY: Broadcast clear command to everyone
  const broadcastClearBoard = () => {
    Object.keys(dataChannels.current).forEach(id => {
      if (dataChannels.current[id].readyState === 'open') {
        dataChannels.current[id].send(JSON.stringify({ type: 'clear-board' }));
      }
    });
  };

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setRoomId('ui-force'); setRoomId('');
    } catch (err) {
      alert("Camera hardware initialization blocked. Please allow browser permissions.");
    }
  };

  const toggleAudioTrack = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !isAudioActive);
      setIsAudioActive(!isAudioActive);
    }
  };

  const toggleVideoTrack = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !isVideoActive);
      setIsVideoActive(!isVideoActive);
    }
  };

   // 1. HARDENED TOGGLE: Emits a data signal notifying peers about screen track changes
  const toggleScreenShare = async () => {
    if (!joinedRoom) return alert("Connect to a meeting room space first.");
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Notify all peers via data channel that we are starting a screen share
        Object.keys(dataChannels.current).forEach(id => {
          if (dataChannels.current[id].readyState === 'open') {
            dataChannels.current[id].send(JSON.stringify({ type: 'screen-share-state', active: true }));
          }
        });

        // Swap out tracks on the fly across peer connections
        Object.keys(peerConnections.current).forEach(id => {
          const sender = peerConnections.current[id].getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        // FIX: DO NOT overwrite localVideoRef! Leave your face visible.
        setIsScreenSharing(true);

        screenTrack.onended = () => stopScreenShareInstance();
      } else {
        stopScreenShareInstance();
      }
    } catch (err) { console.error(err); }
  };

  const stopScreenShareInstance = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    
    // Notify all peers via data channel that screen share has stopped
    Object.keys(dataChannels.current).forEach(id => {
      if (dataChannels.current[id].readyState === 'open') {
        dataChannels.current[id].send(JSON.stringify({ type: 'screen-share-state', active: false }));
      }
    });

    const defaultVideoTrack = localStreamRef.current?.getVideoTracks()[0];
    Object.keys(peerConnections.current).forEach(id => {
      const sender = peerConnections.current[id].getSenders().find(s => s.track?.kind === 'video');
      if (sender && defaultVideoTrack) sender.replaceTrack(defaultVideoTrack);
    });
    
    setIsScreenSharing(false);
  };

  // 2. UPDATED INBOUND PACKET PARSER: Catches screen share state updates from peers
  const handleIncomingDataMessage = (id, event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'screen-share-state') {
        // Dynamically flag the specific peer stream container card as a pinned screen presentation
        setRemoteStreams(prev => prev.map(item => 
          item.socketId === id ? { ...item, isScreenShare: parsed.active } : item
        ));
      } else if (parsed.type === 'draw') {
        setIncomingDraw(parsed.data);
      } else if (parsed.type === 'name-update') {
        setRemoteStreams(prev => prev.map(item => item.socketId === id ? { ...item, name: parsed.name } : item));
      } else if (parsed.type === 'chat') {
        setChatLog(p => [...p, { sender: parsed.senderName || 'Peer', text: parsed.text }]);
      }
    } catch (err) { console.error(err); }
  };

  const createPeerConnection = (targetSocketId, targetRoomId, isCaller) => {
    const pc = new RTCPeerConnection(iceConfiguration);
    peerConnections.current[targetSocketId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit('signal', { roomId: targetRoomId, targetSocketId, signalData: { type: 'ice-candidate', candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        setRemoteStreams(prev => {
          if (prev.find(i => i.socketId === targetSocketId)) return prev;
          return [...prev, { socketId: targetSocketId, stream: e.streams[0], name: 'Peer Call' }];
        });
      }
    };

    if (isCaller) {
      const channel = pc.createDataChannel("chatChannel");
      dataChannels.current[targetSocketId] = channel;
      channel.onopen = () => channel.send(JSON.stringify({ type: 'name-update', name: displayName }));
      channel.onmessage = (e) => handleIncomingDataMessage(targetSocketId, e);
    } else {
      pc.ondatachannel = (e) => {
        dataChannels.current[targetSocketId] = e.channel;
        e.channel.onopen = () => e.channel.send(JSON.stringify({ type: 'name-update', name: displayName }));
        e.channel.onmessage = (msg) => handleIncomingDataMessage(targetSocketId, msg);
      };
    }
    return pc;
  };

  const joinCollaborationRoom = async () => {
    if (!roomId.trim()) return alert("Enter valid room parameters.");

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (sessionError || !token) {
      return alert("Your session has expired. Please logout and log back in.");
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const newSocket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { roomId });
      setJoinedRoom(true);
    });

    newSocket.on('connect_error', (err) => {
      alert(`Connection Refused by Server: ${err.message}`);
      cleanUpConnections();
    });

    newSocket.on('peer-left', ({ socketId }) => {
      if (peerConnections.current[socketId]) peerConnections.current[socketId].close();
      delete peerConnections.current[socketId];
      delete dataChannels.current[socketId];
      setRemoteStreams(prev => prev.filter(item => item.socketId !== socketId));
    });

    newSocket.on('user-joined', async ({ socketId }) => {
      const pc = createPeerConnection(socketId, roomId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      newSocket.emit('signal', { roomId, targetSocketId: socketId, signalData: { type: 'sdp-offer', sdp: offer } });
    });

    newSocket.on('signal-received', async ({ senderSocketId, signalData }) => {
      if (!peerConnections.current[senderSocketId]) createPeerConnection(senderSocketId, roomId, false);
      const pc = peerConnections.current[senderSocketId];
      if (signalData.type === 'sdp-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        newSocket.emit('signal', {
          roomId,
          targetSocketId: senderSocketId,
          signalData: { type: 'sdp-answer', sdp: answer }
        });
      } else if (signalData.type === 'sdp-answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      } else if (signalData.type === 'ice-candidate' && pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {
          console.error("ICE candidate application failed:", e);
        }
      }
    });
  };

  const sendChatMessage = (text) => {
    Object.keys(dataChannels.current).forEach((id) => {
      if (dataChannels.current[id].readyState === 'open') {
        dataChannels.current[id].send(
          JSON.stringify({ type: 'chat', text, senderName: displayName })
        );
      }
    });
    setChatLog((prev) => [...prev, { sender: 'You', text }]);
  };

  return {
    user,
    roomId,
    setRoomId,
    joinedRoom,
    isAudioActive,
    isVideoActive,
    isScreenSharing,
    chatLog,
    remoteStreams,
    displayName,
    updateMeetingName,
    incomingDraw,
    broadcastDrawing,
    broadcastClearBoard,
    localVideoRef,
    localStreamRef,
    startLocalVideo,
    toggleAudioTrack,
    toggleVideoTrack,
    toggleScreenShare,
    joinCollaborationRoom,
    sendChatMessage,
    cleanUpConnections,
    handleGlobalLogout,
    screenStreamRef
  };
}
