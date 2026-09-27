"use client";
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { PhotoZoom } from './PhotoZoom';
import Link from 'next/link';

interface Props {
  subtitle?: string;
  isCr?: boolean;
}

export function WelcomeCard({ subtitle, isCr }: Props) {
  const { data: session } = useSession();
  const photo  = session?.user?.profilePhotoUrl || session?.user?.image;
  const name   = session?.user?.name || '';
  const email  = session?.user?.email || '';

  // Heartbeat — update online status every 60s
  useEffect(() => {
    const ping = () => fetch('/api/heartbeat', { method: 'POST' });
    ping(); // immediate
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-5 border">
      {/* Big profile photo */}
      <div className="relative flex-shrink-0">
        {photo ? (
          <PhotoZoom src={photo} alt={name} size={80}
            className="border-4 border-blue-200 shadow-md"/>
        ) : (
          <Link href="/profile">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500
              flex items-center justify-center text-white text-3xl font-bold shadow-md border-4 border-blue-200 cursor-pointer">
              {name.charAt(0).toUpperCase()}
            </div>
          </Link>
        )}
        {/* Online dot */}
        <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full shadow-sm"
          title="Online now"/>
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-sm text-gray-700 mb-0.5">{subtitle || 'Welcome back!'}</p>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800 truncate">{name}</h1>
          {isCr && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-200">CR / Leader</span>}
        </div>
        <p className="text-sm text-gray-700 truncate">{email}</p>
        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium mt-1">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
          Online
        </span>
      </div>
    </div>
  );
}
