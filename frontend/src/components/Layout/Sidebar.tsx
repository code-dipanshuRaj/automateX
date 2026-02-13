import { NavLink } from 'react-router-dom';
import styles from './Layout.module.css';

const nav = [
  { to: '/dashboard', label: 'Chat' },
  { to: '/dashboard/sessions', label: 'Sessions' },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
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
