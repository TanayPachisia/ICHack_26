// ADHD Reader - Main Content Script
// All modules bundled inline to avoid isolated world issues

(function() {
  'use strict';

  // ============================================
  // TEXT ENHANCER MODULE
  // ============================================
  class TextEnhancer {
    constructor() {
      this.processedNodes = new WeakSet();
      this.originalContent = new WeakMap();
      this.bionicEnabled = false;
      this.fontFamily = 'default';
    }

    applyBionicReading(element, intensity = 0.4) {
      if (!element) return;

      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            
            const tagName = parent.tagName.toLowerCase();
            if (['script', 'style', 'noscript', 'code', 'pre', 'textarea', 'input'].includes(tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            
            if (parent.classList.contains('adhd-reader-bionic')) {
              return NodeFilter.FILTER_REJECT;
            }
            
            if (node.textContent.trim().length > 0) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }

      textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const parent = textNode.parentElement;
        
        if (!parent) return;

        const fragment = document.createDocumentFragment();
        const words = text.split(/(\s+)/);

        words.forEach(word => {
          if (/^\s+$/.test(word)) {
            fragment.appendChild(document.createTextNode(word));
            return;
          }

          if (word.length === 0) return;

          const boldLength = Math.max(1, Math.ceil(word.length * intensity));
          const boldPart = word.slice(0, boldLength);
          const normalPart = word.slice(boldLength);

          const span = document.createElement('span');
          span.className = 'adhd-reader-bionic';

          const boldSpan = document.createElement('span');
          boldSpan.className = 'adhd-reader-bionic-bold';
          boldSpan.textContent = boldPart;
          span.appendChild(boldSpan);

          if (normalPart) {
            span.appendChild(document.createTextNode(normalPart));
          }

          fragment.appendChild(span);
        });

        try {
          parent.replaceChild(fragment, textNode);
        } catch (e) {
          // Node may have been modified, skip
        }
      });

      this.bionicEnabled = true;
    }

    removeBionicReading(element) {
      if (!element) return;

      const bionicSpans = element.querySelectorAll('.adhd-reader-bionic');
      bionicSpans.forEach(span => {
        const text = span.textContent;
        span.replaceWith(document.createTextNode(text));
      });

      this.bionicEnabled = false;
    }

    applyTypography(settings) {
      const root = document.documentElement;
      
      if (settings.fontSize) {
        root.style.setProperty('--adhd-font-size', `${settings.fontSize}%`);
      }
      if (settings.lineHeight) {
        root.style.setProperty('--adhd-line-height', settings.lineHeight);
      }
      if (settings.letterSpacing !== undefined) {
        root.style.setProperty('--adhd-letter-spacing', `${settings.letterSpacing}px`);
      }
      if (settings.wordSpacing !== undefined) {
        root.style.setProperty('--adhd-word-spacing', `${settings.wordSpacing}px`);
      }

      const textElements = document.querySelectorAll('p, article, main, .content, .post, .article-body, .mw-parser-output');
      textElements.forEach(el => {
        el.classList.add('adhd-reader-enhanced-text');
      });
    }

    applyFont(fontFamily) {
      this.fontFamily = fontFamily;
      const textElements = document.querySelectorAll('body, p, article, main, .content, .post, .article-body, h1, h2, h3, h4, h5, h6, li, span, div');
      
      const fontClasses = ['adhd-reader-font-opendyslexic', 'adhd-reader-font-lexie', 'adhd-reader-font-comic'];
      textElements.forEach(el => {
        fontClasses.forEach(cls => el.classList.remove(cls));
      });

      if (fontFamily && fontFamily !== 'default') {
        const fontClass = `adhd-reader-font-${fontFamily}`;
        textElements.forEach(el => {
          el.classList.add(fontClass);
        });
      }
    }

    reset() {
      this.removeBionicReading(document.body);
      
      const enhancedElements = document.querySelectorAll('.adhd-reader-enhanced-text');
      enhancedElements.forEach(el => {
        el.classList.remove('adhd-reader-enhanced-text');
      });

      const fontClasses = ['adhd-reader-font-opendyslexic', 'adhd-reader-font-lexie', 'adhd-reader-font-comic'];
      document.querySelectorAll('[class*="adhd-reader-font"]').forEach(el => {
        fontClasses.forEach(cls => el.classList.remove(cls));
      });
    }
  }

  // ============================================
  // FOCUS OVERLAY MODULE
  // ============================================
  class FocusOverlay {
    constructor() {
      this.lineGuide = null;
      this.overlay = null;
      this.gazeIndicator = null;
      this.currentFocusElement = null;
      this.paragraphs = [];
      this.isActive = false;
      this.settings = {
        blurAmount: 3,
        highlightColor: 'rgba(255, 255, 150, 0.3)',
        lineGuide: true,
        overlayColor: 'cream',
        overlayOpacity: 0.15
      };
    }

    init() {
      this.createElements();
      this.scanForParagraphs();
    }

    createElements() {
      this.lineGuide = document.createElement('div');
      this.lineGuide.className = 'adhd-reader-line-guide';
      this.lineGuide.style.display = 'none';
      document.body.appendChild(this.lineGuide);

      this.gazeIndicator = document.createElement('div');
      this.gazeIndicator.className = 'adhd-reader-gaze-indicator';
      this.gazeIndicator.style.display = 'none';
      document.body.appendChild(this.gazeIndicator);
    }

    createOverlay(color = 'cream') {
      this.removeOverlay();
      this.overlay = document.createElement('div');
      this.overlay.className = `adhd-reader-overlay adhd-reader-overlay--${color}`;
      document.body.appendChild(this.overlay);
    }

    removeOverlay() {
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
    }

    scanForParagraphs() {
      const selectors = 'p, article, .content, .post-content, .article-body, .entry-content, main section, .text-block, .mw-parser-output > p';
      this.paragraphs = Array.from(document.querySelectorAll(selectors))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          const text = el.textContent.trim();
          return rect.height > 20 && text.length > 50;
        });
    }

    updateGazePosition(x, y, showIndicator = false) {
      if (showIndicator && this.gazeIndicator) {
        this.gazeIndicator.style.display = 'block';
        this.gazeIndicator.style.left = `${x}px`;
        this.gazeIndicator.style.top = `${y}px`;
      }

      if (this.lineGuide && this.settings.lineGuide) {
        this.lineGuide.style.display = 'block';
        this.lineGuide.style.top = `${y - 20}px`;
      }

      this.focusParagraphAtPosition(x, y);
    }

    focusParagraphAtPosition(x, y) {
      const scrollY = window.scrollY;
      const adjustedY = y + scrollY;

      let closestParagraph = null;
      let closestDistance = Infinity;

      this.paragraphs.forEach(p => {
        const rect = p.getBoundingClientRect();
        const elementY = rect.top + scrollY + rect.height / 2;
        const distance = Math.abs(elementY - adjustedY);

        if (distance < closestDistance && rect.top < window.innerHeight && rect.bottom > 0) {
          closestDistance = distance;
          closestParagraph = p;
        }
      });

      if (closestParagraph && closestParagraph !== this.currentFocusElement) {
        this.setFocusElement(closestParagraph);
      }
    }

    setFocusElement(element) {
      if (this.currentFocusElement) {
        this.currentFocusElement.classList.remove('adhd-reader-focus');
      }

      this.paragraphs.forEach(p => {
        p.classList.remove('adhd-reader-blur');
      });

      this.currentFocusElement = element;
      if (element) {
        element.classList.add('adhd-reader-focus');

        if (this.isActive) {
          this.paragraphs.forEach(p => {
            if (p !== element) {
              p.classList.add('adhd-reader-blur');
            }
          });
        }
      }
    }

    enableBlur() {
      this.isActive = true;
      this.scanForParagraphs();
      document.documentElement.style.setProperty(
        '--adhd-focus-blur',
        `${this.settings.blurAmount}px`
      );
      document.documentElement.style.setProperty(
        '--adhd-highlight-color',
        this.settings.highlightColor
      );
      // Set initial focus to first visible paragraph
      const firstVisible = this.paragraphs.find(p => {
        const rect = p.getBoundingClientRect();
        return rect.top >= 0 && rect.top < window.innerHeight;
      });
      if (firstVisible) {
        this.setFocusElement(firstVisible);
      }
    }

    disableBlur() {
      this.isActive = false;
      this.paragraphs.forEach(p => {
        p.classList.remove('adhd-reader-blur');
        p.classList.remove('adhd-reader-focus');
      });
    }

    showLineGuide(show = true) {
      if (this.lineGuide) {
        this.lineGuide.style.display = show ? 'block' : 'none';
      }
      this.settings.lineGuide = show;
    }

    hideGazeIndicator() {
      if (this.gazeIndicator) {
        this.gazeIndicator.style.display = 'none';
      }
    }

    updateSettings(newSettings) {
      this.settings = { ...this.settings, ...newSettings };
      
      document.documentElement.style.setProperty(
        '--adhd-focus-blur',
        `${this.settings.blurAmount}px`
      );
      document.documentElement.style.setProperty(
        '--adhd-highlight-color',
        this.settings.highlightColor
      );
    }

    destroy() {
      this.disableBlur();
      this.removeOverlay();
      
      if (this.lineGuide) {
        this.lineGuide.remove();
        this.lineGuide = null;
      }
      
      if (this.gazeIndicator) {
        this.gazeIndicator.remove();
        this.gazeIndicator = null;
      }
    }
  }

  // EYE TRACKER MODULE (WebGazer loaded via manifest content_scripts)
  // ============================================
  let webgazerReady = false;
  
  class EyeTracker {
    constructor() {
      this.isCalibrated = false;
      this.isTracking = false;
      this.gazeHistory = [];
      this.historySize = 5;
      this.onGazeUpdate = null;
    }

    async loadWebGazer() {
      // WebGazer is already loaded via manifest content_scripts
      if (typeof webgazer === 'undefined') {
        console.error('ADHD Reader: WebGazer not found - check manifest');
        throw new Error('WebGazer not loaded');
      }
      
      console.log('ADHD Reader: WebGazer already loaded via content script');
      webgazerReady = true;
      return true;
    }

    async startTracking() {
      if (!webgazerReady) {
        await this.loadWebGazer();
      }

      console.log('ADHD Reader: Starting gaze tracking...');
      
      try {
        await webgazer
          .setRegression('ridge')
          .showVideoPreview(true)  // Show video for debugging
          .showPredictionPoints(true)  // Show gaze point
          .applyKalmanFilter(true)
          .begin();
        
        console.log('ADHD Reader: Gaze tracking started successfully');
        this.isTracking = true;
        
        // Set up gaze listener
        webgazer.setGazeListener((data, timestamp) => {
          if (data && this.isTracking) {
            const smoothedGaze = this.smoothGaze(data.x, data.y);
            if (this.onGazeUpdate) {
              this.onGazeUpdate(smoothedGaze, timestamp);
            }
          }
        });
        
        return true;
      } catch (err) {
        console.error('ADHD Reader: Failed to start tracking:', err);
        throw err;
      }
    }

    stopTracking() {
      if (this.isTracking && typeof webgazer !== 'undefined') {
        webgazer.pause();
        this.isTracking = false;
        console.log('ADHD Reader: Gaze tracking stopped');
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
  }

  // ============================================
  // MAIN APPLICATION
  // ============================================
  
  // Module instances
  let eyeTracker = new EyeTracker();
  let textEnhancer = new TextEnhancer();
  let focusOverlay = new FocusOverlay();

  // State
  let settings = null;
  let isEnabled = true;
  let toolbar = null;

  // Initialize
  async function init() {
    console.log('ADHD Reader: Initializing...');
    
    // Get settings from background
    try {
      settings = await sendMessage({ type: 'GET_SETTINGS' });
    } catch (e) {
      console.log('ADHD Reader: Using default settings');
      settings = getDefaultSettings();
    }
    
    isEnabled = settings?.enabled ?? true;

    // Initialize focus overlay
    focusOverlay.init();

    // Create toolbar
    createToolbar();

    // Apply initial settings
    applySettings(settings);

    console.log('ADHD Reader: Initialized successfully');
  }

  function getDefaultSettings() {
    return {
      enabled: true,
      eyeTracking: { enabled: false, calibrated: false, sensitivity: 0.5 },
      focus: { blurAmount: 3, highlightColor: 'rgba(255, 255, 150, 0.3)', lineGuide: true },
      typography: { bionicReading: false, bionicIntensity: 0.4, fontFamily: 'default', fontSize: 100, lineHeight: 1.6, letterSpacing: 0, wordSpacing: 0 },
      overlay: { enabled: false, color: 'cream', opacity: 0.15 },
      accessibility: { reduceMotion: false, highContrast: false }
    };
  }

  // Apply settings
  function applySettings(s) {
    if (!s) return;
    settings = s;

    // Typography
    if (s.typography) {
      textEnhancer.applyTypography(s.typography);
      
      if (s.typography.bionicReading) {
        textEnhancer.applyBionicReading(document.body, s.typography.bionicIntensity);
      }

      if (s.typography.fontFamily && s.typography.fontFamily !== 'default') {
        textEnhancer.applyFont(s.typography.fontFamily);
      }
    }

    // Focus settings
    if (s.focus) {
      focusOverlay.updateSettings({
        blurAmount: s.focus.blurAmount,
        highlightColor: s.focus.highlightColor,
        lineGuide: s.focus.lineGuide
      });
    }

    // Overlay
    if (s.overlay?.enabled) {
      focusOverlay.createOverlay(s.overlay.color);
    } else {
      focusOverlay.removeOverlay();
    }

    // Accessibility
    if (s.accessibility?.reduceMotion) {
      document.body.classList.add('adhd-reader-reduce-motion');
    } else {
      document.body.classList.remove('adhd-reader-reduce-motion');
    }

    if (s.accessibility?.highContrast) {
      document.body.classList.add('adhd-reader-high-contrast');
    } else {
      document.body.classList.remove('adhd-reader-high-contrast');
    }

    // Update toolbar state
    updateToolbarState();
  }

  // Create floating toolbar
  function createToolbar() {
    if (document.querySelector('.adhd-reader-toolbar')) {
      toolbar = document.querySelector('.adhd-reader-toolbar');
      return;
    }

    toolbar = document.createElement('div');
    toolbar.className = 'adhd-reader-toolbar';
    toolbar.innerHTML = `
      <button class="adhd-reader-toolbar-btn" data-action="eye-tracking" title="Eye Tracking (E)">👁️</button>
      <button class="adhd-reader-toolbar-btn" data-action="bionic" title="Bionic Reading (B)">📖</button>
      <button class="adhd-reader-toolbar-btn" data-action="focus" title="Focus Mode (F)">🎯</button>
      <button class="adhd-reader-toolbar-btn" data-action="overlay" title="Color Overlay (O)">🎨</button>
      <button class="adhd-reader-toolbar-btn" data-action="line-guide" title="Line Guide (L)">📏</button>
    `;

    toolbar.addEventListener('click', handleToolbarClick);
    document.body.appendChild(toolbar);
    console.log('ADHD Reader: Toolbar created');
  }

  // Handle toolbar button clicks
  async function handleToolbarClick(e) {
    const btn = e.target.closest('.adhd-reader-toolbar-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    console.log('ADHD Reader: Action triggered:', action);

    switch (action) {
      case 'eye-tracking':
        await toggleEyeTracking();
        break;
      case 'bionic':
        toggleBionicReading();
        break;
      case 'focus':
        toggleFocusMode();
        break;
      case 'overlay':
        toggleOverlay();
        break;
      case 'line-guide':
        toggleLineGuide();
        break;
    }

    updateToolbarState();
    saveSettings();
  }

  // Toggle functions
  async function toggleEyeTracking() {
    if (!settings.eyeTracking) {
      settings.eyeTracking = { enabled: false };
    }

    if (!settings.eyeTracking.enabled) {
      try {
        console.log('ADHD Reader: Starting eye tracking...');
        await eyeTracker.loadWebGazer();
        await eyeTracker.startTracking();
        
        eyeTracker.onGazeUpdate = (gaze, timestamp) => {
          focusOverlay.updateGazePosition(gaze.x, gaze.y, true);
        };

        settings.eyeTracking.enabled = true;
        focusOverlay.enableBlur();
        console.log('ADHD Reader: Eye tracking started');
      } catch (error) {
        console.error('ADHD Reader: Failed to start eye tracking:', error);
        alert('Failed to start eye tracking. Please ensure camera access is allowed.');
      }
    } else {
      eyeTracker.stopTracking();
      settings.eyeTracking.enabled = false;
      focusOverlay.disableBlur();
      focusOverlay.hideGazeIndicator();
      console.log('ADHD Reader: Eye tracking stopped');
    }
  }

  function toggleBionicReading() {
    if (!settings.typography) {
      settings.typography = { bionicReading: false, bionicIntensity: 0.4 };
    }

    settings.typography.bionicReading = !settings.typography.bionicReading;
    console.log('ADHD Reader: Bionic reading:', settings.typography.bionicReading);
    
    if (settings.typography.bionicReading) {
      textEnhancer.applyBionicReading(document.body, settings.typography.bionicIntensity || 0.4);
    } else {
      textEnhancer.removeBionicReading(document.body);
    }
  }

  function toggleFocusMode() {
    console.log('ADHD Reader: Focus mode toggle, current:', focusOverlay.isActive);
    if (focusOverlay.isActive) {
      focusOverlay.disableBlur();
    } else {
      focusOverlay.enableBlur();
    }
  }

  function toggleOverlay() {
    if (!settings.overlay) {
      settings.overlay = { enabled: false, color: 'cream' };
    }

    settings.overlay.enabled = !settings.overlay.enabled;
    console.log('ADHD Reader: Overlay:', settings.overlay.enabled);
    
    if (settings.overlay.enabled) {
      focusOverlay.createOverlay(settings.overlay.color);
    } else {
      focusOverlay.removeOverlay();
    }
  }

  function toggleLineGuide() {
    if (!settings.focus) {
      settings.focus = { lineGuide: false };
    }

    settings.focus.lineGuide = !settings.focus.lineGuide;
    console.log('ADHD Reader: Line guide:', settings.focus.lineGuide);
    focusOverlay.showLineGuide(settings.focus.lineGuide);
  }

  // Update toolbar button states
  function updateToolbarState() {
    if (!toolbar) return;

    const buttons = toolbar.querySelectorAll('.adhd-reader-toolbar-btn');
    buttons.forEach(btn => {
      const action = btn.dataset.action;
      let isActive = false;

      switch (action) {
        case 'eye-tracking':
          isActive = settings?.eyeTracking?.enabled;
          break;
        case 'bionic':
          isActive = settings?.typography?.bionicReading;
          break;
        case 'focus':
          isActive = focusOverlay?.isActive;
          break;
        case 'overlay':
          isActive = settings?.overlay?.enabled;
          break;
        case 'line-guide':
          isActive = settings?.focus?.lineGuide;
          break;
      }

      btn.classList.toggle('active', !!isActive);
    });
  }

  // Save settings
  async function saveSettings() {
    try {
      await sendMessage({ type: 'UPDATE_SETTINGS', settings });
    } catch (e) {
      console.log('ADHD Reader: Could not save settings');
    }
  }

  // Message helpers
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendMessage) {
        reject(new Error('Chrome runtime not available'));
        return;
      }
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ADHD Reader: Received message:', message.type);
    switch (message.type) {
      case 'SETTINGS_UPDATED':
        applySettings(message.settings);
        break;
      case 'START_CALIBRATION':
        toggleEyeTracking();
        break;
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    
    switch (e.key.toLowerCase()) {
      case 'e':
        toggleEyeTracking();
        break;
      case 'b':
        toggleBionicReading();
        break;
      case 'f':
        toggleFocusMode();
        break;
      case 'o':
        toggleOverlay();
        break;
      case 'l':
        toggleLineGuide();
        break;
      default:
        return;
    }

    updateToolbarState();
    saveSettings();
  });

  // Mouse-based focus tracking (for users without eye tracking)
  let lastMouseUpdate = 0;
  document.addEventListener('mousemove', (e) => {
    const now = Date.now();
    // Throttle to 60fps
    if (now - lastMouseUpdate < 16) return;
    lastMouseUpdate = now;

    // Update line guide
    if (settings?.focus?.lineGuide && focusOverlay.lineGuide) {
      focusOverlay.lineGuide.style.display = 'block';
      focusOverlay.lineGuide.style.top = `${e.clientY - 20}px`;
    }

    // Update focus on paragraph when in focus mode (without eye tracking)
    if (focusOverlay.isActive && !settings?.eyeTracking?.enabled) {
      focusOverlay.focusParagraphAtPosition(e.clientX, e.clientY);
    }
  });

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
