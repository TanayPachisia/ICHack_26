// ADHD Reader - Background Service Worker
// Handles extension lifecycle, messaging, and tab management

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  eyeTracking: {
    enabled: false,
    calibrated: false,
    sensitivity: 0.5
  },
  focus: {
    blurAmount: 3,
    highlightColor: 'rgba(255, 255, 150, 0.3)',
    lineGuide: true
  },
  typography: {
    bionicReading: false,
    bionicIntensity: 0.4,
    fontFamily: 'default',
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 0,
    wordSpacing: 0
  },
  overlay: {
    enabled: false,
    color: 'cream',
    opacity: 0.15
  },
  accessibility: {
    reduceMotion: false,
    highContrast: false
  }
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    console.log('ADHD Reader installed with default settings');
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      chrome.storage.sync.get(['settings'], (result) => {
        sendResponse(result.settings || DEFAULT_SETTINGS);
      });
      return true; // Keep channel open for async response

    case 'UPDATE_SETTINGS':
      chrome.storage.sync.set({ settings: message.settings }, () => {
        // Notify all tabs of settings change
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_UPDATED',
              settings: message.settings
            }).catch(() => {}); // Ignore errors for tabs without content script
          });
        });
        sendResponse({ success: true });
      });
      return true;

    case 'TOGGLE_EXTENSION':
      chrome.storage.sync.get(['settings'], (result) => {
        const settings = result.settings || DEFAULT_SETTINGS;
        settings.enabled = !settings.enabled;
        chrome.storage.sync.set({ settings }, () => {
          sendResponse({ enabled: settings.enabled });
        });
      });
      return true;

    case 'GET_SITE_SETTINGS':
      const hostname = new URL(sender.tab.url).hostname;
      chrome.storage.sync.get(['siteSettings'], (result) => {
        const siteSettings = result.siteSettings || {};
        sendResponse(siteSettings[hostname] || null);
      });
      return true;

    case 'SAVE_SITE_SETTINGS':
      const host = message.hostname;
      chrome.storage.sync.get(['siteSettings'], (result) => {
        const siteSettings = result.siteSettings || {};
        siteSettings[host] = message.settings;
        chrome.storage.sync.set({ siteSettings }, () => {
          sendResponse({ success: true });
        });
      });
      return true;

    case 'INJECT_WEBGAZER':
      // Use chrome.scripting API to inject scripts into MAIN world (bypasses CSP)
      const tabId = sender.tab.id;
      
      (async () => {
        try {
          // First inject WebGazer from CDN with MediaPipe path configuration
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
              return new Promise((resolve, reject) => {
                if (window.webgazer) {
                  resolve(true);
                  return;
                }
                
                // Configure MediaPipe to use CDN paths BEFORE loading WebGazer
                window.Module = window.Module || {};
                window.Module.locateFile = (path) => {
                  return 'https://webgazer.cs.brown.edu/' + path;
                };
                
                const script = document.createElement('script');
                script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
                script.onload = () => resolve(true);
                script.onerror = () => reject(new Error('Failed to load WebGazer'));
                document.head.appendChild(script);
              });
            }
          });
          
          // Then inject our bridge code
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: () => {
              // Wait for WebGazer to be ready
              let attempts = 0;
              const maxAttempts = 100; // More attempts for slower connections
              
              function checkAndNotify() {
                attempts++;
                if (typeof webgazer !== 'undefined' && webgazer.begin) {
                  window.postMessage({ type: 'ADHD_WEBGAZER_READY' }, '*');
                } else if (attempts < maxAttempts) {
                  setTimeout(checkAndNotify, 100);
                } else {
                  window.postMessage({ type: 'ADHD_WEBGAZER_FAILED' }, '*');
                }
              }
              
              // Set up message listener for tracking commands
              if (!window._adhdGazeListenerSet) {
                window._adhdGazeListenerSet = true;
                
                window.addEventListener('message', (event) => {
                  if (event.source !== window) return;
                  
                  if (event.data.type === 'ADHD_START_TRACKING') {
                    if (typeof webgazer === 'undefined') {
                      window.postMessage({ type: 'ADHD_TRACKING_ERROR', error: 'WebGazer not loaded' }, '*');
                      return;
                    }
                    
                    // Configure face mesh locator for CDN
                    try {
                      if (webgazer.params && webgazer.params.faceMeshConfig) {
                        webgazer.params.faceMeshConfig.locateFile = (file) => {
                          return 'https://webgazer.cs.brown.edu/' + file;
                        };
                      }
                    } catch (e) {
                      console.log('ADHD Reader: Could not set faceMeshConfig locator');
                    }
                    
                    webgazer
                      .setRegression('ridge')
                      .showVideoPreview(true)
                      .showPredictionPoints(true)
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
                  } else if (event.data.type === 'ADHD_STOP_TRACKING') {
                    if (typeof webgazer !== 'undefined') {
                      webgazer.pause();
                    }
                  }
                });
              }
              
              checkAndNotify();
            }
          });
          
          sendResponse({ success: true });
        } catch (error) {
          console.error('Failed to inject WebGazer:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    default:
      console.log('Unknown message type:', message.type);
  }
});

// Handle keyboard shortcuts
chrome.commands?.onCommand?.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'COMMAND', command });
    }
  });
});

console.log('ADHD Reader service worker started');
