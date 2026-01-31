// Minimal, local-usage TextEnhancer (ES module)
export class TextEnhancer {
  constructor() {
    this.bionicEnabled = false;
    this.intensity = 0.4;
  }

  applyBionicReading(container, intensity = 0.4) {
    if (!container) return;
    this.intensity = intensity;

    // Process paragraph-like nodes (for PDF.js we created <p> nodes inside .textLayer)
    const paragraphs = container.querySelectorAll('.textLayer p');
    paragraphs.forEach(p => {
      if (p.dataset.adhdBionic === '1') return; // already processed

      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let n;
      while (n = walker.nextNode()) textNodes.push(n);

      textNodes.forEach(textNode => {
        const text = textNode.textContent;
        if (!text.trim()) return;

        const fragment = document.createDocumentFragment();
        const words = text.split(/(\s+)/);

        words.forEach(word => {
          if (/^\s+$/.test(word)) {
            fragment.appendChild(document.createTextNode(word));
            return;
          }

          const boldLength = Math.max(1, Math.ceil(word.length * intensity));
          const boldPart = word.slice(0, boldLength);
          const normalPart = word.slice(boldLength);

          const span = document.createElement('span');
          span.className = 'adhd-reader-bionic';

          const boldSpan = document.createElement('span');
          boldSpan.className = 'adhd-reader-bionic-bold';
          boldSpan.textContent = boldPart;
          span.appendChild(boldSpan);

          if (normalPart) span.appendChild(document.createTextNode(normalPart));

          fragment.appendChild(span);
        });

        textNode.parentElement.replaceChild(fragment, textNode);
      });

      p.dataset.adhdBionic = '1';
    });

    this.bionicEnabled = true;
  }

  removeBionicReading(container) {
    if (!container) return;
    const nodes = container.querySelectorAll('.adhd-reader-bionic');
    nodes.forEach(node => {
      node.replaceWith(document.createTextNode(node.textContent));
    });
    container.querySelectorAll('[data-adhd-bionic]').forEach(n => n.removeAttribute('data-adhd-bionic'));
    this.bionicEnabled = false;
  }
}
