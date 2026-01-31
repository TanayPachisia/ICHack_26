// ADHD Reader - Text Enhancer Module
// Handles Bionic Reading, font changes, and typography adjustments

class TextEnhancer {
  constructor() {
    this.processedNodes = new WeakSet();
    this.originalContent = new WeakMap();
    this.bionicEnabled = false;
    this.fontFamily = 'default';
  }

  // Apply Bionic Reading to text
  applyBionicReading(element, intensity = 0.4) {
    if (!element || this.processedNodes.has(element)) return;

    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          // Skip already processed, scripts, styles, and hidden elements
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'code', 'pre'].includes(tagName)) {
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
      
      if (!parent || parent.classList.contains('adhd-reader-bionic')) return;
      
      // Store original content
      this.originalContent.set(textNode, text);

      const fragment = document.createDocumentFragment();
      const words = text.split(/(\s+)/);

      words.forEach(word => {
        if (/^\s+$/.test(word)) {
          fragment.appendChild(document.createTextNode(word));
          return;
        }

        if (word.length === 0) return;

        // Calculate how many letters to bold based on intensity
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

      parent.replaceChild(fragment, textNode);
    });

    this.processedNodes.add(element);
    this.bionicEnabled = true;
  }

  // Remove Bionic Reading
  removeBionicReading(element) {
    if (!element) return;

    const bionicSpans = element.querySelectorAll('.adhd-reader-bionic');
    bionicSpans.forEach(span => {
      const text = span.textContent;
      span.replaceWith(document.createTextNode(text));
    });

    this.processedNodes.delete(element);
    this.bionicEnabled = false;
  }

  // Apply typography settings
  applyTypography(settings) {
    const root = document.documentElement;
    
    root.style.setProperty('--adhd-font-size', `${settings.fontSize}%`);
    root.style.setProperty('--adhd-line-height', settings.lineHeight);
    root.style.setProperty('--adhd-letter-spacing', `${settings.letterSpacing}px`);
    root.style.setProperty('--adhd-word-spacing', `${settings.wordSpacing}px`);

    // Apply to main text elements
    const textElements = document.querySelectorAll('p, article, main, .content, .post, .article-body');
    textElements.forEach(el => {
      el.classList.add('adhd-reader-enhanced-text');
    });
  }

  // Apply font family
  applyFont(fontFamily) {
    this.fontFamily = fontFamily;
    const textElements = document.querySelectorAll('p, article, main, .content, .post, .article-body, h1, h2, h3, h4, h5, h6, li, span, div');
    
    // Remove all font classes first
    const fontClasses = ['adhd-reader-font-opendyslexic', 'adhd-reader-font-lexie', 'adhd-reader-font-comic'];
    textElements.forEach(el => {
      fontClasses.forEach(cls => el.classList.remove(cls));
    });

    if (fontFamily !== 'default') {
      const fontClass = `adhd-reader-font-${fontFamily}`;
      textElements.forEach(el => {
        el.classList.add(fontClass);
      });
    }
  }

  // Reset all enhancements
  reset(element) {
    this.removeBionicReading(element);
    
    const enhancedElements = document.querySelectorAll('.adhd-reader-enhanced-text');
    enhancedElements.forEach(el => {
      el.classList.remove('adhd-reader-enhanced-text');
    });

    const fontClasses = ['adhd-reader-font-opendyslexic', 'adhd-reader-font-lexie', 'adhd-reader-font-comic'];
    document.querySelectorAll('*').forEach(el => {
      fontClasses.forEach(cls => el.classList.remove(cls));
    });
  }
}

// Export for use in content script
window.ADHDReaderTextEnhancer = TextEnhancer;
