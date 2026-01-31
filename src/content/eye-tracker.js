// ADHD Reader - Eye Tracker Module
// Handles WebGazer.js integration and gaze processing

class EyeTracker {
  constructor() {
    this.webgazer = null;
    this.isCalibrated = false;
    this.isTracking = false;
    this.gazeHistory = [];
    this.historySize = 5;
    this.onGazeUpdate = null;
    this.calibrationPoints = [];
    this.currentCalibrationIndex = 0;
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Inject WebGazer script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/lib/webgazer.min.js');
      script.onload = () => {
        this.webgazer = window.webgazer;
        if (this.webgazer) {
          this.configureWebGazer();
          resolve(true);
        } else {
          reject(new Error('WebGazer failed to load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load WebGazer script'));
      document.head.appendChild(script);
    });
  }

  configureWebGazer() {
    this.webgazer
      .setRegression('ridge')
      .setTracker('TFFacemesh')
      .showVideoPreview(false)
      .showPredictionPoints(false)
      .applyKalmanFilter(true);
  }

  async startTracking() {
    if (!this.webgazer) {
      throw new Error('WebGazer not initialized');
    }

    try {
      await this.webgazer.begin();
      this.isTracking = true;

      this.webgazer.setGazeListener((data, timestamp) => {
        if (data) {
          const smoothedGaze = this.smoothGaze(data.x, data.y);
          if (this.onGazeUpdate) {
            this.onGazeUpdate(smoothedGaze, timestamp);
          }
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to start eye tracking:', error);
      throw error;
    }
  }

  stopTracking() {
    if (this.webgazer && this.isTracking) {
      this.webgazer.pause();
      this.isTracking = false;
    }
  }

  resumeTracking() {
    if (this.webgazer && !this.isTracking) {
      this.webgazer.resume();
      this.isTracking = true;
    }
  }

  smoothGaze(x, y) {
    this.gazeHistory.push({ x, y });
    if (this.gazeHistory.length > this.historySize) {
      this.gazeHistory.shift();
    }

    const smoothed = this.gazeHistory.reduce(
      (acc, point, index) => {
        const weight = index + 1;
        acc.x += point.x * weight;
        acc.y += point.y * weight;
        acc.totalWeight += weight;
        return acc;
      },
      { x: 0, y: 0, totalWeight: 0 }
    );

    return {
      x: smoothed.x / smoothed.totalWeight,
      y: smoothed.y / smoothed.totalWeight
    };
  }

  getCalibrationPoints() {
    const padding = 50;
    const w = window.innerWidth;
    const h = window.innerHeight;

    return [
      { x: padding, y: padding },
      { x: w / 2, y: padding },
      { x: w - padding, y: padding },
      { x: padding, y: h / 2 },
      { x: w / 2, y: h / 2 },
      { x: w - padding, y: h / 2 },
      { x: padding, y: h - padding },
      { x: w / 2, y: h - padding },
      { x: w - padding, y: h - padding }
    ];
  }

  async startCalibration(onPointComplete, onCalibrationComplete) {
    this.calibrationPoints = this.getCalibrationPoints();
    this.currentCalibrationIndex = 0;

    const showNextPoint = () => {
      if (this.currentCalibrationIndex >= this.calibrationPoints.length) {
        this.isCalibrated = true;
        onCalibrationComplete();
        return;
      }

      const point = this.calibrationPoints[this.currentCalibrationIndex];
      onPointComplete(point, this.currentCalibrationIndex, this.calibrationPoints.length);
    };

    showNextPoint();

    return {
      clickPoint: () => {
        const point = this.calibrationPoints[this.currentCalibrationIndex];
        // Record calibration click
        if (this.webgazer) {
          this.webgazer.recordScreenPosition(point.x, point.y);
        }
        this.currentCalibrationIndex++;
        showNextPoint();
      },
      cancel: () => {
        this.currentCalibrationIndex = 0;
      }
    };
  }

  destroy() {
    if (this.webgazer) {
      this.webgazer.end();
      this.webgazer = null;
    }
    this.isTracking = false;
    this.isCalibrated = false;
  }
}

// Export for use in content script
window.ADHDReaderEyeTracker = EyeTracker;
