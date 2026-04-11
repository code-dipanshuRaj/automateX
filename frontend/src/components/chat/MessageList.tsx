import type { ChatMessage, PlanPayload } from '@/types';
import MessageBubble from './MessageBubble';
import PlanCard from './PlanCard';
import ScopeAuthCard from './ScopeAuthCard';

interface MessageListProps {
  messages: ChatMessage[];
  onPlanApprove: (plan: PlanPayload) => void;
  onPlanReject: (plan: PlanPayload) => void;
}

export default function MessageList({
  messages,
  onPlanApprove,
  onPlanReject,
}: MessageListProps) {
  return (
    <>
      {messages.map((msg) => (
        <div key={msg.id} data-role={msg.role}>
          {/* Render auth card for system messages with authRequired */}
          {msg.role === 'system' && msg.authRequired ? (
            <>
              <MessageBubble message={msg} />
              <ScopeAuthCard authPayload={msg.authRequired} />
            </>
          ) : (
            <>
              <MessageBubble message={msg} />
              {msg.plan && msg.plan.status === 'pending' && (
                <PlanCard
                  plan={msg.plan}
                  onApprove={() => onPlanApprove(msg.plan!)}
                  onReject={() => onPlanReject(msg.plan!)}
                />
              )}
            </>
          )}
        </div>
      ))}
    </>
  );
}
