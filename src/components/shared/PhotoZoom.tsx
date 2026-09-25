"use client";
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

interface Props {
  src: string;
  alt: string;
  size?: number;         // thumbnail size in px (default 48)
  className?: string;
}

export function PhotoZoom({ src, alt, size = 48, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!src) {
    return (
      <div 
        className={`flex-shrink-0 bg-blue-100 flex items-center justify-center text-blue-700 font-bold rounded-full ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {alt?.charAt(0)?.toUpperCase()}
      </div>
    );
  }

  const validSrc = src;


  return (
    <>
      {/* Thumbnail — click/touch to open */}
      <div
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`cursor-zoom-in rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
        title="Tap to zoom"
      >
        <Image src={src} alt={alt} width={size} height={size}
          className="object-cover w-full h-full rounded-full"/>
      </div>

      {/* Zoom overlay */}
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center p-6 backdrop-blur-sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="w-72 h-72 rounded-full overflow-hidden border-4 border-white shadow-2xl mx-auto">
              <Image src={src} alt={alt} width={288} height={288}
                className="object-cover w-full h-full" unoptimized/>
            </div>
            <p className="text-white text-center mt-4 font-medium text-lg">{alt}</p>
            <button onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 w-9 h-9 bg-white text-gray-800 rounded-full text-xl flex items-center justify-center shadow-lg hover:bg-gray-100 cursor-pointer">
              ×
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
