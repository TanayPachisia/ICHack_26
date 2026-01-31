// Minimal FocusOverlay for PDF text layers
export class FocusOverlay {
  constructor() {
    this.isActive = false;
    this.current = null;
    this.paragraphs = [];
    this.lineGuideEnabled = true;
    this.overlayEl = null;
  }

  init(root = document.body) {
    // create optional overlay element
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'adhd-reader-overlay';
    root.appendChild(this.overlayEl);
    this.scanForParagraphs(root);
  }

  scanForParagraphs(root = document.body) {
    // In PDF text layer we treat each <p> as a paragraph
    this.paragraphs = Array.from(root.querySelectorAll('.textLayer p'))
      .filter(p => p.textContent.trim().length > 10);
  }

  enableBlur() {
    this.isActive = true;
    this.scanForParagraphs();
    // set initial focus to first visible
    const first = this.paragraphs[0];
    if (first) this.setFocusElement(first);
  }

  disableBlur() {
    this.isActive = false;
    this.paragraphs.forEach(p => p.classList.remove('adhd-reader-blur', 'adhd-reader-focus'));
  }

  setFocusElement(el) {
    if (this.current) this.current.classList.remove('adhd-reader-focus');
    this.paragraphs.forEach(p => p.classList.remove('adhd-reader-blur'));
    this.current = el;
    if (el) {
      el.classList.add('adhd-reader-focus');
      if (this.isActive) {
        this.paragraphs.forEach(p => { if (p !== el) p.classList.add('adhd-reader-blur'); });
      }
      // ensure visible
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  focusParagraphAtPosition(x, y) {
    // find closest paragraph by vertical distance
    let closest = null; let minDist = Infinity;
    this.paragraphs.forEach(p => {
      const rect = p.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const dist = Math.abs(centerY - y);
      if (dist < minDist && rect.top < window.innerHeight && rect.bottom > 0) {
        minDist = dist; closest = p;
      }
    });
    if (closest && closest !== this.current) this.setFocusElement(closest);
  }

  showOverlay(show = true) {
    if (!this.overlayEl) return;
    this.overlayEl.classList.toggle('active', show);
  }
}
