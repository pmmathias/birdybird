import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Wraps MediaPipe PoseLandmarker for real-time pose detection.
 */
export class PoseDetector {
  constructor() {
    this.landmarker = null;
    this.lastResult = null;
    this.ready = false;
    this._lastTimestamp = -1;
  }

  /**
   * Initialize the PoseLandmarker.
   */
  async init() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      this.ready = true;
    } catch (err) {
      console.warn('PoseDetector init failed:', err.message);
      this.ready = false;
    }
  }

  /**
   * Process a video frame and return landmarks.
   * @param {HTMLVideoElement} video
   * @returns {Array|null} - array of 33 landmarks [{x,y,z,visibility}] or null
   */
  detect(video) {
    if (!this.ready || !this.landmarker) return null;

    const timestamp = performance.now();
    // Avoid processing same frame
    if (timestamp <= this._lastTimestamp) return this.lastResult;
    this._lastTimestamp = timestamp;

    try {
      const result = this.landmarker.detectForVideo(video, timestamp);
      if (result.landmarks && result.landmarks.length > 0) {
        this.lastResult = result.landmarks[0]; // first person's 33 landmarks
      } else {
        this.lastResult = null;
      }
    } catch (err) {
      // Silently handle detection errors
      this.lastResult = null;
    }

    return this.lastResult;
  }
}
