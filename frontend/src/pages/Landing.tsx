import { Link } from 'react-router-dom';
import styles from './Landing.module.css';

export default function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>Task Automate</span>
        <nav className={styles.nav}>
          <Link to="/login" className={styles.navLink}>Log in</Link>
          <Link to="/register" className={styles.ctaNav}>Get started</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Automate tasks with <span className={styles.highlight}>natural language</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Describe what you want in plain English. Get a clear plan, approve it once, and let the app handle scheduling, emails, and more.
          </p>
          <div className={styles.heroActions}>
            <Link to="/register" className={styles.primaryBtn}>Get started free</Link>
            <Link to="/login" className={styles.secondaryBtn}>Log in</Link>
          </div>
        </section>

        <section className={styles.description}>
          <h2 className={styles.sectionTitle}>What is Task Automate?</h2>
          <p className={styles.sectionText}>
            Task Automate is an AI-powered platform that turns your natural language requests into real actions. You tell the system what you need—in everyday words—and it proposes a step-by-step plan. After you approve, it executes tasks like scheduling meetings, sending emails, and managing your todo list through connected services.
          </p>
        </section>

        <section className={styles.useCases}>
          <h2 className={styles.sectionTitle}>Use cases</h2>
          <ul className={styles.useCaseList}>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>📅</span>
              <div>
                <h3 className={styles.useCaseTitle}>Schedule meetings</h3>
                <p className={styles.useCaseText}>“Schedule a 30-min sync with the team tomorrow at 2pm.” The app creates the calendar event via Google Calendar.</p>
              </div>
            </li>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>✉️</span>
              <div>
                <h3 className={styles.useCaseTitle}>Send emails</h3>
                <p className={styles.useCaseText}>“Email John a summary of the Q4 report.” Compose and send via Gmail or SMTP—you approve the plan first.</p>
              </div>
            </li>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>📋</span>
              <div>
                <h3 className={styles.useCaseTitle}>Manage tasks</h3>
                <p className={styles.useCaseText}>“Add ‘Review design mockups’ to my todo for Friday.” Tasks are created in your connected todo app.</p>
              </div>
            </li>
            <li className={styles.useCase}>
              <span className={styles.useCaseIcon} aria-hidden>🧠</span>
              <div>
                <h3 className={styles.useCaseTitle}>Domain knowledge (RAG)</h3>
                <p className={styles.useCaseText}>The system uses your documents and context to suggest accurate, relevant plans—so automation fits your workflow.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className={styles.cta}>
          <h2 className={styles.ctaTitle}>Ready to automate?</h2>
          <p className={styles.ctaText}>Sign up, connect your calendar and email, and start with a simple request.</p>
          <div className={styles.ctaActions}>
            <Link to="/register" className={styles.primaryBtn}>Create account</Link>
            <Link to="/login" className={styles.secondaryBtn}>Log in</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.footerLogo}>Task Automate</span>
        <p className={styles.footerTagline}>Intelligent Task Automation Platform</p>
      </footer>
    </div>
  );
}
