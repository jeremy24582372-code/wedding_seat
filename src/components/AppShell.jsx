import PlannerTabs from './PlannerTabs';
import './AppShell.css';

export default function AppShell({
  activeTab,
  tabs,
  onTabChange,
  firebaseStatus,
  lastSaved,
  children,
}) {
  return (
    <div id="root-layout" className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand-block">
          <span className="app-shell__brand-mark" aria-hidden="true" />
          <div>
            <p className="app-shell__eyebrow">Jeremy &amp; Yuri Wedding Seating</p>
            <h1 className="app-shell__title">排座位幫手</h1>
          </div>
        </div>

        <div className="app-shell__status-group" aria-label="系統狀態">
          <span className={`app-shell__status-pill app-shell__status-pill--${firebaseStatus}`}>
            <span className="app-shell__status-dot" aria-hidden="true" />
            {firebaseStatus === 'connected'
              ? 'Firebase 已連線'
              : firebaseStatus === 'disconnected'
                ? 'Firebase 斷線'
                : '本機模式'}
          </span>
          {lastSaved ? (
            <span className="app-shell__saved">最後儲存 {formatSaved(lastSaved)}</span>
          ) : (
            <span className="app-shell__saved">尚未儲存</span>
          )}
        </div>
      </header>

      <PlannerTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />

      <div className="app-shell__main">
        {children}
      </div>
    </div>
  );
}

function formatSaved(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '時間未知';
  return d.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
