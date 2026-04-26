import { useRef, useState } from 'react';
import { ragApi } from '@/api/client';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      setUploadStatus(`Uploading ${file.name}...`);
      const res = await ragApi.uploadDocument(file);
      setUploadStatus(`Uploaded ${file.name} successfully`);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err: any) {
      setUploadStatus(`Upload failed: ${err.message || 'Unknown error'}`);
      setTimeout(() => setUploadStatus(null), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.formWrapper}>
      {uploadStatus && <div className={styles.uploadStatus}>{uploadStatus}</div>}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.wrap}>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".pdf" 
            style={{ display: 'none' }} 
            onChange={handleFileChange} 
          />
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            title="Attach a PDF document"
            aria-label="Attach Document"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a task in plain language…"
            className={styles.input}
            rows={1}
            disabled={disabled || uploading}
            aria-label="Message"
          />
          <button
          type="submit"
          className={styles.send}
          disabled={disabled || !value.trim()}
          aria-label="Send"
        >
          Send
        </button>
      </div>
    </form>
    </div>
  );
}
