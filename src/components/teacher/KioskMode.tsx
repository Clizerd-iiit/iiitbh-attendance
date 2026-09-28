"use client";
import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

interface KioskModeProps {
  subjectId: string;
  onClose: () => void;
  onMark: (studentId: string) => Promise<void>;
  markedMap: Record<string, string>; // student_id -> status
  students: { id: string; name: string; roll_no?: string }[];
}

export function KioskMode({ subjectId, onClose, onMark, markedMap, students }: KioskModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading_models'|'loading_faces'|'starting_camera'|'active'|'error'>('loading_models');
  const [msg, setMsg] = useState('');
  const [recentMatches, setRecentMatches] = useState<{id: string, name: string, time: number}[]>([]);
  
  const markedRef = useRef(markedMap);
  useEffect(() => { markedRef.current = markedMap; }, [markedMap]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let isRunning = true;
    
    const init = async () => {
      try {
        // 1. Load models
        setStatus('loading_models');
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);

        // 2. Load faces
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

        // Distance threshold 0.55 for good accuracy
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.42); // Ultra strict // Stricter for Kiosk to prevent false positives

        // 3. Start Camera
        setStatus('starting_camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Wait for video to be ready
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

        // 4. Scanning Loop (Throttled for Accuracy)
        const scanLoop = async () => {
          if (!isRunning || !videoRef.current || !canvasRef.current) return;
          
          if (videoRef.current.readyState === 4) {
             const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
             faceapi.matchDimensions(canvasRef.current, displaySize);

             // HIGH scoreThreshold (0.75) to prevent ghost faces/background noise
             const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.75 })).withFaceLandmarks().withFaceDescriptors();
             const resizedDetections = faceapi.resizeResults(detections, displaySize);
             
             const ctx = canvasRef.current.getContext('2d');
             if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

             if (resizedDetections && resizedDetections.length > 0) {
                const newlyMarkedNames: string[] = [];
                const markPromises: Promise<void>[] = [];

                resizedDetections.forEach(det => {
                   const bestMatch = faceMatcher.findBestMatch(det.descriptor);
                   
                   // EXTREMELY STRICT distance threshold (0.42) for Kiosk
                   const isUnknown = bestMatch.label === 'unknown' || bestMatch.distance > 0.42;
                   const studentId = bestMatch.label;
                   
                   let boxColor = '#ef4444'; // Red for unknown or not marked
                   let labelText = isUnknown ? 'Unknown' : 'Recognizing...';
                   const box = det.detection.box;

                   // Enforce minimum face size for accuracy (prevent background noise matching)
                   const isTooFar = box.width < 110 || box.height < 110;

                   if (isTooFar) {
                      boxColor = '#eab308'; // Yellow
                      labelText = 'Come Closer!';
                   } else if (!isUnknown) {
                      const s = students.find(x => x.id === studentId);
                      if (s) {
                         const nameParts = s.name.trim().split(' ');
                         labelText = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : s.name;
                      }

                      // Check if already marked
                      if (markedRef.current[studentId] === 'P') {
                         boxColor = '#22c55e'; // Green if already marked
                      } else {
                         // Newly marked
                         boxColor = '#22c55e';
                         markedRef.current[studentId] = 'P'; // Optimistic local update
                         markPromises.push(onMark(studentId));
                         newlyMarkedNames.push(labelText);
                      }
                   }

                   // Draw bounding box
                   const drawBox = new faceapi.draw.DrawBox(box, {
                      label: labelText,
                      boxColor: boxColor,
                      lineWidth: 4,
                      drawLabelOptions: {
                         fontColor: '#ffffff',
                         fontSize: 22,
                         padding: 8
                      }
                   });
                   if (canvasRef.current) drawBox.draw(canvasRef.current);
                });

                if (markPromises.length > 0) {
                   await Promise.all(markPromises);
                }

                if (newlyMarkedNames.length > 0) {
                   const now = Date.now();
                   const newMatches = newlyMarkedNames.map((n, i) => ({ id: now + '-' + i, name: n, time: now }));
                   setRecentMatches(prev => [...prev, ...newMatches]);
                   
                   // Auto-remove after 3 seconds
                   setTimeout(() => {
                      setRecentMatches(prev => prev.filter(m => now - m.time < 3000));
                   }, 3000);
                }
             }
          }
          
          // Throttle to ~3 FPS to prevent "lucky bad frame" false positives
          if (isRunning) setTimeout(scanLoop, 350);
        };

        scanLoop();

      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMsg(e.message || 'Failed to start Kiosk');
      }
    };

    init();

    return () => {
      isRunning = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [subjectId]); // omit onMark and markedMap from deps to avoid re-init

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="p-4 bg-gray-900 flex justify-between items-center border-b border-gray-800">
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"/>
          Live AI Detection Attendance
        </h2>
        <button onClick={onClose} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
          Close Kiosk
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-gray-950 overflow-hidden">
        {status !== 'active' && status !== 'error' && (
          <div className="absolute z-10 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"/>
            <p className="text-white font-medium">
              {status === 'loading_models' ? 'Loading AI Models...' : 
               status === 'loading_faces' ? 'Fetching Student Faces...' : 'Starting Camera...'}
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute z-10 bg-red-500 text-white px-6 py-4 rounded-xl font-bold max-w-md text-center">
            {msg}
          </div>
        )}

        <div className="relative w-full h-full flex items-center justify-center">
           <video ref={videoRef} autoPlay muted playsInline className="absolute w-full h-full object-cover" />
           <canvas ref={canvasRef} className="absolute w-full h-full object-cover pointer-events-none" />
        </div>
        
        {/* Vertical Recent Matches on the Right */}
        <div className="absolute right-6 top-6 bottom-6 w-72 md:w-80 overflow-hidden flex flex-col items-end gap-3 pointer-events-none p-2">
          {recentMatches.map((match) => (
            <div key={match.id} className="bg-green-500 text-white px-6 py-4 rounded-2xl font-bold text-lg md:text-xl shadow-[0_0_30px_rgba(34,197,94,0.6)] animate-pulse flex items-center gap-3 w-full border-2 border-green-400">
              <span className="text-2xl shrink-0">✅</span>
              <span className="truncate">{match.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
