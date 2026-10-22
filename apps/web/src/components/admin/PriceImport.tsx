'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Download, Upload } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Summary {
  dryRun: boolean;
  rowsRead: number;
  rowsImported: number;
  newSneakers: number;
  newVariants: number;
  newRetailers: string[];
  pricesRecorded: number;
  errors: { line: number; message: string }[];
  preview: { line: number; brand: string; model: string; colorway: string; styleCode: string; size: number; retailer: string; price: number; shipping: number; inStock: boolean }[];
}

const btn =
  'inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-display text-[1.05rem] uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40';

/** Upload or paste a CSV, check it (nothing is saved), then import it. */
export function PriceImport({ apiToken }: { apiToken: string }) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState<'check' | 'import' | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = { Authorization: `Bearer ${apiToken}` };

  async function downloadTemplate() {
    const res = await fetch(`${API_URL}/admin/prices/template`, { headers });
    if (!res.ok) return setFailure('Could not download the template. Are you signed in as an admin?');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chosn-prices-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    setSummary(null);
    setFailure(null);
  }

  async function run(dryRun: boolean) {
    setBusy(dryRun ? 'check' : 'import');
    setFailure(null);
    try {
      const res = await fetch(`${API_URL}/admin/prices/import?dryRun=${dryRun}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFailure(body?.message ? String(Array.isArray(body.message) ? body.message[0] : body.message) : `The server said ${res.status}.`);
        return;
      }
      setSummary((await res.json()) as Summary);
    } catch {
      setFailure('Could not reach the API. Is it running?');
    } finally {
      setBusy(null);
    }
  }

  const checked = summary && summary.dryRun && summary.errors.length === 0 && summary.rowsImported > 0;
  const done = summary && !summary.dryRun && summary.errors.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={downloadTemplate} className={`${btn} border-2 border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white`}>
          <Download className="h-4 w-4" aria-hidden /> Template
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} bg-[#0A0A0A] text-white hover:bg-[#262626]`}>
          <Upload className="h-4 w-4" aria-hidden /> Choose CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose a CSV file" />
        {fileName && <span className="font-mono text-[0.8rem] font-bold text-[#0A0A0A]/60">{fileName}</span>}
      </div>

      <label className="block">
        <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[0.24em] text-[#0A0A0A]/60">Or paste CSV here</span>
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setSummary(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder="brand,model,colorway,style_code,size,retailer,price,shipping,url,in_stock"
          className="mt-2 w-full rounded-2xl border-2 border-[#0A0A0A]/15 bg-white p-4 font-mono text-[0.8rem] text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!csv.trim() || busy !== null} onClick={() => run(true)} className={`${btn} bg-[#0A0A0A] text-white hover:bg-[#262626]`}>
          {busy === 'check' ? 'Checking…' : 'Check file'}
        </button>
        <button type="button" disabled={!checked || busy !== null} onClick={() => run(false)} className={`${btn} bg-[#FF7A1A] text-[#0A0A0A] hover:bg-[#ff9040]`}>
          {busy === 'import' ? 'Importing…' : checked ? `Import ${summary.rowsImported} prices` : 'Import'}
        </button>
      </div>

      {failure && (
        <p role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-[#D81E2D] p-4 text-[0.95rem] font-bold text-[#D81E2D]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {failure}
        </p>
      )}

      {summary && summary.errors.length > 0 && (
        <div role="alert" className="rounded-2xl border-2 border-[#D81E2D] p-5">
          <p className="font-display text-[1.4rem] uppercase text-[#D81E2D]">Fix these lines, then check again ({summary.errors.length})</p>
          <ul className="mt-3 space-y-1.5 text-[0.92rem] font-bold text-[#0A0A0A]">
            {summary.errors.slice(0, 50).map((e) => (
              <li key={`${e.line}-${e.message}`}>
                <span className="font-mono text-[#D81E2D]">Line {e.line}:</span> {e.message}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.85rem] font-bold text-[#0A0A0A]/60">Nothing was saved. Prices are only imported when every line is valid.</p>
        </div>
      )}

      {summary && summary.errors.length === 0 && (
        <div className="rounded-3xl border-2 border-[#0A0A0A] p-6">
          <p className="flex items-center gap-2 font-display text-[1.6rem] uppercase text-[#0A0A0A]">
            <Check className="h-6 w-6 text-[#2E8B3D]" aria-hidden />
            {done ? `Imported ${summary.pricesRecorded} prices` : `${summary.rowsImported} rows look good`}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Prices', summary.rowsImported],
              ['New sneakers', summary.newSneakers],
              ['New sizes', summary.dryRun ? '—' : summary.newVariants],
              ['New stores', summary.newRetailers.length],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#0A0A0A]/50">{label}</dt>
                <dd className="mt-1 font-mono text-[1.6rem] font-extrabold text-[#0A0A0A]">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.newRetailers.length > 0 && <p className="mt-3 text-[0.9rem] font-bold text-[#0A0A0A]/65">New stores that will be created: {summary.newRetailers.join(', ')}</p>}
          {done && (
            <Link href="/sneakers" className={`${btn} mt-5 bg-[#0A0A0A] text-white hover:bg-[#262626]`}>
              See it on Compare
            </Link>
          )}
        </div>
      )}

      {summary && summary.preview.length > 0 && summary.errors.length === 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[#0A0A0A]/10">
          <table className="w-full min-w-[40rem] text-left text-[0.88rem]">
            <thead>
              <tr className="border-b border-[#0A0A0A]/10 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">
                {['Line', 'Sneaker', 'Style', 'Size', 'Store', 'Price', 'Ship', 'Stock'].map((h) => (
                  <th key={h} className="px-4 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.preview.map((r) => (
                <tr key={r.line} className="border-b border-[#0A0A0A]/5 font-bold text-[#0A0A0A]">
                  <td className="px-4 py-2.5 font-mono text-[#0A0A0A]/50">{r.line}</td>
                  <td className="px-4 py-2.5">
                    {r.brand} {r.model} <span className="text-[#0A0A0A]/50">· {r.colorway}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{r.styleCode}</td>
                  <td className="px-4 py-2.5 font-mono">{r.size}</td>
                  <td className="px-4 py-2.5">{r.retailer}</td>
                  <td className="px-4 py-2.5 font-mono">₹{new Intl.NumberFormat('en-IN').format(r.price)}</td>
                  <td className="px-4 py-2.5 font-mono">{r.shipping ? `₹${r.shipping}` : 'Free'}</td>
                  <td className="px-4 py-2.5">{r.inStock ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.rowsImported > summary.preview.length && <p className="px-4 py-3 text-[0.8rem] font-bold text-[#0A0A0A]/50">Showing the first {summary.preview.length} of {summary.rowsImported} rows.</p>}
        </div>
      )}
    </div>
  );
}
