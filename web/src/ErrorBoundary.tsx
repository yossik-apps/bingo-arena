import { Component, type ReactNode } from "react";

/** Catches a crash in any screen and shows a way out instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error(e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="shell" style={{ paddingTop: 40 }}>
        <section className="box" role="alert">
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p>The game could not load this screen. This usually fixes itself with a refresh, for example after we release an update.</p>
          <button className="btn" onClick={() => window.location.reload()}>Reload the game</button>
        </section>
      </div>
    );
  }
}
