import { useMemo, useState } from 'react';
import { CATEGORIES, MAX_SEATS } from '../utils/constants';
import { DEFAULT_SEATING_RULES, normalizeSeatingRules } from '../utils/autoSeatPlanner';
import AutoSeatPreview from './AutoSeatPreview';
import './AutoSeatRulesModal.css';

const STRATEGY_OPTIONS = [
  { id: 'balanced', label: '平均分散', description: '優先讓桌次容量保持均衡。' },
  { id: 'category-first', label: '同類優先', description: '同分類賓客盡量集中，但仍遵守容量上限。' },
  { id: 'keep-existing', label: '保留既有脈絡', description: '優先延續指定桌次與已安排同行桌次。' },
];

export default function AutoSeatRulesModal({
  initialRules = DEFAULT_SEATING_RULES,
  preview,
  onPreview,
  onApply,
  onDraftChange,
  onClose,
}) {
  const [draftRules, setDraftRules] = useState(() => normalizeSeatingRules(initialRules));

  const selectedStrategy = useMemo(
    () => STRATEGY_OPTIONS.find(option => option.id === draftRules.fillStrategy) ?? STRATEGY_OPTIONS[0],
    [draftRules.fillStrategy]
  );

  const updateRule = (patch) => {
    setDraftRules(current => normalizeSeatingRules({ ...current, ...patch }));
    onDraftChange?.();
  };

  const updateCategoryLimit = (categoryId, value) => {
    const nextLimits = { ...draftRules.maxPerCategoryPerTable };
    const parsed = Number(value);
    if (!value || !Number.isFinite(parsed) || parsed < 1) {
      delete nextLimits[categoryId];
    } else {
      nextLimits[categoryId] = Math.min(MAX_SEATS, Math.floor(parsed));
    }
    updateRule({ maxPerCategoryPerTable: nextLimits });
  };

  return (
    <div className="auto-seat-modal" role="dialog" aria-modal="true" aria-labelledby="auto-seat-title">
      <div className="auto-seat-modal__panel">
        <header className="auto-seat-modal__header">
          <div>
            <p className="auto-seat-modal__kicker">自動排座規則</p>
            <h2 id="auto-seat-title">先預覽，再套用。</h2>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onClose} aria-label="關閉自動排座規則">
            關閉
          </button>
        </header>

        <div className="auto-seat-modal__body">
          <section className="auto-seat-modal__rules" aria-label="排座規則設定">
            <label className="auto-seat-modal__field">
              <span>填位策略</span>
              <select
                value={draftRules.fillStrategy}
                onChange={event => updateRule({ fillStrategy: event.target.value })}
              >
                {STRATEGY_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <small>{selectedStrategy.description}</small>
            </label>

            <div className="auto-seat-modal__switch-list">
              <label>
                <input
                  type="checkbox"
                  checked={draftRules.respectExistingAssignments}
                  onChange={event => updateRule({ respectExistingAssignments: event.target.checked })}
                />
                <span>保留目前已安排座位</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draftRules.preferFillIncompleteTables}
                  onChange={event => updateRule({ preferFillIncompleteTables: event.target.checked })}
                />
                <span>優先補滿已有賓客的桌次</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draftRules.keepGroupsTogether}
                  onChange={event => updateRule({ keepGroupsTogether: event.target.checked })}
                />
                <span>同行 party 盡量同桌</span>
              </label>
            </div>

            <fieldset className="auto-seat-modal__limits">
              <legend>每桌同分類上限</legend>
              <p>留空代表不限制；上限仍不能超過每桌 {MAX_SEATS} 位。</p>
              <div className="auto-seat-modal__limit-grid">
                {CATEGORIES.map(category => (
                  <label key={category.id}>
                    <span>{category.label}</span>
                    <input
                      type="number"
                      min="1"
                      max={MAX_SEATS}
                      inputMode="numeric"
                      value={draftRules.maxPerCategoryPerTable[category.id] ?? ''}
                      onChange={event => updateCategoryLimit(category.id, event.target.value)}
                      placeholder="不限"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <AutoSeatPreview preview={preview} />
        </div>

        <footer className="auto-seat-modal__footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => onPreview(draftRules)}>
            產生預覽
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={onApply}
            disabled={!preview || preview.summary.candidateMoveCount === 0}
          >
            套用預覽
          </button>
        </footer>
      </div>
    </div>
  );
}
