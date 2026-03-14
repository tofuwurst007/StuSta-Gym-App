import { NavLink } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="privacy-page">
      <div className="privacy-wrap">
        <NavLink to="/" className="privacy-back">← Back</NavLink>

        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-updated">Last updated: March 2026</p>

        <section className="privacy-section">
          <h2>1. Who we are</h2>
          <p>
            StuSta Gym is a gym management service operated for residents of
            Studentenstadt München. This application is an internal tool used to
            manage gym access, shift scheduling, and member communication.
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. Data we collect</h2>
          <ul>
            <li><strong>Account data:</strong> Name, email address, role, house/room number, membership dates.</li>
            <li><strong>Usage data:</strong> Shift claims, attendance check-ins, spontaneous opening registrations.</li>
            <li><strong>Authentication data:</strong> Stored as a secure session token (never your raw password).</li>
            <li><strong>Analytics (optional):</strong> Anonymous page-view data via Vercel Analytics — only if you consent.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>3. Legal basis (GDPR Art. 6)</h2>
          <ul>
            <li><strong>Contract performance (Art. 6(1)(b)):</strong> Account and membership data is necessary to provide the gym service.</li>
            <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> Attendance logs and shift records ensure safe gym operation.</li>
            <li><strong>Consent (Art. 6(1)(a)):</strong> Analytics cookies are only set if you explicitly accept them.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>4. Data retention</h2>
          <ul>
            <li>Account data is retained for the duration of your membership + 1 year.</li>
            <li>Attendance logs are retained for 6 months.</li>
            <li>Notifications are retained for 90 days.</li>
            <li>Analytics data (if consented) is retained for up to 90 days.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>5. Your rights</h2>
          <p>Under GDPR you have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of all data we hold about you.</li>
            <li><strong>Rectification</strong> — correct inaccurate personal data.</li>
            <li><strong>Erasure ("right to be forgotten")</strong> — request deletion of your data.</li>
            <li><strong>Portability</strong> — receive your data in a machine-readable format.</li>
            <li><strong>Objection</strong> — object to processing based on legitimate interest.</li>
            <li><strong>Withdraw consent</strong> — change your cookie preferences at any time below.</li>
          </ul>
          <p>To exercise these rights, contact the gym administration.</p>
        </section>

        <section className="privacy-section">
          <h2>6. Cookies & tracking</h2>
          <p>
            We only use analytics cookies with your explicit consent. No tracking is
            performed for advertising purposes. You can review and change your cookie
            preferences at any time:
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              // Re-open Klaro consent manager
              import('klaro').then(Klaro => (Klaro as { show?: () => void }).show?.());
            }}
          >
            Manage cookie preferences
          </button>
        </section>

        <section className="privacy-section">
          <h2>7. Third-party services</h2>
          <ul>
            <li><strong>Vercel Analytics</strong> — anonymous, aggregated usage statistics (consent required).</li>
            <li><strong>Google OAuth</strong> — if you choose "Continue with Google", Google processes your authentication. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</li>
            <li><strong>PocketBase</strong> — self-hosted open-source backend. All data stays on our own servers.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>8. Contact</h2>
          <p>
            For any privacy-related questions or data requests, please contact the
            StuSta Gym administration or reach us at{' '}
            <a href="mailto:gym@stusta.de">gym@stusta.de</a>.
          </p>
        </section>

        <div className="privacy-footer">
          <NavLink to="/" className="privacy-back">← Back to app</NavLink>
        </div>
      </div>
    </div>
  );
}
