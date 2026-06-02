export default function AutoSeatPreview({ preview }) {
  if (!preview) {
    return (
      <section className="auto-seat-preview auto-seat-preview--empty" aria-label="自動排座預覽">
        <p>尚未產生預覽。調整規則後按「產生預覽」，系統會先列出建議，不會直接改動座位。</p>
      </section>
    );
  }

  const { summary, moves, createdTables, blocked } = preview;
  const visibleMoves = moves.slice(0, 12);
  const hiddenMoveCount = Math.max(0, moves.length - visibleMoves.length);

  return (
    <section className="auto-seat-preview" aria-label="自動排座預覽">
      <div className="auto-seat-preview__summary" aria-label="預覽摘要">
        <Metric label="建議安排" value={summary.candidateMoveCount} note="位座位需求" />
        <Metric label="新增桌次" value={summary.createdTableCount} note="張" />
        <Metric label="無法安排" value={summary.blockedCount} note="組或座位" />
        <Metric label="套用後未分配" value={summary.unassignedAfterCount} note="位" />
      </div>

      {createdTables.length > 0 && (
        <div className="auto-seat-preview__section">
          <h3>預計新增桌次</h3>
          <div className="auto-seat-preview__chips">
            {createdTables.map(table => (
              <span key={table.id}>{table.label}</span>
            ))}
          </div>
        </div>
      )}

      <div className="auto-seat-preview__section">
        <h3>建議移動</h3>
        {moves.length === 0 ? (
          <p className="auto-seat-preview__muted">目前沒有需要移動的座位。</p>
        ) : (
          <>
            <ul className="auto-seat-preview__move-list">
              {visibleMoves.map(move => (
                <li key={move.guestId}>
                  <strong>{move.guestName}</strong>
                  <span>{move.fromTableLabel} → {move.toTableLabel}</span>
                </li>
              ))}
            </ul>
            {hiddenMoveCount > 0 && (
              <p className="auto-seat-preview__muted">另有 {hiddenMoveCount} 位建議移動未列出。</p>
            )}
          </>
        )}
      </div>

      <div className="auto-seat-preview__section">
        <h3>無法安排原因</h3>
        {blocked.length === 0 ? (
          <p className="auto-seat-preview__muted">沒有無法安排的項目。</p>
        ) : (
          <ul className="auto-seat-preview__blocked-list">
            {blocked.map(item => (
              <li key={item.id}>
                <strong>{item.sourceName}</strong>
                <span>{item.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, note }) {
  return (
    <article className="auto-seat-preview__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
