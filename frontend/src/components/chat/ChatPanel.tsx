import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanPayload } from '@/types';
import { chatApi, planApi } from '@/api/client';
import type { ChatMessage } from '@/types';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  sessionId: string | null;
  onSessionChange: (id: string | null) => void;
}

export default function ChatPanel({ sessionId, onSessionChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Tracks plans by ID so history reloads don't lose plan data
  const planCacheRef = useRef<Map<string, PlanPayload>>(new Map());
  // Skip history reload when we just sent a message and already have the response
  const skipNextHistoryRef = useRef(false);

  const loadHistory = useCallback(async (sid: string) => {
    // If we just sent a message, skip reloading from server — we already have latest state
    if (skipNextHistoryRef.current) {
      skipNextHistoryRef.current = false;
      return;
    }
    try {
      const res = await chatApi.getHistory(sid);
      // Re-attach cached plan data to messages (server history doesn't persist plans)
      const msgs = (res.messages ?? []).map((m) => {
        if (m.plan?.id && planCacheRef.current.has(m.plan.id)) {
          return { ...m, plan: planCacheRef.current.get(m.plan.id)! };
        }
        return m;
      });
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (sessionId) loadHistory(sessionId);
    else setMessages([]);
  }, [sessionId, loadHistory]);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Check for pending message after incremental auth ───────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scopeGranted = params.get('scope_granted');
    const pendingMessage = sessionStorage.getItem('pendingChatMessage');

    if (scopeGranted && pendingMessage) {
      // Clear the pending message
      sessionStorage.removeItem('pendingChatMessage');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-resend the original message
      handleSend(pendingMessage);
    } else if (scopeGranted) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(
    async (text: string) => {
      setError(null);
      setLoading(true);
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      scrollToBottom();

      try {
        const res = await chatApi.sendMessage({ text, sessionId: sessionId ?? undefined });

        // Cache plan data so history reloads don't lose it
        if (res.plan) {
          planCacheRef.current.set(res.plan.id, res.plan);
        }

        // Prevent the useEffect from re-fetching history and overwriting our state
        if (res.sessionId !== sessionId) {
          skipNextHistoryRef.current = true;
        }
        onSessionChange(res.sessionId);

        // Check if auth is required
        if (res.authRequired) {
          const authMsg: ChatMessage = {
            id: res.message.id,
            role: 'system',
            content: res.message.content,
            timestamp: res.message.timestamp,
            authRequired: res.authRequired,
          };
          setMessages((prev) => [...prev, authMsg]);
        } else {
          // Normal assistant response
          setMessages((prev) => [
            ...prev,
            {
              id: res.message.id,
              role: res.message.role,
              content: res.message.content,
              timestamp: res.message.timestamp,
              plan: res.plan ?? undefined,
            },
          ]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      } finally {
        setLoading(false);
      }
    },
    [sessionId, onSessionChange, scrollToBottom]
  );

  const handlePlanAction = useCallback(
    async (planId: string, action: 'approve' | 'reject') => {
      try {
        if (action === 'approve') {
          // Mark plan as approved in the UI immediately
          setMessages((prev) =>
            prev.map((m) =>
              m.plan?.id === planId
                ? { ...m, plan: m.plan ? { ...m.plan, status: 'approved' as const } : undefined }
                : m
            )
          );

          const result = await planApi.approve(planId);

          // Update plan status to completed and add execution result as a new message
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.plan?.id === planId
                ? { ...m, plan: m.plan ? { ...m.plan, status: 'executed' as const } : undefined }
                : m
            );
            // Append execution result message
            updated.push({
              id: `exec-${Date.now()}`,
              role: 'assistant' as const,
              content: result.execution?.reply ?? 'Plan executed.',
              timestamp: new Date().toISOString(),
            });
            return updated;
          });
        } else {
          await planApi.reject(planId);
          setMessages((prev) =>
            prev.map((m) =>
              m.plan?.id === planId
                ? { ...m, plan: m.plan ? { ...m.plan, status: 'rejected' as const } : undefined }
                : m
            )
          );
        }
      } catch {
        // show toast or inline error
      }
    },
    []
  );

  return (
    <div className={styles.root}>
      <div className={styles.listWrap} ref={listRef}>
        {messages.length === 0 && !loading && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Describe what you want to do</p>
            <p className={styles.emptyHint}>
              e.g. "Schedule a meeting tomorrow at 2pm" or "Send an email to John about the report"
            </p>
          </div>
        )}
        <MessageList
          messages={messages}
          onPlanApprove={(plan) => handlePlanAction(plan.id, 'approve')}
          onPlanReject={(plan) => handlePlanAction(plan.id, 'reject')}
        />
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
