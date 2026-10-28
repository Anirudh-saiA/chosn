'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectMenuOption {
  value: string;
  label: string;
}

/**
 * A minimal dropdown that replaces the browser's own option list, so the open menu has the same rounded look as the closed pill.
 * Follows the site radius scale (pill trigger, menu at --radius-md). Keyboard: Down/Up/Home/End move, Enter or Space picks, Esc closes,
 * typing a letter jumps to the next option that starts with it. Screen readers get a listbox with the current choice announced.
 */
export function SelectMenu({
  label,
  value,
  options,
  onChange,
  align = 'right',
  className = '',
}: {
  /** Accessible name of the control, for example "Sort". */
  label: string;
  value: string;
  options: readonly SelectMenuOption[];
  onChange: (value: string) => void;
  /** Which edge of the button the open menu lines up with ('left-on-phone': left on phones, right from the sm breakpoint up). */
  align?: 'left' | 'right' | 'left-on-phone';
  className?: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selected];

  const openMenu = () => {
    setActive(selected);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close(true);
  };

  // Focus the list when it opens so the arrow keys work, and keep the active option in view.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-o${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, uid]);

  // Click or tap outside closes it.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, last));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase(), at: now };
      const start = typed.current.text.length > 1 ? active : active + 1;
      for (let k = 0; k < options.length; k++) {
        const i = (start + k) % options.length;
        if (options[i]!.label.toLowerCase().startsWith(typed.current.text)) {
          setActive(i);
          break;
        }
      }
    }
  };

  return (
    <div ref={root} className={`relative inline-block ${className}`}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ''}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKey}
        className="inline-flex h-11 cursor-pointer items-center gap-3 rounded-full border border-text/20 bg-white pl-4 pr-3.5 text-[0.9rem] text-text outline-none transition-colors hover:border-text/45 focus-visible:border-text focus-visible:ring-2 focus-visible:ring-text/20"
      >
        <span className="whitespace-nowrap">{current?.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-text-soft transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <ul
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${uid}-o${active}`}
          onKeyDown={onListKey}
          className={`absolute top-full z-40 mt-2 max-h-[min(26rem,70vh)] w-max min-w-full overflow-auto rounded-[var(--radius-md)] border border-text/15 bg-white p-1.5 shadow-[0_14px_36px_-12px_rgba(10,10,10,0.28)] outline-none motion-safe:animate-[select-menu-in_140ms_ease-out] ${align === 'right' ? 'right-0' : align === 'left-on-phone' ? 'left-0 sm:left-auto sm:right-0' : 'left-0'}`}
        >
          {options.map((o, i) => {
            const isSel = i === selected;
            return (
              <li
                key={o.value || '__default'}
                id={`${uid}-o${i}`}
                role="option"
                aria-selected={isSel}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex min-h-[44px] cursor-pointer items-center justify-between gap-6 rounded-[calc(var(--radius-md)-6px)] px-3.5 text-[0.9rem] ${
                  i === active ? 'bg-text/[0.06]' : ''
                } ${isSel ? 'font-semibold text-text' : 'text-text-soft'}`}
              >
                <span>{o.label}</span>
                {isSel ? <Check className="h-4 w-4 shrink-0 text-text" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
