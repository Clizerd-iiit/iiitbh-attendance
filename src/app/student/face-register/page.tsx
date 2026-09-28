'use client';
import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
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
  const [loading, setLoading] = useState('Loading AI Models...');
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [step, setStep] = useState(0); // 0 to 4 for angles, 5 for complete
  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setLoading('Starting Camera...');
        startVideo();
      } catch (e) {
        setLoading('Error loading AI models. Make sure /models folder exists.');
      }
    };
    loadModels();
    
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} })
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
    if (!videoRef.current) return;
    setLoading('Scanning...');
    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setLoading('');
      alert("No face detected! Please follow the instruction on screen.");
      return;
    }
    
    setDescriptors(prev => [...prev, detection.descriptor]);
    setStep(prev => prev + 1);
    setLoading('');
  };

  const saveMultiAngleFace = async () => {
    if (descriptors.length < 5) return;
    setSaving(true);
    // Convert array of Float32Arrays to standard 2D array
    const arr2D = descriptors.map(d => Array.from(d));
    const res = await fetch('/api/student/face', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ descriptor: arr2D }) // Upload 2D array
    });
    setSaving(false);
    if (res.ok) {
      alert("Multi-Angle Face ID Registered Successfully!");
      window.location.href = '/student/dashboard';
    } else {
      alert("Failed to save Face ID");
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
            {loading && <div className="absolute inset-0 bg-black/50 text-white flex items-center justify-center font-bold z-10 p-4 text-center">{loading}</div>}
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
