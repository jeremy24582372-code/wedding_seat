import { useDeferredValue, useMemo, useState } from 'react';
import GuestQualityPanel from './GuestQualityPanel';
import GuestTable from './GuestTable';
import { buildCategoryOptions, normalizeCategory } from '../utils/constants';
import { buildGuestDashboardModel } from '../utils/guestDashboard';
import './GuestDashboard.css';

const STATUS_OPTIONS = [
  { id: '', label: '全部狀態' },
  { id: 'assigned', label: '已分配' },
  { id: 'unassigned', label: '未分配' },
  { id: 'partial', label: '部分安排' },
  { id: 'split', label: '拆桌' },
  { id: 'target-conflict', label: '指定衝突' },
  { id: 'needs-review', label: '有品質警示' },
];

export default function GuestDashboard({
  state,
  stats,
  importSummary,
  importLoading,
  onImport,
  onOpenAddGuest,
  onGoToSeats,
  onEditGuest,
  onDeleteGuest,
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const deferredSearch = useDeferredValue(search);

  const model = useMemo(
    () => buildGuestDashboardModel(state, importSummary),
    [state, importSummary]
  );
  const categoryOptions = useMemo(() => buildCategoryOptions(state.guests), [state.guests]);

  const visibleRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return model.rows.filter(row => {
      const matchSearch = query ? row.searchText.includes(query) : true;
      const matchCategory = categoryFilter ? normalizeCategory(row.category) === categoryFilter : true;
      const matchStatus = statusFilter === 'needs-review'
        ? row.issues.length > 0
        : statusFilter
          ? row.status === statusFilter
          : true;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [model.rows, deferredSearch, categoryFilter, statusFilter]);

  return (
    <main className="guest-dashboard" aria-label="賓客管理">
      <section className="guest-dashboard__header">
        <div>
          <p className="guest-dashboard__kicker">賓客管理</p>
          <h2 className="guest-dashboard__title">檢查來源列、同行座位與資料品質。</h2>
        </div>
        <div className="guest-dashboard__actions">
          <button className="btn btn-primary" type="button" onClick={onImport} disabled={importLoading}>
            {importLoading ? '匯入中' : '匯入名單'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onOpenAddGuest}>
            新增賓客
          </button>
          <button className="btn btn-secondary" type="button" onClick={onGoToSeats}>
            座位圖
          </button>
        </div>
      </section>

      <section className="guest-dashboard__metric-grid" aria-label="賓客統計">
        <Metric label="來源筆數" value={stats.partyTotal} note="與總覽一致" />
        <Metric label="實際人數" value={stats.seatTotal} note="展開後座位需求" />
        <Metric label="已分配" value={stats.assignedSeats} note={`${stats.seatTotal > 0 ? Math.round((stats.assignedSeats / stats.seatTotal) * 100) : 0}% 完成`} />
        <Metric label="未分配" value={stats.unassignedSeats} note="需進座位圖處理" />
        <Metric label="品質警示" value={model.quality.totalIssueCount} note={model.quality.hasBlockingIssue ? '有需確認項目' : '目前無阻塞'} />
      </section>

      <div className="guest-dashboard__quality-grid">
        <GuestQualityPanel quality={model.quality} onGoToSeats={onGoToSeats} />
        <section className="guest-dashboard__table-status" aria-label="桌次狀態">
          <div className="guest-dashboard__section-head">
            <div>
              <p className="guest-dashboard__kicker">桌次狀態</p>
              <h2 className="guest-dashboard__section-title">容量檢視</h2>
            </div>
          </div>
          <div className="guest-dashboard__table-strip">
            {model.tableSummaries.map(table => (
              <span className={`guest-dashboard__table-chip guest-dashboard__table-chip--${table.state}`} key={table.id}>
                <strong>{table.label}</strong>
                <small>{table.occupied}/{table.seats}</small>
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="guest-dashboard__filters" aria-label="賓客篩選">
        <label>
          <span>搜尋</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="姓名、桌次、飲食或同行角色"
          />
        </label>
        <label>
          <span>分類</span>
          <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
            <option value="">全部分類</option>
            {categoryOptions.map(category => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>狀態</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            {STATUS_OPTIONS.map(status => (
              <option key={status.id} value={status.id}>{status.label}</option>
            ))}
          </select>
        </label>
        <div className="guest-dashboard__filter-result" aria-live="polite">
          顯示 {visibleRows.length} / {model.rows.length} 筆
        </div>
      </section>

      <GuestTable
        rows={visibleRows}
        onEditGuest={onEditGuest}
        onDeleteGuest={onDeleteGuest}
      />
    </main>
  );
}

function Metric({ label, value, note }) {
  return (
    <article className="guest-dashboard__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
