import { useEffect, useRef } from 'react';
import './Toast.css';

/** 對應每種 type 的圖示 */
const ICONS = {
  success: '✓',
  error:   '✕',
  warn:    '⚠',
  info:    'ℹ',
};

/**
 * ToastItem — 單則通知
 */
function ToastItem({ id, message, type, onDismiss }) {
  const ref = useRef(null);

  // 首次渲染後加上 --visible class 以觸發進場動畫
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 讓瀏覽器先完成一幀的繪製，再加 class
    requestAnimationFrame(() => el.classList.add('toast--visible'));
  }, []);

  return (
    <div
      ref={ref}
      className={`toast toast--${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <span className="toast__icon" aria-hidden="true">
        {ICONS[type] ?? ICONS.info}
      </span>
      <span className="toast__message">{message}</span>
      <button
        className="toast__close"
        onClick={() => onDismiss(id)}
        aria-label="關閉通知"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * ToastContainer — 渲染通知堆疊
 *
 * @param {{ toasts: Array, onDismiss: Function }} props
 */
export default function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-label="通知列表">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
