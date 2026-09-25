// Device fingerprinting — runs client-side
// Generates a stable hash from browser characteristics

export function generateDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'server';

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency,
    navigator.platform,
  ].join('|');

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < components.length; i++) {
    hash = (hash << 5) + hash + components.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Store fingerprint in sessionStorage for consistency
export function getOrCreateFingerprint(): string {
  const stored = sessionStorage.getItem('_dfp');
  if (stored) return stored;

  const fp = generateDeviceFingerprint();
  sessionStorage.setItem('_dfp', fp);
  return fp;
}
