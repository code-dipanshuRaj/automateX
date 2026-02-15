import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import styles from './Auth.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, clearError, loading } = useAuth();
  const navigate = useNavigate();
  // const router = useRouter

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
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
          <p className={styles.tagline}>Sign in to automate tasks with AI</p>
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
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          </label>
          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className={styles.footer}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
