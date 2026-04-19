/**
 * Manages webcam access via getUserMedia.
 */
export class WebcamManager {
  constructor() {
    this.video = null;
    this.stream = null;
    this.ready = false;
  }

  /**
   * Request webcam access and set up video element.
   * @returns {Promise<HTMLVideoElement>}
   */
  async init() {
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('autoplay', '');
    this.video.style.display = 'none';
    document.body.appendChild(this.video);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      this.video.srcObject = this.stream;
      await this.video.play();
      this.ready = true;
      return this.video;
    } catch (err) {
      console.warn('Webcam access denied or unavailable:', err.message);
      this.ready = false;
      return null;
    }
  }

  dispose() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.video && this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }
    this.ready = false;
  }
}
