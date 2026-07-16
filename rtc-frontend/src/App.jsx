import React, { useState } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { theme } from './styles';
import Auth from './components/Auth';
import ChatBox from './components/ChatBox';
import Whiteboard from './components/Whiteboard';

export default function App() {
  const hooks = useWebRTC();

  // Layout View Toggles
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);

  if (!hooks.user) return <Auth />;

  // Smart Layout Engine: Detect if anyone is actively sharing a screen stream
  const activeScreenShareFeed = hooks.remoteStreams.find(peer => peer.isScreenShare || false) || 
    (hooks.isScreenSharing ? { socketId: 'local-screen', stream: hooks.localStreamRef.current, name: 'Your Screen Share' } : null);

  return (
    <div style={theme.container}>
      <header style={theme.header}>
        <div style={theme.profileSection}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#04d361', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' }}>
            {hooks.user.email.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '14px', color: '#fff', fontWeight: '500' }}>{hooks.user.email}</span>
            <small style={{ color: '#7c7c8a', fontSize: '11px' }}>Meeting Active</small>
          </div>
        </div>
        <button onClick={hooks.handleGlobalLogout} style={{ ...theme.btnSecondary, borderColor: '#ff4d4d', color: '#ff4d4d' }}>Logout Account</button>
      </header>

      <main style={{ flex: '1', padding: '24px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', marginBottom: '80px' }}>
        
        {hooks.localStreamRef.current && (
          <div style={theme.nameInputBar}>
            <label style={{ fontSize: '14px', color: '#7c7c8a', fontWeight: '500' }}>Display Name:</label>
            <input type="text" value={hooks.displayName} onChange={(e) => hooks.updateMeetingName(e.target.value)} style={{ ...theme.input, marginBottom: '0', width: '180px', padding: '6px 12px' }} />
          </div>
        )}

        {!hooks.localStreamRef.current ? (
          <div style={{ display: 'flex', flex: '1', justifyContent: 'center', alignItems: 'center' }}>
            <div style={theme.card}>
              <h3>Hardware Device Setup</h3>
              <button onClick={hooks.startLocalVideo} style={theme.btnPrimary}>Verify Camera & Mic</button>
            </div>
          </div>
        ) : !hooks.joinedRoom ? (
          <div style={{ display: 'flex', flex: '1', justifyContent: 'center', alignItems: 'center' }}>
            <div style={theme.card}>
              <h3>Connect to Workspace Channel</h3>
              <input type="text" placeholder="Enter Room ID" value={hooks.roomId} onChange={(e) => hooks.setRoomId(e.target.value)} style={theme.input} />
              <button onClick={hooks.joinCollaborationRoom} style={theme.btnPrimary}>Join Room</button>
            </div>
          </div>
        ) : (
                    <div style={{ display: 'flex', gap: '24px', width: '100%', flex: '1', position: 'relative' }}>
            
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: isChatOpen ? '75%' : '100%' }}>
              
              {isWhiteboardOpen && (
                <Whiteboard 
                  onDrawEvent={hooks.broadcastDrawing} 
                  incomingDrawCoordinates={hooks.incomingDraw} 
                  onClearEvent={hooks.broadcastClearBoard}
                />
              )}

              {/* FIX: ACCURATE SYSTEM WIDE SCREEN DETECTION PANEL */}
              {/* Find if a remote peer is sharing, or fallback to our own local screen share state */}
              {hooks.remoteStreams.find(p => p.isScreenShare) || hooks.isScreenSharing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Big Presentation Pin Window Box Container Layout */}
                  <div style={{ ...theme.videoWrapper, aspectRatio: '21/9', borderColor: '#04d361' }}>
                    <video 
                      ref={el => {
                        if (el) {
                          const remoteScreen = hooks.remoteStreams.find(p => p.isScreenShare);
                          if (remoteScreen && remoteScreen.stream) {
                            el.srcObject = remoteScreen.stream[0] || remoteScreen.stream;
                          } else if (hooks.isScreenSharing && hooks.screenStreamRef?.current) {
                            // Mirror your own shared screen securely without wiping your camera box
                            el.srcObject = hooks.screenStreamRef.current;
                          }
                        }
                      }} 
                      autoPlay 
                      playsInline 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                    <div style={theme.videoNameBadge}>
                      📌 Presentation View: {hooks.isScreenSharing ? 'Your Screen Share' : 'Remote Peer Screen'}
                    </div>
                  </div>
                  
                  {/* Bottom Strip Grid: Always displays your face along with the other peers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
                    {/* Your Camera Feed - Always preserved and non-blank */}
                    <div style={{ ...theme.videoWrapper, aspectRatio: '16/9' }}>
                      <video ref={hooks.localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={theme.videoNameBadge}>{hooks.displayName} (You)</div>
                    </div>
                    {/* Peers Camera Feeds */}
                    {hooks.remoteStreams.map(peer => (
                      <div key={peer.socketId} style={{ ...theme.videoWrapper, aspectRatio: '16/9' }}>
                        <video ref={el => { if (el && peer.stream) el.srcObject = peer.stream[0] || peer.stream; }} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={theme.videoNameBadge}>{peer.name || 'Peer'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Default view container structure when no active screen tracking exists */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', autoRows: 'min-content' }}>
                  <div style={theme.videoWrapper}>
                    <video ref={hooks.localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={theme.videoNameBadge}>{hooks.displayName} (You) {!hooks.isVideoActive && "[Cam Off]"}</div>
                  </div>
                  {hooks.remoteStreams.map(peer => (
                    <div key={peer.socketId} style={theme.videoWrapper}>
                      <video ref={el => { if (el && peer.stream) el.srcObject = peer.stream[0] || peer.stream; }} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={theme.videoNameBadge}>{peer.name || 'Anonymous Peer'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {isChatOpen && (
              <div style={{ width: '320px', minWidth: '320px' }}>
                <ChatBox chatLog={hooks.chatLog} onSendMessage={hooks.sendChatMessage} />
              </div>
            )}
          </div>

        )}
      </main>

      {/* Floating Control panel featuring the new toggles */}
      {hooks.localStreamRef.current && (
        <div style={theme.controlBar}>
          <button onClick={hooks.toggleAudioTrack} style={theme.controlBtn(hooks.isAudioActive, !hooks.isAudioActive)} title="Mute Mic">{hooks.isAudioActive ? '🎤' : '🔇'}</button>
          <button onClick={hooks.toggleVideoTrack} style={theme.controlBtn(hooks.isVideoActive, !hooks.isVideoActive)} title="Kill Video">{hooks.isVideoActive ? '📹' : '❌'}</button>
          
          {/* New Feature: Toggleable Interactive Whiteboard Button Overlay */}
          <button onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)} style={theme.controlBtn(isWhiteboardOpen, false)} title="Toggle Whiteboard">🎨</button>
          
          {hooks.joinedRoom && (
            <>
              <button onClick={hooks.toggleScreenShare} style={{ ...theme.controlBtn(hooks.isScreenSharing, false), width: 'auto', borderRadius: '24px', padding: '0 20px' }} title="Toggle Screen Share">{hooks.isScreenSharing ? '⏹️ Stop Sharing' : '🖥️ Share Screen'}</button>
              {/* New Feature: Toggleable Sidebar Message Box Button overlay */}
              <button onClick={() => setIsChatOpen(!isChatOpen)} style={theme.controlBtn(isChatOpen, false)} title="Toggle In-Call Chat">💬</button>
            </>
          )}
          <button onClick={hooks.cleanUpConnections} style={theme.controlBtn(false, true)} title="Disconnect Call">❌ Leave</button>
        </div>
      )}
    </div>
  );
}
