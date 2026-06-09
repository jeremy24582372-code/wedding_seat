import './DragGuestToken.css';
import { getCategoryVisual } from '../utils/constants';
import LockBadge from './LockBadge';

export default function DragGuestToken({ guest, locked = false }) {
  const categoryVisual = getCategoryVisual(guest.category);
  const partyMark = guest.partyId
    ? guest.partyRole === 'companion' ? '同' : '主'
    : '';

  return (
    <div
      className={[
        'drag-guest-token',
        guest.partyId ? 'drag-guest-token--party' : '',
        guest.partyRole === 'companion' ? 'drag-guest-token--companion' : '',
        locked ? 'drag-guest-token--locked' : '',
      ].filter(Boolean).join(' ')}
      style={{
        '--drag-token-border': categoryVisual.floorBorder,
        '--drag-token-bg': categoryVisual.floorBackground,
      }}
      title={`${guest.name}｜${categoryVisual.label}`}
      aria-label={`拖曳 ${guest.name} 到座位`}
    >
      <span className="drag-guest-token__name">{guest.name}</span>
      {partyMark && (
        <span className="drag-guest-token__party" aria-hidden="true">
          {partyMark}
        </span>
      )}
      <span className="drag-guest-token__lock">
        <LockBadge locked={locked} compact />
      </span>
    </div>
  );
}
