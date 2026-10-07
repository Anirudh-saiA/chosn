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
