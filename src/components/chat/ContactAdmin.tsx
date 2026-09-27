'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

export default function ContactAdmin() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [adminLastSeen, setAdminLastSeen] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 3 * 60 * 1000;
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/contact');
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.admin_last_seen) setAdminLastSeen(data.admin_last_seen);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      // Scroll only the chat container, not the whole window!
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const msg = input;
    setInput('');
    setMessages(prev => [...prev, { id: 'temp', content: msg, sender_id: session?.user?.userId, created_at: new Date().toISOString() }]);
    
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg })
    });
    const data = await res.json();
    if (res.status === 429) {
      alert(data.error);
      // Remove the optimistic temp message since it failed
      setMessages(prev => prev.filter(m => m.id !== 'temp'));
    }
    fetchMessages();
  };

  if (loading) return <div className="p-8 text-center">Loading chat...</div>;

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-100px)] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
      <div className="bg-blue-600 text-white p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden border-2 border-white">
          <img src="/iiitbh-logo.jpg" alt="Admin" className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="font-bold flex items-center gap-2">
            Contact Admin
            {isOnline(adminLastSeen) && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 shadow-sm">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Online
              </span>
            )}
          </h2>
          <p className="text-xs text-blue-100">Usually replies within a few hours</p>
        </div>
      </div>
      <div className="bg-yellow-50 border-b border-yellow-100 p-3 text-center space-y-1">
        <p className="text-xs font-bold text-red-600">🚨 Report Bugs, Issues & Errors HERE!!</p>
        <p className="text-xs text-gray-700 font-medium flex items-center justify-center gap-1">🔒 Your Messages Would be Private & only be sent to the ADMIN Only!!</p>
      </div>

      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((m, i) => {
          const isMe = m.sender_id === session?.user?.userId;
          return (
            <div key={m.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] p-3 rounded-2xl ${isMe ? 'bg-blue-600 text-white font-semibold rounded-br-sm' : 'bg-white border text-black font-semibold rounded-bl-sm shadow-sm'}`}>
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-blue-200' : 'text-gray-700'}`}>
                  <span className="text-xs">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && m.id !== 'temp' && (
                    <span className={`text-[14px] leading-none ${m.is_read ? 'text-[#34B7F1]' : 'text-blue-200'}`}>
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
      </div>

      <form onSubmit={send} className="p-3 bg-white border-t flex gap-2">
        <input 
          value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 text-black font-bold bg-gray-100 border focus:bg-white focus:border-blue-500 rounded-xl px-4 py-2 text-sm outline-none shadow-sm"
        />
        <button type="submit" disabled={!input.trim()} className="bg-blue-600 text-white px-5 rounded-xl font-medium disabled:opacity-70">
          Send
        </button>
      </form>
    </div>
  );
}
