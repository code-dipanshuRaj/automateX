import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatPanel from '@/components/chat/ChatPanel';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSessionId = searchParams.get('session');
  
  // Fallback to sessionStorage so session survives tab navigation (Chat → Sessions → Chat)
  const sessionId = urlSessionId || sessionStorage.getItem('chatSessionId') || null;

  // If we restored from sessionStorage during OAuth, push it back to the URL parameters
  useEffect(() => {
    if (sessionId && !urlSessionId) {
      setSearchParams((prev) => {
        prev.set('session', sessionId);
        return prev;
      }, { replace: true });
    }
  }, [sessionId, urlSessionId, setSearchParams]);

  const handleSessionChange = useCallback((id: string | null) => {
    if (id) {
      sessionStorage.setItem('chatSessionId', id);
      setSearchParams((prev) => {
        prev.set('session', id);
        return prev;
      }, { replace: true });
    } else {
      sessionStorage.removeItem('chatSessionId');
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  }, [setSearchParams]);

  return (
    <div className={styles.wrap}>
      <div className={styles.chatArea}>
        <ChatPanel sessionId={sessionId} onSessionChange={handleSessionChange} />
      </div>
    </div>
  );
}
