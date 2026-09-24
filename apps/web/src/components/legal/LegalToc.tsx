'use client';

import { useEffect, useState } from 'react';
import { List } from 'lucide-react';

interface Item {
  id: string;
  title: string;
}

/**
 * Table of contents built at runtime from the article's own sections, so
 * the legal copy stays the single source of truth. Active section is
 * tracked with an IntersectionObserver. Sticky sidebar on lg+, a
 * collapsible "On this page" disclosure below that.
 */
export function LegalToc({ articleId }: { articleId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const root = document.getElementById(articleId);
    if (!root) return;
    // Each LegalSection is <section id><h2>; the section id is the anchor.
    const heads = Array.from(root.querySelectorAll<HTMLElement>('section[id]'));
    setItems(heads.map((h) => ({ id: h.id, title: h.querySelector('h2')?.textContent ?? '' })));

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [articleId]);

  if (items.length === 0) return null;

  const list = (
    <ol className="space-y-0.5 border-l border-text/10">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={on ? 'location' : undefined}
              className={`-ml-px flex min-h-[36px] items-center border-l-2 py-1.5 pl-4 pr-2 text-[0.8125rem] leading-snug transition-colors ${
                on ? 'border-brass-bright font-semibold text-brass-bright' : 'border-transparent text-text-soft hover:border-text/30 hover:text-text'
              }`}
            >
              {it.title}
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      <nav aria-label="On this page" className="sticky top-24 hidden max-h-[calc(100svh-8rem)] overflow-y-auto pr-2 lg:block">
        <p className="eyebrow mb-3 flex items-center gap-2">
          <List aria-hidden className="h-3.5 w-3.5" />
          On this page
        </p>
        {list}
      </nav>
      <details className="panel group mb-8 lg:hidden">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-brass [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <List aria-hidden className="h-3.5 w-3.5" />
            On this page
          </span>
          <span aria-hidden className="text-lg transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <nav aria-label="On this page (mobile)" className="px-4 pb-4">
          {list}
        </nav>
      </details>
    </>
  );
}
