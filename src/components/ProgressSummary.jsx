export default function ProgressSummary({ assignedSeats, seatTotal, tableCapacity }) {
  const seatingRate = seatTotal > 0 ? Math.round((assignedSeats / seatTotal) * 100) : 0;
  const capacityRate = tableCapacity > 0 ? Math.round((assignedSeats / tableCapacity) * 100) : 0;

  return (
    <section className="progress-summary" aria-label="排座進度">
      <div className="progress-summary__header">
        <div>
          <p className="dashboard-home__section-kicker">進度</p>
          <h2 className="dashboard-home__section-title">排座完成度</h2>
        </div>
        <strong className="progress-summary__value">{seatingRate}%</strong>
      </div>

      <div className="progress-summary__bars">
        <ProgressBar label="座位需求完成" value={seatingRate} />
        <ProgressBar label="場地容量使用" value={capacityRate} tone="muted" />
      </div>
    </section>
  );
}

function ProgressBar({ label, value, tone = 'accent' }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={`progress-summary__bar progress-summary__bar--${tone}`}>
      <div className="progress-summary__bar-label">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="progress-summary__track" aria-hidden="true">
        <span style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
