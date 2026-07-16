// WebRTC configurations for NAT traversal routing utilities (Google STUN Servers)
export const iceConfiguration = {
  iceServers: [
    { urls: 'stun:stun.google.com:19302' },
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
