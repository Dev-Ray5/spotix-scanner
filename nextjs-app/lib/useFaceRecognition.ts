/**
 * Spotix Scanner — Professional Event Check-in System
 * Copyright © 2026 Spotix Technologies. All rights reserved.
 *
 * This source code is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without the express written
 * permission of Spotix Technologies.
 *
 * For licensing inquiries, contact: legal@spotix.com.ng
 */




'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FaceState =
  | 'loading'
  | 'no_face'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'ready'
  | 'capturing'
  | 'error';

export interface FacePoint {
  x: number;
  y: number;
}

export interface FaceRecognitionHook {
  faceState: FaceState;
  isReady: boolean;
  loadError: string | null;
  landmarks: FacePoint[] | undefined;
  startDetection: (video: HTMLVideoElement, canvas: HTMLCanvasElement) => void;
  stopDetection: () => void;
  captureEmbedding: (video: HTMLVideoElement) => Promise<number[] | null>;
  retry: () => void;
}

// ─── Module-level singletons (survive re-renders, shared across instances) ────

let faceapi: typeof import('@vladmandic/face-api') | null = null;
let modelsLoaded  = false;
let modelsLoading = false;

function getModelPath(): string {
  if (typeof window === 'undefined') return '/models';
  const { protocol, hostname, port } = window.location;
  if (protocol === 'file:') return 'http://127.0.0.1:3001/models';
  return `${protocol}//${hostname}:${port}/models`;
}

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) {
    while (modelsLoading) await new Promise(r => setTimeout(r, 50));
    return;
  }
  modelsLoading = true;
  try {
    faceapi = await import('@vladmandic/face-api');
    const modelPath = getModelPath();
    console.log(`[Face] Loading models from ${modelPath}`);
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
    ]);
    modelsLoaded = true;
    console.log('[Face] Models loaded ✓');
  } finally {
    modelsLoading = false;
  }
}

// ─── Face quality validation ──────────────────────────────────────────────────

function validateFace(
  box: { x: number; y: number; width: number; height: number },
  score: number,
  videoW: number,
  videoH: number,
): FaceState {
  if (score < 0.65) return 'no_face';
  const ratio = box.width / videoW;
  if (ratio < 0.18) return 'too_far';
  if (ratio > 0.80) return 'too_close';
  const cx = (box.x + box.width  / 2) / videoW;
  const cy = (box.y + box.height / 2) / videoH;
  if (Math.abs(cx - 0.5) > 0.22 || Math.abs(cy - 0.5) > 0.25) return 'off_center';
  return 'ready';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFaceRecognition(): FaceRecognitionHook {
  const [faceState, setFaceState] = useState<FaceState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<FacePoint[] | undefined>(undefined);

  const loopRef    = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load models on mount ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    setFaceState('loading');
    setLoadError(null);
    try {
      await loadModels();
      if (mountedRef.current) setFaceState('no_face');
    } catch (err: any) {
      console.error('[Face] Load error:', err);
      if (mountedRef.current) {
        setLoadError(err?.message ?? 'Failed to load face models');
        setFaceState('error');
      }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Stop detection loop ────────────────────────────────────────────────────
  const stopDetection = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  // ── Start real-time detection + canvas overlay ─────────────────────────────
  const startDetection = useCallback((
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
  ) => {
    if (!faceapi || !modelsLoaded) return;
    stopDetection();

    const ctx     = canvas.getContext('2d');
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize:      224,
      scoreThreshold: 0.5,
    });

    const loop = async () => {
      if (!mountedRef.current || !faceapi) return;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        loopRef.current = requestAnimationFrame(loop);
        return;
      }

      if (canvas.width !== video.videoWidth) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      try {
        const detection = await faceapi
          .detectSingleFace(video, options)
          .withFaceLandmarks(true);

        if (!mountedRef.current) return;
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detection) {
          setFaceState('no_face');
          setLandmarks(undefined);
          loopRef.current = requestAnimationFrame(loop);
          return;
        }

        const { box, score } = detection.detection;
        const state = validateFace(box, score, video.videoWidth, video.videoHeight);
        setFaceState(state);

        // ── Expose landmarks to consumers (e.g. FaceMarker drawing) ─────────
        setLandmarks(
          detection.landmarks.positions.map(pt => ({ x: pt.x, y: pt.y }))
        );

        // ── Draw bounding box + corner accents ───────────────────────────────
        // NOTE: if we decide in future to use the new FaceMarker landmark drawing, we can
        // remove the ctx drawing block below to avoid double-rendering.
        // The bounding box is kept here as a lightweight fallback.
        if (ctx) {
          const isGood = state === 'ready';
          const color  = isGood ? '#34d399' : '#f87171';
          const { x, y, width: w, height: h } = box;

          ctx.strokeStyle = color;
          ctx.lineWidth   = 2.5;
          ctx.strokeRect(x, y, w, h);

          const cs = 14;
          ctx.lineWidth = 4;
          [
            [x,     y,      1,  1],
            [x + w, y,     -1,  1],
            [x,     y + h,  1, -1],
            [x + w, y + h, -1, -1],
          ].forEach(([cx, cy, dx, dy]) => {
            ctx.beginPath();
            ctx.moveTo(cx as number, cy as number);
            ctx.lineTo((cx as number) + (dx as number) * cs, cy as number);
            ctx.moveTo(cx as number, cy as number);
            ctx.lineTo(cx as number, (cy as number) + (dy as number) * cs);
            ctx.stroke();
          });
        }
      } catch (err) {
        console.warn('[Face] Detection frame error:', err);
      }

      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);
  }, [stopDetection]);

  // ── Capture a 128-d embedding for the current video frame ─────────────────
  const captureEmbedding = useCallback(async (
    video: HTMLVideoElement,
  ): Promise<number[] | null> => {
    if (!faceapi || !modelsLoaded) return null;
    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize:      224,
        scoreThreshold: 0.5,
      });
      const detection = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        console.warn('[Face] No face detected during embedding capture');
        return null;
      }
      return Array.from(detection.descriptor);
    } catch (err) {
      console.error('[Face] Embedding capture error:', err);
      return null;
    }
  }, []);

  // ── Retry after error ──────────────────────────────────────────────────────
  const retry = useCallback(() => {
    modelsLoaded  = false;
    modelsLoading = false;
    faceapi       = null;
    load();
  }, [load]);

  return {
    faceState,
    isReady: modelsLoaded,
    loadError,
    landmarks,
    startDetection,
    stopDetection,
    captureEmbedding,
    retry,
  };
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

export const FACE_SIMILARITY_THRESHOLD = 0.72;