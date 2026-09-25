import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export function QrScanner({ onScan, onClose }: { onScan: (token: string) => void, onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render((text) => {
      scanner.clear();
      onScan(text);
    }, (err) => {
      // ignore
    });

    return () => {
      scanner.clear().catch(e => console.error(e));
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl overflow-hidden p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Scan QR Code</h3>
          <button onClick={onClose} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg">✕</button>
        </div>
        <div id="qr-reader" className="w-full overflow-hidden rounded-xl"></div>
      </div>
    </div>
  );
}
