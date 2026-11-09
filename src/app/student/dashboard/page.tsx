"use client";
import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { WelcomeCard } from '@/components/shared/WelcomeCard';
import { QrScanner } from '@/components/student/QrScanner';
import { StudentAttendanceSummary } from '@/types';
import { loadFaceEngine, detectFaceEmbedding, matchFaceDescriptor } from '@/lib/faceEngine';
import { MapPin, Laptop, Smartphone, RefreshCw, X, AlertTriangle, HelpCircle, UserCheck, Camera, CheckCircle2, ShieldCheck, Sparkles, Eye, Info } from 'lucide-react';
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
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [modelLoadStage, setModelLoadStage] = useState('Initializing AI Neural Engine...');
  const [showProxyWarningModal, setShowProxyWarningModal] = useState(false);
  const [proxyWarningData, setProxyWarningData] = useState<{
    warningCount: number;
    maxWarnings: number;
    isSuspended: boolean;
    message: string;
  }>({ warningCount: 0, maxWarnings: 3, isSuspended: false, message: '' });
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

  // Face ID Diagnostic & Help States
  const [showFaceHelp, setShowFaceHelp] = useState(false);
  const [faceHelpTab, setFaceHelpTab] = useState<'test' | 'register' | 'troubleshoot'>('test');
  const [isPreloadingModel, setIsPreloadingModel] = useState(false);
  const [modelPreloadProgress, setModelPreloadProgress] = useState(0);
  const [modelPreloadStage, setModelPreloadStage] = useState('');
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [testMatchResult, setTestMatchResult] = useState<{ isMatch: boolean; confidence: number; text: string } | null>(null);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const testCanvasRef = useRef<HTMLCanvasElement>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  const stopLiveTest = () => {
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    setIsTestingCamera(false);
    setTestMatchResult(null);
  };

  const handlePreloadModel = async () => {
    try {
      setIsPreloadingModel(true);
      await loadFaceEngine((percent, stage) => {
        setModelPreloadProgress(percent);
        setModelPreloadStage(stage);
      });
      setIsModelReady(true);
      setIsPreloadingModel(false);
    } catch (err: any) {
      setIsPreloadingModel(false);
      alert('Failed to pre-load AI models: ' + (err?.message || 'Check network connection'));
    }
  };

  const startLiveTest = async () => {
    try {
      setIsTestingCamera(true);
      setTestMatchResult({ isMatch: false, confidence: 0, text: 'Starting camera & AI engine...' });

      // Ensure model is loaded
      await loadFaceEngine((p, stage) => {
        setModelPreloadProgress(p);
        setModelPreloadStage(stage);
      });
      setIsModelReady(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }
      });
      testStreamRef.current = stream;

      if (testVideoRef.current) {
        testVideoRef.current.srcObject = stream;
        const p = testVideoRef.current.play();
        if (p !== undefined) p.catch(() => {});
      }

      await new Promise<void>((resolve) => {
        if (testVideoRef.current && testVideoRef.current.readyState >= 2) resolve();
        else if (testVideoRef.current) testVideoRef.current.onloadeddata = () => resolve();
        else setTimeout(resolve, 300);
      });

      const studentName = session?.user?.name || 'Student';

      while (testStreamRef.current && testStreamRef.current.active) {
        if (!testVideoRef.current || !testCanvasRef.current) break;

        const video = testVideoRef.current;
        const canvas = testCanvasRef.current;

        if (video.readyState >= 2) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 320;
          }

          const embedding = await detectFaceEmbedding(video);
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (embedding) {
            const cx = canvas.width / 2, cy = canvas.height / 2;
            const size = Math.min(canvas.width, canvas.height) * 0.55;
            const box = { x: cx - size / 2, y: cy - size / 2, width: size, height: size };

            if (faceDescriptor) {
              const { isMatch, confidence } = matchFaceDescriptor(embedding, faceDescriptor, 0.55);
              if (isMatch) {
                if (ctx) drawSquareFaceBox(ctx, box, `${studentName} (${confidence}%)`, 'verified');
                setTestMatchResult({
                  isMatch: true,
                  confidence,
                  text: `✅ Match: ${confidence}% — AI recognizes your face with high confidence!`,
                });
              } else {
                if (ctx) drawSquareFaceBox(ctx, box, `${studentName} (${confidence}%)`, 'mismatch');
                setTestMatchResult({
                  isMatch: false,
                  confidence,
                  text: `⚠️ Match: ${confidence}% — Face detected but score is low. Ensure good lighting & direct angle.`,
                });
              }
            } else {
              if (ctx) drawSquareFaceBox(ctx, box, 'Face Detected', 'scanning');
              setTestMatchResult({
                isMatch: false,
                confidence: 0,
                text: 'Face geometry detected, but no Face ID is registered in your profile yet.',
              });
            }
          } else {
            setTestMatchResult({
              isMatch: false,
              confidence: 0,
              text: '🔍 Looking for face... Position face in camera frame with clear lighting.',
            });
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err: any) {
      console.error('Face test error:', err);
      setTestMatchResult({
        isMatch: false,
        confidence: 0,
        text: `❌ Camera error: ${err?.message || 'Could not access camera'}`,
      });
      setIsTestingCamera(false);
    }
  };

  useEffect(() => {
    return () => {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach(t => t.stop());
        testStreamRef.current = null;
      }
    };
  }, []);

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

  const executeAttendance = async (lat: number|null, lon: number|null, accuracy?: number, overrideCode?: string) => {
    const rawCode = (overrideCode || markForm.code || '').trim();
    const isOtp = rawCode.length <= 6;
    const method = isOtp ? 'otp' : 'qr';
    const deviceFingerprint = getClientDeviceFingerprint();
    const body: any = { method, deviceFingerprint };
    if (lat && lon) {
      body.latitude = lat;
      body.longitude = lon;
      if (typeof accuracy === 'number') body.accuracy = accuracy;
    }
    if (isOtp) body.otp = rawCode;
    else body.qrToken = rawCode;

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
      setShowMarkModal(false);
      setMarkForm({ code: '' });
      fetch('/api/attendance/summary').then(r => r.json()).then(data => {
        setSummary(data.summary || []);
        setStreak(data.streak || 0);
        setShowPercentage(data.settings?.show_student_attendance_percentage !== 'false');
      });

      if (d.proxyDetected) {
        setProxyWarningData({
          warningCount: d.warningCount || 1,
          maxWarnings: d.maxWarnings || 3,
          isSuspended: !!d.isSuspended,
          message: d.warningMessage || 'Proxy attempt caught by ProxyShield. Continued violations will result in account suspension.'
        });
        setShowProxyWarningModal(true);
      } else {
        alert("✅ Attendance marked successfully!");
      }
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

  const handleMarkAttendance = async (overrideCode?: string | React.MouseEvent) => {
    const code = typeof overrideCode === 'string' ? overrideCode.trim() : (markForm.code || '').trim();
    if (!code) return alert("Enter OTP or QR Token");

    setMarking(true);

    // 0. Concurrently pre-acquire GPS in background with 15s cache (instant 10ms retrieval!)
    const gpsPromise: Promise<{ pos: GeolocationPosition | null; err: any }> = (
      typeof navigator !== 'undefined' && navigator.geolocation
    )
      ? new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ pos, err: null }),
            (err) => resolve({ pos: null, err }),
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 15000, // 15s cache allows instant response if located recently
            }
          );
        })
      : Promise.resolve({ pos: null, err: null });

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
      setModelLoadProgress(15);
      setModelLoadStage('Initializing AI Neural Engine...');

      let stream: MediaStream | null = null;
      try {
        await loadFaceEngine((percent, stage) => {
          setModelLoadProgress(percent);
          setModelLoadStage(stage);
        });

        setFaceCheckState('scanning');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
        }

        // Wait for video frame to be ready
        await new Promise<void>((r) => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            r();
          } else if (videoRef.current) {
            videoRef.current.onloadeddata = () => r();
            setTimeout(r, 200);
          } else {
            setTimeout(r, 200);
          }
        });

        const studentName = session?.user?.name || 'Student';
        const startTime = Date.now();
        let matched = false;
        let consecutiveMatches = 0;

        // Realtime detection loop
        while (Date.now() - startTime < 18000 && !matched) {
          if (!videoRef.current || !canvasRef.current) break;

          const video = videoRef.current;
          const canvas = canvasRef.current;

          if (video.readyState >= 2) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width  = video.videoWidth  || 320;
              canvas.height = video.videoHeight || 320;
            }

            const embedding = await detectFaceEmbedding(video);
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (embedding) {
              const { isMatch, confidence } = matchFaceDescriptor(
                embedding,
                faceDescriptor,
                0.55
              );

              // Approximate box from video center for canvas drawing
              const cx = canvas.width / 2, cy = canvas.height / 2;
              const size = Math.min(canvas.width, canvas.height) * 0.55;
              const box = { x: cx - size / 2, y: cy - size / 2, width: size, height: size };

              if (isMatch) {
                consecutiveMatches++;
                if (consecutiveMatches >= 2) {
                  if (ctx) drawSquareFaceBox(ctx, box, `${studentName} (${confidence}%)`, 'verified');
                  matched = true;
                  setFaceCheckState('success');
                  await new Promise(r => setTimeout(r, 250)); // Fast snappy 250ms visual confirmation
                  break;
                } else {
                  if (ctx) drawSquareFaceBox(ctx, box, `${studentName} (${confidence}%)`, 'scanning');
                }
              } else {
                consecutiveMatches = 0;
                if (ctx) drawSquareFaceBox(ctx, box, studentName, 'scanning');
              }
            }
          }
          await new Promise(r => setTimeout(r, 200));
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

    // 3. Geofence Location check (pre-resolved concurrently in background!)
    let lat = null, lon = null, accuracy = null;
    if (reqs.requireGeofence) {
      const { pos, err } = await gpsPromise;
      if (pos) {
        const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
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
      } else if (err) {
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
    await executeAttendance(lat, lon, accuracy ?? undefined, code);
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => setShowFaceHelp(true)} 
              className="w-full sm:w-auto justify-center bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-gray-700 hover:text-blue-700 px-4 py-3 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm"
              title="Test Face AI Recognition & Preload Models"
            >
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>Face ID Help & Test</span>
            </button>
            <button id="tour-mark-attendance" onClick={() => {
              if (!hasFaceId) { alert('Please setup Face ID first!'); window.location.href='/student/face-register'; return; }
              setShowMarkModal(true);
            }} className="w-full sm:w-auto justify-center bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2 sm:mt-0">
              📷 Mark Attendance
            </button>
          </div>
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
                    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-5 text-center">
                      <div className="relative mb-3 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                        <span className="absolute text-[11px] font-black text-blue-400">
                          {modelLoadProgress}%
                        </span>
                      </div>
                      <p className="text-white text-xs font-bold tracking-wide mb-2">
                        Loading AI Model ({modelLoadProgress}%)
                      </p>
                      <div className="w-44 bg-gray-700/60 rounded-full h-2 overflow-hidden border border-gray-600/40">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${Math.min(100, Math.max(5, modelLoadProgress))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-300 mt-2 font-medium">
                        {modelLoadStage}
                      </p>
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
                  <p className="font-bold text-blue-600 animate-pulse text-xs">
                    {modelLoadStage} ({modelLoadProgress}%)
                  </p>
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
                  const scannedToken = (tokenMatch ? tokenMatch[1] : text).trim();
                  setMarkForm({ code: scannedToken });
                  // Instant Auto-Advance: automatically verify & mark without requiring student to click Submit!
                  handleMarkAttendance(scannedToken);
                }} 
              />
            )}
            
            <div className="flex gap-3">
              <button onClick={() => setShowMarkModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-800 font-medium rounded-xl hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleMarkAttendance()} disabled={marking} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-70">
                {marking ? 'Marking...' : 'Submit'}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-gray-700">
              <span>Location + AI Face verification is required.</span>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setShowFaceHelp(true)}
                  className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 underline underline-offset-2"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Face ID Help
                </button>
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
                  <p className="text-xs text-gray-600 font-medium">Quick guide to enable high-accuracy GPS</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLocationHelp(false)}
                className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  locationHelpTab === 'android' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Android
              </button>
              <button
                type="button"
                onClick={() => setLocationHelpTab('ios')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  locationHelpTab === 'ios' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                iPhone (iOS)
              </button>
              <button
                type="button"
                onClick={() => setLocationHelpTab('laptop')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
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
                      In Chrome address bar, tap the <strong>Lock (🔒) or Page Settings icon</strong> on the left side of the website URL.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Tap <strong>Permissions &rarr; Location</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Turn <strong>"Use precise location"</strong> toggle to <strong>ON</strong> (or choose <strong>Precise</strong> instead of Approximate).
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-[11px] text-gray-700 space-y-1">
                    <p>💡 <strong>Alternative Path:</strong> Phone Settings &rarr; Apps &rarr; Chrome &rarr; Permissions &rarr; Location &rarr; Select "Allow only while using the app" and toggle ON "Use precise location".</p>
                    <p>📶 <strong>Indoor Tip:</strong> Keep your Wi-Fi turned ON (even without connecting) to help Google enhance indoor classroom triangulation.</p>
                  </div>
                </div>
              )}

              {locationHelpTab === 'ios' && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Open your iPhone <strong>Settings</strong> app.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Scroll down and tap <strong>Safari</strong> (or Chrome).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Select <strong>Location</strong> and make sure the <strong>"Precise Location"</strong> toggle is switched <strong>ON (Green)</strong>.
                    </p>
                  </div>
                  <div className="border-t border-gray-200 pt-2 text-[11px] text-gray-700">
                    💡 <em>After updating settings, return to your browser and tap the "Retry Location Check" button below.</em>
                  </div>
                </div>
              )}

              {locationHelpTab === 'laptop' && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Click the <strong>Lock (🔒) icon</strong> on the left side of the address bar.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <p className="text-xs text-gray-900 font-medium">
                      Change the <strong>Location</strong> permission to <strong>"Allow"</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <p className="text-xs text-gray-900 font-medium">
                      <strong>Operating System Check:</strong> On Windows, go to Settings &rarr; Privacy & Security &rarr; Location &rarr; Turn ON. On Mac, go to System Settings &rarr; Privacy & Security &rarr; Location Services &rarr; Turn ON.
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
                locationHelpDetails.accuracy && locationHelpDetails.accuracy > 500 ? (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-xs font-bold text-red-700">
                      ⚠️ Current accuracy is ±{locationHelpDetails.accuracy}m (Too Low)
                    </p>
                    <p className="text-[11px] text-red-600 mt-0.5">
                      Server requires Precise Location (max ±500m). Please follow Step 3 above and click "Retry Location Check".
                    </p>
                  </div>
                ) : (
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
                )
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

      {/* Face ID Help & Diagnostics Modal */}
      {showFaceHelp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-bold">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-gray-900 leading-tight">Face ID Help &amp; Diagnostics</h3>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      Neural AI
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Test recognition, preload AI cache, and check registration</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  stopLiveTest();
                  setShowFaceHelp(false);
                }}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/60 p-1.5 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setFaceHelpTab('test');
                }}
                className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  faceHelpTab === 'test'
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Test &amp; Cache</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopLiveTest();
                  setFaceHelpTab('register');
                }}
                className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  faceHelpTab === 'register'
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Registration Guide</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopLiveTest();
                  setFaceHelpTab('troubleshoot');
                }}
                className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  faceHelpTab === 'troubleshoot'
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Troubleshooting</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-700 flex-1">
              {faceHelpTab === 'test' && (
                <div className="space-y-4">
                  {/* Model Preloader Card */}
                  <div className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-gray-900">AI Model Cache Status</span>
                      </div>
                      {isModelReady ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready in Browser Cache
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          Not Cached Yet
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Pre-loading stores the neural model in your phone/laptop browser cache once. During daily class attendance, face verification will run instantaneously (&lt;0.2s) without cold-start delay.
                    </p>
                    
                    {isPreloadingModel && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[11px] font-bold text-blue-700">
                          <span>{modelPreloadStage || 'Loading neural networks...'}</span>
                          <span>{modelPreloadProgress}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${modelPreloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {!isModelReady && !isPreloadingModel && (
                      <button
                        type="button"
                        onClick={handlePreloadModel}
                        className="w-full mt-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Pre-load AI Models Now (Save Time in Class)</span>
                      </button>
                    )}
                  </div>

                  {/* Live Camera Test Window */}
                  <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Live Face Recognition Test</h4>
                        <p className="text-xs text-gray-500">Test if the camera detects you and matches your profile</p>
                      </div>
                      {hasFaceId ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Face ID Enrolled ✓
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                          Face ID Missing
                        </span>
                      )}
                    </div>

                    {!hasFaceId && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                        <span>You haven&apos;t registered your Face ID yet!</span>
                        <button
                          type="button"
                          onClick={() => window.location.href = '/student/face-register'}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] transition"
                        >
                          Register Now
                        </button>
                      </div>
                    )}

                    {!isTestingCamera ? (
                      <div className="py-8 text-center bg-white border border-dashed border-gray-300 rounded-2xl space-y-3">
                        <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Camera className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">Camera Test is Inactive</p>
                          <p className="text-xs text-gray-500 max-w-xs mx-auto mt-0.5">
                            Click below to turn on the camera and see real-time confidence scores and face boundary tracking.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={startLiveTest}
                          className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs transition shadow-sm inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Start Live Diagnostic Test</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-black shadow-inner border border-gray-800">
                          <video
                            ref={testVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          <canvas
                            ref={testCanvasRef}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                          />
                          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white font-bold flex items-center gap-1 border border-white/20">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                            Live Feed
                          </div>
                        </div>

                        {/* Live Match Output */}
                        {testMatchResult && (
                          <div className={`p-3 rounded-xl border text-xs font-semibold ${
                            testMatchResult.isMatch 
                              ? 'bg-green-50 border-green-200 text-green-900' 
                              : testMatchResult.confidence > 0 
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                          }`}>
                            <p>{testMatchResult.text}</p>
                            {testMatchResult.confidence > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span>Confidence Score</span>
                                  <span>{testMatchResult.confidence}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                      testMatchResult.isMatch ? 'bg-green-600' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(100, testMatchResult.confidence)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={stopLiveTest}
                            className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs transition cursor-pointer"
                          >
                            Stop Camera Test
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              stopLiveTest();
                              setTimeout(() => startLiveTest(), 300);
                            }}
                            className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
                          >
                            Restart
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {faceHelpTab === 'register' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
                    <h4 className="font-bold text-blue-900 text-sm mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Face Registration Best Practices
                    </h4>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      Follow these simple rules while registering your face so the AI can reliably recognize you in any classroom condition in less than a second.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-sm">
                      <div className="text-xl">📐</div>
                      <h5 className="font-bold text-gray-900 text-xs">3 Natural Calibration Angles</h5>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Capture 1 center shot looking straight, 1 slightly left (~15°), and 1 slightly right (~15°). This trains the 3D embedding matrix.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-sm">
                      <div className="text-xl">💡</div>
                      <h5 className="font-bold text-gray-900 text-xs">Direct Front Lighting</h5>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Ensure light falls directly on your face. Avoid sitting with bright windows or ceiling lamps directly behind your head (backlight).
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-sm">
                      <div className="text-xl">👓</div>
                      <h5 className="font-bold text-gray-900 text-xs">Glasses &amp; Accessories</h5>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Regular prescription glasses are 100% supported. Remove dark sunglasses, masks, or caps that cover eyebrows or forehead.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-sm">
                      <div className="text-xl">😐</div>
                      <h5 className="font-bold text-gray-900 text-xs">Neutral Face Expression</h5>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        Keep a relaxed, neutral expression during capture. Avoid wide grins, eye squinting, or talking while the camera snaps.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900 text-xs">Need to register or update Face ID?</p>
                      <p className="text-[11px] text-gray-500">You can retake photos anytime if your hairstyle or beard changes.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        stopLiveTest();
                        window.location.href = '/student/face-register';
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition whitespace-nowrap cursor-pointer"
                    >
                      Open Registration Page →
                    </button>
                  </div>
                </div>
              )}

              {faceHelpTab === 'troubleshoot' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
                    <h5 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Lightning-Fast Attendance (&lt;1.5s) Tips
                    </h5>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Hold your phone at eye level ~40cm away. As soon as you enter the OTP/Scan QR, face verification happens automatically in 1 second and submits attendance without extra clicks.
                    </p>
                  </div>

                  <div className="border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white shadow-sm overflow-hidden text-xs">
                    <div className="p-3.5 space-y-1">
                      <p className="font-bold text-gray-900">1. &quot;Face not detected&quot; or camera black screen</p>
                      <p className="text-gray-600 leading-relaxed">
                        Ensure camera permission is allowed in your browser. On <strong>Chrome</strong>, tap the site settings lock icon next to the URL and toggle Camera to &quot;Allow&quot;. On <strong>Safari iOS</strong>, go to Settings &gt; Safari &gt; Camera &gt; &quot;Allow&quot;.
                      </p>
                    </div>

                    <div className="p-3.5 space-y-1">
                      <p className="font-bold text-gray-900">2. Low confidence score or &quot;Face mismatch&quot;</p>
                      <p className="text-gray-600 leading-relaxed">
                        Classroom shadows or extreme backlight can lower confidence. Move your phone angle slightly towards the room light or step away from harsh glare.
                      </p>
                    </div>

                    <div className="p-3.5 space-y-1">
                      <p className="font-bold text-gray-900">3. Multiple faces in background</p>
                      <p className="text-gray-600 leading-relaxed">
                        During personal phone attendance, ensure a friend isn&apos;t peering closely directly over your shoulder, which can confuse the primary face target.
                      </p>
                    </div>

                    <div className="p-3.5 space-y-1">
                      <p className="font-bold text-gray-900">4. Changed beard, hairstyle or spectacles</p>
                      <p className="text-gray-600 leading-relaxed">
                        If you recently shaved, grew a dense beard, or changed glasses, simply re-register your Face ID from the student profile to update your 512-dimension biometric vector.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-medium">
                Biometric embeddings are encrypted &amp; processed 100% on-device.
              </span>
              <button
                type="button"
                onClick={() => {
                  stopLiveTest();
                  setShowFaceHelp(false);
                }}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close Help
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strict English Proxy Warning Modal */}
      {showProxyWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border-2 border-red-500 animate-in fade-in zoom-in duration-200">
            {/* Security Banner */}
            <div className="flex items-center gap-3 pb-4 border-b border-red-100">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl ${
                proxyWarningData.isSuspended ? 'bg-red-600 text-white animate-bounce' : 'bg-amber-100 text-amber-700'
              }`}>
                🛡️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    ProxyShield Defense
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    proxyWarningData.isSuspended ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    Strike {proxyWarningData.warningCount} of {proxyWarningData.maxWarnings}
                  </span>
                </div>
                <h3 className="text-lg font-black text-gray-900 mt-0.5">
                  {proxyWarningData.isSuspended ? 'CRITICAL: Account Suspended' : 'Security Alert: Proxy Attempt Caught'}
                </h3>
              </div>
            </div>

            {/* Body Content */}
            <div className="py-5 space-y-4">
              {/* Attendance Marked Status Notification */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Attendance Status: Recorded</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Your attendance for today’s session has been saved provisionally.
                  </p>
                </div>
              </div>

              {/* Warning Notice Box */}
              <div className={`p-4 rounded-2xl border ${
                proxyWarningData.isSuspended 
                  ? 'bg-red-50 border-red-300 text-red-950' 
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}>
                <h4 className="font-black text-sm uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Official Violation Notice</span>
                </h4>
                <p className="text-xs leading-relaxed font-medium whitespace-pre-line">
                  {proxyWarningData.message}
                </p>
              </div>

              {/* Strike Indicator Progress */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-700">Proxy Violation Strikes:</span>
                  <span className="text-xs font-black text-red-600">
                    {proxyWarningData.warningCount} / {proxyWarningData.maxWarnings} Max
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((step) => {
                    const isPassed = step <= proxyWarningData.warningCount;
                    const isFinal = step === 3;
                    return (
                      <div 
                        key={step} 
                        className={`py-2 text-center rounded-xl font-bold text-xs border ${
                          isPassed 
                            ? isFinal 
                              ? 'bg-red-600 text-white border-red-700 font-black' 
                              : 'bg-amber-500 text-white border-amber-600'
                            : 'bg-white text-gray-400 border-gray-200'
                        }`}
                      >
                        Strike {step} {isFinal ? '(Suspended)' : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              {proxyWarningData.isSuspended ? (
                <button
                  onClick={() => {
                    signOut({ callbackUrl: '/auth/signin' });
                  }}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg transition tracking-wide text-sm"
                >
                  Acknowledge & Sign Out
                </button>
              ) : (
                <button
                  onClick={() => setShowProxyWarningModal(false)}
                  className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-black rounded-2xl shadow-lg transition tracking-wide text-sm"
                >
                  I Understand & Acknowledge (Do Not Repeat)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Feature Tour */}
      <OnboardingTour role="student" />
    </div>
  );
}
