'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import { FlipHorizontal2, ChevronDown } from 'lucide-react';
import type { ScanStatus, ScanResultData, ScannerConfig } from '../../types/scanner';
import { useFaceRecognition } from '../../lib/useFaceRecognition';
import FaceMarker, { FaceHintBar } from './FaceMarker';
import ResultDisplay from './ResultDisplay';
import ScanAgainButton from './ScanAgainButton';

interface FacePanelProps {
  config: ScannerConfig;
  status: ScanStatus;
  resultData: ScanResultData | null;
  onScan: (payload: { faceEmbedding: number[] }) => Promise<void>;
  onReset: () => void;
}

// ─── CameraSelector ───────────────────────────────────────────────────────────

interface CameraDevice {
  deviceId: string;
  label: string;
}

function CameraSelector({
  devices,
  activeId,
  onChange,
}: {
  devices: CameraDevice[];
  activeId: string;
  onChange: (deviceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = devices.find(d => d.deviceId === activeId);

  if (devices.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-colors max-w-[180px]"
      >
        <FlipHorizontal2 size={11} className="flex-shrink-0 text-white/30" />
        <span className="truncate">{active?.label ?? 'Camera'}</span>
        <ChevronDown
          size={11}
          className={`flex-shrink-0 text-white/30 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-20 min-w-[200px] bg-[#1a1a1a] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
            {devices.map(d => (
              <button
                key={d.deviceId}
                onClick={() => { onChange(d.deviceId); setOpen(false); }}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-2 ${
                  d.deviceId === activeId
                    ? 'text-brand-400 bg-brand-500/10'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                }`}
              >
                {d.deviceId === activeId && (
                  <div className="w-1 h-1 rounded-full bg-brand-400 flex-shrink-0" />
                )}
                <span className={`truncate ${d.deviceId !== activeId ? 'pl-3' : ''}`}>
                  {d.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── FacePanel ────────────────────────────────────────────────────────────────

export default function FacePanel({ config, status, resultData, onScan, onReset }: FacePanelProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const capturingRef  = useRef(false);
  const confirmTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cameras, setCameras]       = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');

  const {
    faceState,
    isReady,
    loadError,
    landmarks,        
    startDetection,
    stopDetection,
    captureEmbedding,
    retry,
  } = useFaceRecognition();

  // ── Enumerate cameras ──────────────────────────────────────────────────────
  // We need camera permission first, then enumerate so labels are available.
  useEffect(() => {
    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices
          .filter(d => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`,
          }));
        setCameras(videoDevices);

        // Default to front-facing if available, else first device
        if (!activeCameraId && videoDevices.length > 0) {
          const front = videoDevices.find(d =>
            d.label.toLowerCase().includes('front') ||
            d.label.toLowerCase().includes('selfie') ||
            d.label.toLowerCase().includes('facetime') ||
            d.label.toLowerCase().includes('user')
          );
          setActiveCameraId((front ?? videoDevices[0]).deviceId);
        }
      } catch {
        // ignore — will still work with default camera
      }
    };

    // Listen for device changes (e.g. USB camera plugged in)
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    enumerate();
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, []);

  // ── Start camera stream ────────────────────────────────────────────────────
  const startCamera = useCallback(async (deviceId?: string) => {
    // Stop existing stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 640 } }
        : { facingMode: 'user',            width: { ideal: 640 }, height: { ideal: 640 } },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // After getting permission, re-enumerate so labels appear
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      setCameras(videoDevices);

      // Track which camera is now active from the stream itself
      const activeTrack = stream.getVideoTracks()[0];
      const activeSettings = activeTrack?.getSettings();
      if (activeSettings?.deviceId) setActiveCameraId(activeSettings.deviceId);

    } catch (err) {
      console.error('[Face] Camera error:', err);
    }
  }, []);

  // Initial camera start
  useEffect(() => {
    startCamera(activeCameraId || undefined);
    return () => {
      stopDetection();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  // Switch camera when selection changes (skip on initial mount — handled above)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (activeCameraId) startCamera(activeCameraId);
  }, [activeCameraId]);

  // ── Auto-capture when face is 'ready' for 600ms ────────────────────────────
  useEffect(() => {
    if (faceState !== 'ready' || capturingRef.current || status !== 'idle') return;

    confirmTimer.current = setTimeout(async () => {
      if (!videoRef.current || capturingRef.current || status !== 'idle') return;
      capturingRef.current = true;

      const embedding = await captureEmbedding(videoRef.current);
      if (embedding) await onScan({ faceEmbedding: embedding });
      capturingRef.current = false;
    }, 600);

    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
  }, [faceState, status]);

  // Reset capture flag when scan resets
  useEffect(() => {
    if (status === 'idle') capturingRef.current = false;
  }, [status]);

  const showResult = status !== 'idle' && status !== 'scanning';

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-4">

      {/* Camera selector — shown above the viewfinder */}
      {cameras.length > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/20">Camera</span>
          <CameraSelector
            devices={cameras}
            activeId={activeCameraId}
            onChange={setActiveCameraId}
          />
        </div>
      )}

      <div className="relative">
        <FaceMarker
          videoRef={videoRef}
          faceState={status === 'scanning' ? 'capturing' : faceState}
          isReady={isReady}
          loadError={loadError}
          onRetry={retry}
          onStartDetection={startDetection}
          onStopDetection={stopDetection}
          landmarks={landmarks}  // ← pass live landmarks for drawing
        />
        {showResult && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <ResultDisplay status={status} data={resultData} />
          </div>
        )}
      </div>

      {!showResult && (
        <FaceHintBar faceState={status === 'scanning' ? 'capturing' : faceState} />
      )}

      {showResult && (
        <ScanAgainButton onClick={onReset} />
      )}
    </div>
  );
}