import { NavLink } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="privacy-page">
      <div className="privacy-wrap">
        <NavLink to="/" className="privacy-back">← Zurück / Back</NavLink>

        <h1 className="privacy-title">Datenschutzerklärung</h1>
        <p className="privacy-updated">Stand: März 2026 · Last updated: March 2026</p>

        {/* ─── 1. Verantwortlicher ─── */}
        <section className="privacy-section">
          <h2>1. Verantwortlicher (Controller)</h2>
          <p>
            Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) und des
            Bundesdatenschutzgesetzes (BDSG) ist:
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Studentenstadt München e.V. – Gym-Verwaltung</strong><br />
            Studentenstadt 1, 80939 München<br />
            E-Mail: <a href="mailto:gym@stusta.de">gym@stusta.de</a>
          </p>
          <p style={{ marginTop: 8, color: 'var(--text2)', fontSize: 13 }}>
            <em>The controller responsible for data processing under the GDPR is the StuSta Gym
            administration at the address above.</em>
          </p>
        </section>

        {/* ─── 2. Erhobene Daten ─── */}
        <section className="privacy-section">
          <h2>2. Welche Daten wir erheben (Data we collect)</h2>
          <ul>
            <li>
              <strong>Kontodaten:</strong> Name, E-Mail-Adresse, Rolle (Mitglied / Supervisor / Admin).
              Diese Daten sind zur Nutzung der App zwingend erforderlich.
            </li>
            <li>
              <strong>Nutzungsdaten:</strong> Schichtbuchungen, Anwesenheitsprotokolle,
              Spontanöffnungs-Registrierungen.
            </li>
            <li>
              <strong>Authentifizierungsdaten:</strong> Gespeichert als verschlüsseltes Session-Token
              über Supabase Auth – das Passwort wird niemals im Klartext gespeichert.
            </li>
            <li>
              <strong>Analytik (optional):</strong> Anonymisierte Seitenaufrufe über Vercel Analytics –
              nur bei ausdrücklicher Einwilligung.
            </li>
          </ul>
        </section>

        {/* ─── 3. Rechtsgrundlage ─── */}
        <section className="privacy-section">
          <h2>3. Rechtsgrundlage (Legal basis – Art. 6 DSGVO)</h2>
          <ul>
            <li>
              <strong>Vertragserfüllung – Art. 6 Abs. 1 lit. b DSGVO:</strong> Name, E-Mail
              und Mitgliedsdaten sind zur Bereitstellung der Gym-Dienste erforderlich.
            </li>
            <li>
              <strong>Berechtigte Interessen – Art. 6 Abs. 1 lit. f DSGVO:</strong> Anwesenheits-
              protokolle und Schichtdaten dienen dem sicheren Betrieb des Fitnessstudios.
            </li>
            <li>
              <strong>Einwilligung – Art. 6 Abs. 1 lit. a DSGVO:</strong> Analyse-Cookies werden
              nur gesetzt, wenn Sie ausdrücklich zustimmen.
            </li>
          </ul>
        </section>

        {/* ─── 4. Speicherdauer ─── */}
        <section className="privacy-section">
          <h2>4. Speicherdauer (Data retention)</h2>
          <ul>
            <li>Kontodaten: Für die Dauer der Mitgliedschaft + 1 Jahr.</li>
            <li>Anwesenheitsprotokolle: 6 Monate.</li>
            <li>Benachrichtigungen: 90 Tage.</li>
            <li>Analyse-Daten (bei Einwilligung): bis zu 90 Tage.</li>
          </ul>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
            Nach Ablauf dieser Fristen werden die Daten automatisch gelöscht, sofern keine
            gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
        </section>

        {/* ─── 5. Empfänger / Drittanbieter ─── */}
        <section className="privacy-section">
          <h2>5. Empfänger & Drittanbieter (Third-party processors)</h2>
          <ul>
            <li>
              <strong>Supabase Inc.</strong> (San Francisco, USA) – Datenbank und Authentifizierung.
              Supabase ist nach dem EU-US Data Privacy Framework zertifiziert. Serverstandort: EU (Frankfurt).
              Datenschutzrichtlinie: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">supabase.com/privacy</a>
            </li>
            <li>
              <strong>Vercel Inc.</strong> (San Francisco, USA) – Hosting der Web-App.
              Vercel ist nach dem EU-US Data Privacy Framework zertifiziert. Serverstandort: Frankfurt.
              Datenschutzrichtlinie: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a>
            </li>
            <li>
              <strong>Vercel Analytics</strong> – Anonymisierte, aggregierte Nutzungsstatistiken
              (nur bei Einwilligung, ohne Cookies).
            </li>
          </ul>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
            Eine Weitergabe Ihrer Daten an Dritte zu Werbezwecken findet nicht statt.
          </p>
        </section>

        {/* ─── 6. Ihre Rechte ─── */}
        <section className="privacy-section">
          <h2>6. Ihre Rechte (Your rights – Art. 15–21 DSGVO)</h2>
          <p>Sie haben folgende Rechte gegenüber dem Verantwortlichen:</p>
          <ul>
            <li><strong>Auskunft (Art. 15 DSGVO)</strong> – Kopie aller über Sie gespeicherten Daten.</li>
            <li><strong>Berichtigung (Art. 16 DSGVO)</strong> – Korrektur unrichtiger Daten.</li>
            <li><strong>Löschung (Art. 17 DSGVO)</strong> – "Recht auf Vergessenwerden".</li>
            <li><strong>Einschränkung (Art. 18 DSGVO)</strong> – Einschränkung der Verarbeitung.</li>
            <li><strong>Datenübertragbarkeit (Art. 20 DSGVO)</strong> – Herausgabe in maschinenlesbarem Format.</li>
            <li><strong>Widerspruch (Art. 21 DSGVO)</strong> – Widerspruch gegen auf berechtigtem Interesse beruhende Verarbeitung.</li>
            <li><strong>Widerruf der Einwilligung</strong> – Cookie-Einstellungen jederzeit unten ändern.</li>
          </ul>
          <p style={{ marginTop: 8 }}>
            Zur Ausübung Ihrer Rechte wenden Sie sich bitte per E-Mail an{' '}
            <a href="mailto:gym@stusta.de">gym@stusta.de</a>.
          </p>
        </section>

        {/* ─── 7. Beschwerderecht ─── */}
        <section className="privacy-section">
          <h2>7. Beschwerderecht bei der Aufsichtsbehörde</h2>
          <p>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
            Die zuständige Behörde für Bayern ist:
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)</strong><br />
            Promenade 18, 91522 Ansbach<br />
            Telefon: +49 981 180093-0<br />
            <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer">www.lda.bayern.de</a>
          </p>
        </section>

        {/* ─── 8. Cookies ─── */}
        <section className="privacy-section">
          <h2>8. Cookies & Tracking</h2>
          <p>
            Wir verwenden ausschließlich technisch notwendige Cookies (z. B. Session-Token für die Anmeldung)
            sowie optionale Analyse-Cookies von Vercel Analytics – letztere nur mit Ihrer ausdrücklichen
            Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.
            Werbe-Tracking findet nicht statt.
          </p>
          <button
            className="btn btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              import('klaro').then(Klaro => (Klaro as { show?: () => void }).show?.());
            }}
          >
            Cookie-Einstellungen verwalten
          </button>
        </section>

        {/* ─── 9. Datensicherheit ─── */}
        <section className="privacy-section">
          <h2>9. Datensicherheit</h2>
          <p>
            Die Übertragung aller Daten erfolgt verschlüsselt über HTTPS (TLS 1.3).
            Passwörter werden ausschließlich als bcrypt-Hash gespeichert. Zugriffe auf die
            Datenbank sind durch Row-Level Security (RLS) geschützt – jeder Nutzer sieht
            nur die ihm zustehenden Daten.
          </p>
        </section>

        {/* ─── 10. Kontakt ─── */}
        <section className="privacy-section">
          <h2>10. Kontakt</h2>
          <p>
            Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich an:<br />
            <a href="mailto:gym@stusta.de">gym@stusta.de</a>
          </p>
        </section>

        <div className="privacy-footer">
          <NavLink to="/" className="privacy-back">← Zurück zur App</NavLink>
        </div>
      </div>
    </div>
  );
}
