import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';

/**
 * OAuth callback handler page.
 * The backend redirects here with ?token=JWT&user=ENCODED_USER
 * AuthContext picks up the params on mount and stores them.
 * This page just shows a loading spinner and then redirects to /dashboard.
 */
export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const user = params.get('user');
    const scopeGranted = params.get('scope_granted');

    if (token) {
      localStorage.setItem('token', token);
      if (user) {
        try {
          localStorage.setItem('user', JSON.stringify(JSON.parse(decodeURIComponent(user))));
        } catch {
          // ignore parse errors
        }
      }
    }

    // Small delay for state to settle, then redirect
    const timer = setTimeout(() => {
      if (scopeGranted) {
        // After incremental auth — go to dashboard with a signal
        navigate('/dashboard?scope_granted=' + encodeURIComponent(scopeGranted), { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className={styles.loadingWrap}>
      <div className={styles.spinner} />
      <p className={styles.loadingText}>Signing you in...</p>
    </div>
  );
}
