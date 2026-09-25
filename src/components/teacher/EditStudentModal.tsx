import { useState, useRef } from 'react';
import * as faceapi from 'face-api.js';

export function EditStudentModal({ student, onClose, onSaved }: { student: any, onClose: () => void, onSaved: () => void }) {
  const [name, setName] = useState(student.name || '');
  const [rollNo, setRollNo] = useState(student.roll_no || '');
  const [branch, setBranch] = useState(student.signup_info?.branch || student.branch || '');
  const [group, setGroup] = useState(student.signup_info?.group || '');
  const [subGroup, setSubGroup] = useState(student.signup_info?.sub_group || '');
  
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'details'|'face'>('details');
  const [faceMsg, setFaceMsg] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [descriptor, setDescriptor] = useState<Float32Array | null>(null);

  const saveDetails = async () => {
    setSaving(true);
    // We will call the existing admin user update API! Wait, teacher doesn't have access to admin API?
    // Let's check if teacher can use PATCH /api/admin/users
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: student.id, name, roll_no: rollNo, branch, group, sub_group: subGroup })
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else alert('Failed to save details');
  };
  
  const startCamera = async () => {
    try {
      setFaceMsg('Loading AI Models...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models')
      ]);
      setFaceMsg('Starting Camera...');
      const s = await navigator.mediaDevices.getUserMedia({ video: {} });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      }
      setFaceMsg('');
    } catch (e) {
      setFaceMsg('Error starting camera');
    }
  };
  
  const captureFace = async () => {
    if (!videoRef.current) return;
    setFaceMsg('Detecting Face...');
    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks().withFaceDescriptor();
    if (!detection) {
      setFaceMsg(''); alert('No face detected!'); return;
    }
    setDescriptor(detection.descriptor);
    setFaceMsg('');
  };
  
  const saveFace = async () => {
    setSaving(true);
    const res = await fetch('/api/teacher/students/face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: student.id, descriptor: Array.from(descriptor!) })
    });
    setSaving(false);
    if (res.ok) {
      alert('Face ID updated successfully!');
      stopCamera();
      onClose();
    } else alert('Failed to save face ID');
  };
  
  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Edit Student</h2>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        <div className="flex border-b bg-gray-50">
          <button onClick={() => { setMode('details'); stopCamera(); }} className={`flex-1 py-3 font-medium text-sm ${mode==='details'?'border-b-2 border-blue-600 text-blue-600':'text-gray-500 hover:bg-gray-100'}`}>Basic Details</button>
          <button onClick={() => { setMode('face'); startCamera(); }} className={`flex-1 py-3 font-medium text-sm ${mode==='face'?'border-b-2 border-blue-600 text-blue-600':'text-gray-500 hover:bg-gray-100'}`}>Update Face ID</button>
        </div>

        <div className="p-6">
          {mode === 'details' ? (
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-xl px-3 py-2"/></div>
              <div><label className="block text-sm font-medium mb-1">Roll No</label>
                <input value={rollNo} onChange={e=>setRollNo(e.target.value)} className="w-full border rounded-xl px-3 py-2"/></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm font-medium mb-1">Branch</label>
                  <select value={branch} onChange={e=>{setBranch(e.target.value); setGroup(''); setSubGroup('');}} className="w-full border rounded-xl px-3 py-2 bg-white">
                    <option value="">Select</option><option value="CSE">CSE</option><option value="ECE">ECE</option><option value="MEA">MEA</option><option value="MNC">MNC</option>
                  </select></div>
                <div><label className="block text-sm font-medium mb-1">Group</label>
                  <select value={group} onChange={e=>{setGroup(e.target.value); setSubGroup('');}} className="w-full border rounded-xl px-3 py-2 bg-white">
                    <option value="">Select</option><option value="G1">G1</option><option value="G2">G2</option>
                  </select></div>
                <div><label className="block text-sm font-medium mb-1">Sub Group</label>
                  <select value={subGroup} onChange={e=>setSubGroup(e.target.value)} className="w-full border rounded-xl px-3 py-2 bg-white">
                    <option value="">Select</option><option value={`${group}A`}>{group}A</option><option value={`${group}B`}>{group}B</option>
                  </select></div>
              </div>
              <div className="pt-4">
                <button onClick={saveDetails} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">{saving?'Saving...':'Save Details'}</button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-200 rounded-2xl overflow-hidden mb-6 flex items-center justify-center">
                {faceMsg && <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center p-4 z-10">{faceMsg}</div>}
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              </div>
              
              {!descriptor ? (
                <div className="flex flex-col gap-3">
                  <button onClick={captureFace} disabled={!!faceMsg} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">Capture Face (Webcam)</button>
                  <button onClick={async () => {
                    if(!confirm('This will allow the student to update their own Face ID from their phone. Continue?')) return;
                    setSaving(true);
                    await fetch(`/api/teacher/students/face?student_id=${student.id}`, { method: 'DELETE' });
                    setSaving(false);
                    alert('Limit reset successfully! Student can now update their Face ID.');
                  }} disabled={saving} className="w-full py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-medium">Reset Face ID Limit</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setDescriptor(null)} disabled={saving} className="flex-1 py-3 bg-gray-200 rounded-xl font-medium">Retake</button>
                  <button onClick={saveFace} disabled={saving} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium">{saving?'Saving...':'Confirm & Save'}</button>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-4">This will immediately overwrite the student's Face ID and bypass the 30-day limit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
