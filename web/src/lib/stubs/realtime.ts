// Stands in for @supabase/realtime-js in the build (vite.config.ts, supabaseStubs). The game never opens a Realtime channel,
// so this keeps about 11% of the first download out. supabase-js still creates a client and passes it the access token;
// those calls do nothing here. Using a channel throws, so a future use is noticed at once: remove the alias to use Realtime.
const unused = () => new Error("Supabase Realtime is left out of this build. Remove its alias in web/vite.config.ts to use it.");

export class RealtimeClient {
  constructor(_endpoint?: string, _options?: unknown) { /* no connection is opened */ }
  setAuth(_token?: string | null): Promise<void> { return Promise.resolve(); }
  connect(): void { /* nothing to connect */ }
  disconnect(): void { /* nothing to close */ }
  channel(_topic?: string, _params?: unknown): never { throw unused(); }
  getChannels(): never[] { return []; }
  removeChannel(_channel?: unknown): Promise<"ok"> { return Promise.resolve("ok"); }
  removeAllChannels(): Promise<"ok"[]> { return Promise.resolve([]); }
}
