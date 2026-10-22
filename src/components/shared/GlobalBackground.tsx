'use client';

import React, { useMemo } from 'react';

export function GlobalBackground() {
  // Generate lightweight ambient looped smoke / drift particles
  const particles = useMemo(() => {
    return Array.from({ length: 36 }).map((_, i) => ({
      id: i,
      left: `${(i * 2.77) % 100}%`,
      size: `${(i % 6) * 4 + 6}px`,
      duration: `${10 + (i % 8) * 2.2}s`,
      delay: `${(i * 0.4) % 6}s`,
      opacity: 0.2 + (i % 5) * 0.08,
      blur: `${(i % 3) * 1.5 + 1}px`,
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
              filter: `blur(${p.blur})`,
            }}
          />
        ))}
      </div>
    </aside>
  );
}
