export class AudioRecorder {
  constructor(maxDurationSec = 15) {
    this.maxDurationSec = maxDurationSec;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.timerInterval = null;
    this.startTime = 0;
    this.onProgress = null;
  }

  async start(onProgress) {
    if (this.isRecording) return;
    this.onProgress = onProgress;
    this.audioChunks = [];

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? { mimeType: 'audio/webm;codecs=opus' }
      : {};

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = () => {
        clearInterval(this.timerInterval);
        this.isRecording = false;
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }

        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        resolve(audioBlob);
      };

      this.mediaRecorder.onerror = (err) => {
        clearInterval(this.timerInterval);
        this.isRecording = false;
        reject(err);
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.startTime = Date.now();

      this.timerInterval = setInterval(() => {
        const elapsed = (Date.now() - this.startTime) / 1000;
        if (this.onProgress) {
          this.onProgress(elapsed, this.maxDurationSec);
        }
        if (elapsed >= this.maxDurationSec) {
          this.stop();
        }
      }, 100);
    });
  }

  stop() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }

  async handleFileUpload(file) {
    if (!file) return null;
    return file;
  }
}
