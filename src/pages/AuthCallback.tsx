import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const done = (ok: boolean, msg?: string) => {
      if (msg) console.error('[AuthCallback]', msg);
      setStatus(ok ? 'success' : 'error');
      setTimeout(() => navigate(ok ? '/' : '/login?verify=failed'), ok ? 1500 : 3000);
    };

    // Errors from the verification link arrive in the query or the hash
    const params = new URLSearchParams(window.location.search + '&' + window.location.hash.slice(1));
    if (params.get('error_description')) return done(false, params.get('error_description')!);

    // Old emails linked here directly with ?token=…&type=… (wrong mailer path).
    // Hand the token to GoTrue's verify endpoint, which redirects back with a session.
    const token = params.get('token');
    const type = params.get('type');
    if (token && type) {
      const verify = new URLSearchParams({ token, type, redirect_to: `${window.location.origin}/auth/callback` });
      window.location.replace(`/auth/v1/verify?${verify}`);
      return;
    }

    // PKCE flow: ?code=… must be exchanged for a session
    if (params.get('code')) {
      supabase.auth.exchangeCodeForSession(params.get('code')!)
        .then(({ error }) => done(!error, error?.message));
      return;
    }

    // Implicit flow (the default): the SDK reads #access_token itself
    supabase.auth.getSession()
      .then(({ data, error }) => done(!!data.session, error?.message ?? (data.session ? undefined : 'no session in URL')));
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--bg)', color: 'var(--text)',
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
