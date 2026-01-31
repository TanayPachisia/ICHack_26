/**
 * ADHD Reader - Main Application
 * Coordinates PDF processing, eye tracking, and UI
 */

class ADHDReaderApp {
  constructor() {
    // Module instances
    this.pdfProcessor = new PDFProcessor();
    this.eyeTracker = new EyeTracker(); // Your existing class
    
    // State
    this.pdfLoaded = false;
    this.eyeTrackingActive = false;
    
    // UI elements
    this.uploadSection = document.getElementById('uploadSection');
    this.pdfViewerSection = document.getElementById('pdfViewerSection');
    this.headerControls = document.getElementById('headerControls');
    this.settingsPanel = document.getElementById('settingsPanel');
    this.gazeIndicator = document.getElementById('gazeIndicator');
    
    // Initialize
    this.initializeUI();
    this.initializeEyeTracker();
    
    console.log('ADHD Reader: Application initialized');
  }

  /**
   * Initialize all UI event listeners
   */
  initializeUI() {
    // PDF File Upload
    document.getElementById('pdfFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'application/pdf') {
        this.handlePDFUpload(file);
      } else {
        this.updateStatus('error', 'Please select a valid PDF file');
      }
    });

    // Eye Tracking Toggle
    document.getElementById('eyeTrackingBtn').addEventListener('click', () => {
      this.toggleEyeTracking();
    });

    // Settings Panel
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.settingsPanel.classList.add('open');
    });

    document.getElementById('closeSettingsBtn').addEventListener('click', () => {
      this.settingsPanel.classList.remove('open');
    });

    // Reset/New PDF
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.reset();
    });

    // Settings Controls
    this.initializeSettings();
  }

  /**
   * Initialize settings panel controls
   */
  initializeSettings() {
    // Focus Radius Slider
    const focusRadiusSlider = document.getElementById('focusRadiusSlider');
    const focusRadiusValue = document.getElementById('focusRadiusValue');
    
    focusRadiusSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      focusRadiusValue.textContent = `${value}px`;
      this.pdfProcessor.updateSettings({ focusRadius: value });
    });

    // Min Opacity Slider
    const minOpacitySlider = document.getElementById('minOpacitySlider');
    const minOpacityValue = document.getElementById('minOpacityValue');
    
    minOpacitySlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value) / 100;
      minOpacityValue.textContent = `${e.target.value}%`;
      this.pdfProcessor.updateSettings({ minOpacity: value });
    });

    // Falloff Type Select
    const falloffTypeSelect = document.getElementById('falloffTypeSelect');
    
    falloffTypeSelect.addEventListener('change', (e) => {
      this.pdfProcessor.updateSettings({ falloffType: e.target.value });
    });

    // Show Gaze Indicator Checkbox
    const showGazeIndicator = document.getElementById('showGazeIndicator');
    
    showGazeIndicator.addEventListener('change', (e) => {
      this.gazeIndicator.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  /**
   * Initialize eye tracker with callback
   */
  initializeEyeTracker() {
    // Set up gaze update callback
    this.eyeTracker.onGazeUpdate = (gazeData, timestamp) => {
      if (this.pdfLoaded && this.eyeTrackingActive) {
        // Update PDF text opacity
        this.pdfProcessor.updateTextOpacity(gazeData.x, gazeData.y);
        
        // Update gaze indicator position
        this.updateGazeIndicator(gazeData.x, gazeData.y);
      }
    };
  }

  /**
   * Handle PDF file upload
   */
  async handlePDFUpload(file) {
    this.updateStatus('loading', `Loading ${file.name}...`);
    
    try {
      // Load PDF using processor
      const result = await this.pdfProcessor.loadPDF(file);
      
      this.pdfLoaded = true;
      
      // Switch to viewer UI
      this.uploadSection.style.display = 'none';
      this.pdfViewerSection.style.display = 'block';
      this.headerControls.style.display = 'flex';
      
      this.updateStatus('success', `PDF loaded: ${result.fileName} (${result.totalPages} pages)`);
      
      console.log('ADHD Reader: PDF loaded successfully');
      
    } catch (error) {
      console.error('ADHD Reader: Failed to load PDF:', error);
      this.updateStatus('error', 'Failed to load PDF. Please try another file.');
    }
  }

  /**
   * Toggle eye tracking on/off
   */
  async toggleEyeTracking() {
    const btn = document.getElementById('eyeTrackingBtn');
    
    if (!this.eyeTrackingActive) {
      // Start eye tracking
      this.updateStatus('loading', 'Initializing eye tracking...');
      
      try {
        await this.eyeTracker.init();
        await this.eyeTracker.startTracking();
        
        this.eyeTrackingActive = true;
        btn.classList.add('active');
        btn.querySelector('.label').textContent = 'Stop Eye Tracking';
        
        this.updateStatus('success', 'Eye tracking active - Look around the document');
        
        console.log('ADHD Reader: Eye tracking started');
        
      } catch (error) {
        console.error('ADHD Reader: Failed to start eye tracking:', error);
        this.updateStatus('error', 'Failed to start eye tracking. Allow camera access.');
        alert('Camera access required for eye tracking.\n\nPlease allow camera permission and try again.');
      }
      
    } else {
      // Stop eye tracking
      this.eyeTracker.stopTracking();
      this.pdfProcessor.resetOpacity();
      
      this.eyeTrackingActive = false;
      btn.classList.remove('active');
      btn.querySelector('.label').textContent = 'Start Eye Tracking';
      
      this.updateStatus('idle', 'Eye tracking stopped');
      
      console.log('ADHD Reader: Eye tracking stopped');
    }
  }

  /**
   * Update gaze indicator visual position
   */
  updateGazeIndicator(x, y) {
    if (this.gazeIndicator.style.display !== 'none') {
      this.gazeIndicator.style.left = `${x}px`;
      this.gazeIndicator.style.top = `${y}px`;
    }
  }

  /**
   * Update status bar
   * @param {string} type - 'idle', 'loading', 'success', 'error'
   * @param {string} message - Status message
   */
  updateStatus(type, message) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    // Update indicator color
    const indicators = {
      idle: '⚪',
      loading: '🟡',
      success: '🟢',
      error: '🔴'
    };
    
    indicator.textContent = indicators[type] || '⚪';
    statusText.textContent = message;
  }

  /**
   * Reset application to initial state
   */
  reset() {
    // Stop eye tracking if active
    if (this.eyeTrackingActive) {
      this.eyeTracker.stopTracking();
      this.eyeTrackingActive = false;
    }
    
    // Clean up PDF
    this.pdfProcessor.destroy();
    this.pdfLoaded = false;
    
    // Reset UI
    this.uploadSection.style.display = 'flex';
    this.pdfViewerSection.style.display = 'none';
    this.headerControls.style.display = 'none';
    this.settingsPanel.classList.remove('open');
    
    // Clear file input
    document.getElementById('pdfFileInput').value = '';
    
    this.updateStatus('idle', 'Ready to upload PDF');
    
    console.log('ADHD Reader: Application reset');
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new ADHDReaderApp();
  });
} else {
  window.app = new ADHDReaderApp();
}
