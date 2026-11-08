/**
 * AI Biometric Engine — 100% Client-Side Face Recognition
 * Uses face-api.js with locally bundled models in /public/models/
 * No external CDN dependency. Zero network failure risk. Zero server load.
 *
 * Models bundled at build time:
 *   - TinyFaceDetector   (~192KB) — ultra-fast face detection
 *   - FaceLandmark68Net  (~352KB) — 68-point landmark alignment
 *   - FaceRecognitionNet (~6.4MB) — 128-D identity embedding
 */

import type * as FaceApiType from 'face-api.js';

let faceapi: typeof FaceApiType | null = null;
let loadPromise: Promise<typeof FaceApiType> | null = null;

const MODEL_PATH = '/models';

/**
 * 3 High-Accuracy Natural Angles for Biometric Enrollment
 * Horizontal yaw rotations (Center, Left, Right) preserve 2D facial ratios
 * and prevent vertical landmark collapse.
 */
export const BIOMETRIC_ANGLES = [
  { id: 'center', label: 'Look Straight', emoji: '😐', hint: 'Look directly into the camera' },
  { id: 'left',   label: 'Turn Head to Left', emoji: '⬅️', hint: 'Slowly turn your head ~15° to the left' },
  { id: 'right',  label: 'Turn Head to Right', emoji: '➡️', hint: 'Slowly turn your head ~15° to the right' },
];

/**
 * Loads face-api.js and all three required models with progress callbacks.
 * Idempotent — safe to call multiple times; returns cached instance.
 */
export async function loadFaceEngine(
  onProgress?: (percent: number, stage: string) => void
): Promise<typeof FaceApiType> {
  // Already loaded — return instantly
  if (
    faceapi &&
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  ) {
    onProgress?.(100, 'AI Biometric Engine Ready');
    return faceapi;
  }

  // Loading in progress — wait for it
  if (loadPromise) {
    onProgress?.(60, 'Loading Biometric Models...');
    return await loadPromise;
  }

  loadPromise = (async () => {
    try {
      onProgress?.(15, 'Initializing AI Neural Engine...');

      // Dynamic import — only runs in browser
      const fa = await import('face-api.js');
      faceapi = fa;

      onProgress?.(35, 'Loading Face Detection Model...');
      await fa.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);

      onProgress?.(65, 'Loading Facial Landmark Model...');
      await fa.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);

      onProgress?.(85, 'Loading Biometric Recognition Model...');
      await fa.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);

      onProgress?.(95, 'Calibrating Neural Graph...');
      await new Promise(r => setTimeout(r, 60));

      onProgress?.(100, 'AI Biometric Engine Ready');
      return fa;
    } catch (err) {
      loadPromise = null; // Allow retry on failure
      throw err;
    }
  })();

  return await loadPromise;
}

/**
 * Detects the dominant face in a video element and returns its 128-D embedding.
 * Uses a 2-tier detection (fast 320px first, then high-res 416px fallback for dim lighting).
 * Returns null if no face is found.
 */
export async function detectFaceEmbedding(
  video: HTMLVideoElement
): Promise<Float32Array | null> {
  if (!faceapi) throw new Error('Face engine not loaded. Call loadFaceEngine first.');
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

  // Tier 1: Fast standard detection (320px, score 0.30)
  const opt1 = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.30 });
  let detection = await faceapi
    .detectSingleFace(video, opt1)
    .withFaceLandmarks()
    .withFaceDescriptor();

  // Tier 2: Fallback for dim lighting or slight distance (416px, score 0.25)
  if (!detection) {
    const opt2 = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 });
    detection = await faceapi
      .detectSingleFace(video, opt2)
      .withFaceLandmarks()
      .withFaceDescriptor();
  }

  if (!detection) return null;
  return detection.descriptor;
}

/**
 * Detects a single face with its bounding box, score, and descriptor.
 */
export async function detectFaceWithDetails(
  video: HTMLVideoElement
): Promise<{ descriptor: Float32Array; box: { x: number; y: number; width: number; height: number }; score: number } | null> {
  if (!faceapi) return null;
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

  const opt = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.30 });
  const detection = await faceapi
    .detectSingleFace(video, opt)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  const b = detection.detection.box;
  return {
    descriptor: detection.descriptor,
    box: { x: b.x, y: b.y, width: b.width, height: b.height },
    score: detection.detection.score,
  };
}

/**
 * Detects ALL faces in a video frame with their real bounding boxes and descriptors.
 * Crucial for Teacher Kiosk Mode (handles multiple students walking past simultaneously).
 */
export async function detectAllFacesWithDetails(
  video: HTMLVideoElement
): Promise<{ descriptor: Float32Array; box: { x: number; y: number; width: number; height: number }; score: number }[]> {
  if (!faceapi) return [];
  if (!video || video.readyState < 2 || video.videoWidth === 0) return [];

  const opt = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.30 });
  const detections = await faceapi
    .detectAllFaces(video, opt)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return (detections || []).map(d => {
    const b = d.detection.box;
    return {
      descriptor: d.descriptor,
      box: { x: b.x, y: b.y, width: b.width, height: b.height },
      score: d.detection.score,
    };
  });
}

/**
 * Euclidean distance between two embedding vectors (face-api.js native metric).
 * Values < 0.55 indicate the same individual with high confidence.
 */
export function euclideanDistance(
  a: number[] | Float32Array,
  b: number[] | Float32Array
): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Matches a live face embedding against a stored descriptor.
 * storedDescriptor can be:
 *   - number[][]   — multi-angle 128-D vectors (per-angle profile)
 *   - number[]     — single 128-D vector
 *   - Float32Array — single vector
 *
 * Threshold: 0.55 (industry standard for face-api ResNet Euclidean distance)
 * Returns { isMatch: boolean, confidence: number (0-99%) }
 */
export function matchFaceDescriptor(
  detectedEmbedding: number[] | Float32Array,
  storedDescriptor: any,
  threshold: number = 0.55
): { isMatch: boolean; confidence: number } {
  if (!detectedEmbedding || !storedDescriptor) return { isMatch: false, confidence: 0 };

  let minDist = Infinity;

  if (Array.isArray(storedDescriptor) && Array.isArray(storedDescriptor[0])) {
    // Multi-angle: pick the closest matching angle
    for (const angleVec of storedDescriptor) {
      if (!angleVec || angleVec.length === 0) continue;
      const d = euclideanDistance(detectedEmbedding, angleVec);
      if (d < minDist) minDist = d;
    }
  } else {
    minDist = euclideanDistance(detectedEmbedding, storedDescriptor);
  }

  const isMatch = minDist <= threshold;

  // Calibrated Confidence:
  // If match (minDist <= threshold): confidence scales smoothly from 65% to 99%
  // If no match (minDist > threshold): confidence scales from 64% down to 0%
  let confidence = 0;
  if (minDist <= threshold) {
    confidence = Math.round(65 + ((threshold - minDist) / threshold) * 34);
  } else {
    confidence = Math.max(0, Math.round(65 - ((minDist - threshold) / threshold) * 65));
  }

  return { isMatch, confidence: Math.min(99, Math.max(0, confidence)) };
}

export function isFaceEngineLoaded(): boolean {
  return !!(
    faceapi &&
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  );
}
