import { NavLink, useNavigate } from 'react-router-dom';
import styles from './Layout.module.css';

const nav = [
  { to: '/dashboard', label: 'Chat' },
  { to: '/dashboard/sessions', label: 'Sessions' },
];

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.newChatWrap}>
        <button 
          onClick={() => {
            sessionStorage.removeItem('chatSessionId');
            navigate('/dashboard', { replace: true });
          }} 
          className={styles.newChatBtn}
        >
          + New Chat
        </button>
      </div>
      <nav className={styles.nav}>
        {nav.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
