'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function GlobalBackground() {
  const pathname = usePathname();
  const isLoginPage = pathname === '/auth/login';

  // Subtle, calm ambient smoke particles (reduced quantity, slower float speed)
  const particles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: `${(i * 5.4 + 2) % 96}%`,
      size: `${(i % 5) + 3}px`,
      duration: `${18 + (i % 6) * 3.5}s`,
      delay: `${(i * 0.9) % 12}s`,
      opacity: 0.35 + (i % 4) * 0.1,
    }));
  }, []);

  return (
    <aside
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[1] overflow-hidden select-none"
    >
      {/* ── Campus Background Scenery (Layered at z-0, specifically for /auth/login) ── */}
      {isLoginPage && (
        <div className="absolute inset-0 z-0">
          <Image
            src="/iiitbh-campus.jpg"
            alt="IIIT Bhagalpur Campus"
            role="presentation"
            fill
            priority
            className="object-cover object-center scale-105 filter contrast-125 brightness-90 dark:brightness-60 transition-all duration-700"
          />
          {/* Dynamic Architectural Frosted Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-blue-950/35 to-slate-900/50 dark:from-[#120e0b]/92 dark:via-[#1f1712]/75 dark:to-[#120e0b]/85 transition-colors duration-500" />
          {/* Artistic line sketch overlay texture */}
          <div
            className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none bg-center bg-cover"
            style={{
              backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.22) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        </div>
      )}

      {/* ── Ambient Floating Smoke / Particles Loop (Layered at z-[1], under all cards & elements) ── */}
      <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
        {particles.map(p => (
          <span
            key={p.id}
            className="smoke-particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: p.duration,
              animationDelay: p.delay,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>
    </aside>
  );
}
