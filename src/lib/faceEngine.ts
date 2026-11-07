/**
 * AI Biometric Engine — 100% Client-Side Face Recognition
 * Uses face-api.js with locally bundled models in /public/models/
 * No external CDN dependency. No server load.
 *
 * Models bundled at build time:
 *   - TinyFaceDetector   (~192KB) — fast face detection
 *   - FaceLandmark68Net  (~352KB) — 68-point landmark alignment
 *   - FaceRecognitionNet (~6MB)   — 128-D identity embedding
 */

import type * as FaceApiType from 'face-api.js';

let faceapi: typeof FaceApiType | null = null;
let loadPromise: Promise<typeof FaceApiType> | null = null;

const MODEL_PATH = '/models';

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
      onProgress?.(10, 'Initializing AI Neural Engine...');

      // Dynamic import — only runs in browser
      const fa = await import('face-api.js');
      faceapi = fa;

      onProgress?.(20, 'Loading Face Detection Model...');
      await fa.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);

      onProgress?.(50, 'Loading Facial Landmark Model...');
      await fa.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);

      onProgress?.(75, 'Loading Biometric Recognition Model...');
      await fa.nets.faceRecognitionNet.loadFromUri(MODEL_PATH);

      onProgress?.(95, 'Calibrating Neural Vectors...');
      // Small pause to let UI update smoothly
      await new Promise(r => setTimeout(r, 80));

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
 * Returns null if no face is found.
 */
export async function detectFaceEmbedding(
  video: HTMLVideoElement
): Promise<Float32Array | null> {
  if (!faceapi) throw new Error('Face engine not loaded. Call loadFaceEngine first.');

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });

  const detection = await faceapi
    .detectSingleFace(video, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) return null;
  return detection.descriptor;
}

/**
 * Computes cosine similarity between two embedding vectors.
 * Returns a value in [0, 1] — higher means more similar.
 */
export function cosineSimilarity(
  a: number[] | Float32Array,
  b: number[] | Float32Array
): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Euclidean distance between two embedding vectors (face-api.js native metric).
 * Values < 0.6 indicate the same person with high confidence.
 */
export function euclideanDistance(
  a: number[] | Float32Array,
  b: number[] | Float32Array
): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Matches a live face embedding against a stored multi-angle descriptor.
 * storedDescriptor can be:
 *   - number[][] — array of per-angle 128-D vectors (multi-angle registration)
 *   - number[]   — single 128-D vector (legacy)
 *   - Float32Array — single vector
 *
 * Returns { isMatch, confidence (0–99) }
 * Threshold: euclidean distance < 0.52 → same person
 */
export function matchFaceDescriptor(
  detectedEmbedding: number[] | Float32Array,
  storedDescriptor: any,
  threshold: number = 0.52
): { isMatch: boolean; confidence: number } {
  if (!detectedEmbedding || !storedDescriptor) return { isMatch: false, confidence: 0 };

  let minDist = Infinity;

  if (Array.isArray(storedDescriptor) && Array.isArray(storedDescriptor[0])) {
    // Multi-angle: pick the best matching angle
    for (const angleVec of storedDescriptor) {
      const d = euclideanDistance(detectedEmbedding, angleVec);
      if (d < minDist) minDist = d;
    }
  } else {
    minDist = euclideanDistance(detectedEmbedding, storedDescriptor);
  }

  const isMatch = minDist < threshold;
  // Map distance [0.0 → 99%, 0.52 → 0%] to confidence score
  const confidence = Math.max(0, Math.min(99, Math.round((1 - minDist / threshold) * 99)));

  return { isMatch, confidence };
}

export function isFaceEngineLoaded(): boolean {
  return !!(
    faceapi &&
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  );
}
