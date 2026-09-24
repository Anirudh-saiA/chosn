'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Command, Menu, Search, X } from 'lucide-react';
import { AuthNavStatus } from '@/components/auth/AuthNavStatus';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { Logo } from '@/components/ui/Logo';

const NAV = [
  { href: '/sneakers', label: 'Compare' },
  { href: '/drops', label: 'Drops' },
  { href: '/news', label: 'News' },
  { href: '/community', label: 'Community' },
] as const;

/**
 * Sticky glass header, on every page. Transparent at the top of the
 * page, frosted + hairline once scrolled. ⌘K opens the command palette
 * (also "/" when not typing). Mobile gets a full-screen menu.
 */
export function Masthead() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-all duration-500 ease-out ${
          scrolled || menuOpen
            ? 'border-b border-text/[0.08] bg-vault-deep/70 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-6 px-5 sm:px-8">
          <Logo />

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative px-3.5 py-2 font-sans text-ui-label font-medium transition-colors duration-200 ${
                    active ? 'text-text' : 'text-text-soft hover:text-text'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-3.5 -bottom-px h-px bg-violet-light shadow-[0_0_14px_2px_rgba(124,92,255,.75)]"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search (Command K)"
              className="group hidden h-9 items-center gap-2 border border-text/12 bg-text/[0.03] pl-3 pr-2 font-sans text-meta text-text-soft transition-all hover:border-brass/50 hover:bg-text/[0.06] hover:text-text sm:flex"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span className="pr-6">Search…</span>
              <kbd className="flex items-center gap-0.5 border border-text/15 px-1.5 py-0.5 font-mono text-[0.65rem] text-text-faint">
                <Command className="h-2.5 w-2.5" aria-hidden />K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center text-text-soft transition-colors hover:text-text sm:hidden"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="hidden h-10 w-10 items-center justify-center text-text-soft transition-colors hover:text-text sm:flex"
            >
              <Bell className="h-[18px] w-[18px]" />
            </Link>
            <div className="hidden md:block">
              <AuthNavStatus />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center text-text md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 top-16 z-40 flex flex-col justify-between bg-vault-deep/95 px-6 pb-10 pt-8 backdrop-blur-2xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav aria-label="Mobile" className="flex flex-col">
              {[...NAV, { href: '/notifications', label: 'Notifications' }].map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={item.href}
                    className="flex items-baseline justify-between border-b border-text/10 py-5 font-display text-4xl font-semibold text-text"
                  >
                    {item.label}
                    <span className="font-mono text-meta text-brass">0{i + 1}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="flex items-center justify-between">
              <AuthNavStatus />
              <Link href="/feedback" className="font-mono text-meta text-text-faint">
                Send feedback
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
