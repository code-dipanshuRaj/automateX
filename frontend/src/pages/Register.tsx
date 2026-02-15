import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import styles from './Auth.module.css';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { register, error, clearError, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      // await register(email, password, displayName || undefined);
      navigate('/dashboard', { replace: true });
    } catch {
      // error set in context
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <Link to="/" className={styles.backLink}>← Back to home</Link>
        <div className={styles.brand}>
          <span className={styles.logo}>Task Automate</span>
          <p className={styles.tagline}>Create an account</p>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          <label className={styles.label}>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
          </label>
          <label className={styles.label}>
            Display name (optional)
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={styles.input}
              placeholder="How we’ll call you"
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
              minLength={6}
            />
          </label>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>
        <p className={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
