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
  const [status, setStatus] = useState<'loading_models'|'loading_faces'|'starting_camera'|'active'|'error'>('loading_models');
  const [msg, setMsg] = useState('');
  const [recentMatches, setRecentMatches] = useState<{id: string, name: string, time: number}[]>([]);
  const markedRef = useRef(markedMap);
  useEffect(() => { markedRef.current = markedMap; }, [markedMap]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let scanInterval: NodeJS.Timeout;
    
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

        // Distance threshold 0.45
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.45);

        // 3. Start Camera
        setStatus('starting_camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Give camera time to init
        await new Promise(r => setTimeout(r, 1000));
        setStatus('active');

        // 4. Scanning Loop (Group Scan Mode)
        scanInterval = setInterval(async () => {
          if (!videoRef.current) return;
          
          // detectAllFaces for group scanning
          const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
          
          if (detections && detections.length > 0) {
            const newlyMarkedNames: string[] = [];
            
            // Process all detected faces in this single frame
            const markPromises = detections.map(async (det) => {
              const bestMatch = faceMatcher.findBestMatch(det.descriptor);
              if (bestMatch.label !== 'unknown') {
                const studentId = bestMatch.label;
                
                // If not already marked present
                if (markedRef.current[studentId] !== 'P') {
                  markedRef.current[studentId] = 'P'; // Optimistic local update
                  await onMark(studentId);
                  
                  const s = students.find(x => x.id === studentId);
                  if (s) {
                                        const nameParts = s.name.trim().split(' ');
                    const displayName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : s.name;
                    newlyMarkedNames.push(displayName); // Exclude last name only
                  }
                }
              }
            });
            
            await Promise.all(markPromises);
            
            if (newlyMarkedNames.length > 0) {
               const now = Date.now();
               const newMatches = newlyMarkedNames.map((n, i) => ({ id: now + '-' + i, name: n, time: now }));
               setRecentMatches(prev => [...prev, ...newMatches]);
               
               // Auto-remove after 3 seconds (3000ms)
               setTimeout(() => {
                  setRecentMatches(prev => prev.filter(m => now - m.time < 3000));
               }, 3000);
            }
          }
        }, 1000); // scan every 1s

      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMsg(e.message || 'Failed to start Kiosk');
      }
    };

    init();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (scanInterval) clearInterval(scanInterval);
    };
  }, [subjectId]); // We omit onMark and markedMap from deps to avoid re-init



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

        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-60" />
        
        {/* Overlay frame */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-72 h-72 border-4 border-dashed border-white/50 rounded-3xl relative">
             <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"/>
             <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"/>
             <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"/>
             <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"/>
          </div>
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
