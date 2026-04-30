import { Component } from 'react';

/**
 * ErrorBoundary — catches uncaught render/lifecycle errors in the subtree
 * and renders a graceful fallback instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__box">
          <span className="error-boundary__icon">⚠️</span>
          <h2 className="error-boundary__title">應用程式發生錯誤</h2>
          <p className="error-boundary__desc">
            很抱歉，排座位幫手遇到了意外問題。<br />
            你的資料已儲存在 Firebase，重新整理後可恢復。
          </p>
          {this.state.error?.message && (
            <pre className="error-boundary__detail">{this.state.error.message}</pre>
          )}
          <button className="btn btn-primary error-boundary__btn" onClick={this.handleReload}>
            🔄 重新整理
          </button>
        </div>
      </div>
    );
  }
}
