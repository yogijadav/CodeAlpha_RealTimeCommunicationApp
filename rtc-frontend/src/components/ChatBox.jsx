import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ChatBox({ chatLog, onSendMessage }) {
  const [messageText, setMessageText] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSend = () => {
    if (!messageText.trim()) return;
    onSendMessage(messageText);
    setMessageText('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExtension = file.name.split('.').pop();
      const filePath = `${Date.now()}.${fileExtension}`;

      // 1. Upload raw bytes securely to Supabase Private Storage Bucket
      const { data, error } = await supabase.storage
        .from('room-files')
        .upload(filePath, file);

      if (error) throw error;

      // 2. Generate a temporary Signed URL valid for 60 minutes
      const { data: urlData, error: urlError } = await supabase.storage
        .from('room-files')
        .createSignedUrl(filePath, 3600);

      if (urlError) throw urlError;

      // 3. Drop the file share link into the WebRTC direct data pipeline
      onSendMessage(`📎 Shared File: [${file.name}](${urlData.signedUrl})`);
    } catch (err) {
      alert(`File transfer block anomaly: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#1a1a1e', border: '1px solid #29292e', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', boxSizing: 'border-box' }}>
      <h4 style={{ margin: '0 0 16px 0', color: '#fff' }}>In-Call Workspace</h4>
      <div style={{ flexGrow: 1, overflowY: 'auto', backgroundColor: '#121214', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #29292e' }}>
        {chatLog.map((msg, index) => {
          const isFile = msg.text.startsWith('📎 Shared File:');
          let displayContent = msg.text;
          let fileUrl = '';

          if (isFile) {
            const match = msg.text.match(/\[(.*?)\]\((.*?)\)/);
            if (match) {
              displayContent = `📎 ${match[1]}`;
              fileUrl = match[2];
            }
          }

          return (
            <div key={index} style={{ marginBottom: '12px', textAlign: msg.sender === 'You' ? 'right' : 'left' }}>
              <small style={{ color: '#7c7c8a', display: 'block', marginBottom: '2px', fontSize: '11px' }}>{msg.sender}</small>
              <span style={{ backgroundColor: msg.sender === 'You' ? '#04d361' : '#29292e', color: msg.sender === 'You' ? '#000' : '#fff', padding: '8px 12px', borderRadius: '8px', display: 'inline-block', fontSize: '14px', maxWidth: '80%', wordBreak: 'break-word' }}>
                {isFile ? (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: msg.sender === 'You' ? '#000' : '#04d361', fontWeight: 'bold', textDecoration: 'underline' }}>
                    {displayContent}
                  </a>
                ) : displayContent}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="Send a message..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} style={{ flexGrow: 1, padding: '12px', backgroundColor: '#121214', border: '1px solid #29292e', borderRadius: '8px', color: '#fff', outline: 'none' }} />
          <button onClick={handleSend} style={{ padding: '0 16px', backgroundColor: '#04d361', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Send</button>
        </div>
        <label style={{ display: 'block', backgroundColor: '#29292e', border: '1px solid #323238', color: '#fff', borderRadius: '8px', padding: '10px', textAlign: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
          {uploading ? 'Uploading Secure File Assets...' : '📎 Share Document / Image File'}
          <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
}
