import { useState, useCallback, useRef } from 'react';

/**
 * useToast — 全域輕量通知系統
 *
 * 使用方式：
 *   const { toasts, toast } = useToast();
 *   toast.success('儲存成功');
 *   toast.error('匯入失敗：' + err.message);
 *   toast.info('正在同步…');
 *   toast.warn('座位已滿');
 *
 * @param {number} defaultDuration  每則通知預設顯示時間 (ms)，預設 3500
 */
export function useToast(defaultDuration = 3500) {
  const [toasts, setToasts] = useState([]);
  const timerMap = useRef({}); // id → timeoutId

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timerMap.current[id]);
    delete timerMap.current[id];
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = defaultDuration) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      setToasts((prev) => [
        ...prev.slice(-4), // 最多同時顯示 5 則（新增前先限制舊的）
        { id, message, type },
      ]);

      timerMap.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [defaultDuration, dismiss]
  );

  // 語意化快捷方法
  const toast = {
    success: (msg, dur) => push(msg, 'success', dur),
    error:   (msg, dur) => push(msg, 'error',   dur ?? 5000), // error 預設留更久
    info:    (msg, dur) => push(msg, 'info',     dur),
    warn:    (msg, dur) => push(msg, 'warn',     dur),
    dismiss,
  };

  return { toasts, toast };
}
