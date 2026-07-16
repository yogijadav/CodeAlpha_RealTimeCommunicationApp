import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { theme } from '../styles';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleAuth = async (type) => {
    setAuthError('');
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both fields.');
      return;
    }
    const result = type === 'signup' 
      ? await supabase.auth.signUp({ email, password }) 
      : await supabase.auth.signInWithPassword({ email, password });
      
    if (result.error) setAuthError(result.error.message);
  };

  return (
    <div style={{ ...theme.container, justifyContent: 'center', padding: '20px' }}>
      <div style={theme.card}>
        <h2 style={{ marginTop: '0', marginBottom: '24px', color: '#fff' }}>Welcome Session</h2>
        <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={theme.input} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={theme.input} />
        <button onClick={() => handleAuth('login')} style={{ ...theme.btnPrimary, marginBottom: '12px' }}>Sign In</button>
        <button onClick={() => handleAuth('signup')} style={theme.btnSecondary}>Create Account</button>
        {authError && <p style={{ color: '#ff4d4d', marginTop: '16px', fontSize: '14px' }}>{authError}</p>}
      </div>
    </div>
  );
}
