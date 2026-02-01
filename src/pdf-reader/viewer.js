// Check for PDF.js library
if (typeof pdfjsLib === 'undefined') {
    alert('Error: PDF.js library not loaded. Please check internet connection or file paths.');
    throw new Error('PDF.js library not loaded');
}

// Setup PDF.js worker
// Setup PDFjs worker
const workerPath = '../lib/pdfjs/pdf.worker.min.js';
try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('src/lib/pdfjs/pdf.worker.min.js');
    } else {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    }
} catch (e) {
    console.warn('Could not set absolute worker path, falling back to relative:', e);
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
}

class EyeTracker {
    constructor() {
        this.isCalibrated = false;
        this.isTracking = false;
        this.gazeHistory = [];
        this.historySize = 80; // Extreme smoothness buffer
        this.onGazeUpdate = null;
    }

    async startTracking() {
        if (typeof webgazer === 'undefined') {
            console.error('WebGazer not found');
            return false;
        }

        console.log('Starting gaze tracking...');
        try {
            await webgazer
                .setRegression('ridge')
                .showVideoPreview(true)
                .showPredictionPoints(true)
                .applyKalmanFilter(true)
                .begin();

            // Removed webgazer.removeMouseEventListeners() here to allow calibration

            this.isTracking = true;

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
            console.error('Failed to start tracking:', err);
            throw err;
        }
    }

    stopTracking() {
        if (this.isTracking && typeof webgazer !== 'undefined') {
            webgazer.pause();
            this.isTracking = false;

            // Hide WebGazer UI elements
            const videoContainer = document.getElementById('webgazerVideoContainer');
            if (videoContainer) videoContainer.style.display = 'none';
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

    finishCalibration() {
        if (typeof webgazer !== 'undefined') {
            console.log('Finishing calibration - removing mouse listeners');
            webgazer.removeMouseEventListeners();
        }
    }
}

class PDFReader {
    constructor() {
        this.pdfDoc = null;
        this.pageNum = 1;
        this.pageRendering = false;
        this.pageNumPending = null;
        this.scale = 1.2;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('pdf-viewer');
        this.container.appendChild(this.canvas);

        // Spotlight state
        this.spotlightEnabled = true;
        this.spotlightRadius = 150;
        this.overlay = null;

        // Eye Tracking state
        this.eyeTrackingEnabled = false;
        this.eyeTracker = new EyeTracker();

        this.init();
    }

    init() {
        // Event listeners
        document.getElementById('pdf-upload').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('prev-page').addEventListener('click', () => this.onPrevPage());
        document.getElementById('next-page').addEventListener('click', () => this.onNextPage());
        document.getElementById('zoom-in').addEventListener('click', () => this.changeZoom(0.1));
        document.getElementById('zoom-out').addEventListener('click', () => this.changeZoom(-0.1));
        document.getElementById('toggle-spotlight').addEventListener('click', () => this.toggleSpotlight());

        // Create Eye Tracking toggle
        this.createEyeTrackingToggle();

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') this.onNextPage();
            if (e.key === 'ArrowLeft') this.onPrevPage();
            if (e.key.toLowerCase() === 'e') this.toggleEyeTracking();
        });

        // Initialize Spotlight
        this.createSpotlightOverlay();

        // Track mouse for spotlight (fallback) - DISABLED per user request
        /*
        document.addEventListener('mousemove', (e) => {
            if (!this.eyeTrackingEnabled) {
                this.updateSpotlight(e.clientX, e.clientY);
            }
        });
        */

        // Setup eye tracker callback
        this.eyeTracker.onGazeUpdate = (gaze) => {
            if (this.eyeTrackingEnabled) {
                this.updateSpotlight(gaze.x, gaze.y);
            }
        };
    }

    createEyeTrackingToggle() {
        const controlGroup = document.querySelector('.control-group:last-child');
        const btn = document.createElement('button');
        btn.id = 'toggle-eyetracking';
        btn.textContent = '👁️ Eye Tracking';
        btn.addEventListener('click', () => this.toggleEyeTracking());
        controlGroup.appendChild(btn);

        const calibrateBtn = document.createElement('button');
        calibrateBtn.id = 'finish-calibration';
        calibrateBtn.textContent = '✅ Finish Calibration';
        calibrateBtn.style.display = 'none';
        calibrateBtn.style.background = '#4CAF50';
        calibrateBtn.style.color = 'white';
        calibrateBtn.addEventListener('click', () => this.finishCalibration());
        controlGroup.appendChild(calibrateBtn);
    }

    async toggleEyeTracking() {
        const btn = document.getElementById('toggle-eyetracking');
        this.eyeTrackingEnabled = !this.eyeTrackingEnabled;

        if (this.eyeTrackingEnabled) {
            btn.classList.add('active');
            try {
                await this.eyeTracker.startTracking();
                // Ensure spotlight is on when eye tracking starts
                if (!this.spotlightEnabled) {
                    this.toggleSpotlight();
                }

                // Show calibration button
                const calibrateBtn = document.getElementById('finish-calibration');
                if (calibrateBtn) {
                    calibrateBtn.style.display = 'inline-block';
                    this.showCalibrationGrid();
                    alert('Calibration Mode:\n1. Click each of the 9 dots 5 times while looking at them.\n2. Dots turn green when ready.\n3. Click "Finish Calibration" when done.');
                }

            } catch (e) {
                console.error('Failed to enable eye tracking', e);
                alert('Could not start eye tracker: ' + (e.message || e));
                this.eyeTrackingEnabled = false;
                btn.classList.remove('active');
            }
        } else {
            btn.classList.remove('active');
            this.eyeTracker.stopTracking();
            const calibrateBtn = document.getElementById('finish-calibration');
            if (calibrateBtn) calibrateBtn.style.display = 'none';
            this.hideCalibrationGrid();
        }
    }

    createSpotlightOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'adhd-reader-spotlight-overlay';
        Object.assign(this.overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '9999',
            display: 'none'
        });
        document.body.appendChild(this.overlay);

        if (this.spotlightEnabled) {
            this.overlay.style.display = 'block';
        }

        // Create gaze dot with custom "smoothCursor" styling
        this.gazeDot = document.createElement('div');
        this.gazeDot.className = 'adhd-reader-gaze-dot';
        Object.assign(this.gazeDot.style, {
            position: 'fixed',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 255, 255, 0.7)', // Cyan color
            boxShadow: '0 0 10px rgba(0,255,255,0.5)',
            border: '2px solid white',
            pointerEvents: 'none',
            zIndex: '10000',
            display: 'none',
            transform: 'translate(-50%, -50%)',
            transition: 'top 1s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' // Vertical smoothing biased (1s vs 0.5s)
        });
        document.body.appendChild(this.gazeDot);
    }

    createCalibrationGrid() {
        this.calibrationDots = [];
        const positions = [
            { top: '10%', left: '10%' }, { top: '10%', left: '50%' }, { top: '10%', left: '90%' },
            { top: '50%', left: '10%' }, { top: '50%', left: '50%' }, { top: '50%', left: '90%' },
            { top: '90%', left: '10%' }, { top: '90%', left: '50%' }, { top: '90%', left: '90%' }
        ];

        positions.forEach((pos, index) => {
            const dot = document.createElement('div');
            dot.className = 'calibration-dot';
            Object.assign(dot.style, {
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'red',
                border: '3px solid white',
                boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                zIndex: '10001',
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                display: 'none',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                userSelect: 'none'
            });

            dot.dataset.clicks = '0';
            dot.textContent = '5'; // Clicks remaining

            dot.addEventListener('click', (e) => {
                let clicks = parseInt(dot.dataset.clicks) + 1;
                dot.dataset.clicks = clicks;
                const remaining = 5 - clicks;
                dot.textContent = remaining > 0 ? remaining : '✓';

                if (clicks < 5) {
                    const opacity = 0.2 + (clicks / 5) * 0.8;
                    dot.style.backgroundColor = `rgba(255, 255, 0, ${opacity})`; // Yellowish as it progresses
                } else {
                    dot.style.backgroundColor = '#4CAF50'; // Green when done
                    dot.style.borderColor = '#45a049';
                }
            });

            document.body.appendChild(dot);
            this.calibrationDots.push(dot);
        });
    }

    showCalibrationGrid() {
        if (!this.calibrationDots) {
            this.createCalibrationGrid();
        }
        this.calibrationDots.forEach(dot => {
            dot.style.display = 'flex';
            dot.style.backgroundColor = 'red';
            dot.dataset.clicks = '0';
            dot.textContent = '5';
        });
    }

    hideCalibrationGrid() {
        if (this.calibrationDots) {
            this.calibrationDots.forEach(dot => dot.style.display = 'none');
        }
    }

    finishCalibration() {
        this.eyeTracker.finishCalibration();
        const calibrateBtn = document.getElementById('finish-calibration');
        if (calibrateBtn) calibrateBtn.style.display = 'none';
        this.hideCalibrationGrid();
        alert('Calibration finished! Eye tracking is now in gaze-only mode.');
    }

    updateSpotlight(x, y) {
        if (!this.spotlightEnabled || !this.overlay) return;

        // Use radial gradient to create transparency hole
        this.overlay.style.background = `radial-gradient(circle ${this.spotlightRadius}px at ${x}px ${y}px, transparent 100%, rgba(0, 0, 0, 0.85) 100%)`;

        // Update gaze dot position
        if (this.gazeDot) {
            this.gazeDot.style.left = `${x}px`;
            this.gazeDot.style.top = `${y}px`;
            this.gazeDot.style.display = 'block';
        }
    }

    toggleSpotlight() {
        this.spotlightEnabled = !this.spotlightEnabled;
        const btn = document.getElementById('toggle-spotlight');

        if (this.spotlightEnabled) {
            btn.classList.add('active');
            this.overlay.style.display = 'block';
        } else {
            btn.classList.remove('active');
            this.overlay.style.display = 'none';
        }
    }

    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a valid PDF file.');
            console.error('Invalid file selected:', file ? file.type : 'No file');
            return;
        }

        console.log('File selected:', file.name);

        document.getElementById('file-name').textContent = file.name;

        const fileReader = new FileReader();
        fileReader.onload = async (event) => {
            const typedarray = new Uint8Array(event.target.result);
            try {
                // Load PDF
                const loadingTask = pdfjsLib.getDocument(typedarray);
                this.pdfDoc = await loadingTask.promise;

                // Update UI state
                document.getElementById('page-num').textContent = `Page ${this.pageNum} of ${this.pdfDoc.numPages}`;
                document.getElementById('prev-page').disabled = false;
                document.getElementById('next-page').disabled = false;

                // Render first page
                this.pageNum = 1;
                this.renderPage(this.pageNum);
            } catch (err) {
                console.error('Error loading PDF:', err);
                alert('Error loading PDF file: ' + err.message);
            }
        };
        fileReader.readAsArrayBuffer(file);
    }

    async renderPage(num) {
        this.pageRendering = true;

        // Fetch page
        const page = await this.pdfDoc.getPage(num);

        const viewport = page.getViewport({ scale: this.scale });
        this.canvas.height = viewport.height;
        this.canvas.width = viewport.width;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: this.ctx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        try {
            await renderTask.promise;
            this.pageRendering = false;

            // Update page counters
            document.getElementById('page-num').textContent = `Page ${num} of ${this.pdfDoc.numPages}`;
            document.getElementById('prev-page').disabled = num <= 1;
            document.getElementById('next-page').disabled = num >= this.pdfDoc.numPages;

            if (this.pageNumPending !== null) {
                this.renderPage(this.pageNumPending);
                this.pageNumPending = null;
            }
        } catch (err) {
            console.error('Error rendering page:', err);
            this.pageRendering = false;
        }
    }

    queueRenderPage(num) {
        if (this.pageRendering) {
            this.pageNumPending = num;
        } else {
            this.renderPage(num);
        }
    }

    onPrevPage() {
        if (this.pageNum <= 1) return;
        this.pageNum--;
        this.queueRenderPage(this.pageNum);
    }

    onNextPage() {
        if (this.pageNum >= this.pdfDoc.numPages) return;
        this.pageNum++;
        this.queueRenderPage(this.pageNum);
    }

    changeZoom(delta) {
        let newScale = this.scale + delta;
        newScale = Math.max(0.5, Math.min(newScale, 3.0));
        this.scale = parseFloat(newScale.toFixed(1)); // avoid floating point errors
        document.getElementById('zoom-level').textContent = `${Math.round(this.scale * 100)}%`;

        if (this.pdfDoc) {
            this.renderPage(this.pageNum);
        }
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    window.pdfReader = new PDFReader();
});
