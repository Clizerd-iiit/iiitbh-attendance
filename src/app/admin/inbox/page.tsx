'use client';
import { Navbar } from '@/components/shared/Navbar';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

export default function AdminInbox() {
  const { data: session } = useSession();
  const [inbox, setInbox] = useState<any[]>([]);
  const [activeUser, setActiveUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) setAllUsers(data.users);
    } catch(e) {}
  };

  const fetchInbox = async () => {
    try {
      const res = await fetch('/api/contact');
      const data = await res.json();
      if (data.inbox) setInbox(data.inbox);
    } catch(e) {}
  };

  const fetchMessages = async (userId: string) => {
    try {
      const res = await fetch(`/api/contact?user_id=${userId}`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch(e) {}
  };

  // Poll inbox list
  useEffect(() => {
    fetchInbox();
    fetchAllUsers();
    const id = setInterval(fetchInbox, 5000);
    return () => clearInterval(id);
  }, []);

  // Sync activeUser with latest inbox data (for real-time last_seen_at updates)
  useEffect(() => {
    if (activeUser) {
      const updatedChat = inbox.find(c => c.user_id === activeUser.user_id);
      if (updatedChat && updatedChat.user?.last_seen_at !== activeUser.user?.last_seen_at) {
        setActiveUser((prev: any) => ({ ...prev, user: updatedChat.user }));
      }
    }
  }, [inbox]);


  // Poll active chat
  useEffect(() => {
    if (!activeUser) return;
    fetchMessages(activeUser.user_id);
    const id = setInterval(() => fetchMessages(activeUser.user_id), 3000);
    return () => clearInterval(id);
  }, [activeUser]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const deleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await fetch(`/api/contact?message_id=${msgId}`, { method: 'DELETE' });
    fetchInbox();
  };

  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 3 * 60 * 1000;
  };

  const clearChat = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this entire conversation?")) return;
    setMessages([]);
    setActiveUser(null);
    setInbox(prev => prev.filter(c => c.user_id !== userId));
    await fetch(`/api/contact?user_id=${userId}`, { method: 'DELETE' });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeUser) return;
    const msg = input;
    setInput('');
    
    setMessages(prev => [...prev, { id: 'temp', content: msg, sender_id: session?.user?.userId, created_at: new Date().toISOString() }]);
    
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg, user_id: activeUser.user_id })
    });
    fetchMessages(activeUser.user_id);
    fetchInbox(); // update latest message in sidebar
  };

  return (
    <div className="min-h-screen bg-gray-50"><Navbar /><div className="md:pl-64 pt-16 md:pt-0 p-4 h-screen">
      <div className="max-w-6xl mx-auto h-full bg-white rounded-2xl shadow-sm border border-gray-200 flex overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-1/3 border-r bg-gray-50 flex flex-col">
          <div className="p-4 bg-white border-b space-y-3">
            <h2 className="font-bold text-lg text-gray-800">Admin Inbox</h2>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
              <input 
                type="text" 
                placeholder="Search teacher/student..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-lg pl-9 pr-4 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(() => {
              // If searching, show matching users
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const filtered = allUsers.filter(u => 
                  (u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
                );
                
                if (filtered.length === 0) return <p className="p-4 text-gray-500 text-sm text-center">No user found.</p>;
                
                return filtered.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => {
                      // Find if an inbox chat already exists
                      const existingChat = inbox.find(c => c.user_id === u.id);
                      if (existingChat) setActiveUser(existingChat);
                      else setActiveUser({ user_id: u.id, user: u, unread_count: 0 });
                      setSearchQuery('');
                    }}
                    className={`w-full p-4 text-left border-b hover:bg-gray-100 transition flex gap-3 ${activeUser?.user_id === u.id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-gray-500 font-bold">
                      {u.profile_photo_url ? (
                        <img src={u.profile_photo_url} alt="" className="w-full h-full object-cover"/>
                      ) : (u.name?.charAt(0) || '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="font-medium text-sm text-gray-900 truncate">{u.name || 'Unknown'}</h3>
                      </div>
                      <p className="text-xs text-gray-500 capitalize">{u.role}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </button>
                ));
              }

              // Otherwise show inbox
              if (inbox.length === 0) return <p className="p-4 text-gray-500 text-sm text-center">No messages yet.</p>;

              return inbox.map(chat => (
                <button 
                  key={chat.user_id}
                  onClick={() => setActiveUser(chat)}
                  className={`w-full p-4 text-left border-b hover:bg-gray-100 transition flex gap-3 ${activeUser?.user_id === chat.user_id ? 'bg-blue-50' : ''}`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center text-gray-500 font-bold">
                    {chat.user?.profile_photo_url ? (
                      <img src={chat.user.profile_photo_url} alt="" className="w-full h-full object-cover"/>
                    ) : (chat.user?.name?.charAt(0) || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-sm text-gray-900 truncate">{chat.user?.name || 'Unknown User'}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {new Date(chat.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{chat.latest_message}</p>
                  </div>
                  {chat.unread_count > 0 && (
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {chat.unread_count}
                    </div>
                  )}
                </button>
              ));
            })()}
          </div>
        </div>

        {/* Chat Area */}
        {activeUser ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b bg-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                   {activeUser.user?.profile_photo_url ? (
                     <img src={activeUser.user.profile_photo_url} alt="" className="w-full h-full object-cover"/>
                   ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">{activeUser.user?.name?.charAt(0) || '?'}</div>
                   )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    {activeUser.user?.name}
                    {isOnline(activeUser.user?.last_seen_at) ? (
                       <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Online</span>
                    ) : (
                       <span className="text-xs text-gray-500 font-normal">
                         Last seen: {activeUser.user?.last_seen_at ? new Date(activeUser.user.last_seen_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Offline'}
                       </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 capitalize">{activeUser.user?.role}</p>
                </div>
              </div>
              <button onClick={() => clearChat(activeUser.user_id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg text-sm font-medium flex items-center gap-1 transition flex-shrink-0">
                🗑️ Clear Chat
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((m, i) => {
                const isMe = m.sender_id === session?.user?.userId;
                return (
                  <div key={m.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative`}>
                    <div className={`relative max-w-[75%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border text-gray-800 rounded-bl-sm shadow-sm'}`}>
                      {m.id !== 'temp' && (
                        <button onClick={() => deleteMessage(m.id)} title="Delete message"
                          className={`absolute hidden group-hover:flex items-center justify-center w-6 h-6 bg-red-100 text-red-600 rounded-full shadow-sm -top-2 ${isMe ? '-left-2' : '-right-2'} hover:bg-red-200 transition text-sm z-10`}>
                          ×
                        </button>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>
                        <span className="text-xs">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && m.id !== 'temp' && (
                          <span className={`text-[12px] leading-none ${m.is_read ? 'text-[#34B7F1]' : 'text-blue-200/70'}`}>
                            {m.is_read ? '✓✓' : '✓'}
                          </span>
                        )}
                        {isMe && m.id === 'temp' && (
                          <span className="text-xs text-blue-200/50">🕒</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="p-3 bg-white border-t flex gap-2">
              <input 
                value={input} onChange={e => setInput(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 bg-gray-100 border-transparent focus:bg-white rounded-xl px-4 py-2 text-sm"
              />
              <button type="submit" disabled={!input.trim()} className="bg-blue-600 text-white px-5 rounded-xl font-medium disabled:opacity-70">
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">💬</div>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
        
      </div>
      </div>
    </div>
  );
}
