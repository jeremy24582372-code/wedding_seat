import { useState, useRef, useEffect, useCallback } from 'react';
import './PasswordGate.css';

const SESSION_KEY = 'wedding_auth';
// SHA-256 雜湊值由 Vite 在 build 時從環境變數注入
// 原始明碼密碼永遠不會出現在原始碼裡
const EXPECTED_HASH = import.meta.env.VITE_PASSWORD_HASH ?? '';

/**
 * 使用 Web Crypto API 計算字串的 SHA-256 雜湊（小寫 hex）
 */
async function sha256(text) {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * PasswordGate — 全螢幕密碼鎖
 * 正確後將驗證結果存入 sessionStorage（關閉分頁即失效）。
 * 密碼以 SHA-256 雜湊值比對，原始碼中不保存明碼。
 */
export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!input || checking) return;
    setChecking(true);
    try {
      const hash = await sha256(input);
      if (hash === EXPECTED_HASH) {
        sessionStorage.setItem(SESSION_KEY, '1');
        setUnlocked(true);
      } else {
        setShake(true);
        setInput('');
        setTimeout(() => {
          setShake(false);
          inputRef.current?.focus();
        }, 600);
      }
    } finally {
      setChecking(false);
    }
  }, [input, checking]);

  if (unlocked) return children;

  return (
    <div className="pw-gate">
      {/* Decorative background rings */}
      <div className="pw-gate__bg-ring pw-gate__bg-ring--1" aria-hidden="true" />
      <div className="pw-gate__bg-ring pw-gate__bg-ring--2" aria-hidden="true" />
      <div className="pw-gate__bg-ring pw-gate__bg-ring--3" aria-hidden="true" />

      <div className="pw-gate__card">
        {/* Icon */}
        <div className="pw-gate__icon" aria-hidden="true">
          💍
        </div>

        {/* Heading */}
        <h1 className="pw-gate__title">婚禮座位規劃</h1>
        <p className="pw-gate__subtitle">請輸入密碼以進入系統</p>

        {/* Form */}
        <form className="pw-gate__form" onSubmit={handleSubmit} noValidate>
          <div className={`pw-gate__input-wrap ${shake ? 'pw-gate__input-wrap--shake' : ''}`}>
            <input
              ref={inputRef}
              id="pw-input"
              className="pw-gate__input"
              type={showPw ? 'text' : 'password'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入密碼"
              autoComplete="current-password"
              aria-label="密碼"
              disabled={checking}
            />
            <button
              type="button"
              className="pw-gate__eye-btn"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
              tabIndex={-1}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          <button
            type="submit"
            className="pw-gate__submit"
            disabled={input.length === 0 || checking}
          >
            {checking ? '驗證中…' : '進入系統'}
          </button>
        </form>
      </div>
    </div>
  );
}
