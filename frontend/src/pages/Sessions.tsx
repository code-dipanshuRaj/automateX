import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '@/api/client';
import type { SessionInfo } from '@/types';
import styles from './Sessions.module.css';

export default function Sessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSessionClick = (id: string) => {
    sessionStorage.setItem('chatSessionId', id);
    navigate('/dashboard');
  };

  useEffect(() => {
    chatApi
      .getSessions()
      .then((res) => setSessions(res.sessions ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.wrap}>Loading sessions…</div>;
  if (error) return <div className={styles.wrap}><p className={styles.error}>{error}</p></div>;

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Sessions</h1>
      {sessions.length === 0 ? (
        <p className={styles.empty}>No sessions yet. Start a conversation from Chat.</p>
      ) : (
        <ul className={styles.list}>
          {sessions.map((s) => (
            <li 
              key={s.id} 
              className={styles.item}
              onClick={() => handleSessionClick(s.id)}
              title="Click to resume this chat"
            >
              <span className={styles.id}>{s.id}</span>
              <span className={styles.meta}>
                {new Date(s.lastActivityAt).toLocaleString()}
                {s.messageCount != null && ` · ${s.messageCount} messages`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
