'use client';
import { useEffect, useRef } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import type { FaceState } from '../../lib/useFaceRecognition';

// ─── Hint text for each face state ───────────────────────────────────────────

const HINTS: Record<FaceState, string> = {
  loading:    'Loading face models...',
  no_face:    'No face detected — look at the camera',
  too_far:    'Move closer to the camera',
  too_close:  'Move further back',
  off_center: 'Centre your face in the frame',
  ready:      'Hold still...',
  capturing:  'Capturing...',
  error:      'Face recognition unavailable',
};

// ─── Landmark indices (face-api.js 68-point model) ───────────────────────────
// These are the standard 68-point facial landmark indices:
//   Jaw:        0–16
//   R.Eyebrow: 17–21   L.Eyebrow: 22–26
//   Nose:      27–35
//   R.Eye:     36–41   L.Eye:     42–47
//   Mouth:     48–67

const LANDMARK_GROUPS = {
  rightEye:  [36, 37, 38, 39, 40, 41],
  leftEye:   [42, 43, 44, 45, 46, 47],
  nose:      [27, 28, 29, 30, 31, 32, 33, 34, 35],
  outerMouth:[48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
  innerMouth:[60, 61, 62, 63, 64, 65, 66, 67],
  rightEar:  [0, 1, 2],   // jaw edge approximation for right ear
  leftEar:   [14, 15, 16], // jaw edge approximation for left ear
} as const;

// ─── Draw landmarks on canvas ─────────────────────────────────────────────────

function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  isGreen: boolean,
  timestamp: number,
) {
  if (!points || points.length < 68) return;

  const pulse = 0.7 + 0.3 * Math.sin(timestamp / 400); // breathing pulse

  // ── Helper: draw a filled circle ──────────────────────────────────────────
  const dot = (x: number, y: number, r: number, alpha = 1) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── Helper: draw a smooth polygon outline ─────────────────────────────────
  const outline = (indices: readonly number[], close = true) => {
    if (indices.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(points[indices[0]].x, points[indices[0]].y);
    for (let i = 1; i < indices.length; i++) {
      ctx.lineTo(points[indices[i]].x, points[indices[i]].y);
    }
    if (close) ctx.closePath();
    ctx.stroke();
  };

  // ── Helper: centroid of a group of indices ────────────────────────────────
  const centroid = (indices: readonly number[]) => {
    let sx = 0, sy = 0;
    indices.forEach(i => { sx += points[i].x; sy += points[i].y; });
    return { x: sx / indices.length, y: sy / indices.length };
  };

  // ── Helper: bounding radius of a group ────────────────────────────────────
  const radius = (indices: readonly number[], cx: number, cy: number) => {
    let maxR = 0;
    indices.forEach(i => {
      const dx = points[i].x - cx;
      const dy = points[i].y - cy;
      maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy));
    });
    return maxR;
  };

  const color      = isGreen ? '52,211,153'  : '255,255,255';
  const accentColor= isGreen ? '110,231,183' : '200,200,200';

  // ─── Eyes ─────────────────────────────────────────────────────────────────
  for (const eyeIndices of [LANDMARK_GROUPS.rightEye, LANDMARK_GROUPS.leftEye]) {
    const c = centroid(eyeIndices);
    const r = radius(eyeIndices, c.x, c.y);

    // Outer glow ring
    ctx.strokeStyle = `rgba(${color},${0.15 * pulse})`;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Main eye circle
    ctx.strokeStyle = `rgba(${color},${0.7 * pulse})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r + 1, 0, Math.PI * 2);
    ctx.stroke();

    // Iris dot
    ctx.fillStyle = `rgba(${accentColor},${0.9})`;
    dot(c.x, c.y, 2.5 * pulse);

    // Corner dots
    ctx.fillStyle = `rgba(${color},0.6)`;
    eyeIndices.forEach(i => dot(points[i].x, points[i].y, 1.2));
  }

  // ─── Nose ─────────────────────────────────────────────────────────────────
  const noseTip    = points[30];
  const noseBase   = [31, 32, 33, 34, 35] as const;

  // Nose bridge line
  ctx.strokeStyle = `rgba(${color},0.3)`;
  ctx.lineWidth   = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(points[27].x, points[27].y);
  ctx.lineTo(noseTip.x, noseTip.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Nose tip circle
  ctx.strokeStyle = `rgba(${color},${0.6 * pulse})`;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(noseTip.x, noseTip.y, 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(${accentColor},0.8)`;
  dot(noseTip.x, noseTip.y, 2);

  // Nostril dots
  ctx.fillStyle = `rgba(${color},0.5)`;
  noseBase.forEach(i => dot(points[i].x, points[i].y, 1.5));

  // ─── Mouth ────────────────────────────────────────────────────────────────
  const mouthOuter = LANDMARK_GROUPS.outerMouth;
  const mouthInner = LANDMARK_GROUPS.innerMouth;

  // Calculate mouth openness (vertical span of inner mouth)
  const innerTop    = points[62]; // top of inner mouth
  const innerBottom = points[66]; // bottom of inner mouth
  const mouthOpen   = innerBottom && innerTop
    ? Math.max(0, innerBottom.y - innerTop.y)
    : 0;

  // Outer lip outline
  ctx.strokeStyle = `rgba(${color},${0.55 * pulse})`;
  ctx.lineWidth   = 1.5;
  outline(mouthOuter, true);

  // Inner mouth — filled more when open
  const innerAlpha = Math.min(0.6, 0.1 + mouthOpen * 0.04);
  ctx.fillStyle   = `rgba(${color},${innerAlpha})`;
  ctx.beginPath();
  ctx.moveTo(points[mouthInner[0]].x, points[mouthInner[0]].y);
  mouthInner.forEach(i => ctx.lineTo(points[i].x, points[i].y));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(${color},0.4)`;
  ctx.lineWidth   = 1;
  outline(mouthInner, true);

  // Corner accent dots
  ctx.fillStyle = `rgba(${accentColor},0.9)`;
  dot(points[48].x, points[48].y, 2.5); // left corner
  dot(points[54].x, points[54].y, 2.5); // right corner

  // ─── Ears (jaw-edge approximation) ────────────────────────────────────────
  for (const earIndices of [LANDMARK_GROUPS.rightEar, LANDMARK_GROUPS.leftEar]) {
    const c = centroid(earIndices);
    ctx.fillStyle   = `rgba(${color},0.35)`;
    dot(c.x, c.y, 3 * pulse);
    earIndices.forEach(i => {
      ctx.fillStyle = `rgba(${color},0.2)`;
      dot(points[i].x, points[i].y, 1.5);
    });
  }

  // ─── Connective lines (eye → ear, nose → mouth) ───────────────────────────
  ctx.strokeStyle = `rgba(${color},0.1)`;
  ctx.lineWidth   = 0.8;
  ctx.setLineDash([1, 4]);

  // Right eye → right ear
  const rEyeC = centroid(LANDMARK_GROUPS.rightEye);
  const rEarC = centroid(LANDMARK_GROUPS.rightEar);
  ctx.beginPath(); ctx.moveTo(rEyeC.x, rEyeC.y); ctx.lineTo(rEarC.x, rEarC.y); ctx.stroke();

  // Left eye → left ear
  const lEyeC = centroid(LANDMARK_GROUPS.leftEye);
  const lEarC = centroid(LANDMARK_GROUPS.leftEar);
  ctx.beginPath(); ctx.moveTo(lEyeC.x, lEyeC.y); ctx.lineTo(lEarC.x, lEarC.y); ctx.stroke();

  // Nose → mouth
  const mouthC = centroid(mouthOuter);
  ctx.beginPath(); ctx.moveTo(noseTip.x, noseTip.y); ctx.lineTo(mouthC.x, mouthC.y); ctx.stroke();

  ctx.setLineDash([]);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FaceMarkerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  faceState: FaceState;
  isReady: boolean;
  loadError: string | null;
  onRetry: () => void;
  onStartDetection: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => void;
  onStopDetection: () => void;
  /** Raw 68-point landmarks from face-api.js detection result */
  landmarks?: { x: number; y: number }[];
}

// ─── FaceMarker ───────────────────────────────────────────────────────────────

export default function FaceMarker({
  videoRef,
  faceState,
  isReady,
  loadError,
  onRetry,
  onStartDetection,
  onStopDetection,
  landmarks,
}: FaceMarkerProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number | null>(null);

  // Start/stop detection when models become ready
  useEffect(() => {
    if (!isReady || !videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;

    const tryStart = () => {
      if (video.videoWidth > 0) {
        onStartDetection(video, canvas);
      } else {
        video.addEventListener('loadedmetadata', () => onStartDetection(video, canvas), { once: true });
      }
    };
    tryStart();

    return () => onStopDetection();
  }, [isReady]);

  // ── Landmark animation loop ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const isGreen = faceState === 'ready' || faceState === 'capturing';

    const render = (timestamp: number) => {
      const w = video.videoWidth  || canvas.offsetWidth;
      const h = video.videoHeight || canvas.offsetHeight;

      if (canvas.width !== w)  canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      if (landmarks && landmarks.length >= 68 && isReady && faceState !== 'error' && faceState !== 'loading') {
        // Mirror the x-coordinates to match the CSS scale-x-[-1] on both video and canvas
        const mirrored = landmarks.map(p => ({ x: w - p.x, y: p.y }));
        drawLandmarks(ctx, mirrored, isGreen, timestamp);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [landmarks, faceState, isReady]);

  const isGreen = faceState === 'ready' || faceState === 'capturing';

  return (
    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#0a0a0a] border border-white/[0.06]">

      {/* Camera feed — mirrored for natural selfie UX */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        muted
        playsInline
        autoPlay
      />

      {/*
        Landmark canvas — NOT mirrored here since we mirror the point
        coordinates manually in drawLandmarks to match the video flip.
      */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Loading overlay */}
      {faceState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
          <Loader2 size={28} className="text-brand-400 animate-spin" />
          <p className="text-sm text-white/60">Loading face models...</p>
          <p className="text-xs text-white/30">~6MB · one-time load</p>
        </div>
      )}

      {/* Error overlay */}
      {faceState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 p-6">
          <XCircle size={28} className="text-red-400" />
          <p className="text-sm text-white/60 text-center">
            {loadError ?? 'Failed to load face models'}
          </p>
          <p className="text-xs text-white/30 text-center">
            Make sure model files are in{' '}
            <code className="text-white/50">nextjs-app/public/models/</code>
          </p>
          <button
            onClick={onRetry}
            className="mt-1 text-xs text-brand-400 hover:text-brand-300 underline underline-offset-2 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Face guide ring */}
      {isReady && faceState !== 'error' && faceState !== 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-44 h-44 rounded-full border-2 transition-all duration-300 ${
              isGreen
                ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.25)]'
                : 'border-white/20'
            }`}
          >
            {isGreen && (
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/20 animate-ping" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FaceHintBar ──────────────────────────────────────────────────────────────

export function FaceHintBar({ faceState }: { faceState: FaceState }) {
  const isGreen = faceState === 'ready' || faceState === 'capturing';

  return (
    <div
      className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border transition-all duration-300 ${
        isGreen
          ? 'border-emerald-400/30 bg-emerald-400/5'
          : 'border-white/[0.06] bg-[#141414]'
      }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300 ${
          isGreen ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'
        }`}
      />
      <p
        className={`text-xs transition-colors duration-300 ${
          isGreen ? 'text-emerald-400' : 'text-white/40'
        }`}
      >
        {HINTS[faceState]}
      </p>
    </div>
  );
}