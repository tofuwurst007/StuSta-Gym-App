import { useEffect, useState, FormEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// One page, two steps:
//  1. Not logged in → ask for the email and send a reset link.
//  2. Logged in (the link from the email signs the user in) → choose a new password.
export default function ResetPassword() {
  const { currentUser, requestPasswordReset, updatePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // An expired or already used link redirects here with #error=… in the hash.
  // (Initializer must stay pure — StrictMode runs it twice; the URL is tidied in an effect.)
  const [linkError] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('error_description')
      ? 'This reset link is invalid or has expired. Request a new one below.'
      : '');
  useEffect(() => {
    if (linkError) window.history.replaceState(null, '', window.location.pathname);
  }, [linkError]);

  // Prefilled from the login form (router state, so the address never ends up in the URL)
  const [email, setEmail]       = useState((location.state as { email?: string } | null)?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState(linkError);
  const [info, setInfo]         = useState('');
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);

  function describe(err: unknown): string {
    const msg = err instanceof Error ? err.message : '';
    const status = (err as { status?: number }).status;
    if (status === 429 || /rate limit|only request this/i.test(msg)) {
      return 'Please wait a minute before requesting another email.';
    }
    if (err instanceof TypeError || /failed to fetch|network/i.test(msg)) {
      return "Can't reach the server. Check your connection and try again.";
    }
    return msg || 'Something went wrong. Please try again.';
  }

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setInfo('If an account exists for this email, we sent a link to reset your password. Check your inbox (and the spam folder).');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🏋️</div>
          <h1>{currentUser ? 'Set a new password' : 'Reset password'}</h1>
          <p className="login-subtitle">
            {currentUser
              ? `Signed in as ${currentUser.email}`
              : "Enter your email and we'll send you a link to choose a new password."}
          </p>
        </div>

        {currentUser ? (
          done ? (
            <p className="login-info">Your password has been changed. Redirecting…</p>
          ) : (
            <form className="login-form" onSubmit={handleUpdate} noValidate>
              <div className="login-field">
                <label htmlFor="reset-password">New password</label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              <div className="login-field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>
              {error && <p className="login-error">{error}</p>}
              <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )
        ) : (
          <form className="login-form" onSubmit={handleRequest} noValidate>
            <div className="login-field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                placeholder="your@stusta.de"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            {info  && <p className="login-info">{info}</p>}
            <button className="btn btn-primary login-submit" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="login-guest-row">
          <NavLink to={currentUser ? '/' : '/login'} className="login-guest-link">
            {currentUser ? '← Back to the app' : '← Back to sign in'}
          </NavLink>
        </div>
      </div>
    </div>
  );
}
