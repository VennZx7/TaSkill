import type { TaskStatus } from '../types/item';
import { formatRemaining, formatToWIB, getUrgency, INVALID_DATE_LABEL } from '../utils/date';
import { Badge, type BadgeTone } from './ui/Badge';
import styles from './DeadlineBadge.module.css';

interface DeadlineBadgeProps {
  deadline: string;
  status: TaskStatus;
  now?: number;
}

const TONE_BY_URGENCY: Record<Exclude<ReturnType<typeof getUrgency>, 'invalid'>, BadgeTone> = {
  overdue: 'danger',
  critical: 'danger',
  approaching: 'warning',
  safe: 'neutral',
};

export function DeadlineBadge({ deadline, status, now = Date.now() }: DeadlineBadgeProps) {
  const urgency = getUrgency(deadline, now);

  if (urgency === 'invalid') {
    return <Badge tone="neutral">{INVALID_DATE_LABEL}</Badge>;
  }

  // A finished task is not a deadline problem, so it never keeps the urgent tone.
  const tone = status === 'Done' && (urgency === 'overdue' || urgency === 'critical')
    ? 'neutral'
    : TONE_BY_URGENCY[urgency];

  return (
    <span className={styles.wrapper}>
      <Badge tone={tone} dot>
        {formatToWIB(deadline)} WIB
      </Badge>
      <span className={styles.remaining}>{formatRemaining(deadline, now)}</span>
    </span>
  );
}
