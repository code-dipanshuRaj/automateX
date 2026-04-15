import { Link } from 'react-router-dom';
import styles from './Landing.module.css';

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>Task Automate</span>
        <nav className={styles.nav}>
          <Link to="/login" className={styles.navLink}>Sign in</Link>
          <Link to="/login" className={styles.ctaNav}>Get started</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Automate tasks with <span className={styles.highlight}>natural language</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Describe what you want in plain English. Get a clear plan, approve it once, and let the app handle scheduling, emails, and more — powered by Google Workspace.
          </p>
          <div className={styles.heroActions}>
            <Link to="/login" className={styles.primaryBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: '0.5rem' }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Get started with Google
            </Link>
          </div>
        </section>

        <section className={styles.description}>
          <h2 className={styles.sectionTitle}>What is Task Automate?</h2>
          <p className={styles.sectionText}>
            Task Automate is an AI-powered platform that turns your natural language requests into real actions via Google Workspace. Sign in with your Google account, and the AI assistant will manage your Calendar, Gmail, and Tasks — requesting only the permissions it needs, when it needs them.
          </p>
        </section>

        <section className={styles.useCases}>
          <h2 className={styles.sectionTitle}>Use cases</h2>
          <ul className={styles.useCaseList}>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>📅</span>
              <div>
                <h3 className={styles.useCaseTitle}>Schedule meetings</h3>
                <p className={styles.useCaseText}>"Schedule a 30-min sync with the team tomorrow at 2pm." The AI creates the calendar event via Google Calendar.</p>
              </div>
            </li>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>✉️</span>
              <div>
                <h3 className={styles.useCaseTitle}>Send emails</h3>
                <p className={styles.useCaseText}>"Email John a summary of the Q4 report." Compose and send via Gmail — you approve each action.</p>
              </div>
            </li>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>📋</span>
              <div>
                <h3 className={styles.useCaseTitle}>Manage tasks</h3>
                <p className={styles.useCaseText}>"Add 'Review design mockups' to my todo for Friday." Tasks are created in Google Tasks.</p>
              </div>
            </li>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>🔒</span>
              <div>
                <h3 className={styles.useCaseTitle}>Incremental permissions</h3>
                <p className={styles.useCaseText}>The app only asks for Google permissions when you actually need them — Calendar access is requested only when you try to schedule something.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className={styles.cta}>
          <h2 className={styles.ctaTitle}>Ready to automate?</h2>
          <p className={styles.ctaText}>Sign in with Google and start with a simple request.</p>
          <div className={styles.ctaActions}>
            <Link to="/login" className={styles.primaryBtn}>Sign in with Google</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerLogo}>Task Automate</span>
        <p className={styles.footerTagline}>Intelligent Task Automation Platform • Powered by Google Workspace</p>
      </footer>
    </div>
  );
}
