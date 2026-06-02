import { useState } from 'react';
import { getCategoryVisual } from '../utils/constants';
import './GuestDashboard.css';

const STATUS_LABELS = {
  assigned: '已分配',
  unassigned: '未分配',
  partial: '部分安排',
  split: '拆桌',
  'target-conflict': '指定衝突',
};

export default function GuestTable({ rows, onEditGuest, onDeleteGuest }) {
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const handleDelete = (guest) => {
    if (pendingDeleteId === guest.id) {
      onDeleteGuest(guest.id);
      setPendingDeleteId(null);
      return;
    }
    setPendingDeleteId(guest.id);
  };

  if (rows.length === 0) {
    return (
      <section className="guest-table-shell" aria-label="賓客資料表">
        <div className="guest-table__empty">
          沒有符合目前搜尋或篩選條件的賓客資料。
        </div>
      </section>
    );
  }

  return (
    <section className="guest-table-shell" aria-label="賓客資料表">
      <div className="guest-table-scroll">
        <table className="guest-table">
          <thead>
            <tr>
              <th>來源 / Party</th>
              <th>分類</th>
              <th>人數</th>
              <th>桌次狀態</th>
              <th>座位單位</th>
              <th>品質</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className={`guest-table__row guest-table__row--${row.status}`}>
                <td>
                  <div className="guest-table__party">
                    <strong>{row.sourceName}</strong>
                    <span>{row.type === 'party' ? 'Google Sheets 來源列' : '手動新增'}</span>
                    {row.tableLabel ? <small>指定：{row.tableLabel}</small> : null}
                  </div>
                </td>
                <td>
                  <CategoryBadge category={row.category} />
                </td>
                <td>
                  <div className="guest-table__number">
                    <strong>{row.headcount}</strong>
                    <span>展開 {row.units.length} 位</span>
                  </div>
                </td>
                <td>
                  <div className="guest-table__status-block">
                    <span className={`guest-table__status guest-table__status--${row.status}`}>
                      {STATUS_LABELS[row.status] ?? '狀態未知'}
                    </span>
                    <small>{row.tableSummary}</small>
                  </div>
                </td>
                <td>
                  <div className="guest-table__units">
                    {row.units.map(unit => (
                      <div className="guest-table__unit" key={unit.id}>
                        <span>
                          <strong>{unit.name}</strong>
                          <small>{unit.role} ｜ {unit.tableLabel || '未分配'}</small>
                        </span>
                        <div className="guest-table__unit-actions">
                          <button type="button" onClick={() => onEditGuest(unit.guest)}>
                            編輯
                          </button>
                          <button
                            type="button"
                            className={pendingDeleteId === unit.id ? 'guest-table__delete guest-table__delete--confirm' : 'guest-table__delete'}
                            onClick={() => handleDelete(unit.guest)}
                          >
                            {pendingDeleteId === unit.id ? '再按刪除' : '刪除'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </td>
                <td>
                  {row.issues.length === 0 ? (
                    <span className="guest-table__quality guest-table__quality--ok">正常</span>
                  ) : (
                    <div className="guest-table__issue-list">
                      {row.issues.map(issue => (
                        <span className={`guest-table__quality guest-table__quality--${issue.level}`} key={`${issue.label}-${issue.detail}`}>
                          {issue.label}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CategoryBadge({ category }) {
  const visual = getCategoryVisual(category);
  return (
    <span
      className="guest-table__category"
      style={{
        '--guest-category-color': visual.color,
        '--guest-category-bg': visual.background,
      }}
    >
      {visual.label}
    </span>
  );
}
