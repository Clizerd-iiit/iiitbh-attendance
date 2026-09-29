'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Profession = 'student' | 'teacher';

export default function ProfileSetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<'info' | 'done'>('info');
  const [profession, setProfession] = useState<Profession>('student');
  const [name, setName] = useState(session?.user?.name || '');
  const [rollNo, setRollNo] = useState('');
  const [branch, setBranch] = useState('CSE');
  const [group, setGroup] = useState('G1');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== 'done') return;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data?.profile?.verification_status === 'approved') {
          await update();
          const role = data.profile.role;
          if (role === 'teacher') router.push('/teacher/dashboard');
          else if (role === 'student') router.push('/student/dashboard');
          else router.push('/auth/login');
        } else if (data?.profile?.verification_status === 'rejected') {
          await update();
          router.push('/auth/error?error=account_rejected');
        }
      } catch (e) {}
    };
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [step, update, router]);


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2MB'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!agreed) { setError('You must agree to the Terms & Conditions and Privacy Policy'); return; }
    if (!name.trim()) { setError('Name is required'); return; }
    if (profession === 'student' && !rollNo.trim()) { setError('Roll No is required'); return; }
    if (profession === 'teacher' && (!subjectName.trim() || !subjectCode.trim())) {
      setError('Subject name and code are required'); return;
    }
    setSubmitting(true); setError('');

    // Upload photo if provided
    let photoUrl = '';
    if (photoFile) {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const res = await fetch('/api/profile/photo', { method: 'POST', body: formData });
      const d = await res.json();
      if (d.url) photoUrl = d.url;
    }

    const res = await fetch('/api/profile/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, profession,
        rollNo:      profession === 'student' ? rollNo : undefined,
        branch:      profession === 'student' ? branch : undefined,
        section:     profession === 'student' ? group : undefined,
        subjectName: profession === 'teacher' ? subjectName : undefined,
        subjectCode: profession === 'teacher' ? subjectCode : undefined,
        photoUrl,
      }),
    });

    const d = await res.json();
    if (!res.ok) { setError(d.error || 'Something went wrong'); setSubmitting(false); return; }

    await update(); // refresh session
    setStep('done');
    setSubmitting(false);
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Profile Submitted!</h1>
          <p className="text-gray-700 mb-4">
            Your account is pending verification by the administrator. You will be notified once approved.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 mb-6">
            Verification usually takes within 24 hours on working days.
          </div>
          <button onClick={() => signOut({ callbackUrl: '/auth/login' })}
            className="w-full bg-gray-100 text-gray-800 py-2.5 rounded-xl hover:bg-gray-200 transition font-medium">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-blue-200 mx-auto mb-3">
            <Image unoptimized={true} src="/iiitbh-logo.jpg" alt="IIIT Bhagalpur" width={64} height={64} className="object-cover"/>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Complete Your Profile</h1>
          <p className="text-gray-700 text-sm mt-1">Fill in your details to get started</p>
        </div>

        <div className="space-y-5">
          {/* Profile Photo */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-full overflow-hidden border-4 border-dashed border-blue-300 bg-blue-50 cursor-pointer hover:border-blue-500 transition flex items-center justify-center">
              {photoPreview ? (
                <Image unoptimized={true} src={photoPreview} alt="Preview" width={80} height={80} className="object-cover w-full h-full"/>
              ) : (
                <span className="text-blue-400 text-3xl">📷</span>
              )}
            </div>
            <p className="text-xs text-gray-700">Click to upload photo (optional, max 2MB)</p>
            {photoPreview && (
              <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }} className="text-xs text-red-500 mt-2 font-medium hover:underline">
                Remove Photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. ABCD EFGH"
              className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 text-gray-800"/>
          </div>

          {/* Profession */}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-2">I am a <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {(['student', 'teacher'] as Profession[]).map(p => (
                <button key={p} onClick={() => setProfession(p)}
                  className={`py-3 rounded-xl font-medium capitalize border-2 transition ${
                    profession === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}>
                  {p === 'student' ? '🎓 Student' : '👨‍🏫 Teacher'}
                </button>
              ))}
            </div>
          </div>

          {/* Student: Roll No, Branch, Group */}
          {profession === 'student' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Roll Number <span className="text-red-500">*</span></label>
                <input value={rollNo} onChange={e => setRollNo(e.target.value)}
                  placeholder="e.g. 260101047"
                  className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500"/>
                <p className="text-xs text-gray-700 mt-1">E.g., 26 (Year), 01 (BTech), 01 (CSE), 047 (Roll)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Branch <span className="text-red-500">*</span></label>
                  <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 bg-white">
                    <option value="CSE">CSE (01)</option>
                    <option value="ECE">ECE (02)</option>
                    <option value="MAE">MAE (03)</option>
                    <option value="MNC">MnC (04)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Group <span className="text-red-500">*</span></label>
                  <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500 bg-white">
                    <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
                    <option value="G1A">G1A</option><option value="G1B">G1B</option>
                    <option value="G2A">G2A</option><option value="G2B">G2B</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Teacher: Subject + Code */}
          {profession === 'teacher' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Subject Name <span className="text-red-500">*</span></label>
                <input value={subjectName} onChange={e => setSubjectName(e.target.value)}
                  placeholder="e.g. Data Structures"
                  className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Subject Code <span className="text-red-500">*</span></label>
                <input value={subjectCode} onChange={e => setSubjectCode(e.target.value)}
                  placeholder="e.g. CS201"
                  className="w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:border-blue-500"/>
              </div>
            </div>
          )}


          <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600 rounded cursor-pointer" />
            <p className="text-sm text-gray-800 leading-tight">
              I agree to the <a href="/terms" target="_blank" className="text-blue-600 font-semibold hover:underline">Terms & Conditions</a> and <a href="/privacy" target="_blank" className="text-blue-600 font-semibold hover:underline">Privacy Policy</a> of the IIIT-BH Attendance System.
            </p>
          </div>
          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-70 transition text-lg">
            {submitting ? 'Submitting...' : 'Submit for Verification →'}
          </button>

          <p className="text-xs text-center text-gray-700">
            Your account will be activated after administrator approval
          </p>
        </div>
      </div>
    </div>
  );
}
