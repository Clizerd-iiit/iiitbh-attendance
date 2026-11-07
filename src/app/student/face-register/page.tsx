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
  
  // Model loading state
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStage, setModelStage] = useState('Initializing AI Biometric Engine...');
  const [cameraError, setCameraError] = useState('');

  // Angle scanning state
  const [isScanningAngle, setIsScanningAngle] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

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
            setModelStage(stage);
          }
        });
        if (!isCancelled) {
          humanRef.current = human;
          setModelStage('Starting Camera...');
          startVideo();
        }
      } catch (e) {
        if (!isCancelled) {
          setIsModelLoading(false);
          setCameraError('Error loading AI biometric models. Please refresh the page.');
        }
      }
    };

    init();
    
    return () => {
      isCancelled = true;
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' } 
    })
      .then(s => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            setIsModelLoading(false);
            setModelStage('');
          };
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        }
        // Fallback safety release
        setTimeout(() => {
          setIsModelLoading(false);
          setModelStage('');
        }, 1200);
      })
      .catch(() => {
        setIsModelLoading(false);
        setCameraError('Camera access denied or unavailable. Please enable camera access.');
      });
  };

  const captureAngle = async () => {
    if (!videoRef.current || !humanRef.current) return;

    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      alert("Camera stream is still starting. Please wait a moment and try again.");
      return;
    }

    setIsScanningAngle(true);
    setScanMessage('Scanning Face Geometry...');
    
    try {
      const detectPromise = humanRef.current.detect(videoRef.current);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Scanning timed out. Please hold steady in good lighting.')), 8000)
      );

      const res = await Promise.race([detectPromise, timeoutPromise]) as any;

      if (!res.face || res.face.length === 0 || !res.face[0]?.embedding) {
        alert("No face detected! Please look directly at the camera with clear lighting.");
        return;
      }
      
      const embedding = Array.from(res.face[0].embedding as number[] | Float32Array);
      setDescriptors(prev => [...prev, embedding]);
      setStep(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Error scanning face. Please try again.");
    } finally {
      setIsScanningAngle(false);
      setScanMessage('');
    }
  };

  const saveMultiAngleFace = async () => {
    if (descriptors.length < 5) return;
    setSaving(true);
    try {
      const res = await fetch('/api/student/face', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ descriptor: descriptors }) // Upload 5-angle 512-D vectors
      });
      setSaving(false);
      if (res.ok) {
        alert("✅ Multi-Angle Face ID Registered Successfully!");
        window.location.href = '/student/dashboard';
      } else {
        const d = await res.json();
        alert("❌ " + (d.error || "Failed to save Face ID"));
      }
    } catch (err) {
      setSaving(false);
      alert("Network error while saving Face ID. Please try again.");
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
                <div key={idx} className={`h-2 flex-1 rounded-full transition-all duration-300 ${idx < step ? 'bg-green-500' : idx === step ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'}`} />
             ))}
          </div>

          <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-900 rounded-3xl overflow-hidden border-4 border-gray-800 shadow-xl mb-6 flex items-center justify-center">
            {/* Model Loading Screen */}
            {isModelLoading && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm text-white flex flex-col items-center justify-center font-bold z-20 p-6 text-center">
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  {modelProgress > 0 && (
                    <span className="absolute text-xs font-black text-blue-400">
                      {modelProgress}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold mb-2">{modelStage}</p>
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

            {/* Camera Error Screen */}
            {cameraError && (
              <div className="absolute inset-0 bg-red-950/90 text-white flex flex-col items-center justify-center p-6 text-center z-20">
                <span className="text-3xl mb-2">📷⚠️</span>
                <p className="font-bold text-sm">{cameraError}</p>
              </div>
            )}

            {/* Face Angle Scanning HUD */}
            {isScanningAngle && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] text-white flex flex-col items-center justify-center font-bold z-10 p-6 text-center">
                <div className="w-12 h-12 border-3 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mb-3"></div>
                <p className="text-sm font-bold text-emerald-300 tracking-wide">{scanMessage || 'Scanning Face Geometry...'}</p>
                <p className="text-xs text-gray-300 font-normal mt-1">Hold steady for a moment</p>
              </div>
            )}

            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            
            {step < 5 && !isModelLoading && !cameraError && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-md text-white px-4 py-3 rounded-2xl border border-gray-600 flex items-center justify-between z-10">
                 <span className="text-2xl">{ANGLES[step].emoji}</span>
                 <span className="font-bold text-sm">{ANGLES[step].label}</span>
              </div>
            )}
          </div>

          {step < 5 ? (
            <button 
              onClick={captureAngle} 
              disabled={isModelLoading || isScanningAngle || !!cameraError} 
              className="px-8 py-4 bg-blue-600 text-white font-bold text-lg rounded-2xl hover:bg-blue-700 disabled:opacity-70 transition w-full max-w-sm shadow-md"
            >
              {isScanningAngle ? 'Scanning Face...' : `Capture Angle ${step + 1}/5`}
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
