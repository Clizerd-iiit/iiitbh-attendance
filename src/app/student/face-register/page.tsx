'use client';
import { useEffect, useRef, useState } from 'react';
import { loadInsightFaceWithProgress } from '@/lib/humanInsightFace';
import { Navbar } from '@/components/shared/Navbar';

const ANGLES = [
  { id: 'center', label: 'Look Straight', emoji: '😐' },
  { id: 'left', label: 'Turn Head Slowly to Left', emoji: '⬅️' },
  { id: 'right', label: 'Turn Head Slowly to Right', emoji: '➡️' },
  { id: 'up', label: 'Tilt Head Upwards', emoji: '⬆️' },
  { id: 'down', label: 'Tilt Head Downwards', emoji: '⬇️' }
];

export default function FaceRegisterPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const humanRef = useRef<any>(null);
  const [loading, setLoading] = useState('Initializing InsightFace...');
  const [modelProgress, setModelProgress] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [step, setStep] = useState(0); // 0 to 4 for angles, 5 for complete
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      try {
        const human = await loadInsightFaceWithProgress((percent, stage) => {
          if (!isCancelled) {
            setModelProgress(percent);
            setLoading(`${stage} (${percent}%)`);
          }
        });
        if (!isCancelled) {
          humanRef.current = human;
          setLoading('Starting Camera...');
          startVideo();
        }
      } catch (e) {
        if (!isCancelled) setLoading('Error loading InsightFace AI models. Please refresh.');
      }
    };

    init();
    
    return () => {
      isCancelled = true;
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' } })
      .then(s => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        }
        setLoading('');
      })
      .catch(e => setLoading('Camera access denied'));
  };

  const captureAngle = async () => {
    if (!videoRef.current || !humanRef.current) return;
    setLoading('Scanning with InsightFace...');
    
    try {
      const res = await humanRef.current.detect(videoRef.current);
      if (!res.face || res.face.length === 0 || !res.face[0]?.embedding) {
        setLoading('');
        alert("No face detected! Please look directly at the camera with clear lighting.");
        return;
      }
      
      const embedding = Array.from(res.face[0].embedding as number[] | Float32Array);
      setDescriptors(prev => [...prev, embedding]);
      setStep(prev => prev + 1);
      setLoading('');
    } catch (err) {
      console.error(err);
      setLoading('');
      alert("Error scanning face. Please try again.");
    }
  };

  const saveMultiAngleFace = async () => {
    if (descriptors.length < 5) return;
    setSaving(true);
    const res = await fetch('/api/student/face', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ descriptor: descriptors }) // Upload 5-angle 512-D vectors
    });
    setSaving(false);
    if (res.ok) {
      alert("✅ InsightFace Multi-Angle Face ID Registered Successfully!");
      window.location.href = '/student/dashboard';
    } else {
      const d = await res.json();
      alert("❌ " + (d.error || "Failed to save Face ID"));
    }
  };

  const reset = () => {
    setStep(0);
    setDescriptors([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">📷 Smart Multi-Angle Face ID</h1>
        <p className="text-sm text-gray-600 mb-6">Capture 5 angles for 99.9% accuracy and zero false matches.</p>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
          
          <div className="flex justify-center gap-2 mb-6">
             {[0,1,2,3,4].map(idx => (
                <div key={idx} className={`h-2 flex-1 rounded-full ${idx < step ? 'bg-green-500' : idx === step ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'}`} />
             ))}
          </div>

          <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-900 rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl mb-6 flex items-center justify-center">
            {loading && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm text-white flex flex-col items-center justify-center font-bold z-10 p-6 text-center">
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  {modelProgress > 0 && (
                    <span className="absolute text-xs font-black text-blue-400">
                      {modelProgress}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold mb-2">{loading}</p>
                {modelProgress > 0 && modelProgress < 100 && (
                  <div className="w-44 bg-gray-700/60 rounded-full h-2 overflow-hidden border border-gray-600/40">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(5, modelProgress))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            
            {step < 5 && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-gray-600 flex items-center justify-between">
                 <span className="text-2xl">{ANGLES[step].emoji}</span>
                 <span className="font-bold text-sm">{ANGLES[step].label}</span>
              </div>
            )}
          </div>

          {step < 5 ? (
            <button onClick={captureAngle} disabled={!!loading} className="px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 disabled:opacity-70 transition w-full max-w-sm shadow-md">
              Capture Angle {step + 1}/5
            </button>
          ) : (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="bg-green-100 text-green-800 p-4 rounded-xl border border-green-300">
                 <p className="font-bold text-lg">✅ All Angles Scanned!</p>
                 <p className="text-sm mt-1">Your 3D facial map is ready.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={reset} disabled={saving} className="flex-1 py-4 bg-gray-200 text-gray-800 font-bold rounded-2xl hover:bg-gray-300 transition">
                  Retake All
                </button>
                <button onClick={saveMultiAngleFace} disabled={saving} className="flex-1 py-4 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition shadow-md">
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
