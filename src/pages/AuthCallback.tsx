import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    // Exchange the code in the URL for a real session
    supabase.auth.exchangeCodeForSession(window.location.href)
      .then(({ error }) => {
        if (error) {
          console.error('[AuthCallback]', error.message);
          setStatus('error');
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setStatus('success');
          setTimeout(() => navigate('/'), 1500);
        }
      });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--bg)', color: 'var(--text1)',
    }}>
      <div style={{ fontSize: 48 }}>
        {status === 'loading' ? '⏳' : status === 'success' ? '✅' : '❌'}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600 }}>
        {status === 'loading' && 'Verifying your email…'}
        {status === 'success' && 'Email verified! Redirecting…'}
        {status === 'error'   && 'Verification failed. Redirecting to login…'}
      </p>
    </div>
  );
}
