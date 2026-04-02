'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import jsQR from 'jsqr';
import type { ScanStatus, ScanResultData, ScannerConfig } from '../../types/scanner';
import ResultDisplay from './ResultDisplay';
import ScanAgainButton from './ScanAgainButton';

interface QRPanelProps {
  config: ScannerConfig;
  status: ScanStatus;
  resultData: ScanResultData | null;
  onScan: (payload: { ticketId: string }) => Promise<void>;
  onReset: () => void;
}

export default function QRPanel({ config, status, resultData, onScan, onReset }: QRPanelProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const loopRef     = useRef<number | null>(null);
  const scanningRef = useRef(false); // prevent double-fire

  const stopCamera = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const qrLoop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      loopRef.current = requestAnimationFrame(qrLoop);
      return;
    }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // jsQR returns null when no QR code is found — only fire when a code is detected
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data.trim() && !scanningRef.current && status === 'idle') {
      scanningRef.current = true;
      onScan({ ticketId: code.data.trim() }).finally(() => {
        // Re-enable scanning after result clears (handled by parent via onReset)
        scanningRef.current = false;
      });
      // Stop looping while result is shown — resume on reset
      return;
    }

    loopRef.current = requestAnimationFrame(qrLoop);
  }, [status, onScan]);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().then(() => {
          loopRef.current = requestAnimationFrame(qrLoop);
        });
      }
    }).catch(err => console.error('[QR] Camera error:', err));

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  // Resume scanning loop after result is dismissed
  useEffect(() => {
    if (status === 'idle' && streamRef.current) {
      scanningRef.current = false;
      loopRef.current = requestAnimationFrame(qrLoop);
    }
  }, [status]);

  const showResult  = status !== 'idle' && status !== 'scanning';
  const isScanning  = status === 'scanning';

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#141414] border border-white/[0.06]">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder — only visible when idle */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-52 h-52 relative">
              {(['tl','tr','bl','br'] as const).map((corner) => (
                <div key={corner} className={`absolute w-7 h-7 border-brand-400 ${
                  corner === 'tl' ? 'top-0 left-0 border-t-2 border-l-2 rounded-tl' :
                  corner === 'tr' ? 'top-0 right-0 border-t-2 border-r-2 rounded-tr' :
                  corner === 'bl' ? 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl' :
                                    'bottom-0 right-0 border-b-2 border-r-2 rounded-br'
                }`} />
              ))}
            </div>
          </div>
        )}

        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 size={32} className="text-brand-400 animate-spin" />
          </div>
        )}

        {showResult && (
          <ResultDisplay status={status} data={resultData} />
        )}
      </div>

      {/* Show Scan Again button after result — manual dismiss for QR */}
      {showResult && (
        <ScanAgainButton onClick={onReset} />
      )}

      {status === 'idle' && (
        <p className="text-xs text-white/20 text-center">Point camera at guest QR code</p>
      )}
    </div>
  );
}