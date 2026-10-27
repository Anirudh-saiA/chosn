/**
 * GET a page as text with a time limit and a size limit, so one stalled or hostile feed cannot block the whole news run or fill memory.
 * Throws on timeout, on a body over `maxBytes`, and (via the caller's own check) on a bad status.
 */
export async function fetchLimited(
  url: string,
  init: RequestInit = {},
  { timeoutMs = 20_000, maxBytes = 3_000_000 }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, status: res.status, text: '' };
  }
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    await res.body?.cancel();
    throw new Error(`response too large (${declared} bytes, limit ${maxBytes})`);
  }
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`response too large (over ${maxBytes} bytes)`);
    }
    chunks.push(value);
  }
  return { ok: true, status: res.status, text: Buffer.concat(chunks).toString('utf8') };
}
