"use client";
import { useEffect, useRef, useState } from 'react';
import { loadFaceEngine, detectAllFacesWithDetails, matchFaceDescriptor } from '@/lib/faceEngine';

interface KioskModeProps {
  subjectId: string;
  onClose: () => void;
  onMark: (studentId: string) => Promise<void>;
  markedMap: Record<string, string>;
  students: { id: string; name: string; roll_no?: string }[];
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

  // Label capsule
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  const textWidth = ctx.measureText(label).width;
  const padding = 6;
  ctx.fillStyle = color === '#22c55e' ? 'rgba(22, 101, 52, 0.95)' : 'rgba(153, 27, 27, 0.95)';
  const labelY = box.y - 28 > 0 ? box.y - 28 : box.y;
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
  const [modelLoadStage, setModelLoadStage] = useState('Initializing Biometric Attendance Engine...');
  const [msg, setMsg] = useState('');
  const [recentMatches, setRecentMatches] = useState<{id: string, name: string, time: number}[]>([]);
  const [fps, setFps] = useState(0);
  const [facesCount, setFacesCount] = useState(0);
  
  const markedRef = useRef(markedMap);
  useEffect(() => { markedRef.current = markedMap; }, [markedMap]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isRunning = true;
    let frameCount = 0;
    let lastFpsTime = Date.now();
    
    const init = async () => {
      try {
        setStatus('loading_models');
        await loadFaceEngine((percent, stage) => {
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

        // High-Speed Throttled Inference Loop
        let isDetecting = false;
        let lastDetectTime = 0;

        const scanLoop = async () => {
          if (!isRunning || !videoRef.current || !canvasRef.current) return;
          
          const now = Date.now();
          if (!isDetecting && now - lastDetectTime >= 250 && videoRef.current.readyState >= 2) {
            isDetecting = true;
            lastDetectTime = now;
            try {
              if (canvasRef.current.width !== videoRef.current.videoWidth || canvasRef.current.height !== videoRef.current.videoHeight) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }

              const detections = await detectAllFacesWithDetails(videoRef.current);
              setFacesCount(detections.length);

              const ctx = canvasRef.current.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

              if (detections.length > 0) {
                const newlyMarkedNames: string[] = [];
                const markPromises: Promise<void>[] = [];

                for (const det of detections) {
                  let bestMatch: any = null;
                  let highestConf = 0;

                  for (const s of enrolledStudents) {
                    const match = matchFaceDescriptor(det.descriptor, s.descriptor, 0.55);
                    if (match.isMatch && match.confidence > highestConf) {
                      highestConf = match.confidence;
                      bestMatch = s;
                    }
                  }

                  const box = det.box;
                  let labelText = 'Scanning…';
                  let boxColor = '#3b82f6';

                  if (bestMatch && highestConf >= 50) {
                    const studentName = bestMatch.name || 'Student';
                    const rollNo = bestMatch.roll_no ? ` (${bestMatch.roll_no})` : '';

                    labelText = `${studentName} ${highestConf}%`;
                    boxColor = '#22c55e';

                    if (markedRef.current[bestMatch.id] !== 'P') {
                      markedRef.current[bestMatch.id] = 'P';
                      markPromises.push(onMark(bestMatch.id));
                      newlyMarkedNames.push(`${studentName}${rollNo}`);
                    }
                  } else {
                    labelText = 'Unknown Face';
                    boxColor = '#ef4444';
                  }

                  if (canvasRef.current && ctx) {
                    drawInsightBox(ctx, box, labelText, boxColor);
                  }
                }

                if (markPromises.length > 0) await Promise.all(markPromises);

                if (newlyMarkedNames.length > 0) {
                  const stamp = Date.now();
                  const newMatches = newlyMarkedNames.map((n, i) => ({ id: stamp + '-' + i, name: n, time: stamp }));
                  setRecentMatches(prev => [...prev, ...newMatches]);
                  setTimeout(() => {
                    setRecentMatches(prev => prev.filter(m => stamp - m.time < 3500));
                  }, 3500);
                }
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
          Biometric Attendance Kiosk (512-D HD)
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
             <div className="absolute top-4 left-4 text-green-400 text-xs md:text-sm font-bold opacity-80 pointer-events-none">
                <p>ENGINE: Neural Biometric AI (512-D HD)</p>
                <p>TARGET: High-Precision Attendance Recognition</p>
                <p>DEVICE: WebGL Hardware Accelerated</p>
             </div>
           )}
        </div>
        
        {/* Realtime Toast Popups */}
        <div className="absolute right-6 top-20 bottom-6 w-72 md:w-80 overflow-hidden flex flex-col items-end gap-3 pointer-events-none p-2">
          {recentMatches.map((match) => (
            <div key={match.id} className="bg-gray-900 text-green-400 px-4 py-3 rounded font-bold text-lg shadow-lg flex items-center justify-between w-full border border-green-500">
              <span className="truncate">{match.name}</span>
              <span className="text-xs bg-green-900 text-white px-2 py-1 rounded">MATCHED</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
