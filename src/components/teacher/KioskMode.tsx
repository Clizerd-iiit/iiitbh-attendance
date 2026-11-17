"use client";
import { useEffect, useRef, useState } from 'react';
import { loadInsightFaceWithProgress, detectAllFacesInsight, matchInsightDescriptor } from '@/lib/humanInsightFace';
import { loadFaceEngine, detectAllFacesWithDetails, matchFaceDescriptor } from '@/lib/faceEngine';

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
  const cornerLen = Math.min(20, Math.max(8, box.width * 0.18));
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
  const [facesCount, setFacesCount] = useState(0);
  
  const markedRef = useRef(markedMap);
  useEffect(() => { markedRef.current = markedMap; }, [markedMap]);

  // Industry Setting: Multi-frame temporal consistency map (studentId -> consecutive hit count)
  const consecutiveHitsRef = useRef<Record<string, number>>({});
  // Pending mark lockout set
  const pendingMarkRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isRunning = true;
    let frameCount = 0;
    let lastFpsTime = Date.now();
    
    const init = async () => {
      try {
        setStatus('loading_models');
        
        // 1. Load InsightFace ArcFace (512-D) with local caching
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

        // Categorize enrolled students into Neural Biometrics (>= 256) and 128-D (Legacy)
        const enrolledNeural = enrolledStudents.filter(s => getDescriptorDim(s.descriptor) >= 256);
        const enrolled128 = enrolledStudents.filter(s => getDescriptorDim(s.descriptor) === 128);

        // If class contains legacy 128-D students, also ensure faceEngine is initialized
        if (enrolled128.length > 0) {
          await loadFaceEngine();
        }

        setStatus('starting_camera');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        await new Promise(r => {
          if (videoRef.current && videoRef.current.readyState >= 2) r(true);
          else if (videoRef.current) videoRef.current.onloadeddata = () => r(true);
          else setTimeout(r, 1000);
        });
        
        if (videoRef.current && canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }

        setStatus('active');

        // High-Speed Industry-Level Inference Loop (250ms cadence)
        let isDetecting = false;
        let lastDetectTime = 0;

        const scanLoop = async () => {
          if (!isRunning || !videoRef.current || !canvasRef.current) return;
          
          const now = Date.now();
          if (!isDetecting && now - lastDetectTime >= 220 && videoRef.current.readyState >= 2) {
            isDetecting = true;
            lastDetectTime = now;
            try {
              if (canvasRef.current.width !== videoRef.current.videoWidth || canvasRef.current.height !== videoRef.current.videoHeight) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }

              // Run Neural Biometric Detection
              const detectionsNeural = await detectAllFacesInsight(videoRef.current);
              setFacesCount(detectionsNeural.length);

              const ctx = canvasRef.current.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

              const currentFrameMatchedIds = new Set<string>();
              const newlyMarkedNames: string[] = [];
              const markPromises: Promise<void>[] = [];

              if (detectionsNeural.length > 0) {
                for (const det of detectionsNeural) {
                  let bestMatch: any = null;
                  let topSim = -1;
                  let secondSim = -1;

                  // 1. Compare against Neural Biometric Enrolled Students
                  for (const s of enrolledNeural) {
                    const match = matchInsightDescriptor(det.embedding, s.descriptor, 0.70);
                    if (match.similarity > topSim) {
                      secondSim = topSim;
                      topSim = match.similarity;
                      bestMatch = { student: s, similarity: match.similarity, confidence: match.confidence };
                    } else if (match.similarity > secondSim) {
                      secondSim = match.similarity;
                    }
                  }

                  const box = det.box;
                  let labelText = 'Unknown Face';
                  let boxColor = '#ef4444'; // Red default for unregistered

                  // Industry Standard Criteria:
                  // - Cosine Similarity >= 0.70 (>= 70%)
                  // - Margin over 2nd best candidate >= 0.05 (Disambiguation guard)
                  const isDistinctMatch = bestMatch && topSim >= 0.70 && (topSim - secondSim >= 0.05);

                  if (isDistinctMatch) {
                    const sId = bestMatch.student.id;
                    currentFrameMatchedIds.add(sId);
                    const hits = (consecutiveHitsRef.current[sId] || 0) + 1;
                    consecutiveHitsRef.current[sId] = hits;

                    const studentName = bestMatch.student.name || 'Student';
                    const rollNo = bestMatch.student.roll_no ? ` (${bestMatch.student.roll_no})` : '';

                    // Require 3 consecutive frames (~750ms steady gaze) before triggering attendance
                    if (hits >= 3) {
                      labelText = `${studentName} ${bestMatch.confidence}% ✓`;
                      boxColor = '#22c55e'; // Green confirmed

                      if (markedRef.current[sId] !== 'P' && !pendingMarkRef.current.has(sId)) {
                        markedRef.current[sId] = 'P';
                        pendingMarkRef.current.add(sId);
                        markPromises.push(onMark(sId));
                        newlyMarkedNames.push(`${studentName}${rollNo}`);
                      }
                    } else {
                      labelText = `${studentName} Verifying (${hits}/3)…`;
                      boxColor = '#eab308'; // Amber verifying
                    }
                  } else {
                    labelText = 'Unknown Face';
                    boxColor = '#ef4444'; // Red
                  }

                  if (canvasRef.current && ctx) {
                    drawInsightBox(ctx, box, labelText, boxColor);
                  }
                }
              }

              // 2. Fallback for legacy 128-D enrolled students if no 512-D matches were found in frame
              if (enrolled128.length > 0 && currentFrameMatchedIds.size === 0) {
                const detections128 = await detectAllFacesWithDetails(videoRef.current);
                if (detections128.length > 0) {
                  for (const det of detections128) {
                    let bestMatch128: any = null;
                    let minDist1 = Infinity;
                    let minDist2 = Infinity;

                    for (const s of enrolled128) {
                      // Strict 0.40 Euclidean threshold for 1-to-N search!
                      const match = matchFaceDescriptor(det.descriptor, s.descriptor, 0.40);
                      const dist = 0.55 - ((match.confidence - 65) / 34) * 0.55;
                      if (dist < minDist1) {
                        minDist2 = minDist1;
                        minDist1 = dist;
                        if (match.isMatch && match.confidence >= 80) {
                          bestMatch128 = { student: s, confidence: match.confidence };
                        }
                      } else if (dist < minDist2) {
                        minDist2 = dist;
                      }
                    }

                    const box = det.box;
                    if (bestMatch128 && (minDist2 - minDist1 >= 0.05)) {
                      const sId = bestMatch128.student.id;
                      currentFrameMatchedIds.add(sId);
                      const hits = (consecutiveHitsRef.current[sId] || 0) + 1;
                      consecutiveHitsRef.current[sId] = hits;

                      const studentName = bestMatch128.student.name || 'Student';
                      const rollNo = bestMatch128.student.roll_no ? ` (${bestMatch128.student.roll_no})` : '';

                      let labelText = '';
                      let boxColor = '#ef4444';

                      if (hits >= 3) {
                        labelText = `${studentName} ${bestMatch128.confidence}% ✓`;
                        boxColor = '#22c55e';

                        if (markedRef.current[sId] !== 'P' && !pendingMarkRef.current.has(sId)) {
                          markedRef.current[sId] = 'P';
                          pendingMarkRef.current.add(sId);
                          markPromises.push(onMark(sId));
                          newlyMarkedNames.push(`${studentName}${rollNo}`);
                        }
                      } else {
                        labelText = `${studentName} Verifying (${hits}/3)…`;
                        boxColor = '#eab308';
                      }

                      if (canvasRef.current && ctx) {
                        drawInsightBox(ctx, box, labelText, boxColor);
                      }
                    }
                  }
                }
              }

              // Decay consecutive hit counter for any student not matched in this frame
              Object.keys(consecutiveHitsRef.current).forEach(id => {
                if (!currentFrameMatchedIds.has(id)) {
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
              console.error("Face matching error:", err);
            } finally {
              isDetecting = false;
            }
          }
          
          // FPS Calculation
          frameCount++;
          if (now - lastFpsTime >= 1000) {
            setFps(frameCount);
            frameCount = 0;
            lastFpsTime = now;
          }
          
          if (isRunning) requestAnimationFrame(scanLoop);
        };

        scanLoop();

      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMsg(e.message || 'Failed to start Biometric Engine');
      }
    };

    init();

    return () => {
      isRunning = false;
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
           <button onClick={onClose} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold uppercase tracking-wider text-sm">
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
                <p>MATCHING: Cosine Similarity ≥ 70% · 3-Frame Temporal Lock</p>
                <p>HARDWARE: WebGL GPU Accelerated · IndexedDB Cached</p>
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
