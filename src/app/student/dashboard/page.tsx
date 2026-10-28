"use client";
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { WelcomeCard } from '@/components/shared/WelcomeCard';
import { QrScanner } from '@/components/student/QrScanner';
import { StudentAttendanceSummary } from '@/types';
import * as faceapi from 'face-api.js';
import { MapPin, Laptop, Smartphone, RefreshCw, X, AlertTriangle, HelpCircle } from 'lucide-react';
import { OnboardingTour } from '@/components/shared/OnboardingTour';


function AttendanceCard({ subject, showPercentage }: { subject: StudentAttendanceSummary & { safe_to_miss: number; classes_to_attend: number }, showPercentage: boolean }) {
  const pct = subject.percentage === null ? 100 : subject.percentage;
  const color = pct >= 85 ? 'green' : pct >= 75 ? 'yellow' : 'red';
  const colorMap = {
    green:  'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800/60 dark:text-green-300',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-800/60 dark:text-yellow-300',
    red:    'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800/60 dark:text-red-300',
  };
  const barMap = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' };

  return (
    <div className={`border-2 rounded-xl p-5 transition-all shadow-sm ${colorMap[color]}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">{subject.subject_name}</h3>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{subject.subject_code}</p>
        </div>
        {showPercentage ? (
          <span className="text-2xl font-bold">{pct}%</span>
        ) : (
          <span className="text-2xl opacity-60">🔒</span>
        )}
      </div>
      {showPercentage && (
        <div className="w-full bg-white/80 dark:bg-gray-800 rounded-full h-2.5 mb-3 border border-gray-200/50 dark:border-gray-700">
          <div className={`${barMap[color]} h-2.5 rounded-full transition-all`}
            style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
      <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
        <span className="text-gray-700 dark:text-gray-300">{subject.attended}/{subject.total_classes} classes</span>
        {subject.total_classes === 0 ? (
          <span className="text-gray-500 dark:text-gray-400">No classes yet</span>
        ) : pct >= 75 ? (
          <span className="text-green-700 dark:text-green-400 font-bold">✅ On track (≥75%)</span>
        ) : (
          <span className="text-red-600 dark:text-red-400 font-bold">⚠️ Attend {subject.classes_to_attend} more</span>
        )}
      </div>


    </div>
  );
}

function drawSquareFaceBox(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  name: string,
  status: 'scanning' | 'verified' | 'mismatch'
) {
  const color = status === 'verified' ? '#22c55e' : status === 'mismatch' ? '#ef4444' : '#3b82f6';
  const badgeBg = status === 'verified' ? 'rgba(22, 101, 52, 0.95)' : status === 'mismatch' ? 'rgba(153, 27, 27, 0.95)' : 'rgba(15, 23, 42, 0.9)';
  
  // Square box dimensions - center on detected face
  const size = Math.max(box.width, box.height) * 1.05;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const x = Math.max(4, cx - size / 2);
  const y = Math.max(4, cy - size / 2);
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = status === 'verified' ? 14 : 6;
  
  // Outer square frame
  ctx.strokeRect(x, y, size, size);
  
  // High-tech corner brackets
  const cornerLen = Math.min(24, size * 0.22);
  ctx.lineWidth = 5;
  // Top-left
  ctx.beginPath(); ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(x + size - cornerLen, y); ctx.lineTo(x + size, y); ctx.lineTo(x + size, y + cornerLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(x, y + size - cornerLen); ctx.lineTo(x, y + size); ctx.lineTo(x + cornerLen, y + size); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(x + size - cornerLen, y + size); ctx.lineTo(x + size, y + size); ctx.lineTo(x + size, y + size - cornerLen); ctx.stroke();

  // Name Badge on top/bottom of the square frame
  const badgeText = status === 'verified' ? `✓ ${name}` : status === 'mismatch' ? `✕ ${name}` : `🔍 ${name}`;
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  const textWidth = ctx.measureText(badgeText).width;
  const badgeWidth = textWidth + 24;
  const badgeHeight = 26;
  const badgeX = Math.max(4, Math.min(ctx.canvas.width - badgeWidth - 4, x + (size - badgeWidth) / 2));
  const badgeY = y > badgeHeight + 8 ? y - badgeHeight - 6 : y + size + 6;

  // Badge capsule
  ctx.fillStyle = badgeBg;
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
  } else {
    ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
  }
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Badge label
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 0;
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + 12, badgeY + badgeHeight / 2);
  
  ctx.restore();
}

export default function StudentDashboard() {
  const { data: session } = useSession();
  const [streak, setStreak] = useState(0);
  const [hasFaceId, setHasFaceId] = useState(true);
  const [activePoll, setActivePoll] = useState<any>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [markForm, setMarkForm] = useState({ code: '' });
  const [marking, setMarking] = useState(false);
  const [faceCheckState, setFaceCheckState] = useState<'idle'|'loading_models'|'scanning'|'success'|'failed'>('idle');
  const [faceDescriptor, setFaceDescriptor] = useState<any>(null);
  const [batchInfo, setBatchInfo] = useState('');
  const [isCr, setIsCr] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [summary, setSummary] = useState<(StudentAttendanceSummary & { safe_to_miss: number; classes_to_attend: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPercentage, setShowPercentage] = useState(true);

  // Precise Location Help States
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [locationHelpTab, setLocationHelpTab] = useState<'android' | 'ios' | 'laptop'>('android');
  const [locationHelpDetails, setLocationHelpDetails] = useState<{
    accuracy?: number;
    errorMsg?: string;
    coords?: { lat: number; lon: number };
  }>({});
  const [retryingGps, setRetryingGps] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/iPad|iPhone|iPod/.test(ua)) {
        setLocationHelpTab('ios');
      } else if (/Android/.test(ua)) {
        setLocationHelpTab('android');
      } else {
        setLocationHelpTab('laptop');
      }
    }
  }, []);

  useEffect(() => {
    // If URL has ?token=..., open the modal automatically
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setMarkForm({ code: token });
      setShowMarkModal(true);
      // clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/attendance/summary').then(r => r.json()).then(d => {
      setSummary(d.summary || []);
      setStreak(d.streak || 0);
      setShowPercentage(d.settings?.show_student_attendance_percentage !== 'false');
      setLoading(false);
    });
    fetch('/api/polls/active').then(r=>r.json()).then(d => {
      setActivePoll(d.poll || null);
      setMyVote(d.myVote !== undefined ? d.myVote : null);
    });
    };
    fetchData();
    
    // Only once, get face ID status
    fetch('/api/student/face').then(r => r.json()).then(d => {
      setHasFaceId(d.hasFaceId);
      if (d.descriptor) setFaceDescriptor(d.descriptor);
      if (d.is_cr) setIsCr(true);
      if (d.info?.branch) {
        let txt = d.info.branch;
        if (d.info.group) txt += ` - ${d.info.group}`;
        if (d.info.sub_group) txt += ` (${d.info.sub_group})`;
        setBatchInfo(txt);
      }
    });

    // Track user activity — if inactive for > 6 minutes in student portal, halt all background requests completely
    let lastActive = Date.now();
    const onActivity = () => { lastActive = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    // Background refresh strictly paused if user is inactive for > 6 minutes (requests ekdam band)
    const interval = setInterval(() => {
      if (document.hidden || Date.now() - lastActive > 6 * 60 * 1000) return;
      fetchData();
    }, 300_000);
    return () => {
      clearInterval(interval);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, []);

  const getClientDeviceFingerprint = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      let id = localStorage.getItem('ams_device_id');
      if (!id) {
        const raw = `${navigator.userAgent}|${screen.width}x${screen.height}|${screen.colorDepth}|${new Intl.DateTimeFormat().resolvedOptions().timeZone}|${Math.random().toString(36).substring(2)}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          hash = ((hash << 5) - hash) + raw.charCodeAt(i);
          hash |= 0;
        }
        id = `dev_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
        localStorage.setItem('ams_device_id', id);
      }
      return id;
    } catch {
      return 'unknown_device';
    }
  };

  const executeAttendance = async (lat: number|null, lon: number|null, accuracy?: number) => {
    const isOtp = markForm.code.length <= 6;
    const method = isOtp ? 'otp' : 'qr';
    const deviceFingerprint = getClientDeviceFingerprint();
    const body: any = { method, deviceFingerprint };
    if (lat && lon) {
      body.latitude = lat;
      body.longitude = lon;
      if (typeof accuracy === 'number') body.accuracy = accuracy;
    }
    if (isOtp) body.otp = markForm.code;
    else body.qrToken = markForm.code;

    const res = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceFingerprint
      },
      body: JSON.stringify(body)
    });
    
    const d = await res.json();
    setMarking(false);
    setFaceCheckState('idle');
    if (res.ok) {
      alert("✅ Attendance marked successfully!");
      setShowMarkModal(false);
      setMarkForm({ code: '' });
      fetch('/api/attendance/summary').then(r => r.json()).then(data => {
        setSummary(data.summary || []);
        setStreak(data.streak || 0);
        setShowPercentage(data.settings?.show_student_attendance_percentage !== 'false');
      });
    } else {
      alert("❌ " + (d.error || "Failed to mark attendance"));
    }
  };

  const retryLocationCheck = async () => {
    setRetryingGps(true);
    try {
      const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { 
          enableHighAccuracy: true, 
          timeout: 15000, 
          maximumAge: 0 
        })
      );
      
      if (isMobile && pos.coords.accuracy > 1500) {
        setLocationHelpDetails({
          accuracy: Math.round(pos.coords.accuracy),
          errorMsg: `Still approximate (±${Math.round(pos.coords.accuracy)}m). Please verify 'Use precise location' is toggled ON.`,
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude }
        });
        setRetryingGps(false);
        return;
      }
      
      // Success!
      setShowLocationHelp(false);
      setRetryingGps(false);
      if (markForm.code) {
        setMarking(true);
        await executeAttendance(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      }
    } catch (e: any) {
      setRetryingGps(false);
      setLocationHelpDetails(prev => ({
        ...prev,
        errorMsg: e?.message || "Could not retrieve GPS location. Check device permissions."
      }));
    }
  };

  const handleMarkAttendance = async () => {
    const code = (markForm.code || '').trim();
    if (!code) return alert("Enter OTP or QR Token");

    setMarking(true);

    // 1. Fetch class verification requirements set by teacher
    let reqs = { requireFace: true, requireGeofence: true };
    try {
      const chkRes = await fetch(`/api/attendance/check-requirements?code=${encodeURIComponent(code)}`);
      const chkData = await chkRes.json();
      if (!chkRes.ok) {
        setMarking(false);
        return alert("❌ " + (chkData.error || "Active class not found or code expired."));
      }
      reqs = {
        requireFace: chkData.requireFace !== false,
        requireGeofence: chkData.requireGeofence !== false,
      };
    } catch (e) {
      console.warn("Could not check class requirements, defaulting to standard verification", e);
    }

    // 2. Face ID check (only if teacher enabled Face ID)
    if (reqs.requireFace) {
      if (!faceDescriptor) {
        setMarking(false);
        alert("Face ID is required for this class session, but you have not registered Face ID yet. Please set it up in your profile.");
        return;
      }

      setFaceCheckState('loading_models');

      let stream: MediaStream | null = null;
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);

        setFaceCheckState('scanning');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        }

        const studentName = session?.user?.name || 'Student';
        const startTime = Date.now();
        let matched = false;
        let consecutiveMatches = 0;

        // Realtime detection loop: scans face, draws square frame & name badge
        while (Date.now() - startTime < 15000 && !matched) {
          if (!videoRef.current || !canvasRef.current) break;

          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (video.readyState >= 2) {
            const displaySize = {
              width: video.videoWidth || 320,
              height: video.videoHeight || 320
            };
            if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
              canvas.width = displaySize.width;
              canvas.height = displaySize.height;
            }
            faceapi.matchDimensions(canvas, displaySize);

            const detection = await faceapi.detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
            ).withFaceLandmarks().withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
              const resized = faceapi.resizeResults(detection, displaySize);
              const box = resized.detection.box;

              // Handle Multi-Angle vs Legacy Single-Angle mapping
              let dist = 1.0;
              if (Array.isArray(faceDescriptor[0])) {
                for (let i = 0; i < faceDescriptor.length; i++) {
                  const currentDist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(faceDescriptor[i]));
                  if (currentDist < dist) dist = currentDist;
                }
              } else {
                dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(faceDescriptor));
              }

              if (dist <= 0.54) {
                consecutiveMatches++;
                // Anti-Spoof Liveness: require 2 consecutive live frames (~240ms) to ensure continuous live presence
                if (consecutiveMatches >= 2) {
                  // Verified! Draw Green Square with Verified Name Badge
                  if (ctx) drawSquareFaceBox(ctx, box, studentName, 'verified');
                  matched = true;
                  setFaceCheckState('success');
                  // Hold for 1.2s so student clearly sees their square face and verified name badge
                  await new Promise(r => setTimeout(r, 1200));
                  break;
                } else {
                  if (ctx) drawSquareFaceBox(ctx, box, studentName, 'scanning');
                }
              } else {
                consecutiveMatches = 0;
                // Still scanning / matching face
                if (ctx) drawSquareFaceBox(ctx, box, studentName, 'scanning');
              }
            }
          }
          await new Promise(r => setTimeout(r, 120));
        }

        if (stream) stream.getTracks().forEach(t => t.stop());

        if (!matched) {
          setFaceCheckState('failed');
          setMarking(false);
          return alert("Face verification failed. Please look straight at the camera with clear lighting.");
        }
      } catch (e) {
        console.error(e);
        if (stream) stream.getTracks().forEach(t => t.stop());
        setFaceCheckState('failed'); setMarking(false);
        return alert("Error accessing camera or AI models");
      }
    }

    // 3. Geofence Location check (only if teacher enabled Geofence)
    let lat = null, lon = null, accuracy = null;
    if (reqs.requireGeofence) {
      try {
        const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { 
            enableHighAccuracy: true, 
            timeout: 15000, 
            maximumAge: 30000 
          })
        );
        
        // On mobile devices, Android/iOS Approximate location produces accuracy > 1500 meters
        // Laptops/Desktops use Wi-Fi positioning where accuracy is often 300-800m naturally
        if (isMobile && pos.coords.accuracy > 1500) {
          setLocationHelpDetails({
            accuracy: Math.round(pos.coords.accuracy),
            errorMsg: `Approximate Location detected (±${Math.round(pos.coords.accuracy)}m). Please switch to 'Precise Location'.`,
            coords: { lat: pos.coords.latitude, lon: pos.coords.longitude }
          });
          setShowLocationHelp(true);
          setMarking(false);
          setFaceCheckState('idle');
          return;
        }
        
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      } catch (err: any) {
        console.warn("Could not get GPS:", err);
        if (err?.code === 1) { // PERMISSION_DENIED
          setLocationHelpDetails({
            errorMsg: "Location permission is blocked. Please allow location access in your browser or device settings."
          });
          setShowLocationHelp(true);
          setMarking(false);
          setFaceCheckState('idle');
          return;
        } else if (err?.code === 3) { // TIMEOUT
          setLocationHelpDetails({
            errorMsg: "GPS location request timed out. Please ensure GPS/Location is turned ON and try again."
          });
          setShowLocationHelp(true);
          setMarking(false);
          setFaceCheckState('idle');
          return;
        }
      }
    }

    // 4. Submit attendance directly
    await executeAttendance(lat, lon, accuracy ?? undefined);
  };

  const submitVote = async (index: number) => {
    if (!activePoll) return;
    setMyVote(index); // optimistic
    await fetch('/api/polls/vote', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ poll_id: activePoll.id, option_index: index }) });
  };
  const overall = summary.length > 0
    ? Math.round(summary.reduce((acc, s) => acc + (s.percentage === null ? 100 : s.percentage), 0) / summary.length)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Face ID Warning */}
        {!hasFaceId && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl flex justify-between items-center shadow-sm">
            <div>
              <h3 className="font-bold text-red-800">Action Required: Face ID Not Setup!</h3>
              <p className="text-sm text-red-700">You must register your face to mark attendance using AI.</p>
            </div>
            <button onClick={() => window.location.href='/student/face-register'} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition">
              Setup Now
            </button>
          </div>
        )}

        {/* Welcome Card */}
        <div id="tour-welcome" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-auto">
            <WelcomeCard subtitle={batchInfo || "Your Attendance Overview"} isCr={isCr} />
          </div>
          <button id="tour-mark-attendance" onClick={() => {
            if (!hasFaceId) { alert('Please setup Face ID first!'); window.location.href='/student/face-register'; return; }
            setShowMarkModal(true);
          }} className="w-full sm:w-auto justify-center bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2 sm:mt-0">
            📷 Mark Attendance
          </button>
        </div>

        {/* Live Poll Banner */}
        {activePoll && (
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-6 mb-6 shadow-sm border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="animate-pulse w-3 h-3 bg-red-500 rounded-full inline-block"></span>
              <span className="text-sm font-bold text-purple-100 uppercase tracking-wider">Live Vibe Check</span>
            </div>
            <h3 className="text-xl font-semibold mb-1">{activePoll.question}</h3>
            <p className="text-sm text-purple-200 mb-5">— {activePoll.teacher?.name}</p>
            
            <div className="flex gap-3">
              {activePoll.options.map((opt: string, i: number) => (
                <button key={i} onClick={() => submitVote(i)} disabled={myVote !== null}
                  className={`flex-1 py-3 rounded-xl font-bold transition ${
                    myVote === i ? 'bg-white text-purple-700 ring-2 ring-white/50' :
                    myVote !== null ? 'bg-white/10 text-white/50' : 'bg-white/20 hover:bg-white/30 text-white'
                  }`}>
                  {opt} {myVote === i && '✓'}
                </button>
              ))}
            </div>
            {myVote !== null && <p className="text-center text-sm text-purple-200 mt-4">Your vote has been recorded.</p>}
          </div>
        )}

        {/* Overall card */}
        <div id="tour-overall-attendance" className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 shadow-sm">
            <p className="text-blue-200 text-sm mb-1">Overall Attendance</p>
            {showPercentage ? (
              <>
                <p className="text-5xl font-bold">{overall}%</p>
                <p className="text-blue-200 mt-2 text-sm">
                  {overall >= 75 ? '✅ You are safe! Keep it up.' : '⚠️ Below 75% threshold — attend more classes!'}
                </p>
              </>
            ) : (
              <div className="mt-2 flex items-center justify-center w-16 h-16 rounded-full bg-blue-700/50">
                 <span className="text-2xl opacity-80">🔒</span>
              </div>
            )}
          </div>
          <div className="col-span-1 bg-gradient-to-br from-orange-400 to-red-500 text-white rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-red-100 text-sm font-medium mb-1">Current Streak</p>
            <div className="flex items-center gap-1">
              <span className="text-4xl">🔥</span>
              <span className="text-5xl font-bold">{streak}</span>
            </div>
            <p className="text-red-100 mt-1 text-xs">{streak > 0 ? 'Classes in a row!' : 'Start a new streak!'}</p>
          </div>
        </div>

        {/* Subject-wise */}
        <div id="tour-subject-breakdown">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Subject-wise Breakdown</h2>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse"/>)}
            </div>
          ) : summary.length === 0 ? (
            <div className="text-center text-gray-700 dark:text-gray-300 py-12 bg-white dark:bg-[#231b16] rounded-xl border border-gray-100 dark:border-[#3d3026]">
              <p className="text-4xl mb-2">📚</p>
              <p>No subjects enrolled yet</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {summary.map(s => <AttendanceCard key={s.subject_id} subject={s} showPercentage={showPercentage}/>)}
            </div>
          )}
        </div>
      </div>

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl mx-auto my-auto max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Mark Attendance</h2>
            <p className="text-sm text-gray-700 mb-4">Enter the 4-digit OTP or paste the QR Token shown by your teacher.</p>
            
            {(faceCheckState === 'loading_models' || faceCheckState === 'scanning' || faceCheckState === 'success') && (
              <div className="mb-4 text-center">
                <div className="w-64 h-64 mx-auto bg-black rounded-2xl overflow-hidden relative mb-2 shadow-lg border-2 border-gray-800">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                  
                  {faceCheckState === 'loading_models' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-white text-xs font-bold tracking-wide">Loading Face AI Models...</p>
                    </div>
                  )}

                  {faceCheckState === 'scanning' && (
                    <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                      <span className="text-[10px] font-bold bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30">
                        Square Face Tracker Active
                      </span>
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                    </div>
                  )}

                  {faceCheckState === 'success' && (
                    <div className="absolute top-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                      <span className="text-[10px] font-bold bg-green-900/90 text-green-200 px-2.5 py-0.5 rounded-full border border-green-400/40">
                        Face Verified ✓
                      </span>
                    </div>
                  )}
                </div>

                {faceCheckState === 'loading_models' && (
                  <p className="font-bold text-blue-600 animate-pulse text-xs">Initializing AI Camera...</p>
                )}
                {faceCheckState === 'scanning' && (
                  <p className="font-bold text-blue-600 animate-pulse text-xs">
                    Align your face in the square frame...
                  </p>
                )}
                {faceCheckState === 'success' && (
                  <div className="p-2.5 bg-green-50 border border-green-300 text-green-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2">
                    <span>✅</span>
                    <span>Face Verified with Name Badge! Marking attendance...</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input 
                placeholder="OTP or Token" 
                value={markForm.code} 
                onChange={e => setMarkForm({ code: e.target.value.trim() })}
                disabled={marking}
                className="flex-1 min-w-0 text-black font-black border-2 border-gray-300 rounded-xl px-3 py-3 text-center text-xl tracking-wider focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-900"
              />
              <button 
                onClick={() => setShowScanner(true)}
                disabled={marking}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 rounded-xl flex items-center justify-center font-bold transition whitespace-nowrap disabled:text-gray-800"
              >
                📷 Scan
              </button>
            </div>
            
            {showScanner && (
              <QrScanner 
                onClose={() => setShowScanner(false)} 
                onScan={(text) => {
                  setShowScanner(false);
                  const tokenMatch = text.match(/token=([a-zA-Z0-9-]+)/);
                  setMarkForm({ code: tokenMatch ? tokenMatch[1] : text.trim() });
                }} 
              />
            )}
            
            <div className="flex gap-3">
              <button onClick={() => setShowMarkModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-800 font-medium rounded-xl hover:bg-gray-200">Cancel</button>
              <button onClick={handleMarkAttendance} disabled={marking} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-70">
                {marking ? 'Marking...' : 'Submit'}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-gray-700">
              <span>Location + AI Face verification is required.</span>
              <button 
                type="button"
                onClick={() => {
                  setLocationHelpDetails({});
                  setShowLocationHelp(true);
                }}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 underline underline-offset-2"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Location Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Precise Location Help Modal */}
      {showLocationHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">Precise Location Required</h3>
                  <p className="text-xs text-gray-600 font-medium">सटीक लोकेशन चालू करने का तरीका</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLocationHelp(false)}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert Banner if issue occurred */}
            {locationHelpDetails.errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{locationHelpDetails.errorMsg}</p>
                  {locationHelpDetails.accuracy && (
                    <p className="mt-0.5 text-amber-800 font-medium">Detected accuracy radius: ±{locationHelpDetails.accuracy}m</p>
                  )}
                </div>
              </div>
            )}

            {/* Device Selector Tabs */}
            <div className="flex gap-1.5 p-1 bg-gray-100 rounded-xl mt-4">
              <button
                type="button"
                onClick={() => setLocationHelpTab('android')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  locationHelpTab === 'android' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Android
              </button>
              <button
                type="button"
                onClick={() => setLocationHelpTab('ios')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  locationHelpTab === 'ios' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                iPhone (iOS)
              </button>
              <button
                type="button"
                onClick={() => setLocationHelpTab('laptop')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  locationHelpTab === 'laptop' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                Laptop / PC
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="mt-4 text-xs sm:text-sm text-gray-900 space-y-3">
              {locationHelpTab === 'android' && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Browser address bar me left side <strong>Lock (🔒) ya Page Info</strong> icon par tap karein.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-xs text-gray-900 font-medium">
                      <strong>Permissions &rarr; Location</strong> par click karein.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-xs text-gray-900 font-medium">
                      <strong>"Use precise location" (सटीक स्थान चालू करें)</strong> toggle ko ON karein.
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-[11px] text-gray-700">
                    💡 <em>Direct Phone Settings: Settings &rarr; Apps &rarr; Chrome &rarr; Permissions &rarr; Location &rarr; Select "Allow only while using the app" & "Use precise location".</em>
                  </div>
                </div>
              )}

              {locationHelpTab === 'ios' && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-xs text-gray-900 font-medium">
                      iPhone <strong>Settings</strong> app open karein.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Neeche scroll karke <strong>Safari</strong> (ya Chrome) par tap karein.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-xs text-gray-900 font-medium">
                      <strong>Location</strong> select karein aur <strong>"Precise Location"</strong> toggle ko ON (Green) karein.
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-[11px] text-gray-700">
                    💡 <em>Settings badalne ke baad browser par wapas aayein aur neeche "Retry" button dabayein.</em>
                  </div>
                </div>
              )}

              {locationHelpTab === 'laptop' && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Chrome / Edge address bar me URL ke left side <strong>Lock (🔒) icon</strong> click karein.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-xs text-gray-900 font-medium">
                      <strong>Location</strong> dropdown ko <strong>"Allow"</strong> par set karein.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-xs text-gray-900 font-medium">
                      <strong>System Settings:</strong> Windows Settings &rarr; Privacy &rarr; Location ON karein. Mac me System Settings &rarr; Privacy & Security &rarr; Location Services ON karein.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={retryLocationCheck}
                disabled={retryingGps}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-70 active:scale-[0.99]"
              >
                <RefreshCw className={`w-4 h-4 ${retryingGps ? 'animate-spin' : ''}`} />
                {retryingGps ? 'Checking Location...' : '🔄 Retry Location Check'}
              </button>

              {locationHelpDetails.coords && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationHelp(false);
                    if (locationHelpDetails.coords) {
                      setMarking(true);
                      executeAttendance(locationHelpDetails.coords.lat, locationHelpDetails.coords.lon, locationHelpDetails.accuracy);
                    }
                  }}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold rounded-xl transition"
                >
                  ⚡ Proceed with Current Location ({locationHelpDetails.accuracy ? `±${locationHelpDetails.accuracy}m` : 'Detected'})
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowLocationHelp(false)}
                className="w-full py-2 text-xs text-gray-600 hover:text-gray-900 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Feature Tour */}
      <OnboardingTour role="student" />
    </div>
  );
}
