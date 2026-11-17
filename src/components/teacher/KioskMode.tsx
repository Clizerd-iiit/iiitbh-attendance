"use client";
import { useEffect, useRef, useState } from 'react';
import { loadInsightFaceWithProgress, detectAllFacesInsight, matchInsightDescriptor } from '@/lib/humanInsightFace';

interface KioskModeProps {
  subjectId: string;
  onClose: () => void;
  onMark: (studentId: string) => Promise<void>;
  markedMap: Record<string, string>;
  students: { id: string; name: string; roll_no?: string }[];
}

function getDescriptorDim(descriptor: any): number {
  if (!descriptor) return 0;
  if (Array.isArray(descriptor) && Array.isArray(descriptor[0])) return descriptor[0].length;
  if (Array.isArray(descriptor)) return descriptor.length;
  return 0;
}

interface BoxDrawItem {
  box: { x: number; y: number; width: number; height: number };
  label: string;
  color: string;
}

function drawInsightBox(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  label: string,
  color: string
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  // High-tech corner brackets
  const cornerLen = Math.min(22, Math.max(10, box.width * 0.18));
  ctx.lineWidth = 4;
  // Top-left
  ctx.beginPath(); ctx.moveTo(box.x, box.y + cornerLen); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cornerLen, box.y); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cornerLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(box.x, box.y + box.height - cornerLen); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + cornerLen, box.y + box.height); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen); ctx.stroke();

  // Label capsule
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
  const textWidth = ctx.measureText(label).width;
  const padding = 8;
  const labelBg = color === '#22c55e' 
    ? 'rgba(22, 101, 52, 0.95)' 
    : color === '#eab308' 
      ? 'rgba(161, 98, 7, 0.95)' 
      : 'rgba(153, 27, 27, 0.95)';
  const labelY = box.y - 28 > 0 ? box.y - 28 : box.y + box.height + 4;
  ctx.fillStyle = labelBg;
  ctx.fillRect(box.x, labelY, textWidth + padding * 2, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, box.x + padding, labelY + 18);
  ctx.restore();
}

export function KioskMode({ subjectId, onClose, onMark, markedMap, students }: KioskModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading_models'|'loading_faces'|'starting_camera'|'active'|'error'>('loading_models');
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [modelLoadStage, setModelLoadStage] = useState('Initializing AI Biometric Engine...');
  const [msg, setMsg] = useState('');
  const [recentMatches, setRecentMatches] = useState<{id: string, name: string, time: number}[]>([]);
  const [fps, setFps] = useState(0);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [detectedCount, setDetectedCount] = useState(0);
  
  const markedRef = useRef(markedMap);
  useEffect(() => { markedRef.current = markedMap; }, [markedMap]);

  // Multi-frame temporal consistency map (studentId -> consecutive hit count)
  const consecutiveHitsRef = useRef<Record<string, number>>({});
  // Pending mark lockout set
  const pendingMarkRef = useRef<Set<string>>(new Set());
  // Active boxes to render continuously at 60 FPS
  const activeBoxesRef = useRef<BoxDrawItem[]>([]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animFrameId: number | null = null;
    let inferTimer: NodeJS.Timeout | null = null;
    let isRunning = true;
    let frameCount = 0;
    let lastFpsTime = Date.now();
    let isInferring = false;
    
    const init = async () => {
      try {
        setStatus('loading_models');
        
        // 1. Load Neural Biometrics with local caching
        await loadInsightFaceWithProgress((percent, stage) => {
          setModelLoadProgress(percent);
          setModelLoadStage(stage);
        });

        setStatus('loading_faces');
        const res = await fetch(`/api/teacher/attendance/faces?subject_id=${subjectId}`);
        const data = await res.json();
        
        // Build map of student info (id -> { name, roll_no, descriptor })
        const infoMap: Record<string, { name: string; roll_no: string; descriptor: any }> = {};
        (data.students || []).forEach((s: any) => {
          if (s.id && s.descriptor) {
            infoMap[s.id] = { name: s.name || 'Student', roll_no: s.roll_no || '', descriptor: s.descriptor };
          }
        });
        (students || []).forEach((s: any) => {
          if (s.id && infoMap[s.id] && !infoMap[s.id].roll_no && s.roll_no) {
            infoMap[s.id].roll_no = s.roll_no;
          }
        });

        const enrolledStudents = Object.entries(infoMap).map(([id, info]) => ({
          id,
          name: info.name,
          roll_no: info.roll_no,
          descriptor: info.descriptor,
        }));

        if (enrolledStudents.length === 0) {
          setStatus('error');
          setMsg('No students have registered their Face ID yet! Ask students to set up Face ID.');
          return;
        }

        // Categorize enrolled students into Neural Biometrics (>= 256)
        const enrolledNeural = enrolledStudents.filter(s => getDescriptorDim(s.descriptor) >= 256);
        setEnrolledCount(enrolledNeural.length);

        setStatus('starting_camera');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } 
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        }

        // Guaranteed video readiness: resolves on playing, loadedmetadata, or at most 800ms
        await new Promise<void>((resolve) => {
          const vid = videoRef.current;
          if (vid && vid.readyState >= 2 && vid.videoWidth > 0) {
            resolve();
            return;
          }
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          const timeout = setTimeout(done, 800);
          if (vid) {
            vid.onloadedmetadata = () => { clearTimeout(timeout); done(); };
            vid.onplaying = () => { clearTimeout(timeout); done(); };
            vid.oncanplay = () => { clearTimeout(timeout); done(); };
          }
        });
        
        if (videoRef.current && canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }

        setStatus('active');

        // ── 2. Decoupled 60 FPS Render Loop (Always active, never blocks) ─────
        const renderLoop = () => {
          if (!isRunning) return;
          animFrameId = requestAnimationFrame(renderLoop);

          // FPS calculation
          const now = Date.now();
          frameCount++;
          if (now - lastFpsTime >= 1000) {
            setFps(frameCount);
            frameCount = 0;
            lastFpsTime = now;
          }

          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (!canvas || !video) return;

          if (video.videoWidth > 0 && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw active bounding boxes
          const boxes = activeBoxesRef.current;
          for (const b of boxes) {
            drawInsightBox(ctx, b.box, b.label, b.color);
          }
        };

        renderLoop();

        // ── 3. High-Cadence Neural Inference Loop (every 220ms) ───────────────
        const runInferenceCycle = async () => {
          if (!isRunning || isInferring) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.videoWidth === 0) return;

          isInferring = true;
          try {
            const detections = await detectAllFacesInsight(video);
            setDetectedCount(detections.length);

            if (detections.length === 0) {
              activeBoxesRef.current = [];
              return;
            }

            const currentMatchedIds = new Set<string>();
            const newlyMarkedNames: string[] = [];
            const markPromises: Promise<void>[] = [];
            const nextBoxes: BoxDrawItem[] = [];

            for (const det of detections) {
              let bestMatch: any = null;
              let topSim = -1;
              let secondSim = -1;

              for (const s of enrolledNeural) {
                const match = matchInsightDescriptor(det.embedding, s.descriptor, 0.65);
                if (match.similarity > topSim) {
                  secondSim = topSim;
                  topSim = match.similarity;
                  bestMatch = { student: s, similarity: match.similarity, confidence: match.confidence };
                } else if (match.similarity > secondSim) {
                  secondSim = match.similarity;
                }
              }

              let labelText = 'Unregistered Face';
              let boxColor = '#ef4444'; // Red default

              // Robust Matching Threshold: Cosine similarity >= 65% with disambiguation guard
              const isMatch = bestMatch && topSim >= 0.65 && (secondSim < 0 || topSim - secondSim >= 0.04);

              if (isMatch) {
                const sId = bestMatch.student.id;
                currentMatchedIds.add(sId);
                const hits = (consecutiveHitsRef.current[sId] || 0) + 1;
                consecutiveHitsRef.current[sId] = hits;

                const sName = bestMatch.student.name || 'Student';
                const rollStr = bestMatch.student.roll_no ? ` (${bestMatch.student.roll_no})` : '';

                if (hits >= 3) {
                  labelText = `${sName} ${bestMatch.confidence}% ✓`;
                  boxColor = '#22c55e'; // Green confirmed

                  if (markedRef.current[sId] !== 'P' && !pendingMarkRef.current.has(sId)) {
                    markedRef.current[sId] = 'P';
                    pendingMarkRef.current.add(sId);
                    markPromises.push(onMark(sId));
                    newlyMarkedNames.push(`${sName}${rollStr}`);
                  }
                } else {
                  labelText = `${sName} Verifying (${hits}/3)…`;
                  boxColor = '#eab308'; // Amber verifying
                }
              }

              nextBoxes.push({ box: det.box, label: labelText, color: boxColor });
            }

            activeBoxesRef.current = nextBoxes;

            // Decay hit counters for unmatched students
            Object.keys(consecutiveHitsRef.current).forEach(id => {
              if (!currentMatchedIds.has(id)) {
                consecutiveHitsRef.current[id] = Math.max(0, (consecutiveHitsRef.current[id] || 0) - 1);
              }
            });

            if (markPromises.length > 0) await Promise.all(markPromises);

            if (newlyMarkedNames.length > 0) {
              const stamp = Date.now();
              const newMatches = newlyMarkedNames.map((n, i) => ({ id: stamp + '-' + i, name: n, time: stamp }));
              setRecentMatches(prev => [...prev, ...newMatches]);
              setTimeout(() => {
                setRecentMatches(prev => prev.filter(m => stamp - m.time < 3500));
              }, 3500);
            }
          } catch (err) {
            console.warn('[Kiosk] Inference error:', err);
          } finally {
            isInferring = false;
          }
        };

        // Run inference every 220ms
        inferTimer = setInterval(runInferenceCycle, 220);

      } catch (e: any) {
        console.error('[Kiosk] Initialization error:', e);
        setStatus('error');
        setMsg(e.message || 'Failed to start Biometric Engine');
      }
    };

    init();

    return () => {
      isRunning = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (inferTimer) clearInterval(inferTimer);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [subjectId]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-mono">
      <div className="p-4 bg-gray-950 flex justify-between items-center border-b border-gray-800">
        <h2 className="text-white font-bold text-xl flex items-center gap-3">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"/>
          AI Biometric Attendance Kiosk
        </h2>
        <div className="flex items-center gap-4">
           <div className="text-green-400 font-bold bg-gray-900 px-3 py-1 rounded border border-green-900">
              {fps} FPS
           </div>
           <button onClick={onClose} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold uppercase tracking-wider text-sm transition">
             Terminate
           </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-gray-900 overflow-hidden">
        {status === 'loading_models' && (
          <div className="absolute z-10 flex flex-col items-center max-w-sm px-6 text-center">
            <div className="relative mb-4 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
              <span className="absolute text-sm font-black text-green-400 font-mono">
                {modelLoadProgress}%
              </span>
            </div>
            <p className="text-green-400 font-bold uppercase tracking-widest text-sm mb-2 font-mono">
              Loading AI Models ({modelLoadProgress}%)
            </p>
            <div className="w-64 bg-gray-800 rounded-full h-2.5 overflow-hidden border border-green-900/50 mb-2">
              <div 
                className="bg-green-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(5, modelLoadProgress))}%` }}
              />
            </div>
            <p className="text-gray-400 text-xs font-mono">
              {modelLoadStage}
            </p>
          </div>
        )}

        {status !== 'loading_models' && status !== 'active' && status !== 'error' && (
          <div className="absolute z-10 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"/>
            <p className="text-green-400 font-bold uppercase tracking-widest">
              {status === 'loading_faces' ? 'Loading Descriptors...' : 'Starting Camera...'}
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute z-10 bg-red-900 text-red-200 px-6 py-4 rounded font-bold max-w-md text-center border border-red-500">
            {msg}
          </div>
        )}

        <div className="relative w-full h-full flex items-center justify-center">
           <video ref={videoRef} autoPlay muted playsInline className="absolute w-full h-full object-cover" />
           <canvas ref={canvasRef} className="absolute w-full h-full object-cover pointer-events-none" />
           
           {/* Biometric HUD Overlay */}
           {status === 'active' && (
             <div className="absolute top-4 left-4 text-green-400 text-xs md:text-sm font-bold opacity-90 pointer-events-none bg-black/60 p-2.5 rounded-xl border border-green-500/30">
                <p className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                  ENGINE: High-Precision Neural Biometrics
                </p>
                <p>MATCHING: Cosine Similarity ≥ 65% · 3-Frame Temporal Lock</p>
                <p>HARDWARE: WebGL GPU Accelerated · IndexedDB Cached</p>
                <p className="text-xs text-gray-300 mt-1 font-mono">
                  Enrolled: <span className="text-green-300">{enrolledCount}</span> · Tracking: <span className="text-green-300">{detectedCount}</span> face(s)
                </p>
             </div>
           )}
        </div>
        
        {/* Realtime Toast Popups */}
        <div className="absolute right-6 top-20 bottom-6 w-72 md:w-80 overflow-hidden flex flex-col items-end gap-3 pointer-events-none p-2">
          {recentMatches.map((match) => (
            <div key={match.id} className="bg-gray-900 text-green-400 px-4 py-3 rounded-xl font-bold text-base shadow-xl flex items-center justify-between w-full border border-green-500/60 animate-in fade-in slide-in-from-right duration-200">
              <span className="truncate">{match.name}</span>
              <span className="text-xs bg-green-900 text-green-200 px-2 py-1 rounded font-mono">VERIFIED ✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
