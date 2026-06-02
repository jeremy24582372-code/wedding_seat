import './LockBadge.css';

export default function LockBadge({ locked, compact = false }) {
  if (!locked) return null;

  return (
    <span className={`lock-badge${compact ? ' lock-badge--compact' : ''}`} title="已鎖定，auto-seat 不會移動">
      鎖
    </span>
  );
}
