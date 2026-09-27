import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export function QrScanner({ onScan, onClose }: { onScan: (token: string) => void, onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    
    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("qr-reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (html5QrCode?.isScanning) {
              html5QrCode.stop().then(() => onScan(decodedText)).catch(() => onScan(decodedText));
            } else {
              onScan(decodedText);
            }
          },
          (err) => { /* ignore */ }
        );
      } catch (err) {
        console.error("Failed to start camera", err);
      }
    };
    
    startScanner();

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Scan QR Code</h3>
          <button onClick={onClose} className="text-gray-700 hover:bg-gray-100 p-2 rounded-lg">✕</button>
        </div>
        <div id="qr-reader" className="w-full min-h-[300px] overflow-hidden rounded-xl [&>video]:w-full [&>video]:object-cover"></div>
      </div>
    </div>
  );
}
