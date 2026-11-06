import * as faceapi from 'face-api.js';

let isModelLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadFaceModelsWithProgress(
  onProgress: (percent: number, statusText: string) => void
): Promise<void> {
  // If already loaded in memory, immediately report 100% and resolve
  if (
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded
  ) {
    onProgress(100, 'AI Neural Engine Ready');
    return;
  }

  if (loadPromise) {
    onProgress(75, 'Initializing Neural Graph...');
    await loadPromise;
    onProgress(100, 'AI Neural Engine Ready');
    return;
  }

  loadPromise = (async () => {
    try {
      onProgress(10, 'Initializing AI Neural Engine...');

      // Stage 1: Load Tiny Face Detector
      onProgress(20, 'Loading Face Detection Model...');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      onProgress(45, 'Configuring Spatial Bounding Graph...');

      // Stage 2: Load Face Landmarks
      onProgress(55, 'Loading Facial Feature Landmarks...');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      onProgress(75, 'Building Neural Facial Mesh...');

      // Stage 3: Load Recognition Model
      onProgress(85, 'Loading Biometric Feature Extractor...');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');

      // Stage 4: Warmup and finalize
      onProgress(95, 'Calibrating Biometric Verification...');
      await new Promise(r => setTimeout(r, 120));

      isModelLoaded = true;
      onProgress(100, 'AI Neural Engine Ready');
    } catch (err) {
      console.error('Failed to load AI face models:', err);
      loadPromise = null;
      throw err;
    }
  })();

  await loadPromise;
}

export function areModelsLoaded(): boolean {
  return isModelLoaded &&
    faceapi.nets.tinyFaceDetector.isLoaded &&
    faceapi.nets.faceLandmark68Net.isLoaded &&
    faceapi.nets.faceRecognitionNet.isLoaded;
}
