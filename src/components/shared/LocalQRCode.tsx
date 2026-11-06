'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface LocalQRCodeProps {
  text: string;
  className?: string;
  alt?: string;
}

export function LocalQRCode({ text, className = '', alt = 'QR Code' }: LocalQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!text) {
      setDataUrl('');
      return;
    }

    QRCode.toDataURL(text, {
      width: 600,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setDataUrl(url))
      .catch(err => {
        console.error('Failed to generate local QR code:', err);
      });
  }, [text]);

  if (!dataUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse text-gray-700 text-xs font-medium ${className}`}>
        Generating QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      className={`${className} select-none pointer-events-none transition-opacity duration-200`}
    />
  );
}
