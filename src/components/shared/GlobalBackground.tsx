'use client';

import React, { useMemo } from 'react';

export function GlobalBackground() {
  // Generate lightweight ambient looped particles with original delicate size (3px-7px)
  const particles = useMemo(() => {
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
      className="fixed inset-0 pointer-events-none z-30 overflow-hidden select-none"
    >
      {/* ── Ambient Floating Smoke / Particles Loop ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
