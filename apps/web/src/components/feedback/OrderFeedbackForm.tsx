'use client';

import { useState } from 'react';
import { forgetPurchase } from '@/lib/purchases';
import { getConsent } from '@/lib/consent';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const PROBLEMS: Array<[string, string]> = [
  ['late', 'It came late'],
  ['wrong_item', 'Wrong shoe, colour or size sent'],
  ['damaged', 'Damaged or used'],
  ['suspected_fake', 'I think it is not original'],
  ['refund_issue', 'Refund or return problem'],
  ['poor_support', 'The store did not help'],
];
const REASONS: Array<[string, string]> = [
  ['price_changed', 'The price changed at the store'],
  ['out_of_stock', 'My size was out of stock'],
  ['found_elsewhere', 'I found it cheaper elsewhere'],
  ['changed_mind', 'I changed my mind'],
  ['other', 'Something else'],
];

function Choice({ value, current, onPick, children }: { value: string; current: string; onPick: (v: string) => void; children: React.ReactNode }) {
  const on = value === current;
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      aria-pressed={on}
      className={`rounded-full border px-4 py-2 text-sm font-semibold ${on ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
    >
      {children}
    </button>
  );
}

/** "How did it go?" for one shoe at one store. Anonymous; sent to POST /order-feedback. */
export function OrderFeedbackForm({ styleCode, store, storeName, shoeName, size, promisedMaxDays }: { styleCode: string; store: string; storeName: string; shoeName: string; size?: number; promisedMaxDays: number | null }) {
  const [bought, setBought] = useState('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');
  const [arrived, setArrived] = useState('');
  const [described, setDescribed] = useState('');
  const [sizeOk, setSizeOk] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [again, setAgain] = useState('');
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const toggle = (p: string) => setProblems((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  const ready = bought === 'yes' ? arrived !== '' : bought !== '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setState('sending');
    let visitorId: string | undefined;
    try {
      if (getConsent() === 'granted') visitorId = window.localStorage.getItem('chosn_visitor') ?? undefined;
    } catch {
      /* ignore */
    }
    const d = arrived === 'yes' && days !== '' ? Number(days) : undefined;
    try {
      const res = await fetch(`${API_URL}/order-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleCode, store, size, bought, website,
          notBoughtReason: bought === 'yes' ? undefined : reason || undefined,
          deliveredInDays: bought === 'yes' ? d : undefined,
          promisedMaxDays: promisedMaxDays ?? undefined,
          asDescribed: bought === 'yes' ? described || undefined : undefined,
          sizeOk: bought === 'yes' ? sizeOk || undefined : undefined,
          problems: bought === 'yes' ? problems : undefined,
          wouldBuyAgain: bought === 'yes' && again ? again === 'yes' : undefined,
          comment: comment || undefined,
          visitorId,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (bought !== 'later') forgetPurchase(styleCode, store);
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div className="rounded-2xl border border-text/12 bg-white p-6">
        <h2 className="text-lg font-bold text-text">Thank you</h2>
        <p className="mt-2 text-sm text-text-muted">
          {bought === 'later' ? 'We will ask again in a few days.' : `Your answer helps other shoppers judge ${storeName}. Nothing about you was saved.`}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl border border-text/12 bg-white p-5 sm:p-6">
      <p className="text-sm text-text-muted">
        {shoeName}{size ? `, UK ${size}` : ''} at <strong className="text-text">{storeName}</strong>. Anonymous: no name, e-mail or order number is asked for.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text">Did you buy it?</legend>
        <div className="flex flex-wrap gap-2">
          <Choice value="yes" current={bought} onPick={setBought}>Yes</Choice>
          <Choice value="no" current={bought} onPick={setBought}>No</Choice>
          <Choice value="later" current={bought} onPick={setBought}>Not yet</Choice>
        </div>
      </fieldset>

      {bought === 'no' ? (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-text">Why not?</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(([v, l]) => (
              <Choice key={v} value={v} current={reason} onPick={setReason}>{l}</Choice>
            ))}
          </div>
        </fieldset>
      ) : null}

      {bought === 'yes' ? (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-text">Has it arrived?</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Choice value="yes" current={arrived} onPick={setArrived}>Yes</Choice>
              <Choice value="no" current={arrived} onPick={setArrived}>Not yet</Choice>
              {arrived === 'yes' ? (
                <label className="ml-2 flex items-center gap-2 text-sm text-text">
                  after
                  <input type="number" min={0} max={120} value={days} onChange={(e) => setDays(e.target.value)} className="w-20 rounded-lg border border-text/20 px-3 py-2" aria-label="Days it took to arrive" />
                  days
                </label>
              ) : null}
            </div>
            {promisedMaxDays !== null ? <p className="mt-2 text-xs text-text-muted">{storeName} said up to {promisedMaxDays} days.</p> : null}
          </fieldset>

          {arrived === 'yes' ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-text">Was it what the page showed (shoe, colour, original)?</legend>
                <div className="flex flex-wrap gap-2">
                  <Choice value="yes" current={described} onPick={setDescribed}>Yes</Choice>
                  <Choice value="no" current={described} onPick={setDescribed}>No</Choice>
                  <Choice value="unsure" current={described} onPick={setDescribed}>Not sure</Choice>
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-text">Did the size fit?</legend>
                <div className="flex flex-wrap gap-2">
                  <Choice value="yes" current={sizeOk} onPick={setSizeOk}>Yes</Choice>
                  <Choice value="no" current={sizeOk} onPick={setSizeOk}>No</Choice>
                  <Choice value="exchanged" current={sizeOk} onPick={setSizeOk}>Exchanged it</Choice>
                </div>
              </fieldset>
            </>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-text">Any problems? (pick all that apply)</legend>
            <div className="flex flex-wrap gap-2">
              {PROBLEMS.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggle(v)}
                  aria-pressed={problems.includes(v)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${problems.includes(v) ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-text/20 bg-white text-text hover:border-[#14213D]'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold text-text">Would you buy from {storeName} again?</legend>
            <div className="flex gap-2">
              <Choice value="yes" current={again} onPick={setAgain}>Yes</Choice>
              <Choice value="no" current={again} onPick={setAgain}>No</Choice>
            </div>
          </fieldset>
        </>
      ) : null}

      {bought ? (
        <label className="block text-sm font-bold text-text">
          Anything else? <span className="font-normal text-text-muted">(optional, keep personal details out)</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={280} rows={2} className="mt-2 w-full rounded-lg border border-text/20 px-3 py-2 text-sm font-normal" />
        </label>
      ) : null}

      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {state === 'error' ? <p role="alert" className="text-sm text-red-700">Could not send. Please try again in a moment.</p> : null}
      <button type="submit" disabled={!ready || state === 'sending'} className="rounded-full bg-[#14213D] px-6 py-3 text-sm font-bold text-white disabled:opacity-40">
        {state === 'sending' ? 'Sending…' : 'Send answer'}
      </button>
    </form>
  );
}
