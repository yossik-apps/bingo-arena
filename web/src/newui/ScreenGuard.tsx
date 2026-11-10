/** @jsxRuntime automatic @jsxImportSource react */
import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Changing this clears a failure, for example when the player moves to another screen or tab. */
  resetKey?: string;
  /** Runs before the retry, for example to forget a screen that failed to load. */
  onRetry?: () => void;
  /** What failed, for the log and the screen reader. */
  label?: string;
};
type State = { failed: boolean; tries: number };

/**
 * Keeps a crash in one New screen or tab inside that screen. The shell around it (header, navigation, balances)
 * keeps working, and the player can try again without reloading the game. Wording and look are plain on purpose: this
 * must not depend on anything that might be what failed.
 */
export default class ScreenGuard extends Component<Props, State> {
  state: State = { failed: false, tries: 0 };
  static getDerivedStateFromError(): Partial<State> { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error(`New design: ${this.props.label ?? "screen"} failed`, e); }
  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  retry = () => {
    this.props.onRetry?.();
    // a new key remounts the children, so they load again from scratch
    this.setState((s) => ({ failed: false, tries: s.tries + 1 }));
  };
  render() {
    if (this.state.failed) {
      return (
        <div className="nu-guard" role="alert" style={{ display: "grid", gap: 12, justifyItems: "center", textAlign: "center", padding: "32px 16px" }}>
          <p style={{ margin: 0, fontWeight: 700 }}>This part could not load. Try again.</p>
          <button type="button" className="nu-btn nu-btn-gold nu-btn-md" onClick={this.retry}>Try again</button>
        </div>
      );
    }
    return <div key={this.state.tries} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
