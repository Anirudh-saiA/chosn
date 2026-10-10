'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Menu, Search, X } from 'lucide-react';
import { AuthNavStatus } from '@/components/auth/AuthNavStatus';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { WishlistNav } from '@/components/wishlist/WishlistNav';
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
export function Masthead({ overlay = false }: { overlay?: boolean } = {}) {
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
      } else if (e.key === 'Escape') {
        setMenuOpen(false);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);
  // lets the landing hero fade its wordmark while the menu is open
  useEffect(() => {
    document.documentElement.toggleAttribute('data-menu-open', menuOpen);
    return () => document.documentElement.removeAttribute('data-menu-open');
  }, [menuOpen]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (overlay) {
    // Landing: no bar, just the logo top-centre and a three-line button top-left
    // that opens a dimmed overlay with a slow CHOSN fade and a sliding nav panel.
    const ease = [0.22, 1, 0.36, 1] as const;
    return (
      <>
        <header className="pointer-events-none absolute inset-x-0 top-0 z-50 flex h-20 items-center justify-center">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="pointer-events-auto absolute left-5 top-1/2 flex h-11 w-11 -translate-y-1/2 flex-col items-center justify-center gap-[6px] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-opacity hover:opacity-70 sm:left-8"
          >
            <span className={`h-[2px] w-6 rounded bg-current transition-transform duration-500 ease-out ${menuOpen ? 'translate-y-[8px] rotate-45' : ''}`} />
            <span className={`h-[2px] w-6 rounded bg-current transition-opacity duration-300 ${menuOpen ? 'opacity-0 md:opacity-100' : ''}`} />
            <span className={`h-[2px] w-6 rounded bg-current transition-transform duration-500 ease-out ${menuOpen ? '-translate-y-[8px] -rotate-45' : ''}`} />
          </button>
          <span className={`pointer-events-auto transition-opacity duration-500 ${menuOpen ? 'opacity-0 md:opacity-100' : ''}`}>
            <Logo markOnly className="!text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]" />
          </span>
        </header>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              key="landing-menu"
              className="fixed inset-0 z-[45]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              onClick={() => setMenuOpen(false)}
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
              <motion.nav
                aria-label="Primary"
                className="absolute inset-y-0 right-0 flex w-[min(68vw,24rem)] flex-col justify-center rounded-l-[2.75rem] bg-white px-10 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.5)]"
                initial={{ x: '100%' }}
                animate={{ x: 0, transition: { duration: 0.8, ease } }}
                exit={{ x: '100%', transition: { duration: 0.55, ease: [0.64, 0, 0.78, 0] } }}
                onClick={(e) => e.stopPropagation()}
              >
                {NAV.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: 0.3 + i * 0.08, duration: 0.7, ease } }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="group flex items-baseline justify-between border-b border-[#0A0A0A]/10 py-6 font-display text-5xl uppercase tracking-[0.02em] text-[#0A0A0A] transition-[padding,color] duration-300 hover:pl-3 hover:text-[#0A0A0A]/60"
                    >
                      {item.label}
                      <span className="font-mono text-xs text-[#0A0A0A]/40">0{i + 1}</span>
                    </Link>
                  </motion.div>
                ))}
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 rounded-b-[2rem] border-b border-[#0A0A0A]/10 transition-all duration-500 ease-out ${
          scrolled || menuOpen ? 'bg-vault-deep/70 backdrop-blur-xl' : 'bg-transparent'
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
                  className={`relative px-4 py-2 font-sans text-[0.72rem] font-bold uppercase tracking-[0.2em] transition-colors duration-200 ${
                    active ? 'text-[#0A0A0A]' : 'text-[#0A0A0A]/55 hover:text-[#0A0A0A]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-x-4 -bottom-px h-[2px] bg-[#0A0A0A]"
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
              aria-label="Search sneakers"
              className="flex h-10 w-10 items-center justify-center text-[#0A0A0A] transition-opacity hover:opacity-60"
            >
              <Search className="h-[20px] w-[20px]" strokeWidth={2.2} aria-hidden />
            </button>
            <WishlistNav />
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="hidden h-10 w-10 items-center justify-center text-[#0A0A0A] transition-opacity hover:opacity-60 sm:flex"
            >
              <Bell className="h-[20px] w-[20px]" strokeWidth={2.2} />
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
