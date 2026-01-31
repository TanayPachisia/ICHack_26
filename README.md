# ADHD Reader

A Chrome extension that makes reading easier for people with ADHD, dyslexia, and other neurodivergent conditions.

## Features

- 👁️ **Eye Tracking Focus** - Uses webcam-based eye tracking to highlight the paragraph you're looking at
- 📖 **Bionic Reading** - Bolds the first letters of words for faster recognition
- 🎨 **Color Overlays** - Reduces visual stress with tinted overlays
- 📏 **Line Guide** - Follows your reading position
- 🔤 **Dyslexia-Friendly Fonts** - OpenDyslexic and other accessible fonts
- ⚙️ **Adjustable Typography** - Control font size, line height, letter spacing

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `adhd-reader` folder
5. The extension icon should appear in your toolbar

## Usage

### Keyboard Shortcuts
- `E` - Toggle Eye Tracking
- `B` - Toggle Bionic Reading
- `F` - Toggle Focus Mode (blur)
- `O` - Toggle Color Overlay
- `L` - Toggle Line Guide

### Eye Tracking Setup
1. Click the eye tracking button or press `E`
2. Allow camera access when prompted
3. Complete the 9-point calibration by clicking each dot
4. Look at your screen while reading - the focused paragraph stays clear!

## Tech Stack

- WebGazer.js for browser-based eye tracking
- Chrome Manifest V3
- Pure JavaScript (no framework dependencies)

## Privacy

- All eye tracking processing happens locally in your browser
- No data is sent to external servers
- Camera access is only used when eye tracking is enabled

## Demo: Local PDF Viewer

A simple local PDF viewer was added at `src/site/index.html` that demonstrates the bionic-reading and focus/overlay features on PDFs with selectable text using PDF.js.

Quick start:

1. Run a local static server from the project root (serve over localhost/HTTPS):
   - Python: `python -m http.server 8000`
   - Or `npx http-server . -p 8000`
2. Open: `http://localhost:8000/src/site/index.html`
3. Choose a PDF using the file picker. If a page has no selectable text the viewer will show `(No selectable text on this page)`.

Notes:
- This viewer is intended for local testing and does not modify or remove any eye-tracking code. Eye-tracking modules have been left untouched to avoid conflicts with ongoing work.

## License

MIT
