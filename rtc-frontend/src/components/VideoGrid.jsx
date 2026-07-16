import React from 'react';

export default function VideoGrid({ localVideoRef, remoteVideoRef }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div>
        <h4>Local View (You)</h4>
        <div style={{ width: '100%', height: '280px', backgroundColor: '#222', borderRadius: '8px', overflow: 'hidden' }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
      <div>
        <h4>Remote View (Peer)</h4>
        <div style={{ width: '100%', height: '280px', backgroundColor: '#333', borderRadius: '8px', overflow: 'hidden' }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
    </div>
  );
}
