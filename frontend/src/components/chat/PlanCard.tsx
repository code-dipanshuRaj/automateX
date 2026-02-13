import type { PlanPayload } from '@/types';
import styles from './PlanCard.module.css';

interface PlanCardProps {
  plan: PlanPayload;
  onApprove: () => void;
  onReject: () => void;
}

export default function PlanCard({ plan, onApprove, onReject }: PlanCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>Plan</span>
        {plan.summary && <p className={styles.summary}>{plan.summary}</p>}
      </div>
      <ul className={styles.steps}>
        {plan.steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.stepNum}>{i + 1}</span>
            <div>
              <span className={styles.stepAction}>{step.action}</span>
              {step.description && (
                <p className={styles.stepDesc}>{step.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button type="button" onClick={onApprove} className={styles.approve}>
          Approve
        </button>
        <button type="button" onClick={onReject} className={styles.reject}>
          Reject
        </button>
      </div>
    </div>
  );
}
