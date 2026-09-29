'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/shared/Navbar';

interface Subject { id: string; name: string; code: string; section: string; branch: string; semester: number; teacher_ids: string[]; is_active: boolean; }
interface Teacher { id: string; name: string; email: string; }

export default function AdminSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const defaultForm = { id: '', name: '', code: '', section: 'G1', branch: 'CSE', semester: 1, teacher_ids: [] as string[] };
  const [form, setForm] = useState(defaultForm);

  const fetchAll = () => {
    fetch('/api/admin/subjects').then(r=>r.json()).then(d => setSubjects(d.subjects||[]));
    fetch('/api/admin/users?role=teacher').then(r=>r.json()).then(d => setTeachers(d.users||[]));
  };
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, []);

  const saveSubject = async () => {
    const method = isEditing ? 'PATCH' : 'POST';
    const payload = isEditing ? form : { ...form, id: undefined };
    const res = await fetch('/api/admin/subjects', {
      method, headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error && data.error.includes('duplicate key')) {
        alert('A subject with this Code already exists! If you are adding the same subject for a different branch, please make the code unique (e.g., append -MNC to it like "MA101-MNC"). Or, you can just use the single existing subject, as teachers now have a Branch Filter in their attendance screen!');
      } else {
        alert('Error: ' + (data.error || 'Failed to save subject'));
      }
      return;
    }
    setShowModal(false); setForm(defaultForm); setIsEditing(false);
    fetchAll();
  };
  
  const deleteSubject = async (id: string) => {
    if (!window.confirm("Delete this subject? This will cascade delete classes and attendance.")) return;
    await fetch(`/api/admin/subjects?id=${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const toggleActive = async (s: Subject) => {
    await fetch('/api/admin/subjects', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
    });
    fetchAll();
  };

  const toggleTeacher = (id: string) => {
    const next = new Set(form.teacher_ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setForm({...form, teacher_ids: Array.from(next)});
  };

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📚 Subjects</h1>
          <button onClick={() => { setForm(defaultForm); setIsEditing(false); setShowModal(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition">
            + Add Subject
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subjects.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-800">{s.name}</h3>
                  <p className="text-xs text-gray-700 font-mono">{s.code}</p>
                </div>
                <button onClick={() => toggleActive(s)}
                  className={`text-xs px-2 py-1 rounded-full border ${s.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="space-y-1.5 mt-4">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-800">Group:</span> {s.section}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-800">Branch:</span> {s.branch || 'N/A'}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-800">Sem:</span> {s.semester}
                </p>
                <div className="text-sm text-gray-700 mt-2">
                  <span className="font-semibold text-gray-800 block mb-1">Teachers:</span>
                  {(s.teacher_ids || []).map(tid => {
                    const t = teachers.find(x => x.id === tid);
                    return t ? <div key={tid} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs inline-block mr-1 mb-1">{t.name}</div> : null;
                  })}
                  {!(s.teacher_ids && s.teacher_ids.length > 0) && <span className="text-xs italic text-gray-700">None assigned</span>}
                </div>
              </div>
              
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setForm({ ...s, teacher_ids: s.teacher_ids || [] }); setIsEditing(true); setShowModal(true); }} className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition shadow-sm">✏️</button>
                <button onClick={() => deleteSubject(s.id)} className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition shadow-sm">🗑️</button>
              </div>
            </div>
          ))}
          {subjects.length === 0 && <p className="text-gray-700 col-span-full">No subjects found.</p>}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit Subject' : 'Add Subject'}</h2>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g. Mathematics" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Code</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.code} onChange={e=>setForm({...form, code:e.target.value.toUpperCase()})} placeholder="e.g. MA101" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Branch</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.branch} onChange={e=>setForm({...form, branch:e.target.value})}>
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="MNC">MNC</option>
                      <option value="MAE">MAE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Group (Section)</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.section} onChange={e=>setForm({...form, section:e.target.value})}>
                      <option value="G1">G1</option>
                      <option value="G1A">G1A</option>
                      <option value="G1B">G1B</option>
                      <option value="G2">G2</option>
                      <option value="G2A">G2A</option>
                      <option value="G2B">G2B</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Semester</label>
                    <input type="number" min="1" max="8" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      value={form.semester} onChange={e=>setForm({...form, semester:parseInt(e.target.value)})} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Assign Teachers (Multiple)</label>
                  <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1 bg-gray-50">
                    {teachers.map(t => (
                      <label key={t.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer border border-transparent hover:border-gray-200 transition">
                        <input type="checkbox" className="w-4 h-4 text-blue-600"
                          checked={form.teacher_ids.includes(t.id)} onChange={() => toggleTeacher(t.id)} />
                        <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button onClick={saveSubject} disabled={!form.name || !form.code}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-70">
                  {isEditing ? 'Save Changes' : 'Add Subject'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
