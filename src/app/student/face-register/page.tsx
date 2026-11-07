'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadFaceEngine, detectFaceEmbedding } from '@/lib/faceEngine';
import { Navbar } from '@/components/shared/Navbar';

const ANGLES = [
  { id: 'center', label: 'Look Straight',              emoji: '😐', hint: 'Face the camera directly' },
  { id: 'left',   label: 'Turn Head to Left',          emoji: '⬅️', hint: 'Slowly rotate left ~20°'  },
  { id: 'right',  label: 'Turn Head to Right',         emoji: '➡️', hint: 'Slowly rotate right ~20°' },
  { id: 'up',     label: 'Tilt Head Slightly Upward',  emoji: '⬆️', hint: 'Look slightly up'          },
  { id: 'down',   label: 'Tilt Head Slightly Downward',emoji: '⬇️', hint: 'Look slightly down'        },
];

export default function FaceRegisterPage() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ── Loading ── */
  const [phase, setPhase] = useState<'loading' | 'ready' | 'scanning' | 'done' | 'error'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage,    setLoadStage]    = useState('Initializing AI Biometric Engine...');
  const [errorMsg,     setErrorMsg]     = useState('');

  /* ── Registration ── */
  const [step,        setStep]        = useState(0);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [saving,      setSaving]      = useState(false);

  /* ── Feedback ── */
  const [scanFeedback, setScanFeedback] = useState('');

  // ── Init: load models → start camera ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Step 1 — Load AI models (local, no CDN)
        await loadFaceEngine((pct, stage) => {
          if (!cancelled) {
            setLoadProgress(pct);
            setLoadStage(stage);
          }
        });

        if (cancelled) return;

        setLoadStage('Starting Camera...');

        // Step 2 — Request camera
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
        });

        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = s;

        const vid = videoRef.current!;
        vid.srcObject = s;

        // Wait for video to be truly playable
        await new Promise<void>((res, rej) => {
          vid.onloadeddata = () => res();
          vid.onerror      = () => rej(new Error('Video load error'));
          vid.play().catch(() => {}); // autoplay
          setTimeout(() => res(), 3000); // safety fallback
        });

        if (!cancelled) setPhase('ready');
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and refresh.'
            : `Failed to initialize: ${err?.message || 'Unknown error'}. Please refresh the page.`;
          setErrorMsg(msg);
          setPhase('error');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Capture one angle ──────────────────────────────────────────────────────
  const captureAngle = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid || phase !== 'ready') return;

    setPhase('scanning');
    setScanFeedback('Scanning face geometry…');

    try {
      // Give the browser 1 frame to render the scanning overlay
      await new Promise(r => requestAnimationFrame(r));

      let embedding: Float32Array | null = null;
      let attempts = 0;
      const maxAttempts = 8;

      // Retry up to 8 times (~4s) in case of a blink or slight blur
      while (!embedding && attempts < maxAttempts) {
        attempts++;
        setScanFeedback(`Analyzing biometric features… (${attempts}/${maxAttempts})`);
        embedding = await detectFaceEmbedding(vid);
        if (!embedding) await new Promise(r => setTimeout(r, 500));
      }

      if (!embedding) {
        setScanFeedback('');
        setPhase('ready');
        alert(
          'No face detected after multiple attempts.\n\n' +
          '• Make sure your face is fully visible\n' +
          '• Improve lighting — avoid dark backgrounds\n' +
          '• Look directly at the camera'
        );
        return;
      }

      setScanFeedback('✅ Angle captured!');
      await new Promise(r => setTimeout(r, 400)); // brief visual confirmation

      setDescriptors(prev => [...prev, Array.from(embedding!)]);
      setStep(prev => {
        const next = prev + 1;
        if (next >= ANGLES.length) setPhase('done');
        else setPhase('ready');
        return next;
      });
      setScanFeedback('');
    } catch (err: any) {
      setScanFeedback('');
      setPhase('ready');
      alert(`Face scan error: ${err?.message || 'Please try again.'}`);
    }
  }, [phase]);

  // ── Save all 5 descriptors ─────────────────────────────────────────────────
  const saveFace = async () => {
    if (descriptors.length < ANGLES.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/student/face', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ descriptor: descriptors }),
      });
      if (res.ok) {
        alert('✅ Multi-Angle Face ID Registered Successfully!');
        window.location.href = '/student/dashboard';
      } else {
        const d = await res.json();
        alert('❌ ' + (d.error || 'Failed to save Face ID'));
      }
    } catch {
      alert('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const retakeAll = () => {
    setStep(0);
    setDescriptors([]);
    setPhase('ready');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const currentAngle = ANGLES[Math.min(step, ANGLES.length - 1)];

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">📷 Smart Face ID Setup</h1>
        <p className="text-sm text-gray-500 mb-6">
          Capture 5 angles for maximum accuracy. All processing happens locally on your device.
        </p>

        <div className="bg-white p-6 rounded-2xl shadow-sm border">

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {ANGLES.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  idx < step
                    ? 'bg-green-500'
                    : idx === step && phase !== 'done'
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Camera viewport */}
          <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-900 rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl mb-6">

            {/* VIDEO always rendered — just hidden behind overlays when needed */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* ── Loading overlay ── */}
            {phase === 'loading' && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                  {loadProgress > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-400">
                      {loadProgress}%
                    </span>
                  )}
                </div>
                <p className="text-white text-sm font-semibold mb-3">{loadStage}</p>
                {loadProgress > 0 && loadProgress < 100 && (
                  <div className="w-48 bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Error overlay ── */}
            {phase === 'error' && (
              <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
                <span className="text-4xl mb-3">⚠️</span>
                <p className="text-white text-sm font-semibold">{errorMsg}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-5 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* ── Scanning overlay ── */}
            {phase === 'scanning' && (
              <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="w-14 h-14 rounded-full border-4 border-emerald-400/20 border-t-emerald-400 animate-spin mb-3" />
                <p className="text-emerald-300 text-sm font-bold">{scanFeedback}</p>
                <p className="text-gray-400 text-xs mt-1">Hold still…</p>
              </div>
            )}

            {/* ── Done overlay ── */}
            {phase === 'done' && (
              <div className="absolute inset-0 bg-green-950/90 flex flex-col items-center justify-center p-6 text-center z-10">
                <span className="text-5xl mb-2">🎉</span>
                <p className="text-green-300 font-bold text-lg">All Angles Captured!</p>
                <p className="text-green-400 text-sm mt-1">Your biometric profile is ready.</p>
              </div>
            )}

            {/* ── Angle prompt (shown when ready) ── */}
            {(phase === 'ready') && step < ANGLES.length && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-white/10 z-10">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currentAngle.emoji}</span>
                  <div>
                    <p className="font-bold text-sm leading-tight">{currentAngle.label}</p>
                    <p className="text-xs text-gray-400">{currentAngle.hint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Angle counter ── */}
          <p className="text-center text-xs text-gray-500 mb-4 font-medium">
            {phase === 'done'
              ? '5 / 5 angles captured'
              : `Angle ${step + 1} of ${ANGLES.length}`}
          </p>

          {/* ── Action button ── */}
          {phase !== 'done' ? (
            <button
              onClick={captureAngle}
              disabled={phase !== 'ready'}
              className="w-full max-w-sm mx-auto flex justify-center px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
            >
              {phase === 'loading'   && 'Loading AI Engine…'}
              {phase === 'scanning'  && 'Scanning…'}
              {phase === 'ready'     && `Capture Angle ${step + 1} / ${ANGLES.length}`}
              {phase === 'error'     && 'Error — Refresh page'}
            </button>
          ) : (
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="flex gap-3">
                <button
                  onClick={retakeAll}
                  disabled={saving}
                  className="flex-1 py-4 bg-gray-100 text-gray-800 font-bold rounded-2xl hover:bg-gray-200 transition border border-gray-200"
                >
                  Retake All
                </button>
                <button
                  onClick={saveFace}
                  disabled={saving}
                  className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition shadow-md"
                >
                  {saving ? 'Saving…' : 'Save Face ID'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
