'use client';
import { useEffect, useState, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Navbar } from '@/components/shared/Navbar';
import Image from 'next/image';
import Link from 'next/link';

interface ProfileData {
  name: string; email: string; role: string; roll_no?: string;
  bio?: string; profile_photo_url?: string;
  photo_change_count?: number; photo_month_year?: string;
  signup_info?: Record<string, string>;
}

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [group, setGroup] = useState('');
  const [subGroup, setSubGroup] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/profile').then(r => r.json()).then(d => {
      setProfile(d.profile);
      setName(d.profile?.name || '');
      setBio(d.profile?.bio || '');
      setBranch(d.profile?.signup_info?.branch || '');
      setGroup(d.profile?.signup_info?.group || '');
      setSubGroup(d.profile?.signup_info?.sub_group || '');
    });
    };
    fetchData();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio, branch, group, sub_group: subGroup }),
    });
    const d = await res.json();
    if (d.success) {
      setProfile(p => p ? { ...p, name, bio, signup_info: { ...(p.signup_info || {}), branch, group, sub_group: subGroup } } : p);
      setEditing(false); setMsg('Saved!');
      await update();
    } else setMsg(d.error || 'Error');
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg('Photo must be under 2MB'); return; }
    setPhotoUploading(true);
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch('/api/profile/photo', { method: 'POST', body: formData });
    const d = await res.json();
    if (d.url) {
      setProfile(p => p ? { ...p, profile_photo_url: d.url } : p);
      setMsg('Photo updated!');
      await update();
    } else setMsg(d.error || 'Upload failed');
    setPhotoUploading(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your profile photo?')) return;
    setPhotoUploading(true);
    setMsg('Removing photo...');
    const res = await fetch('/api/profile/photo', { method: 'DELETE' });
    const d = await res.json();
    if (d.success) {
      setProfile(p => p ? { ...p, profile_photo_url: undefined } : p);
      setMsg('Photo removed!');
      await update();
    } else {
      setMsg(d.error || 'Removal failed');
    }
    setPhotoUploading(false);
    setTimeout(() => setMsg(''), 4000);
  };

  const currentMonth = new Date().toISOString().substring(0, 7);
  const isSuperAdmin = profile?.role === 'superadmin';
  const photoChangesLeft = isSuperAdmin
    ? Infinity  // admin: unlimited
    : (profile?.photo_month_year === currentMonth ? Math.max(0, 2 - (profile?.photo_change_count || 0)) : 2);

  if (!profile) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/>
    </div>
  );

  const role = profile.role;
  const displayRole = role === 'superadmin' ? 'Administrator' : role;

  return (
    <div className="min-h-screen bg-gray-50 md:pl-64 pt-14 md:pt-0">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">👤 My Profile</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-5">
          {/* Photo */}
          <div className="flex items-start gap-5 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-blue-200">
                {profile.profile_photo_url ? (
                  <Image src={profile.profile_photo_url} alt={profile.name}
                    width={80} height={80} className="object-cover w-full h-full"/>
                ) : (
                  <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
                    {profile.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
              </div>
              <button onClick={() => fileRef.current?.click()} disabled={photoUploading || photoChangesLeft === 0}
                title={photoChangesLeft === 0 ? 'Limit reached this month' : `Change photo (${photoChangesLeft} left this month)`}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition">
                {photoUploading ? '…' : '📷'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden"/>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{profile.name}</h2>
              {profile.profile_photo_url && (
                <button onClick={handleRemovePhoto} disabled={photoUploading}
                  className="text-xs text-red-500 hover:text-red-700 font-medium mt-1">
                  Remove Photo
                </button>
              )}
              <p className="text-gray-700 text-sm">{profile.email}</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded capitalize mt-1 inline-block">
                {displayRole}
              </span>
              <p className="text-xs text-gray-700 mt-1">
                {isSuperAdmin
                  ? <span className="text-blue-500">✨ Unlimited photo changes</span>
                  : `Photo changes remaining this month: ${photoChangesLeft}/2`
                }
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            {editing ? (
              <>
                <div>
                  <label className="block text-sm font-black text-gray-900 mb-1">Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full text-black font-bold border-2 border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 bg-white shadow-sm"/>
                </div>
                {role === 'student' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-black text-gray-900 mb-1">Branch</label>
                      <select value={branch} onChange={e => { setBranch(e.target.value); setGroup(''); setSubGroup(''); }} className="w-full text-black font-bold border-2 border-gray-300 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-600 shadow-sm">
                        <option value="">Select Branch</option>
                        <option value="CSE">Computer Science (CSE)</option>
                        <option value="ECE">Electronics (ECE)</option>
                        <option value="MEA">Mechatronics (MEA)</option>
                        <option value="MNC">Maths & Computing (MNC)</option>
                      </select>
                    </div>
                    {branch && (
                      <div>
                        <label className="block text-sm font-black text-gray-900 mb-1">Group</label>
                        <select value={group} onChange={e => { setGroup(e.target.value); setSubGroup(''); }} className="w-full text-black font-bold border-2 border-gray-300 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-600 shadow-sm">
                          <option value="">Select Group</option>
                          <option value="G1">G1</option>
                          <option value="G2">G2</option>
                        </select>
                      </div>
                    )}
                    {group && (
                      <div>
                        <label className="block text-sm font-black text-gray-900 mb-1">Sub Group</label>
                        <select value={subGroup} onChange={e => setSubGroup(e.target.value)} className="w-full text-black font-bold border-2 border-gray-300 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-600 shadow-sm">
                          <option value="">Select Sub Group</option>
                          <option value={`${group}A`}>{group}A</option>
                          <option value={`${group}B`}>{group}B</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-black text-gray-900 mb-1">Bio (optional)</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    className="w-full text-black font-bold border-2 border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-600 bg-white shadow-sm resize-none"
                    placeholder="Tell something about yourself..."/>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-900 mb-0.5">Name</p>
                    <p className="font-black text-black text-base tracking-tight">{profile.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 mb-0.5">Email</p>
                    <p className="font-medium text-gray-800 text-sm">{profile.email}</p>
                  </div>
                  {profile.roll_no && (
                    <div>
                      <p className="text-xs font-bold text-gray-900 mb-0.5">Roll No</p>
                      <p className="font-black text-black text-base tracking-tight">{profile.roll_no}</p>
                    </div>
                  )}
                  {profile.signup_info?.branch && (
                    <div>
                      <p className="text-xs font-bold text-gray-900 mb-0.5">Class / Batch</p>
                      <p className="font-black text-black text-base tracking-tight">
                        {profile.signup_info.branch} 
                        {profile.signup_info.group ? ` - ${profile.signup_info.group}` : ''} 
                        {profile.signup_info.sub_group ? ` (${profile.signup_info.sub_group})` : ''}
                      </p>
                    </div>
                  )}
                  {profile.signup_info?.subject_name && (
                    <div>
                      <p className="text-xs font-bold text-gray-900 mb-0.5">Subject</p>
                      <p className="font-black text-black text-base tracking-tight">
                        {profile.signup_info.subject_name} ({profile.signup_info.subject_code})
                      </p>
                    </div>
                  )}
                </div>
                {profile.bio && (
                  <div>
                    <p className="text-xs font-bold text-gray-900 mb-0.5">Bio</p>
                    <p className="font-bold text-black text-sm">{profile.bio}</p>
                  </div>
                )}
              </>
            )}

            {msg && <p className={`text-sm p-2 rounded-lg ${msg.includes('Error') || msg.includes('failed') || msg.includes('Limit') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{msg}</p>}

            <div className="flex gap-3 pt-2">
              {editing ? (
                <>
                  <button onClick={saveProfile} disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 disabled:opacity-70 transition font-medium">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="flex-1 bg-gray-100 text-gray-800 py-2 rounded-xl hover:bg-gray-200 transition">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-xl hover:bg-blue-100 transition font-medium">
                  ✏️ Edit Profile
                </button>
              )}
            </div>
            
            {!editing && role === 'student' && (
              <div className="pt-4 mt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Biometric Security</h3>
                {(() => {
                  const lastUpdate = profile.signup_info?.last_face_update;
                  let canUpdate = true;
                  let daysLeft = 0;
                  if (lastUpdate) {
                    const daysSince = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24);
                    if (daysSince < 30) {
                      canUpdate = false;
                      daysLeft = Math.ceil(30 - daysSince);
                    }
                  }
                  
                  return (
                    <div className="flex flex-col gap-2">
                      <Link 
                        href={canUpdate ? "/student/face-register" : "#"}
                        onClick={e => {
                          if (!canUpdate) {
                            e.preventDefault();
                            alert(`You can only update your Face ID once every 30 days.\nPlease try again after ${daysLeft} days.`);
                          }
                        }}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition ${canUpdate ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-gray-50 text-gray-700 cursor-not-allowed'}`}>
                        <span>📸</span> 
                        {profile.signup_info?.face_descriptor ? 'Update Face ID' : 'Register Face ID'}
                      </Link>
                      {!canUpdate && (
                        <>
                          <p className="text-xs text-center text-gray-700">
                            Next update available in {daysLeft} days
                          </p>
                          <p className="text-xs text-center text-red-500 font-medium">
                            Contact your Teacher if Face ID not Working
                          </p>
                        </>
                      )}
                      {canUpdate && profile.signup_info?.face_descriptor && (
                         <p className="text-xs text-center text-gray-700">
                          You can update your Face ID once per month.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
