import { useAuth } from '@/context/AuthContext';
import type { AuthRequiredPayload } from '@/types';
import { SCOPE_META } from '@/types';
import styles from './ScopeAuthCard.module.css';

interface ScopeAuthCardProps {
  authPayload: AuthRequiredPayload;
  isGranted?: boolean;
}

export default function ScopeAuthCard({ authPayload, isGranted }: ScopeAuthCardProps) {
  const { requestScope } = useAuth();

  const meta = SCOPE_META[authPayload.requiredScope] ?? {
    label: authPayload.scopeLabel,
    icon: '🔐',
    description: 'Additional Google permission required',
  };

  if (isGranted) {
    return (
      <div className={`${styles.card} ${styles.granted}`}>
        <div className={styles.header}>
          <span className={styles.icon}>{meta.icon}</span>
          <span className={styles.title}>{meta.label} — Connected!</span>
        </div>
        <div className={styles.grantedBadge}>
          ✓ Authorization granted — processing your request...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card} id="scope-auth-card">
      <div className={styles.header}>
        <span className={styles.icon}>{meta.icon}</span>
        <span className={styles.title}>Authorize {meta.label}</span>
      </div>
      <p className={styles.description}>
        To complete this request, I need access to <strong>{meta.label}</strong>.
        <br />
        {meta.description}.
      </p>
      <button
        type="button"
        className={styles.authorizeBtn}
        onClick={() => requestScope(authPayload.requiredScope, authPayload.originalMessage)}
        id="authorize-scope-btn"
      >
        <span className={styles.lockIcon}>🔓</span>
        Authorize {meta.label}
      </button>
    </div>
  );
}
