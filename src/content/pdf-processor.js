/**
 * ADHD Reader - PDF Processor
 * Handles PDF upload, text extraction, rendering, and opacity management
 */

class PDFProcessor {
  constructor() {
    // PDF.js setup
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    // PDF document state
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    
    // Canvas elements
    this.canvas = document.getElementById('pdfCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.textLayer = document.getElementById('textLayer');
    
    // Text elements for opacity control
    this.textElements = [];
    
    // Opacity settings
    this.focusRadius = 200;        // pixels
    this.minOpacity = 0.15;        // 15% minimum visibility
    this.maxOpacity = 1.0;         // 100% at focus
    this.falloffType = 'gaussian'; // 'gaussian' or 'linear'
    
    // Performance optimization
    this.updateThrottleMs = 16;    // ~60fps
    this.lastUpdateTime = 0;
  }

  /**
   * Load PDF from file input
   * @param {File} file - PDF file from input
   */
  async loadPDF(file) {
    console.log('PDF Processor: Loading PDF file...', file.name);
    
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await this._readFileAsArrayBuffer(file);
      
      // Load PDF document using PDF.js
      this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      this.totalPages = this.pdfDoc.numPages;
      
      console.log(`PDF Processor: Loaded ${this.totalPages} pages`);
      
      // Render first page
      await this.renderPage(1);
      
      return {
        success: true,
        totalPages: this.totalPages,
        fileName: file.name
      };
      
    } catch (error) {
      console.error('PDF Processor: Error loading PDF:', error);
      throw new Error(`Failed to load PDF: ${error.message}`);
    }
  }

  /**
   * Read file as ArrayBuffer (helper method)
   * @private
   */
  _readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Render a specific page of the PDF
   * @param {number} pageNumber - Page to render (1-indexed)
   */
  async renderPage(pageNumber) {
    if (!this.pdfDoc || pageNumber < 1 || pageNumber > this.totalPages) {
      console.error('PDF Processor: Invalid page number', pageNumber);
      return;
    }

    console.log(`PDF Processor: Rendering page ${pageNumber}...`);
    this.currentPage = pageNumber;

    try {
      // Get page from PDF
      const page = await this.pdfDoc.getPage(pageNumber);
      
      // Calculate scale for good quality (1.5 = 150% of original size)
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      // Set canvas dimensions
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      
      // Set text layer dimensions to match
      this.textLayer.style.width = `${viewport.width}px`;
      this.textLayer.style.height = `${viewport.height}px`;
      
      // Render PDF page to canvas (background)
      const renderContext = {
        canvasContext: this.ctx,
        viewport: viewport
      };
      await page.render(renderContext).promise;
      
      console.log('PDF Processor: Page rendered to canvas');
      
      // Extract and render text layer (for opacity control)
      await this.extractTextLayer(page, viewport);
      
      console.log(`PDF Processor: Extracted ${this.textElements.length} text elements`);
      
    } catch (error) {
      console.error('PDF Processor: Error rendering page:', error);
      throw error;
    }
  }

  /**
   * Extract text content and create overlay text layer
   * This creates individual text elements that can have opacity controlled
   * @private
   */
  async extractTextLayer(page, viewport) {
    // Clear previous text layer
    this.textLayer.innerHTML = '';
    this.textElements = [];
    
    try {
      // Get text content from PDF.js
      const textContent = await page.getTextContent();
      
      console.log(`PDF Processor: Processing ${textContent.items.length} text items`);
      
      // Create a div for each text item
      textContent.items.forEach((item) => {
        // Skip empty text
        if (!item.str || item.str.trim().length === 0) return;
        
        // Create text element
        const textDiv = document.createElement('div');
        textDiv.className = 'pdf-text-item';
        textDiv.textContent = item.str;
        
        // Calculate position using PDF.js transform matrix
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        
        // Apply positioning and styling
        textDiv.style.left = `${tx[4]}px`;
        textDiv.style.top = `${tx[5]}px`;
        textDiv.style.fontSize = `${Math.abs(tx[0])}px`;
        textDiv.style.fontFamily = item.fontName || 'sans-serif';
        
        // Set initial opacity to full
        textDiv.style.opacity = '1';
        
        // Add to text layer
        this.textLayer.appendChild(textDiv);
        
        // Store reference for opacity updates
        this.textElements.push({
          element: textDiv,
          // Store bounds for performance (will be updated on scroll)
          bounds: null
        });
      });
      
      // Calculate initial bounds for all elements
      this._updateElementBounds();
      
    } catch (error) {
      console.error('PDF Processor: Error extracting text layer:', error);
    }
  }

  /**
   * Update cached bounding boxes for all text elements
   * Call this after render or on scroll
   * @private
   */
  _updateElementBounds() {
    this.textElements.forEach(item => {
      item.bounds = item.element.getBoundingClientRect();
    });
  }

  /**
   * Main function: Update text opacity based on gaze position
   * Called by eye tracker on each gaze update
   * @param {number} gazeX - X coordinate of gaze
   * @param {number} gazeY - Y coordinate of gaze
   */
  updateTextOpacity(gazeX, gazeY) {
    // Throttle updates for performance
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottleMs) {
      return;
    }
    this.lastUpdateTime = now;

    const gazePoint = { x: gazeX, y: gazeY };
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      this.textElements.forEach(({ element, bounds }) => {
        if (!bounds) return;
        
        // Calculate center of text element
        const elementCenter = {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2
        };
        
        // Calculate distance from gaze to element center
        const distance = this._calculateDistance(elementCenter, gazePoint);
        
        // Calculate appropriate opacity based on distance
        const opacity = this._calculateOpacity(distance);
        
        // Apply opacity
        element.style.opacity = opacity.toFixed(3);
      });
    });
  }

  /**
   * Calculate Euclidean distance between two points
   * @private
   */
  _calculateDistance(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate opacity based on distance from gaze point
   * Uses either linear or gaussian falloff
   * @private
   */
  _calculateOpacity(distance) {
    // If outside focus radius, use minimum opacity
    if (distance > this.focusRadius) {
      return this.minOpacity;
    }
    
    // Normalize distance to 0-1 range
    const normalizedDistance = distance / this.focusRadius;
    
    if (this.falloffType === 'linear') {
      // Linear falloff: straight line from max to min
      const opacity = this.maxOpacity - (normalizedDistance * (this.maxOpacity - this.minOpacity));
      return Math.max(this.minOpacity, Math.min(this.maxOpacity, opacity));
      
    } else {
      // Gaussian falloff: smooth, natural-looking transition
      // exp(-4x²) creates a nice bell curve
      const gaussianFactor = Math.exp(-Math.pow(normalizedDistance * 2, 2));
      const opacity = this.minOpacity + (this.maxOpacity - this.minOpacity) * gaussianFactor;
      return Math.max(this.minOpacity, Math.min(this.maxOpacity, opacity));
    }
  }

  /**
   * Reset all text to full opacity
   * Called when eye tracking is stopped
   */
  resetOpacity() {
    this.textElements.forEach(({ element }) => {
      element.style.opacity = '1';
    });
  }

  /**
   * Update processor settings
   * @param {Object} settings - { focusRadius, minOpacity, falloffType }
   */
  updateSettings(settings) {
    if (settings.focusRadius !== undefined) {
      this.focusRadius = settings.focusRadius;
      console.log('PDF Processor: Focus radius updated to', this.focusRadius);
    }
    
    if (settings.minOpacity !== undefined) {
      this.minOpacity = settings.minOpacity;
      console.log('PDF Processor: Min opacity updated to', this.minOpacity);
    }
    
    if (settings.falloffType !== undefined) {
      this.falloffType = settings.falloffType;
      console.log('PDF Processor: Falloff type updated to', this.falloffType);
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.resetOpacity();
    this.textElements = [];
    this.pdfDoc = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.textLayer.innerHTML = '';
  }
}

// Make available globally
window.PDFProcessor = PDFProcessor;