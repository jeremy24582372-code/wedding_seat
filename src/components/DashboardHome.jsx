import { useEffect, useMemo, useRef, useState } from 'react';
import ProgressSummary from './ProgressSummary';
import './DashboardHome.css';

const FIREBASE_LABELS = {
  connected: 'Firebase 已連線',
  disconnected: 'Firebase 斷線',
  unconfigured: '本機模式',
};

export default function DashboardHome({
  state,
  stats,
  firebaseStatus,
  lastSaved,
  importLoading,
  onImport,
  onOpenAddGuest,
  onGoToSeats,
  onExportPDF,
  onExportFloorPDF,
  onExportFloorDesignPNG,
  onExportFloorDesignPrompt,
  onSyncSheets,
}) {
  const [syncState, setSyncState] = useState('idle');
  const syncTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const dashboard = useMemo(() => buildDashboardState(state, stats, firebaseStatus), [state, stats, firebaseStatus]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
  }, []);

  const handleSync = async () => {
    setSyncState('syncing');
    try {
      await onSyncSheets();
      if (!mountedRef.current) return;
      setSyncState('success');
    } catch {
      if (!mountedRef.current) return;
      setSyncState('error');
    }

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => setSyncState('idle'), 3000);
  };

  return (
    <main className="dashboard-home" aria-label="總覽工作台">
      <section className="dashboard-home__intro">
        <div>
          <p className="dashboard-home__kicker">婚禮排座工作台</p>
          <h2 className="dashboard-home__title">先看進度，再進畫布。</h2>
        </div>
        <div className="dashboard-home__primary-actions" aria-label="主要操作">
          <button className="btn btn-primary" type="button" onClick={onImport} disabled={importLoading}>
            {importLoading ? '匯入中' : '匯入名單'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onGoToSeats}>
            前往座位圖
          </button>
          <button className="btn btn-secondary" type="button" onClick={onExportPDF}>
            匯出座位表
          </button>
          <button className="btn btn-secondary" type="button" onClick={onExportFloorPDF}>
            匯出桌次圖
          </button>
          <button className="btn btn-secondary" type="button" onClick={onExportFloorDesignPNG}>
            匯出設計圖
          </button>
        </div>
      </section>

      <section className="dashboard-home__metric-grid" aria-label="排座統計">
        {dashboard.metrics.map(metric => (
          <article className="dashboard-home__metric" key={metric.label}>
            <span className="dashboard-home__metric-label">{metric.label}</span>
            <strong className="dashboard-home__metric-value">{metric.value}</strong>
            <span className="dashboard-home__metric-note">{metric.note}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-home__content-grid">
        <ProgressSummary
          assignedSeats={stats.assignedSeats}
          seatTotal={stats.seatTotal}
          tableCapacity={dashboard.tableCapacity}
        />

        <section className="dashboard-home__panel dashboard-home__panel--actions" aria-label="快速操作">
          <div>
            <p className="dashboard-home__section-kicker">下一步</p>
            <h2 className="dashboard-home__section-title">快速處理</h2>
          </div>
          <div className="dashboard-home__action-list">
            <button className="dashboard-home__action" type="button" onClick={onOpenAddGuest}>
              <span>新增賓客</span>
              <small>手動補一位座位需求</small>
            </button>
            <button className="dashboard-home__action" type="button" onClick={onGoToSeats}>
              <span>安排座位</span>
              <small>{stats.unassignedSeats > 0 ? `尚有 ${stats.unassignedSeats} 位未分配` : '目前沒有未分配座位'}</small>
            </button>
            <button
              className="dashboard-home__action"
              type="button"
              onClick={handleSync}
              disabled={syncState === 'syncing'}
            >
              <span>{syncState === 'syncing' ? '同步中' : syncState === 'error' ? '同步失敗' : syncState === 'success' ? '同步完成' : '同步試算表'}</span>
              <small>把目前排位結果回寫</small>
            </button>
            <button className="dashboard-home__action" type="button" onClick={onExportFloorPDF}>
              <span>匯出桌次圖</span>
              <small>交付場地的桌位位置圖</small>
            </button>
            <button className="dashboard-home__action" type="button" onClick={onExportFloorDesignPrompt}>
              <span>AI 生圖提示詞</span>
              <small>搭配設計圖做視覺美化</small>
            </button>
          </div>
        </section>

        <section className="dashboard-home__panel dashboard-home__panel--tasks" aria-label="待辦檢查">
          <div>
            <p className="dashboard-home__section-kicker">檢查</p>
            <h2 className="dashboard-home__section-title">待處理項目</h2>
          </div>
          <ul className="dashboard-home__task-list">
            {dashboard.tasks.map(task => (
              <li className={`dashboard-home__task dashboard-home__task--${task.state}`} key={task.label}>
                <span className="dashboard-home__task-dot" aria-hidden="true" />
                <div>
                  <strong>{task.label}</strong>
                  <span>{task.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-home__panel dashboard-home__panel--status" aria-label="系統摘要">
          <div>
            <p className="dashboard-home__section-kicker">狀態</p>
            <h2 className="dashboard-home__section-title">同步與儲存</h2>
          </div>
          <dl className="dashboard-home__status-list">
            <div>
              <dt>Firebase</dt>
              <dd>{FIREBASE_LABELS[firebaseStatus] ?? '狀態未知'}</dd>
            </div>
            <div>
              <dt>最後儲存</dt>
              <dd>{formatSaved(lastSaved)}</dd>
            </div>
            <div>
              <dt>桌次容量</dt>
              <dd>{stats.assignedSeats} / {dashboard.tableCapacity}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}

function buildDashboardState(state, stats, firebaseStatus) {
  const tableCapacity = (state.tables ?? []).reduce((sum, table) => sum + (table.seats ?? 10), 0);
  const fullTableCount = (state.tables ?? []).filter(table =>
    (table.guestIds ?? []).filter(Boolean).length >= (table.seats ?? 10)
  ).length;
  const incompletePartyCount = countIncompleteParties(state);
  const categoryReviewCount = (state.guests ?? []).filter(guest => !guest.category || guest.category === '其他').length;

  const tasks = [
    {
      label: '名單匯入',
      detail: stats.partyTotal > 0 ? `${stats.partyTotal} 筆來源已在工作台` : '尚未匯入來源名單',
      state: stats.partyTotal > 0 ? 'done' : 'warning',
    },
    {
      label: '未分配座位',
      detail: stats.unassignedSeats > 0 ? `${stats.unassignedSeats} 位等待安排` : '所有座位需求已安排',
      state: stats.unassignedSeats > 0 ? 'warning' : 'done',
    },
    {
      label: '滿桌狀態',
      detail: fullTableCount > 0 ? `${fullTableCount} 桌已滿` : '目前沒有滿桌',
      state: fullTableCount > 0 ? 'notice' : 'done',
    },
    {
      label: '同行完整性',
      detail: incompletePartyCount > 0 ? `${incompletePartyCount} 組同行需確認` : '未偵測到拆桌或半安置同行',
      state: incompletePartyCount > 0 ? 'warning' : 'done',
    },
    {
      label: '分類確認',
      detail: categoryReviewCount > 0 ? `${categoryReviewCount} 位使用其他或空分類` : '分類已完成',
      state: categoryReviewCount > 0 ? 'notice' : 'done',
    },
    {
      label: '同步狀態',
      detail: firebaseStatus === 'connected' ? '自動儲存可用' : '目前不在 Firebase 連線狀態',
      state: firebaseStatus === 'connected' ? 'done' : 'notice',
    },
  ];

  return {
    tableCapacity,
    metrics: [
      { label: '來源筆數', value: stats.partyTotal, note: 'Google Sheets 來源列' },
      { label: '實際人數', value: stats.seatTotal, note: '需要安排的座位' },
      { label: '已分配座位', value: stats.assignedSeats, note: `${stats.seatTotal > 0 ? Math.round((stats.assignedSeats / stats.seatTotal) * 100) : 0}% 完成` },
      { label: '未分配座位', value: stats.unassignedSeats, note: stats.unassignedSeats > 0 ? '需進座位圖處理' : '無待安排座位' },
      { label: '桌次數', value: state.tables.length, note: `總容量 ${tableCapacity} 位` },
      { label: '滿桌數', value: fullTableCount, note: fullTableCount > 0 ? '容量已滿' : '仍有餘裕' },
    ],
    tasks,
  };
}

function countIncompleteParties(state) {
  const guestsById = new Map((state.guests ?? []).map(guest => [guest.id, guest]));

  return (state.partyRows ?? []).filter(row => {
    const tableIds = (row.guestIds ?? []).map(id => guestsById.get(id)?.tableId ?? null);
    const assignedCount = tableIds.filter(Boolean).length;
    const assignedTables = new Set(tableIds.filter(Boolean));
    return (assignedCount > 0 && assignedCount < tableIds.length) || assignedTables.size > 1;
  }).length;
}

function formatSaved(iso) {
  if (!iso) return '尚未儲存';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '時間未知';
  return d.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
