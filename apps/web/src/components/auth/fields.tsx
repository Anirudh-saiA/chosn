'use client';

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Input, cx } from '@chosn/ui';

/** Small inline spinner for busy buttons (respects reduced motion via the global rule). */
export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 aria-hidden className={cx('h-4 w-4 animate-spin', className)} />;
}

/** Google "G" mark, inline so there is no network dependency. */
export function GoogleGlyph({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Rust alert row, announced immediately (role=alert). */
export function FormAlert({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-2 border border-rust/40 bg-rust/[0.08] px-3 py-2.5 text-data-inline text-rust">
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Signal success row, polite live region. */
export function FormSuccess({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 border border-signal/40 bg-signal/[0.08] px-3 py-2.5 text-data-inline text-signal">
      <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export const labelClass = 'block font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-text-soft';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** node rendered inside the right edge of the input (e.g. a toggle) */
  trailing?: ReactNode;
  wrapperClassName?: string;
}

/** Label + input + hint + inline error, wired with aria-describedby. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, trailing, wrapperClassName, className, id, ...props },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = `${fieldId}-hint`;
  const errId = `${fieldId}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={wrapperClassName}>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <div className="relative mt-2">
        <Input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'min-h-[48px]',
            trailing ? 'pr-12' : '',
            error ? '!border-rust/70 focus-visible:!shadow-[0_0_0_3px_rgba(255,79,109,.2)]' : '',
            className,
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-meta text-text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-meta text-rust">
          <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});

/** 0-4 heuristic — a nudge only; the server enforces the real rule. */
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 10) s++;
  if (pw.length >= 14) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const STRENGTH = [
  { label: 'Too short', bar: 'bg-rust' },
  { label: 'Weak', bar: 'bg-rust' },
  { label: 'Okay', bar: 'bg-brass' },
  { label: 'Strong', bar: 'bg-signal' },
  { label: 'Excellent', bar: 'bg-signal' },
];

export function StrengthMeter({ password }: { password: string }) {
  const score = scorePassword(password);
  if (!password) return null;
  const s = STRENGTH[score] ?? STRENGTH[0]!;
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1 flex-1 transition-colors duration-300', i < score ? s.bar : 'bg-text/10')} />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-meta text-text-faint">
        Strength: <span className="text-text-soft">{s.label}</span>
      </p>
    </div>
  );
}

/** Password input with a show/hide toggle (aria-pressed). Paste and password managers are never blocked. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<TextFieldProps, 'type' | 'trailing'> & { meter?: boolean }>(
  function PasswordField({ meter, value, ...props }, ref) {
    const [shown, setShown] = useState(false);
    return (
      <div>
        <TextField
          ref={ref}
          {...props}
          value={value}
          type={shown ? 'text' : 'password'}
          spellCheck={false}
          autoCapitalize="none"
          trailing={
            <button
              type="button"
              aria-pressed={shown}
              aria-label="Show password"
              onClick={() => setShown((v) => !v)}
              className="flex h-11 w-11 items-center justify-center text-text-soft transition-colors hover:text-brass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
            >
              {shown ? <EyeOff aria-hidden className="h-[18px] w-[18px]" /> : <Eye aria-hidden className="h-[18px] w-[18px]" />}
            </button>
          }
        />
        {meter && <StrengthMeter password={String(value ?? '')} />}
      </div>
    );
  },
);
