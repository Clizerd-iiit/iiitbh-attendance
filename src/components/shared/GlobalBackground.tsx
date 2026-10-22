'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';

export function GlobalBackground() {
  // Generate lightweight looped snowfall particles
  const snowflakes = useMemo(() => {
    return Array.from({ length: 42 }).map((_, i) => ({
      id: i,
      left: `${(i * 2.38) % 100}%`,
      size: `${(i % 5) + 3}px`,
      duration: `${6.5 + (i % 6) * 1.3}s`,
      delay: `${(i * 0.28) % 5}s`,
      opacity: 0.35 + (i % 5) * 0.12,
    }));
  }, []);

  return (
    <aside
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-50 overflow-hidden select-none"
    >
      {/* ── Background Scenery Layer (IIIT Bhagalpur Campus) ── */}
      <div className="absolute inset-0">
        <Image
          src="/iiitbh-campus.jpg"
          alt=""
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

      {/* ── Snowfall Loop Particles ── */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {snowflakes.map(flake => (
          <span
            key={flake.id}
            className="snow-flake"
            style={{
              left: flake.left,
              width: flake.size,
              height: flake.size,
              animationDuration: flake.duration,
              animationDelay: flake.delay,
              opacity: flake.opacity,
            }}
          />
        ))}
      </div>
    </aside>
  );
}
