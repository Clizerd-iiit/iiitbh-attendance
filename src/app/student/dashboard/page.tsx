"use client";
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import { WelcomeCard } from '@/components/shared/WelcomeCard';
import { QrScanner } from '@/components/student/QrScanner';
import { StudentAttendanceSummary } from '@/types';
import * as faceapi from 'face-api.js';

function AttendanceCard({ subject }: { subject: StudentAttendanceSummary & { safe_to_miss: number; classes_to_attend: number } }) {
  const pct = subject.percentage === null ? 100 : subject.percentage;
  const color = pct >= 85 ? 'green' : pct >= 75 ? 'yellow' : 'red';
  const colorMap = {
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red:    'bg-red-50 border-red-200 text-red-700',
  };
  const barMap = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' };

  return (
    <div className={`border-2 rounded-xl p-5 ${colorMap[color]}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">{subject.subject_name}</h3>
          <p className="text-sm text-gray-500">{subject.subject_code}</p>
        </div>
        <span className="text-2xl font-bold">{pct}%</span>
      </div>
      <div className="w-full bg-white rounded-full h-2 mb-3">
        <div className={`${barMap[color]} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="flex justify-between text-sm">
        <span>{subject.attended}/{subject.total_classes} classes</span>
        {subject.total_classes === 0 ? (
          <span className="text-gray-500">No classes yet</span>
        ) : pct >= 75 ? (
          <span className="text-green-700">✅ Can miss {subject.safe_to_miss} more</span>
        ) : (
          <span className="text-red-600">⚠️ Attend {subject.classes_to_attend} more</span>
        )}
      </div>


    </div>
  );
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
  const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
  const [batchInfo, setBatchInfo] = useState('');
  const [isCr, setIsCr] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [summary, setSummary] = useState<(StudentAttendanceSummary & { safe_to_miss: number; classes_to_attend: number })[]>([]);
    const [loading, setLoading] = useState(true);

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
      if (d.descriptor) setFaceDescriptor(new Float32Array(d.descriptor));
      if (d.is_cr) setIsCr(true);
      if (d.info?.branch) {
        let txt = d.info.branch;
        if (d.info.group) txt += ` - ${d.info.group}`;
        if (d.info.sub_group) txt += ` (${d.info.sub_group})`;
        setBatchInfo(txt);
      }
    });

    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const executeAttendance = async (lat: number|null, lon: number|null) => {
    const isOtp = markForm.code.length <= 6;
    const method = isOtp ? 'otp' : 'qr';
    const body: any = { method };
    if (lat && lon) { body.latitude = lat; body.longitude = lon; }
    if (isOtp) body.otp = markForm.code;
    else body.qrToken = markForm.code;

    const res = await fetch('/api/attendance/mark', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      });
    } else {
      alert("❌ " + (d.error || "Failed to mark attendance"));
    }
  };

  const handleMarkAttendance = async () => {
    if (!markForm.code) return alert("Enter OTP or QR Token");
    if (!faceDescriptor) { alert("Face ID not found, please setup."); return; }
    
    setMarking(true);
    setFaceCheckState('loading_models');

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      setFaceCheckState('scanning');
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
      
      // Give camera a second to adjust lighting
      await new Promise(r => setTimeout(r, 1500));
      if (!videoRef.current) throw new Error("Video element missing");
      
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      stream.getTracks().forEach(t => t.stop()); // stop camera immediately
      
      if (!detection) {
        setFaceCheckState('failed'); setMarking(false);
        return alert("No face detected! Please look clearly at the camera.");
      }
      
      const dist = faceapi.euclideanDistance(detection.descriptor, faceDescriptor);
      if (dist > 0.45) {
        setFaceCheckState('failed'); setMarking(false);
        return alert(`Face mismatch! Distance: ${dist.toFixed(2)}. This doesn't look like you.`);
      }
      
      setFaceCheckState('success');
      
      // If face passes, get GPS and execute
      let lat = null, lon = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } catch (e) {
        console.warn("Could not get GPS");
      }
      await executeAttendance(lat, lon);
      
    } catch (e) {
      console.error(e);
      setFaceCheckState('failed'); setMarking(false);
      alert("Error accessing camera or AI models");
    }
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
        <div className="flex justify-between items-center mb-4">
          <WelcomeCard subtitle={batchInfo || "Your Attendance Overview"} isCr={isCr} />
          <button onClick={() => {
            if (!hasFaceId) { alert('Please setup Face ID first!'); window.location.href='/student/face-register'; return; }
            setShowMarkModal(true);
          }} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2">
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
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 shadow-sm">
            <p className="text-blue-200 text-sm mb-1">Overall Attendance</p>
            <p className="text-5xl font-bold">{overall}%</p>
            <p className="text-blue-200 mt-2 text-sm">
              {overall >= 75 ? '✅ You are safe! Keep it up.' : '⚠️ Below 75% threshold — attend more classes!'}
            </p>
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
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Subject-wise Breakdown</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1,2,3,4].map(i => <div key={i} className="h-36 bg-gray-200 rounded-xl animate-pulse"/>)}
          </div>
        ) : summary.length === 0 ? (
          <div className="text-center text-gray-400 py-12 bg-white rounded-xl">
            <p className="text-4xl mb-2">📚</p>
            <p>No subjects enrolled yet</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {summary.map(s => <AttendanceCard key={s.subject_id} subject={s}/>)}
          </div>
        )}
      </div>

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-xl font-bold mb-2">Mark Attendance</h2>
            <p className="text-sm text-gray-500 mb-4">Enter the 4-digit OTP or paste the QR Token shown by your teacher.</p>
            
            {(faceCheckState === 'loading_models' || faceCheckState === 'scanning') && (
              <div className="mb-4 text-center">
                <div className="w-48 h-48 mx-auto bg-black rounded-xl overflow-hidden relative mb-2">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 border-4 border-blue-500 opacity-50 rounded-xl animate-pulse"></div>
                </div>
                <p className="font-bold text-blue-600 animate-pulse">
                  {faceCheckState === 'loading_models' ? 'Loading AI...' : 'Scanning Face...'}
                </p>
              </div>
            )}
            
            {faceCheckState === 'success' && (
              <div className="mb-4 text-center p-3 bg-green-50 text-green-700 font-bold rounded-lg">
                ✅ Face Verified Successfully!
              </div>
            )}

            <input 
              placeholder="e.g. 1234 or a-long-qr-token..." 
              value={markForm.code} 
              onChange={e => setMarkForm({ code: e.target.value.trim() })}
              disabled={marking}
              className="w-full border-2 rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest focus:border-blue-500 outline-none mb-4 disabled:bg-gray-100 disabled:opacity-50"
            />
            
            <div className="flex gap-3">
              <button onClick={() => setShowMarkModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200">Cancel</button>
              <button onClick={handleMarkAttendance} disabled={marking} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {marking ? 'Marking...' : 'Submit'}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400 mt-4">Location + AI Face verification is required.</p>
          </div>
        </div>
      )}
    </div>
  );
}
