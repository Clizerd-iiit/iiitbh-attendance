"use client";
import { useSession } from 'next-auth/react';
import { PhotoZoom } from './PhotoZoom';

interface Props {
  subtitle?: string;
  isCr?: boolean;
}

export function WelcomeCard({ subtitle, isCr }: Props) {
  const { data: session } = useSession();
  const photo  = session?.user?.profilePhotoUrl || session?.user?.image;
  const name   = session?.user?.name || '';
  const email  = session?.user?.email || '';

  return (
    <div className="bg-white dark:bg-[#1a120b] rounded-2xl shadow-sm p-5 flex items-center gap-5 border border-gray-100 dark:border-amber-900/40">
      {/* Big profile photo with zoom */}
      <div className="relative flex-shrink-0">
        <PhotoZoom
          src={photo}
          alt={name}
          size={80}
          className="border-4 border-blue-200 dark:border-amber-600/40 shadow-md"
        />
        {/* Online dot */}
        <span
          className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 border-2 border-white dark:border-gray-900 rounded-full shadow-sm"
          title="Online now"
        />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-amber-200/70 mb-0.5">{subtitle || 'Welcome back!'}</p>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-800 dark:text-[#fcf7f2] truncate">{name}</h1>
          {isCr && (
            <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full font-bold border border-purple-200 dark:border-purple-700/50">
              CR / Leader
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-amber-200/60 truncate">{email}</p>
        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium mt-1">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Online
        </span>
      </div>
    </div>
  );
}
