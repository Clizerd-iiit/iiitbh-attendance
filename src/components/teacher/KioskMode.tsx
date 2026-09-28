"use client";
import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

interface KioskModeProps {
  subjectId: string;
  onClose: () => void;
  onMark: (studentId: string) => Promise<void>;
  markedMap: Record<string, string>;
  students: { id: string; name: string; roll_no?: string }[];
}

export function KioskMode({ subjectId, onClose, onMark, markedMap, students }: KioskModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading_models'|'loading_faces'|'starting_camera'|'active'|'error'>('loading_models');
  const [msg, setMsg] = useState('');
  const [recentMatches, setRecentMatches] = useState<{id: string, name: string, time: number}[]>([]);
  const [fps, setFps] = useState(0);
  
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
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);

        setStatus('loading_faces');
        const res = await fetch(`/api/teacher/attendance/faces?subject_id=${subjectId}`);
        const data = await res.json();
        
        const labeledDescriptors = (data.students || []).map((s: any) => {
          return new faceapi.LabeledFaceDescriptors(s.id, [new Float32Array(s.descriptor)]);
        });

        if (labeledDescriptors.length === 0) {
          setStatus('error');
          setMsg('No students have registered their Face ID yet!');
          return;
        }

        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.38); // OPTIMAL STRICTNESS

        setStatus('starting_camera');
        // Request higher resolution for M1 Mac performance
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 } } 
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
           canvasRef.current.width = videoRef.current.videoWidth;
           canvasRef.current.height = videoRef.current.videoHeight;
        }

        setStatus('active');

        // YOLO-style High-Speed Inference Loop
        const scanLoop = async () => {
          if (!isRunning || !videoRef.current || !canvasRef.current) return;
          
          const loopStartTime = Date.now();

          if (videoRef.current.readyState === 4) {
             const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
             faceapi.matchDimensions(canvasRef.current, displaySize);

             const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.75 })).withFaceLandmarks().withFaceDescriptors();
             const resizedDetections = faceapi.resizeResults(detections, displaySize);
             
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

             if (resizedDetections && resizedDetections.length > 0) {
                const newlyMarkedNames: string[] = [];
                const markPromises: Promise<void>[] = [];

                resizedDetections.forEach(det => {
                   const box = det.detection.box;
                   
                   // CRITICAL FIX: Ignore background faces (too small). 
                   // This prevents blurry background people from causing random false positives.
                   if (box.width < 120 || box.height < 120) return; // BALANCED BACKGROUND FILTER

                   const bestMatch = faceMatcher.findBestMatch(det.descriptor);
                   const isUnknown = bestMatch.label === 'unknown' || bestMatch.distance > 0.38;
                   const studentId = bestMatch.label;
                   
                   // YOLOv7 style confidence mapping (lower distance = higher confidence)
                   const confidence = isUnknown ? 0 : Math.max(0, Math.min(99, Math.round((1 - bestMatch.distance) * 100)));
                   
                   let boxColor = '#ef4444'; // Red for unknown
                   let labelText = `Unknown`;
                   if (!isUnknown) {
                      const s = students.find(x => x.id === studentId);
                      let firstName = 'Unknown';
                      if (s) {
                         const nameParts = s.name.trim().split(' ');
                         firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : s.name;
                         labelText = `${firstName} ${confidence}%`; // YOLO Style Confidence
                      }

                      if (markedRef.current[studentId] === 'P') {
                         boxColor = '#22c55e'; // YOLO Green
                      } else {
                         boxColor = '#22c55e'; 
                         markedRef.current[studentId] = 'P'; 
                         markPromises.push(onMark(studentId));
                         newlyMarkedNames.push(firstName);
                      }
                   }

                   // YOLOv7 Style Crisp Bounding Box
                   const drawBox = new faceapi.draw.DrawBox(box, {
                      label: labelText,
                      boxColor: boxColor,
                      lineWidth: 3,
                      drawLabelOptions: {
                         fontColor: '#ffffff',
                         fontSize: 20,
                         padding: 8
                      }
                   });
                   if (canvasRef.current) drawBox.draw(canvasRef.current);
                });

                if (markPromises.length > 0) await Promise.all(markPromises);

                if (newlyMarkedNames.length > 0) {
                   const now = Date.now();
                   const newMatches = newlyMarkedNames.map((n, i) => ({ id: now + '-' + i, name: n, time: now }));
                   setRecentMatches(prev => [...prev, ...newMatches]);
                   setTimeout(() => {
                      setRecentMatches(prev => prev.filter(m => now - m.time < 3000));
                   }, 3000);
                }
             }
          }
          
          // FPS Calculation
          frameCount++;
          const now = Date.now();
          if (now - lastFpsTime >= 1000) {
             setFps(frameCount);
             frameCount = 0;
             lastFpsTime = now;
          }
          
          // Ultra-fast requestAnimationFrame for M1 Mac performance
          if (isRunning) requestAnimationFrame(scanLoop);
        };

        scanLoop();

      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMsg(e.message || 'Failed to start YOLO Engine');
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
          YOLO Inference Engine (M1 Optimized)
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
        {status !== 'active' && status !== 'error' && (
          <div className="absolute z-10 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"/>
            <p className="text-green-400 font-bold uppercase tracking-widest">
              {status === 'loading_models' ? 'Initializing YOLO Weights...' : 
               status === 'loading_faces' ? 'Loading Descriptors...' : 'Starting Camera...'}
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
           
           {/* YOLO HUD Overlay */}
           {status === 'active' && (
             <div className="absolute top-4 left-4 text-green-400 text-xs md:text-sm font-bold opacity-70 pointer-events-none">
                <p>MODEL: YOLO-Face-Optimized</p>
                <p>TARGET: Attendance Recognition</p>
                <p>DEVICE: WebGL Hardware Accelerated</p>
             </div>
           )}
        </div>
        
        {/* Realtime Toast Popups (YOLO Style) */}
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
