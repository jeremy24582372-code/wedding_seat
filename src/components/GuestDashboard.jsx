import { useDeferredValue, useMemo, useState } from 'react';
import GuestTable from './GuestTable';
import { buildCategoryOptions, normalizeCategory } from '../utils/constants';
import { buildGuestDashboardModel } from '../utils/guestDashboard';
import './GuestDashboard.css';

export default function GuestDashboard({
  state,
  stats,
  importLoading,
  onImport,
  onOpenAddGuest,
  onGoToSeats,
  onEditGuest,
  onDeleteGuest,
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const deferredSearch = useDeferredValue(search);

  const model = useMemo(
    () => buildGuestDashboardModel(state),
    [state]
  );
  const categoryOptions = useMemo(() => buildCategoryOptions(state.guests), [state.guests]);

  const visibleRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return model.rows.filter(row => {
      const matchSearch = query ? row.searchText.includes(query) : true;
      const matchCategory = categoryFilter ? normalizeCategory(row.category) === categoryFilter : true;
      return matchSearch && matchCategory;
    });
  }, [model.rows, deferredSearch, categoryFilter]);

  return (
    <main className="guest-dashboard" aria-label="賓客管理">
      <section className="guest-dashboard__header">
        <div>
          <p className="guest-dashboard__kicker">賓客管理</p>
          <h2 className="guest-dashboard__title">管理來源列、同行座位與桌次安排。</h2>
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
      </section>

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
