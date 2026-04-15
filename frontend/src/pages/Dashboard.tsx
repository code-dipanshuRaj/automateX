import { useState, useCallback } from 'react';
import ChatPanel from '@/components/chat/ChatPanel';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [sessionId, setSessionId] = useState<string | null>(
    () => sessionStorage.getItem('chatSessionId')
  );

  const handleSessionChange = useCallback((id: string | null) => {
    setSessionId(id);
    if (id) {
      sessionStorage.setItem('chatSessionId', id);
    } else {
      sessionStorage.removeItem('chatSessionId');
    }
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.chatArea}>
        <ChatPanel sessionId={sessionId} onSessionChange={handleSessionChange} />
      </div>
    </div>
  );
}
