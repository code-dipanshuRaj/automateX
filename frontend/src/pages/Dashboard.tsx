import { useState } from 'react';
import ChatPanel from '@/components/chat/ChatPanel';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className={styles.wrap}>
      <div className={styles.chatArea}>
        <ChatPanel sessionId={sessionId} onSessionChange={setSessionId} />
      </div>
    </div>
  );
}
