import { useState, useRef } from 'react';
import * as faceapi from 'face-api.js';

const ANGLES = [
  { id: 'center', label: 'Look Straight', emoji: '😐' },
  { id: 'left', label: 'Turn Head Slowly to Left', emoji: '⬅️' },
  { id: 'right', label: 'Turn Head Slowly to Right', emoji: '➡️' },
  { id: 'up', label: 'Tilt Head Upwards', emoji: '⬆️' },
  { id: 'down', label: 'Tilt Head Downwards', emoji: '⬇️' }
];

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
  
  const [step, setStep] = useState(0);
  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);

  const saveDetails = async () => {
    setSaving(true);
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
  
  const captureAngle = async () => {
    if (!videoRef.current) return;
    setFaceMsg('Scanning...');
    const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks().withFaceDescriptor();
    if (!detection) {
      setFaceMsg(''); alert('No face detected! Please ensure good lighting.'); return;
    }
    setDescriptors(prev => [...prev, detection.descriptor]);
    setStep(s => s + 1);
    setFaceMsg('');
  };
  
  const saveFace = async () => {
    setSaving(true);
    const arr2D = descriptors.map(d => Array.from(d));
    const res = await fetch('/api/teacher/students/face', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: student.id, descriptor: arr2D })
    });
    setSaving(false);
    if (res.ok) {
      alert('3D Face ID mapped successfully!');
      stopCamera();
      onSaved();
      onClose();
    } else alert('Failed to save face ID');
  };
  
  const resetFace = async () => {
    if(!confirm('Are you sure you want to delete this Face ID? The student will be forced to re-register on their own phone.')) return;
    setSaving(true);
    await fetch(`/api/teacher/students/face?student_id=${student.id}`, { method: 'DELETE' });
    setSaving(false);
    alert('Face ID deleted successfully! Student must re-register.');
    stopCamera();
    onSaved();
    onClose();
  };
  
  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl mx-auto my-auto max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit Student</h2>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-gray-700 hover:text-gray-900 text-2xl font-bold">&times;</button>
        </div>
        
        <div className="flex border-b bg-gray-50 border-gray-200">
          <button onClick={() => { setMode('details'); stopCamera(); }} className={`flex-1 py-3 font-bold text-sm ${mode==='details'?'border-b-2 border-blue-600 text-blue-700 bg-white':'text-gray-800 hover:bg-gray-100'}`}>Basic Details</button>
          <button onClick={() => { setMode('face'); startCamera(); }} className={`flex-1 py-3 font-bold text-sm ${mode==='face'?'border-b-2 border-blue-600 text-blue-700 bg-white':'text-gray-800 hover:bg-gray-100'}`}>Update Face ID</button>
        </div>

        <div className="p-6 overflow-y-auto">
          {mode === 'details' ? (
            <div className="space-y-4">
              <div><label className="block text-sm font-bold text-gray-900 mb-1">Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 font-semibold bg-white focus:outline-none focus:border-blue-500 shadow-sm"/></div>
              <div><label className="block text-sm font-bold text-gray-900 mb-1">Roll No</label>
                <input value={rollNo} onChange={e=>setRollNo(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 font-semibold bg-white focus:outline-none focus:border-blue-500 shadow-sm"/></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="block text-sm font-bold text-gray-900 mb-1">Branch</label>
                  <select value={branch} onChange={e=>{setBranch(e.target.value); setGroup(''); setSubGroup('');}} className="w-full border border-gray-300 rounded-xl px-2.5 py-2 bg-white text-gray-900 font-bold focus:outline-none focus:border-blue-500 shadow-sm">
                    <option value="" className="text-gray-900 font-bold">Select</option>
                    <option value="CSE" className="text-gray-900 font-bold">CSE</option>
                    <option value="ECE" className="text-gray-900 font-bold">ECE</option>
                    <option value="MAE" className="text-gray-900 font-bold">MAE</option>
                    <option value="MNC" className="text-gray-900 font-bold">MNC</option>
                  </select></div>
                <div><label className="block text-sm font-bold text-gray-900 mb-1">Group</label>
                  {branch !== 'CSE' ? (
                    <div className="w-full border border-dashed border-gray-300 rounded-xl px-2.5 py-2 bg-gray-50 text-gray-500 text-xs font-semibold flex items-center justify-between">
                      <span>None</span>
                    </div>
                  ) : (
                    <select value={group} onChange={e=>{setGroup(e.target.value); setSubGroup('');}} className="w-full border border-gray-300 rounded-xl px-2.5 py-2 bg-white text-gray-900 font-bold focus:outline-none focus:border-blue-500 shadow-sm">
                      <option value="" className="text-gray-900 font-bold">Select</option>
                      <option value="G1" className="text-gray-900 font-bold">G1</option>
                      <option value="G2" className="text-gray-900 font-bold">G2</option>
                    </select>
                  )}
                </div>
                <div><label className="block text-sm font-bold text-gray-900 mb-1">Sub Group</label>
                  {branch !== 'CSE' || !group ? (
                    <div className="w-full border border-dashed border-gray-300 rounded-xl px-2.5 py-2 bg-gray-50 text-gray-500 text-xs font-semibold flex items-center justify-between">
                      <span>None</span>
                    </div>
                  ) : (
                    <select value={subGroup} onChange={e=>setSubGroup(e.target.value)} className="w-full border border-gray-300 rounded-xl px-2.5 py-2 bg-white text-gray-900 font-bold focus:outline-none focus:border-blue-500 shadow-sm">
                      <option value="" className="text-gray-900 font-bold">Select</option>
                      <option value={`${group}A`} className="text-gray-900 font-bold">{group}A</option>
                      <option value={`${group}B`} className="text-gray-900 font-bold">{group}B</option>
                    </select>
                  )}
                </div>
              </div>
              <div className="pt-4">
                <button onClick={saveDetails} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-70 shadow-sm">{saving?'Saving...':'Save Details'}</button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="flex justify-between mb-4">
                <h3 className="font-bold text-gray-900">3D Face Mapping</h3>
                <button onClick={resetFace} disabled={saving} className="text-sm font-bold text-red-600 hover:text-red-800">Reset & Delete</button>
              </div>
              
              <div className="relative w-full max-w-sm mx-auto aspect-square bg-gray-200 rounded-2xl overflow-hidden mb-4 flex items-center justify-center border-4 border-blue-100">
                {faceMsg && <div className="absolute inset-0 bg-black/80 backdrop-blur-sm text-white flex items-center justify-center p-4 z-10 font-bold">{faceMsg}</div>}
                <video ref={videoRef} className="w-full h-full object-cover transform scale-x-[-1]" muted playsInline />
                
                {/* 3D Target Overlay Guide */}
                <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-64 border-2 border-dashed border-white/50 rounded-full"></div>
                </div>
              </div>
              
              {step < 5 ? (
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{ANGLES[step].emoji} {ANGLES[step].label}</h3>
                  <p className="text-sm font-bold text-gray-800 mb-4">Angle {step + 1} of 5</p>
                  <button onClick={captureAngle} disabled={!!faceMsg} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium">Capture Angle</button>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-bold text-green-600 mb-4">✅ All 5 Angles Captured</h3>
                  <button onClick={saveFace} disabled={saving} className="w-full py-3 bg-green-600 text-white rounded-xl font-medium">{saving?'Saving...':'Save 3D Face ID'}</button>
                  <button onClick={() => { setStep(0); setDescriptors([]); }} className="w-full py-3 mt-2 bg-gray-100 text-gray-800 rounded-xl font-medium">Retake</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
