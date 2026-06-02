import './GuestDashboard.css';

const LEVEL_LABELS = {
  danger: '需修正',
  warning: '需確認',
  notice: '提醒',
  info: '摘要',
};

export default function GuestQualityPanel({ quality, onGoToSeats }) {
  const items = quality.items.slice(0, 8);

  return (
    <section className="guest-quality" aria-label="資料品質警示">
      <div className="guest-dashboard__section-head">
        <div>
          <p className="guest-dashboard__kicker">資料品質</p>
          <h2 className="guest-dashboard__section-title">需要先處理的名單狀態</h2>
        </div>
        <button className="btn btn-secondary" type="button" onClick={onGoToSeats}>
          前往座位圖
        </button>
      </div>

      <div className="guest-quality__summary" aria-label="品質統計">
        <span><strong>{quality.counts.danger}</strong> 需修正</span>
        <span><strong>{quality.counts.warning}</strong> 需確認</span>
        <span><strong>{quality.counts.notice}</strong> 提醒</span>
      </div>

      {items.length === 0 ? (
        <div className="guest-quality__empty">
          目前沒有偵測到拆桌、容量或未分配風險。
        </div>
      ) : (
        <ul className="guest-quality__list">
          {items.map(item => (
            <li className={`guest-quality__item guest-quality__item--${item.level}`} key={`${item.rowId}-${item.label}-${item.detail}`}>
              <span className="guest-quality__marker" aria-hidden="true" />
              <div>
                <div className="guest-quality__item-head">
                  <strong>{item.label}</strong>
                  <span>{LEVEL_LABELS[item.level] ?? '資訊'}</span>
                </div>
                <p>{item.detail}</p>
                <small>{item.sourceName}</small>
              </div>
            </li>
          ))}
        </ul>
      )}

      {quality.items.length > items.length ? (
        <p className="guest-quality__more">
          另有 {quality.items.length - items.length} 筆品質訊息，請用下方篩選查看。
        </p>
      ) : null}
    </section>
  );
}
