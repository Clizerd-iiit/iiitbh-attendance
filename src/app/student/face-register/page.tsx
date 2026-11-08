'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadFaceEngine, detectFaceEmbedding, BIOMETRIC_ANGLES } from '@/lib/faceEngine';
import { Navbar } from '@/components/shared/Navbar';

export default function FaceRegisterPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /* ── State Machine: loading → ready → scanning → done | error ── */
  const [phase, setPhase] = useState<'loading' | 'ready' | 'scanning' | 'done' | 'error'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStage, setLoadStage] = useState('Initializing AI Biometric Engine...');
  const [errorMsg, setErrorMsg] = useState('');

  /* ── Biometric Multi-Angle Vectors ── */
  const [step, setStep] = useState(0);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [saving, setSaving] = useState(false);

  /* ── Live Scanner & Feedback ── */
  const [scanFeedback, setScanFeedback] = useState('');
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);
  const [guidanceTip, setGuidanceTip] = useState('');

  // ── 1. Init: Load local neural models & start camera ──────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadFaceEngine((pct, stage) => {
          if (!cancelled) {
            setLoadProgress(pct);
            setLoadStage(stage);
          }
        });

        if (cancelled) return;
        setLoadStage('Starting Camera...');

        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 640 },
            facingMode: 'user',
          },
        });

        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = s;

        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }

        // Wait for video stream readyState
        await new Promise<void>((resolve) => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            resolve();
          } else if (videoRef.current) {
            videoRef.current.onloadeddata = () => resolve();
            setTimeout(resolve, 1500);
          } else {
            setTimeout(resolve, 1500);
          }
        });

        if (!cancelled) setPhase('ready');
      } catch (err: any) {
        if (!cancelled) {
          const msg =
            err?.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access in your browser and refresh.'
              : `Biometric initialization failed: ${err?.message || 'Unknown error'}. Please refresh.`;
          setErrorMsg(msg);
          setPhase('error');
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── 2. Lightweight Live Face Tracker for Smooth Visual Feedback ────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    let active = true;

    const tracker = setInterval(async () => {
      const vid = videoRef.current;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0 || !active) return;

      try {
        // Fast probe to check if face is currently visible
        const embedding = await detectFaceEmbedding(vid);
        if (active) {
          setIsFaceInFrame(!!embedding);
          if (!embedding) {
            setGuidanceTip('Hold steady · Position face in center');
          } else {
            setGuidanceTip('');
          }
        }
      } catch {
        // Silent catch for background probe
      }
    }, 600);

    return () => {
      active = false;
      clearInterval(tracker);
    };
  }, [phase]);

  // ── 3. Capture Biometric Angle ───────────────────────────────────────────
  const captureAngle = useCallback(async () => {
    const vid = videoRef.current;
    if (!vid || phase !== 'ready') return;

    if (vid.readyState < 2 || vid.videoWidth === 0) {
      alert('Camera stream is still starting. Please wait a moment.');
      return;
    }

    setPhase('scanning');
    setScanFeedback('Analyzing face geometry…');
    setGuidanceTip('');

    try {
      await new Promise((r) => requestAnimationFrame(r));

      let embedding: Float32Array | null = null;
      let attempts = 0;
      const maxAttempts = 3;

      // 3 fast attempts (~1s total)
      while (!embedding && attempts < maxAttempts) {
        attempts++;
        embedding = await detectFaceEmbedding(vid);
        if (!embedding && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }

      if (!embedding) {
        setScanFeedback('');
        setPhase('ready');
        setGuidanceTip('Face not detected. Look directly into camera in good lighting.');
        return;
      }

      setScanFeedback('✅ Angle Captured!');
      await new Promise((r) => setTimeout(r, 350));

      setDescriptors((prev) => [...prev, Array.from(embedding!)]);
      setStep((prev) => {
        const next = prev + 1;
        if (next >= BIOMETRIC_ANGLES.length) {
          setPhase('done');
        } else {
          setPhase('ready');
        }
        return next;
      });
      setScanFeedback('');
    } catch (err: any) {
      setScanFeedback('');
      setPhase('ready');
      alert(`Face scan error: ${err?.message || 'Please try again.'}`);
    }
  }, [phase]);

  // ── 4. Save Multi-Angle Face ID Profile ───────────────────────────────────
  const saveFace = async () => {
    if (descriptors.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/student/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: descriptors }),
      });
      if (res.ok) {
        alert('✅ Face ID Profile Registered Successfully!');
        window.location.href = '/student/dashboard';
      } else {
        const d = await res.json();
        alert('❌ ' + (d.error || 'Failed to save Face ID profile'));
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
    setGuidanceTip('');
  };

  const currentAngle = BIOMETRIC_ANGLES[Math.min(step, BIOMETRIC_ANGLES.length - 1)];

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>📷</span> Smart Face ID Setup
          </h1>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
            100% Private &amp; Client-Side
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Capture 3 natural angles for fast &amp; secure attendance matching.
        </p>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          {/* Progress Indicator Dots */}
          <div className="flex gap-2 mb-6">
            {BIOMETRIC_ANGLES.map((angle, idx) => (
              <div key={angle.id} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx < step
                      ? 'bg-emerald-500'
                      : idx === step && phase !== 'done'
                      ? 'bg-blue-600 animate-pulse'
                      : 'bg-gray-200'
                  }`}
                />
                <p className="text-[11px] font-medium text-gray-500 text-center mt-1 truncate">
                  {idx + 1}. {angle.label.replace('Look ', '').replace('Turn Head to ', '')}
                </p>
              </div>
            ))}
          </div>

          {/* Camera Viewport */}
          <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-950 rounded-3xl overflow-hidden border-4 border-gray-900 shadow-xl mb-5 flex items-center justify-center">
            {/* Mirrored Selfie Video */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {/* Biometric Oval Guide (Shown during ready & scanning) */}
            {(phase === 'ready' || phase === 'scanning') && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-56 h-72 rounded-[48%] border-2 transition-colors duration-300 ${
                    isFaceInFrame
                      ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                      : 'border-white/40 border-dashed'
                  }`}
                />
              </div>
            )}

            {/* Live Status Badge */}
            {phase === 'ready' && (
              <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10 pointer-events-none">
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-sm ${
                    isFaceInFrame
                      ? 'bg-emerald-500/90 text-white'
                      : 'bg-amber-500/80 text-white'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isFaceInFrame ? 'bg-white animate-pulse' : 'bg-amber-100'
                    }`}
                  />
                  {isFaceInFrame ? 'Face Aligned' : 'Align Face'}
                </span>
                <span className="text-[11px] font-semibold text-white/80 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
                  Angle {step + 1} of {BIOMETRIC_ANGLES.length}
                </span>
              </div>
            )}

            {/* Loading Overlay */}
            {phase === 'loading' && (
              <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="relative mb-4 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                  {loadProgress > 0 && (
                    <span className="absolute text-xs font-bold text-blue-400">
                      {loadProgress}%
                    </span>
                  )}
                </div>
                <p className="text-white text-sm font-semibold mb-3">{loadStage}</p>
                {loadProgress > 0 && loadProgress < 100 && (
                  <div className="w-48 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error Overlay */}
            {phase === 'error' && (
              <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center p-6 text-center z-20">
                <span className="text-4xl mb-3">⚠️</span>
                <p className="text-white text-sm font-semibold mb-4">{errorMsg}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition"
                >
                  Retry Setup
                </button>
              </div>
            )}

            {/* Scanning Overlay */}
            {phase === 'scanning' && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-400/30 border-t-emerald-400 animate-spin mb-3" />
                <p className="text-emerald-300 text-sm font-bold tracking-wide">{scanFeedback}</p>
                <p className="text-gray-300 text-xs mt-1">Hold still…</p>
              </div>
            )}

            {/* Done Overlay */}
            {phase === 'done' && (
              <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-6 text-center z-20">
                <span className="text-5xl mb-3">🎉</span>
                <p className="text-emerald-300 font-bold text-lg">3D Profile Ready!</p>
                <p className="text-emerald-200 text-xs mt-1">
                  All 3 biometric angles captured successfully.
                </p>
              </div>
            )}

            {/* Angle Guidance Banner (Shown when ready) */}
            {phase === 'ready' && step < BIOMETRIC_ANGLES.length && (
              <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl border border-white/10 z-10 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currentAngle.emoji}</span>
                  <div>
                    <p className="font-bold text-sm leading-tight">{currentAngle.label}</p>
                    <p className="text-xs text-gray-300">{currentAngle.hint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guidance warning tip if face not detected */}
          {guidanceTip && phase === 'ready' && (
            <p className="text-center text-xs font-semibold text-amber-600 bg-amber-50 py-1.5 px-3 rounded-lg mb-3 border border-amber-200">
              💡 {guidanceTip}
            </p>
          )}

          {/* Action Buttons */}
          {phase !== 'done' ? (
            <div className="space-y-2 max-w-sm mx-auto">
              <button
                onClick={captureAngle}
                disabled={phase !== 'ready'}
                className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {phase === 'loading' && 'Initializing AI Engine…'}
                {phase === 'scanning' && 'Scanning Biometrics…'}
                {phase === 'ready' && (
                  <>
                    <span>Capture Angle {step + 1} of 3</span>
                    <span>{currentAngle.emoji}</span>
                  </>
                )}
                {phase === 'error' && 'Error — Refresh Page'}
              </button>

              {/* Quick Save Option if at least 1 angle is already captured */}
              {step > 0 && phase === 'ready' && (
                <button
                  onClick={saveFace}
                  disabled={saving}
                  className="w-full py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition underline"
                >
                  {saving ? 'Saving…' : `Save now with ${step} angle${step > 1 ? 's' : ''} (Quick Setup)`}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="flex gap-3">
                <button
                  onClick={retakeAll}
                  disabled={saving}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-800 font-bold rounded-2xl hover:bg-gray-200 transition border border-gray-200 text-sm"
                >
                  Retake All
                </button>
                <button
                  onClick={saveFace}
                  disabled={saving}
                  className="flex-1 py-3.5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition shadow-md text-sm flex items-center justify-center gap-2"
                >
                  {saving ? 'Saving…' : 'Save Face ID Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
