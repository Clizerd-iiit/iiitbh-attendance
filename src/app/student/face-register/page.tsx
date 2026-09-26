'use client';
import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Navbar } from '@/components/shared/Navbar';

export default function FaceRegisterPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState('Loading AI Models...');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [descriptor, setDescriptor] = useState<Float32Array | null>(null);
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
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
        }
        setLoading('');
      })
      .catch(e => setLoading('Camera access denied'));
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    setLoading('Detecting Face...');
    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setLoading('');
      alert("No face detected! Please look straight into the camera.");
      return;
    }
    
    setDescriptor(detection.descriptor);
    setLoading('');
  };

  const saveFace = async () => {
    if (!descriptor) return;
    setSaving(true);
    const arr = Array.from(descriptor);
    const res = await fetch('/api/student/face', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ descriptor: arr })
    });
    setSaving(false);
    if (res.ok) {
      alert("Face ID Registered Successfully!");
      window.location.href = '/student/dashboard';
    } else {
      alert("Failed to save Face ID");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📷 Register Face ID</h1>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border text-center">
          <p className="text-sm text-gray-600 mb-6">
            Register your face to enable AI Face Recognition for attendance. This is completely safe and runs on your device.
          </p>
          
          <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-200 rounded-2xl overflow-hidden border-4 border-blue-100 shadow-inner mb-6 flex items-center justify-center">
            {loading && <div className="absolute inset-0 bg-black/50 text-white flex items-center justify-center font-semibold z-10 p-4 text-center">{loading}</div>}
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          </div>

          {!descriptor ? (
            <button onClick={captureFace} disabled={!!loading} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-70 transition w-full max-w-sm">
              Capture Face
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600 font-bold">✅ Face Detected & Scanned!</p>
              <div className="flex gap-4 max-w-sm mx-auto">
                <button onClick={() => setDescriptor(null)} disabled={saving} className="flex-1 py-3 bg-gray-200 text-gray-800 font-bold rounded-xl hover:bg-gray-300 transition">
                  Retake
                </button>
                <button onClick={saveFace} disabled={saving} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition">
                  {saving ? 'Saving...' : 'Save Face ID'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
