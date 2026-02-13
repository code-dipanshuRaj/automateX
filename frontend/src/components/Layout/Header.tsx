import { useAuth } from '@/context/AuthContext';
import styles from './Layout.module.css';

export default function Header() {
  const { user, logout } = useAuth();
  const name = user?.displayName ?? user?.email ?? 'User';

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <span className={styles.appName}>Task Automate</span>
        <div className={styles.userRow}>
          <span className={styles.userName}>{name}</span>
          <button type="button" onClick={() => logout()} className={styles.logoutBtn}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
