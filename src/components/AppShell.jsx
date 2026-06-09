import { useState } from 'react';
import PlannerTabs from './PlannerTabs';
import './AppShell.css';

export default function AppShell({
  activeTab,
  tabs,
  onTabChange,
  firebaseStatus,
  lastSaved,
  onManualSave,
  children,
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onManualSave?.();
    } finally {
      setSaving(false);
    }
  };

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
          <button
            id="manual-save-btn"
            className={`app-shell__save-btn${saving ? ' app-shell__save-btn--saving' : ''}`}
            onClick={handleSave}
            disabled={saving || firebaseStatus === 'unconfigured'}
            title={
              firebaseStatus === 'unconfigured'
                ? '本機模式，無法儲存'
                : saving
                  ? '儲存中…'
                  : '立即儲存至 Firebase'
            }
            aria-label="手動儲存"
          >
            <svg className="app-shell__save-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
              {saving ? (
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="8">
                  <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.8s" repeatCount="indefinite" />
                </circle>
              ) : (
                <>
                  <path d="M4 2h9.586L16 4.414V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M6 2v4h6V2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <rect x="5" y="10" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </>
              )}
            </svg>
            <span className="app-shell__save-label">{saving ? '儲存中' : '儲存'}</span>
          </button>
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
