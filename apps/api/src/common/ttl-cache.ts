/**
 * A small in-process cache with single-flight: while a value is being computed, every other caller for the same key waits for that one
 * computation instead of starting its own. A burst of identical requests (a popular page, a load test) then costs one set of database
 * queries and one pool connection each, not one per request. Failures are never cached, and the cache is bounded.
 */
export class TtlCache<V> {
  private readonly done = new Map<string, { at: number; value: V }>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string, compute: () => Promise<V>): Promise<V> {
    const hit = this.done.get(key);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.value;
    const running = this.inflight.get(key);
    if (running) return running;
    const p = compute()
      .then((value) => {
        this.done.set(key, { at: this.now(), value });
        this.trim();
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private trim(): void {
    if (this.done.size <= this.maxEntries) return;
    const t = this.now();
    for (const [k, v] of this.done) if (t - v.at >= this.ttlMs) this.done.delete(k);
    // Still over: drop the oldest entries (Map keeps insertion order).
    for (const k of this.done.keys()) {
      if (this.done.size <= this.maxEntries) break;
      this.done.delete(k);
    }
  }
}
