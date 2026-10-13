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
              <strong>Mitgliedsdaten:</strong> Haus, Zimmer, Geburtsdatum und Mitgliedschaftszeitraum –
              werden von Supervisoren bzw. Admins gepflegt und sind nur für Sie selbst sowie für
              Supervisoren und Admins sichtbar.
            </li>
            <li>
              <strong>Nutzungsdaten:</strong> Schichtbuchungen, Anwesenheitsprotokolle,
              Spontanöffnungs-Registrierungen.
            </li>
            <li>
              <strong>Authentifizierungsdaten:</strong> Gespeichert als verschlüsseltes Session-Token
              über die Anmeldefunktion (Supabase Auth) – das Passwort wird niemals im Klartext gespeichert.
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
          </ul>
        </section>

        {/* ─── 4. Speicherdauer ─── */}
        <section className="privacy-section">
          <h2>4. Speicherdauer (Data retention)</h2>
          <ul>
            <li>
              Kontodaten: Solange das Konto besteht – auch nach Ende der Mitgliedschaft. Auf
              Wunsch löschen wir das Konto jederzeit (siehe Abschnitt 6). Konten ohne
              eingetragene Mitgliedschaft werden 1 Jahr nach der letzten Anmeldung gelöscht.
            </li>
            <li>Nicht bestätigte Registrierungen: 7 Tage.</li>
            <li>Anwesenheitsprotokolle: 6 Monate.</li>
            <li>Benachrichtigungen: 90 Tage.</li>
            <li>Änderungsprotokoll der Mitgliedsdaten und Feedback-Meldungen: 1 Jahr.</li>
            <li>Datensicherungen (Backups): 30 Tage.</li>
          </ul>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
            Nach Ablauf dieser Fristen werden die Daten einmal täglich automatisch gelöscht,
            sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Konten von
            Supervisoren und Admins werden von der Verwaltung gepflegt und nicht automatisch gelöscht.
          </p>
        </section>

        {/* ─── 5. Empfänger / Drittanbieter ─── */}
        <section className="privacy-section">
          <h2>5. Empfänger & Drittanbieter (Third-party processors)</h2>
          <ul>
            <li>
              <strong>StuStaNet e.V.</strong> (Studentenstadt München) – Betrieb des Servers
              unter gym.stusta.de. Web-App, Datenbank und Anmeldung (selbst gehostete
              Supabase-Software) laufen ausschließlich auf diesem Server; es findet keine
              Übermittlung an Supabase Inc., Vercel oder in Drittländer statt.
            </li>
            <li>
              <strong>E-Mail-Versand</strong> – Bestätigungs-E-Mails werden über den Mailserver
              des StuStaNet e.V. versendet.
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
            Wir verwenden keine Analyse- oder Werbe-Cookies und kein Tracking. Im lokalen Speicher
            Ihres Browsers (localStorage) werden ausschließlich technisch notwendige Daten abgelegt:
            das Anmelde-Token (Session) und Ihre Design-Einstellung (hell/dunkel).
          </p>
          <p style={{ marginTop: 8 }}>
            Schriftarten werden vom eigenen Server geladen; Inhalte von Drittanbietern
            (z. B. Google Fonts) werden nicht eingebunden.
          </p>
        </section>

        {/* ─── 9. Datensicherheit ─── */}
        <section className="privacy-section">
          <h2>9. Datensicherheit</h2>
          <p>
            Die Übertragung aller Daten erfolgt verschlüsselt über HTTPS (TLS 1.2/1.3).
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
