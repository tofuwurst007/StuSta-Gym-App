import { useState, FormEvent } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'signin' | 'signup';

export default function Login() {
  const { login, signUp, resendVerification, loading } = useAuth();
  const [searchParams] = useSearchParams();

  const [mode, setMode]         = useState<Mode>('signin');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  // /auth/callback sends failed verification links here with ?verify=failed
  const [error, setError]       = useState(searchParams.get('verify') === 'failed'
    ? 'This verification link is invalid or has expired. Sign in to get a new one.' : '');
  const [info, setInfo]         = useState('');
  const [canResend, setCanResend] = useState(false);

  async function handleResend() {
    setError('');
    setInfo('');
    try {
      await resendVerification(email);
      setInfo('A new verification email is on its way. Check your inbox.');
      setCanResend(false);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      setError(status === 429
        ? 'Please wait a minute before requesting another email.'
        : err instanceof Error ? err.message : 'Could not send the email. Please try again.');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setCanResend(false);

    if (mode === 'signup') {
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
      try {
        await signUp(email, password, name);
        setInfo('Account created! Check your email to confirm, then sign in.');
        setMode('signin');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
      }
    } else {
      try {
        await login(email, password);
        // No navigate() here — LoginRoute in App.tsx watches currentUser
        // and redirects once loadProfile() sets it, avoiding the race condition.
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        const status = (err as { status?: number }).status;
        if (msg.includes('email not confirmed')) {
          setError('Please confirm your email first. Check your inbox for the verification link.');
          setCanResend(true);
        } else if (msg.includes('invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (status === 429 || msg.includes('rate limit')) {
          setError('Too many attempts. Please wait a moment and try again.');
        } else if (err instanceof TypeError || msg.includes('failed to fetch') || msg.includes('network')) {
          setError("Can't reach the server. Check your connection and try again.");
        } else {
          setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
        }
      }
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">🏋️</div>
          <h1>StuSta Gym</h1>
          <p className="login-subtitle">Studentenstadt München</p>
        </div>

        {/* Tab switcher */}
        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(''); setInfo(''); setCanResend(false); }}
            type="button"
          >Sign in</button>
          <button
            className={`login-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); setInfo(''); setCanResend(false); }}
            type="button"
          >Create account</button>
        </div>

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <div className="login-field">
              <label htmlFor="login-name">Full name</label>
              <input
                id="login-name"
                type="text"
                autoComplete="name"
                placeholder="Max Mustermann"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="your@stusta.de"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {mode === 'signup' && (
            <div className="login-field">
              <label htmlFor="login-confirm">Confirm password</label>
              <input
                id="login-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          {error && <p className="login-error">{error}</p>}
          {canResend && (
            <button className="btn btn-ghost" type="button" onClick={handleResend} disabled={loading || !email}>
              Resend verification email
            </button>
          )}
          {info  && <p className="login-info">{info}</p>}

          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </button>
        </form>

        {/* Guest access */}
        <div className="login-guest-row">
          <NavLink to="/" className="login-guest-link">
            Browse as guest →
          </NavLink>
          <NavLink to="/privacy" className="login-privacy-link">
            Privacy policy
          </NavLink>
        </div>
      </div>
    </div>
  );
}
