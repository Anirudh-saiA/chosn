'use client';

import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Row {
  id: string;
  release_date: string;
  release_time: string | null;
  status: string;
  confirmation: string;
  india_status: string;
  hidden: boolean;
  is_demo: boolean;
  retail_price: string | null;
  currency: string;
  source_name: string | null;
  brand: string;
  model: string;
  colorway: string;
  style_code: string;
}

interface Form {
  id: string | null;
  brand: string;
  model: string;
  colorway: string;
  styleCode: string;
  releaseDate: string;
  releaseTime: string;
  timezone: string;
  retailPrice: string;
  currency: string;
  region: 'india' | 'us' | 'global';
  status: 'upcoming' | 'live' | 'sold_out';
  confirmation: 'confirmed' | 'reported' | 'unconfirmed';
  indiaStatus: 'unknown' | 'confirmed_india' | 'global_only';
  sourceName: string;
  sourceUrl: string;
  imageUrl: string;
  buyLabel: string;
  buyUrl: string;
  story: string;
}

const EMPTY: Form = {
  id: null, brand: '', model: '', colorway: '', styleCode: '', releaseDate: '', releaseTime: '', timezone: 'Asia/Kolkata', retailPrice: '', currency: 'INR',
  region: 'india', status: 'upcoming', confirmation: 'confirmed', indiaStatus: 'unknown', sourceName: '', sourceUrl: '', imageUrl: '', buyLabel: '', buyUrl: '', story: '',
};

const input = 'w-full border-2 border-[#0A0A0A] bg-white px-3 py-2 text-[0.95rem] text-[#0A0A0A]';
const label = 'flex flex-col gap-1 font-mono text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]/70';
const btn = 'rounded-full border-2 border-[#0A0A0A] px-5 py-2 font-display text-[0.95rem] uppercase tracking-[0.14em] transition-colors disabled:opacity-40';

/** List, add, edit, hide and delete drops. Every change goes through the admin API, which re-checks every field. */
export function DropsAdmin({ apiToken }: { apiToken: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${API_URL}/admin/drops${path}`, { ...init, headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' } });
      const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
      if (!res.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? `Request failed (${res.status})`));
      return body;
    },
    [apiToken],
  );

  const load = useCallback(async () => {
    try {
      const body = await call(`?q=${encodeURIComponent(q)}`);
      setRows(body.drops as Row[]);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [call, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function edit(id: string) {
    try {
      const d = await call(`/${id}`);
      const link = Array.isArray(d.purchase_links) ? d.purchase_links[0] : null;
      setForm({
        id, brand: d.brand, model: d.model, colorway: d.colorway === 'Default' ? '' : d.colorway, styleCode: d.style_code, releaseDate: d.release_date,
        releaseTime: d.release_time ? String(d.release_time).slice(0, 5) : '', timezone: d.release_timezone, retailPrice: d.retail_price ?? '', currency: d.currency,
        region: (String(d.regions).replace(/[{}]/g, '').split(',')[0] || 'india') as Form['region'], status: d.status, confirmation: d.confirmation, indiaStatus: d.india_status,
        sourceName: d.source_name ?? '', sourceUrl: d.source_url ?? '', imageUrl: d.primary_image_url ?? '', buyLabel: link?.label ?? link?.retailer_name ?? '', buyUrl: link?.url ?? '', story: d.story ?? '',
      });
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setMessage(null);
    const body: Record<string, unknown> = {
      brand: form.brand, model: form.model, colorway: form.colorway || 'Default', releaseDate: form.releaseDate, releaseTime: form.releaseTime || null, timezone: form.timezone,
      retailPrice: form.retailPrice ? Number(form.retailPrice) : null, currency: form.currency, regions: [form.region], status: form.status, confirmation: form.confirmation,
      indiaStatus: form.indiaStatus, sourceName: form.sourceName, sourceUrl: form.sourceUrl, imageUrl: form.imageUrl || null, story: form.story || null,
      links: form.buyUrl ? [{ label: form.buyLabel || 'Official link', url: form.buyUrl }] : [],
    };
    if (!form.id && form.styleCode) body.styleCode = form.styleCode;
    try {
      await call(form.id ? `/${form.id}` : '', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      setMessage('Saved.');
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(r: Row) {
    try {
      await call(`/${r.id}`, { method: 'PATCH', body: JSON.stringify({ hidden: !r.hidden }) });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  async function remove(r: Row) {
    if (!window.confirm(`Delete "${r.brand} ${r.model}" (${r.release_date})? This cannot be undone.`)) return;
    try {
      await call(`/${r.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div className="flex flex-col gap-6 text-[#0A0A0A]">
      <div className="flex flex-wrap items-center gap-3">
        <input aria-label="Search drops" placeholder="Search brand, model, style code" value={q} onChange={(e) => setQ(e.target.value)} className={`${input} max-w-sm`} />
        <button type="button" className={`${btn} bg-[#0A0A0A] text-white`} onClick={() => setForm({ ...EMPTY })}>Add a drop</button>
        <span className="font-mono text-xs text-[#0A0A0A]/60">{rows.length} shown</span>
      </div>
      {message && <p role="status" className="border-2 border-[#0A0A0A] bg-white px-4 py-3 text-[0.95rem] font-bold">{message}</p>}

      {form && (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-4 border-2 border-[#0A0A0A] bg-white p-5 sm:grid-cols-2">
          <h2 className="font-display text-2xl uppercase sm:col-span-2">{form.id ? 'Edit drop' : 'New drop'}</h2>
          <label className={label}>Brand<input required className={input} value={form.brand} onChange={(e) => set('brand', e.target.value)} /></label>
          <label className={label}>Model<input required className={input} value={form.model} onChange={(e) => set('model', e.target.value)} /></label>
          <label className={label}>Colourway<input className={input} value={form.colorway} onChange={(e) => set('colorway', e.target.value)} /></label>
          <label className={label}>Style code (optional, for a shoe we track)<input disabled={!!form.id} className={input} value={form.styleCode} onChange={(e) => set('styleCode', e.target.value)} /></label>
          <label className={label}>Release date<input required type="date" className={input} value={form.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} /></label>
          <label className={label}>Time (leave empty if unknown)<input type="time" className={input} value={form.releaseTime} onChange={(e) => set('releaseTime', e.target.value)} /></label>
          <label className={label}>Time zone<input className={input} value={form.timezone} onChange={(e) => set('timezone', e.target.value)} /></label>
          <label className={label}>Price<input type="number" min="0" className={input} value={form.retailPrice} onChange={(e) => set('retailPrice', e.target.value)} /></label>
          <label className={label}>Currency<select className={input} value={form.currency} onChange={(e) => set('currency', e.target.value)}><option>INR</option><option>USD</option><option>GBP</option><option>EUR</option></select></label>
          <label className={label}>Region<select className={input} value={form.region} onChange={(e) => set('region', e.target.value as Form['region'])}><option value="india">India</option><option value="us">US</option><option value="global">Global</option></select></label>
          <label className={label}>Status<select className={input} value={form.status} onChange={(e) => set('status', e.target.value as Form['status'])}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="sold_out">Released</option></select></label>
          <label className={label}>How firm is the date<select className={input} value={form.confirmation} onChange={(e) => set('confirmation', e.target.value as Form['confirmation'])}><option value="confirmed">Confirmed</option><option value="reported">Reported</option><option value="unconfirmed">Unconfirmed</option></select></label>
          <label className={label}>Coming to India?<select className={input} value={form.indiaStatus} onChange={(e) => set('indiaStatus', e.target.value as Form['indiaStatus'])}><option value="unknown">Not announced</option><option value="confirmed_india">Confirmed for India</option><option value="global_only">Global only</option></select></label>
          <label className={label}>Source name (who confirmed it)<input required className={input} value={form.sourceName} onChange={(e) => set('sourceName', e.target.value)} /></label>
          <label className={label}>Source link (https)<input required type="url" className={input} value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} /></label>
          <label className={label}>Official buy link name<input className={input} value={form.buyLabel} onChange={(e) => set('buyLabel', e.target.value)} /></label>
          <label className={label}>Official buy link (https)<input type="url" className={input} value={form.buyUrl} onChange={(e) => set('buyUrl', e.target.value)} /></label>
          <label className={`${label} sm:col-span-2`}>Picture link (https, optional)<input type="url" className={input} value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} /></label>
          <label className={`${label} sm:col-span-2`}>The story (optional)<textarea rows={4} maxLength={4000} className={input} value={form.story} onChange={(e) => set('story', e.target.value)} /></label>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={busy} className={`${btn} bg-[#0A0A0A] text-white`}>{busy ? 'Saving...' : 'Save'}</button>
            <button type="button" className={`${btn} bg-white`} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto border-2 border-[#0A0A0A] bg-white">
        <table className="w-full min-w-[720px] text-left text-[0.9rem]">
          <thead className="border-b-2 border-[#0A0A0A] font-mono text-[0.65rem] uppercase tracking-[0.14em]">
            <tr><th className="p-3">Date</th><th className="p-3">Drop</th><th className="p-3">Firmness</th><th className="p-3">Status</th><th className="p-3">Public</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[#0A0A0A]/15">
                <td className="whitespace-nowrap p-3 font-mono text-xs">{r.release_date}{r.release_time ? ` ${r.release_time.slice(0, 5)}` : ''}</td>
                <td className="p-3"><strong>{r.brand}</strong> {r.model} <span className="text-[#0A0A0A]/60">{r.colorway !== 'Default' ? r.colorway : ''}</span></td>
                <td className="p-3">{r.confirmation}</td>
                <td className="p-3">{r.status === 'sold_out' ? 'released' : r.status}</td>
                <td className="p-3">{r.hidden ? 'Hidden' : r.is_demo ? 'Demo (local only)' : 'Yes'}</td>
                <td className="whitespace-nowrap p-3 text-right">
                  <button type="button" className="mr-3 font-bold underline" onClick={() => void edit(r.id)}>Edit</button>
                  <button type="button" className="mr-3 font-bold underline" onClick={() => void toggleHidden(r)}>{r.hidden ? 'Show' : 'Hide'}</button>
                  <button type="button" className="font-bold text-[#B3261E] underline" onClick={() => void remove(r)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
