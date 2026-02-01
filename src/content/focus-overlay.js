// ADHD Reader - Focus Overlay Module
// Handles blur effects, highlighting, and reading guides

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
      overlayOpacity: 0.15,
      spotlightMode: false,
      spotlightRadius: 150
    };
  }

  init() {
    this.createElements();
    this.scanForParagraphs();
    this.createSpotlightOverlay();
  }

  createSpotlightOverlay() {
    if (document.getElementById('adhd-reader-spotlight')) return;

    this.spotlightOverlay = document.createElement('div');
    this.spotlightOverlay.id = 'adhd-reader-spotlight';
    this.spotlightOverlay.className = 'adhd-reader-spotlight';
    document.body.appendChild(this.spotlightOverlay);
  }

  createElements() {
    // Create line guide
    this.lineGuide = document.createElement('div');
    this.lineGuide.className = 'adhd-reader-line-guide';
    this.lineGuide.style.display = 'none';
    document.body.appendChild(this.lineGuide);

    // Create gaze indicator (for debugging/visual feedback)
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
    // Find all readable text blocks
    const selectors = 'p, article, .content, .post-content, .article-body, .entry-content, main section, .text-block';
    this.paragraphs = Array.from(document.querySelectorAll(selectors))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const text = el.textContent.trim();
        // Filter out elements that are too small or have no text
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

    if (this.settings.spotlightMode) {
      this.updateSpotlight(x, y);
    }

    // Find and focus the paragraph at gaze position
    this.focusParagraphAtPosition(x, y);
  }

  updateSpotlight(x, y) {
    if (!this.spotlightOverlay) return;
    // Radial gradient mask to create the flashlight effect
    this.spotlightOverlay.style.background = `radial-gradient(circle ${this.settings.spotlightRadius}px at ${x}px ${y}px, transparent 0%, transparent 95%, rgba(0, 0, 0, 0.95) 100%)`;
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
    // Remove focus from previous element
    if (this.currentFocusElement) {
      this.currentFocusElement.classList.remove('adhd-reader-focus');
    }

    // Remove blur from previous siblings
    this.paragraphs.forEach(p => {
      p.classList.remove('adhd-reader-blur');
    });

    // Set new focus
    this.currentFocusElement = element;
    if (element) {
      element.classList.add('adhd-reader-focus');

      // Blur other paragraphs
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
    document.documentElement.style.setProperty(
      '--adhd-focus-blur',
      `${this.settings.blurAmount}px`
    );
    document.documentElement.style.setProperty(
      '--adhd-highlight-color',
      this.settings.highlightColor
    );
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

  toggleSpotlight(enabled) {
    this.settings.spotlightMode = enabled;
    if (this.spotlightOverlay) {
      this.spotlightOverlay.style.display = enabled ? 'block' : 'none';
      if (enabled) {
        document.body.classList.add('adhd-reader-spotlight-active');
      } else {
        document.body.classList.remove('adhd-reader-spotlight-active');
      }
    }
  }

  hideGazeIndicator() {
    if (this.gazeIndicator) {
      this.gazeIndicator.style.display = 'none';
    }
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };

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

// Export for use in content script
window.ADHDReaderFocusOverlay = FocusOverlay;
