import { useState } from 'react';
import './AddGuestModal.css';
import { CATEGORIES } from '../utils/constants';

/**
 * Modal for adding a new guest OR editing an existing one.
 *
 * Props:
 *   onAdd          — ({ name, category, diet }) => void   (新增模式)
 *   onUpdate       — (guestId, patch)           => void   (編輯模式)
 *   onClose        — () => void
 *   initialGuest   — Guest object (傳入時進入「編輯」模式)
 */
export default function AddGuestModal({ onAdd, onUpdate, onClose, initialGuest }) {
  const isEditMode = Boolean(initialGuest);

  const [name, setName]         = useState(initialGuest?.name     ?? '');
  const [category, setCategory] = useState(initialGuest?.category ?? '其他');
  const [diet, setDiet]         = useState(initialGuest?.diet     ?? '葷食');
  const [error, setError]       = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('請填寫賓客姓名');
      return;
    }

    if (isEditMode) {
      onUpdate(initialGuest.id, { name: name.trim(), category, diet });
    } else {
      onAdd({ name: name.trim(), category, diet });
    }
    onClose();
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-guest-modal-title"
    >
      <div className="modal">
        <header className="modal__header">
          <h2 className="modal__title" id="add-guest-modal-title">
            {isEditMode ? '編輯賓客' : '新增賓客'}
          </h2>
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="關閉"
          >
            ✕
          </button>
        </header>

        <form className="modal__form" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="modal__field">
            <label className="modal__label" htmlFor="guest-name">
              姓名 <span className="modal__required">*</span>
            </label>
            <input
              id="guest-name"
              className={`modal__input ${error ? 'modal__input--error' : ''}`}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="請輸入賓客姓名"
              autoFocus
              maxLength={30}
            />
            {error && <span className="modal__error">{error}</span>}
          </div>

          {/* Category */}
          <div className="modal__field">
            <label className="modal__label" htmlFor="guest-category">關係分類</label>
            <select
              id="guest-category"
              className="modal__input modal__select"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Diet */}
          <div className="modal__field">
            <label className="modal__label" htmlFor="guest-diet">飲食</label>
            <select
              id="guest-diet"
              className="modal__input modal__select"
              value={diet}
              onChange={e => setDiet(e.target.value)}
            >
              <option value="葷食">🍖 葷食</option>
              <option value="素食">🥦 素食</option>
              <option value="清真">🌙 清真</option>
              <option value="其他">其他</option>
            </select>
          </div>

          {/* Actions */}
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              id="btn-cancel-add-guest"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              id="btn-confirm-add-guest"
            >
              {isEditMode ? '儲存' : '新增'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
