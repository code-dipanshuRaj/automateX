import type { ChatMessage } from '@/types';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={isUser ? `${styles.bubble} ${styles.user}` : `${styles.bubble} ${styles.assistant}`}
      data-role={message.role}
    >
      <div className={styles.content}>{message.content}</div>
      <span className={styles.time}>{formatTime(message.timestamp)}</span>
    </div>
  );
}
