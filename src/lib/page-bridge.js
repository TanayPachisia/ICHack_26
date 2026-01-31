// ADHD Reader - Page Context Helper
// This script runs in the page's main world to bridge WebGazer

(function() {
  'use strict';
  
  // Check if WebGazer is ready
  function checkWebGazerReady() {
    let attempts = 0;
    const maxAttempts = 50;
    
    function check() {
      attempts++;
      if (typeof webgazer !== 'undefined' && webgazer.begin) {
        window.postMessage({ type: 'ADHD_WEBGAZER_READY' }, '*');
      } else if (attempts < maxAttempts) {
        setTimeout(check, 100);
      } else {
        window.postMessage({ type: 'ADHD_WEBGAZER_FAILED' }, '*');
      }
    }
    
    check();
  }
  
  // Start tracking
  function startTracking() {
    if (typeof webgazer === 'undefined') {
      window.postMessage({ type: 'ADHD_TRACKING_ERROR', error: 'WebGazer not found' }, '*');
      return;
    }
    
    try {
      // Using default TFFacemesh tracker - CDN version has MediaPipe assets properly hosted
      webgazer
        .setRegression('ridge')
        .showVideoPreview(true)  // Show video preview for user feedback
        .showPredictionPoints(true)  // Show where user is looking
        .applyKalmanFilter(true)
        .begin()
        .then(() => {
          window.postMessage({ type: 'ADHD_TRACKING_STARTED' }, '*');
          
          webgazer.setGazeListener((data, timestamp) => {
            if (data) {
              window.postMessage({ 
                type: 'ADHD_GAZE_UPDATE', 
                x: data.x, 
                y: data.y,
                timestamp: timestamp 
              }, '*');
            }
          });
        })
        .catch((err) => {
          window.postMessage({ type: 'ADHD_TRACKING_ERROR', error: err.message || String(err) }, '*');
        });
    } catch (err) {
      window.postMessage({ type: 'ADHD_TRACKING_ERROR', error: err.message || String(err) }, '*');
    }
  }
  
  // Stop tracking
  function stopTracking() {
    if (typeof webgazer !== 'undefined') {
      webgazer.pause();
      window.postMessage({ type: 'ADHD_TRACKING_STOPPED' }, '*');
    }
  }
  
  // Listen for commands from content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    switch (event.data.type) {
      case 'ADHD_CHECK_WEBGAZER':
        checkWebGazerReady();
        break;
      case 'ADHD_START_TRACKING':
        startTracking();
        break;
      case 'ADHD_STOP_TRACKING':
        stopTracking();
        break;
    }
  });
  
  // Auto-check when loaded after webgazer
  if (typeof webgazer !== 'undefined') {
    window.postMessage({ type: 'ADHD_WEBGAZER_READY' }, '*');
  }
})();
