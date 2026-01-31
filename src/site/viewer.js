import { TextEnhancer } from './modules/text-enhancer.module.js';
import { FocusOverlay } from './modules/focus-overlay.module.js';

const pdfContainer = document.getElementById('pdfContainer');
const fileInput = document.getElementById('fileInput');
const status = document.getElementById('status');
const toggleBionicBtn = document.getElementById('toggleBionic');
const toggleFocusBtn = document.getElementById('toggleFocus');
const toggleOverlayBtn = document.getElementById('toggleOverlay');

const textEnhancer = new TextEnhancer();
const focusOverlay = new FocusOverlay();
focusOverlay.init(document.body);

let currentDoc = null;
let settings = {
  bionic: false,
  focus: false,
  overlay: false
};

function setStatus(msg) { status.textContent = msg; }

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  setStatus('Loading PDF...');
  try {
    const url = URL.createObjectURL(f);
    const pdf = await window.pdfjsLib.getDocument({ url }).promise;
    currentDoc = pdf;
    pdfContainer.innerHTML = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.2 });

      const pageEl = document.createElement('div');
      pageEl.className = 'page';

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      // render page to canvas
      await page.render({ canvasContext: context, viewport }).promise;

      // create a simple text layer by concatenating text items
      const textContent = await page.getTextContent();
      const textLayer = document.createElement('div');
      textLayer.className = 'textLayer';

      if (textContent.items.length === 0) {
        const note = document.createElement('p');
        note.textContent = '(No selectable text on this page)';
        note.style.fontStyle = 'italic';
        textLayer.appendChild(note);
      } else {
        // Naive split: create one paragraph per line chunk
        // We just join items into paragraphs for our enhancer to operate on
        let paragraph = document.createElement('p');
        textContent.items.forEach((item, idx) => {
          const t = document.createTextNode(item.str + (idx < textContent.items.length - 1 ? ' ' : ''));
          paragraph.appendChild(t);
          // break heuristically by large vertical jumps (not implemented — keep simple)
        });
        textLayer.appendChild(paragraph);
      }

      pageEl.appendChild(canvas);
      pageEl.appendChild(textLayer);
      pdfContainer.appendChild(pageEl);
    }

    // Apply current settings to newly rendered content
    if (settings.bionic) textEnhancer.applyBionicReading(pdfContainer, 0.4);
    if (settings.focus) { focusOverlay.enableBlur(); focusOverlay.scanForParagraphs(pdfContainer); }
    focusOverlay.showOverlay(settings.overlay);

    setStatus('PDF loaded — use the controls to enable features.');
  } catch (err) {
    console.error(err);
    setStatus('Error loading PDF. See console for details.');
  }
});

// Buttons
toggleBionicBtn.addEventListener('click', () => {
  settings.bionic = !settings.bionic;
  if (settings.bionic) textEnhancer.applyBionicReading(pdfContainer, 0.4);
  else textEnhancer.removeBionicReading(pdfContainer);
});

toggleFocusBtn.addEventListener('click', () => {
  settings.focus = !settings.focus;
  if (settings.focus) {
    focusOverlay.enableBlur();
    focusOverlay.scanForParagraphs(pdfContainer);
  } else {
    focusOverlay.disableBlur();
  }
});

toggleOverlayBtn.addEventListener('click', () => {
  settings.overlay = !settings.overlay;
  focusOverlay.showOverlay(settings.overlay);
});

// Simple mouse-based focus (works without eye-tracker)
document.addEventListener('mousemove', (e) => {
  if (!settings.focus) return;
  const rect = pdfContainer.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right) return;
  // forward Y relative to viewport
  focusOverlay.focusParagraphAtPosition(e.clientX, e.clientY);
});

setStatus('Ready — pick a PDF file.');
