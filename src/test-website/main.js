// ========== GLOBAL STATE ==========
let pdfTextLines = []; // Array of text lines extracted from PDF
let currentLineIndex = 0;
let isCalibrated = false;
let isFocusMode = false;

// ========== DOM ELEMENTS ==========
const startBtn = document.getElementById('startBtn');
const instruction = document.getElementById('instruction');
const pdfUpload = document.getElementById('pdf-upload');
const pdfViewer = document.getElementById('pdf-viewer');
const startFocusBtn = document.getElementById('startFocusBtn');
const focusReader = document.getElementById('focus-reader');
const readingText = document.getElementById('reading-text');
const lineProgress = document.getElementById('line-progress');
const gazePosition = document.getElementById('gaze-position');
const exitFocusBtn = document.getElementById('exit-focus-btn');

// ========== INITIALIZATION ==========
window.onload = async function () {
    // PDF Upload Handler
    if (pdfUpload) {
        pdfUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || file.type !== 'application/pdf') {
                return;
            }
            await extractPDFText(file);
        });
    }

    // Start Calibration Button
    startBtn.addEventListener('click', async () => {
        instruction.style.display = 'none';
        initWebGazer();
    });

    // Start Focus Reading Button
    if (startFocusBtn) {
        startFocusBtn.addEventListener('click', () => {
            if (pdfTextLines.length === 0) {
                alert('Please upload a PDF first!');
                return;
            }
            if (!isCalibrated) {
                alert('Please complete calibration first!');
                return;
            }
            startFocusReading();
        });
    }

    // Exit Focus Mode Button
    if (exitFocusBtn) {
        exitFocusBtn.addEventListener('click', () => {
            exitFocusMode();
        });
    }
};

// ========== PDF TEXT EXTRACTION ==========
async function extractPDFText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        pdfTextLines = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Group text items into lines based on Y position
            const lineMap = new Map();

            textContent.items.forEach((item) => {
                if (!item.str || item.str.trim() === '') return;

                // Round Y to group items on same line
                const yKey = Math.round(item.transform[5]);

                if (!lineMap.has(yKey)) {
                    lineMap.set(yKey, []);
                }
                lineMap.get(yKey).push({
                    text: item.str,
                    x: item.transform[4]
                });
            });

            // Sort lines by Y (top to bottom in PDF = higher Y first)
            const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

            sortedYs.forEach(y => {
                const lineItems = lineMap.get(y);
                // Sort items within line by X (left to right)
                lineItems.sort((a, b) => a.x - b.x);
                // Combine text items into single line string
                const lineText = lineItems.map(item => item.text).join(' ');
                if (lineText.trim()) {
                    pdfTextLines.push(lineText);
                }
            });
        }

        console.log(`Extracted ${pdfTextLines.length} lines from PDF`);

        // Show the Start Focus Reading button
        if (startFocusBtn) {
            startFocusBtn.style.display = 'block';
        }

        // Preview first few lines
        if (readingText) {
            readingText.textContent = pdfTextLines[0] || 'No text found in PDF';
        }

    } catch (error) {
        console.error('Error extracting PDF text:', error);
        alert('Error reading PDF. See console for details.');
    }
}

// ========== FOCUS READING MODE ==========
function startFocusReading() {
    isFocusMode = true;
    currentLineIndex = 0;

    // Show focus reader UI
    focusReader.style.display = 'flex';

    // Hide other UI elements
    document.getElementById('pdf-controls').style.display = 'none';

    // Hide the smooth cursor in focus mode
    if (smoothCursor) {
        smoothCursor.style.display = 'none';
    }

    // Display first line
    updateReadingDisplay();
}

function exitFocusMode() {
    isFocusMode = false;
    focusReader.style.display = 'none';
    document.getElementById('pdf-controls').style.display = 'flex';

    // Show cursor again
    if (smoothCursor) {
        smoothCursor.style.display = 'block';
    }
}

function updateReadingDisplay() {
    if (currentLineIndex >= pdfTextLines.length) {
        readingText.textContent = '📚 End of document!';
        lineProgress.textContent = 'Reading complete!';
        return;
    }

    const currentLine = pdfTextLines[currentLineIndex];
    readingText.textContent = currentLine;
    lineProgress.textContent = `Line ${currentLineIndex + 1} of ${pdfTextLines.length}`;
}

// Called by gaze listener to update scroll position
function updateFocusReadingPosition(gazeX) {
    if (!isFocusMode) return;

    const screenWidth = window.innerWidth;

    // Map gaze X to a normalized position (0 = left, 1 = right)
    const normalizedX = Math.max(0, Math.min(1, gazeX / screenWidth));

    // Update gaze indicator
    if (gazePosition) {
        const indicatorWidth = gazePosition.parentElement.offsetWidth - 20;
        gazePosition.style.marginLeft = `${normalizedX * indicatorWidth}px`;
    }

    // Calculate text scroll based on gaze position
    const currentLine = pdfTextLines[currentLineIndex] || '';
    const charWidth = 18; // Approximate character width in pixels at 32px font
    const visibleChars = 25; // How many characters fit in the window
    const totalChars = currentLine.length;
    const maxScroll = Math.max(0, (totalChars - visibleChars) * charWidth);

    // Scroll text based on gaze
    const scrollX = normalizedX * maxScroll;
    readingText.style.transform = `translateX(${-scrollX}px)`;

    // Advance to next line when gaze reaches right edge
    if (normalizedX > 0.9) {
        // Check if we've been looking right for a moment (debounce)
        if (!window.rightGazeTimer) {
            window.rightGazeTimer = setTimeout(() => {
                advanceToNextLine();
                window.rightGazeTimer = null;
            }, 800); // Wait 800ms before advancing
        }
    } else {
        // Cancel timer if gaze moves away from right edge
        if (window.rightGazeTimer) {
            clearTimeout(window.rightGazeTimer);
            window.rightGazeTimer = null;
        }
    }
}

function advanceToNextLine() {
    if (currentLineIndex < pdfTextLines.length - 1) {
        currentLineIndex++;
        updateReadingDisplay();
        // Reset scroll position for new line
        readingText.style.transform = 'translateX(0)';
    }
}

// Keyboard controls for focus mode
document.addEventListener('keydown', (e) => {
    if (!isFocusMode) return;

    if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        advanceToNextLine();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentLineIndex > 0) {
            currentLineIndex--;
            updateReadingDisplay();
            readingText.style.transform = 'translateX(0)';
        }
    } else if (e.key === 'Escape') {
        exitFocusMode();
    }
});

// ========== WEBGAZER INITIALIZATION ==========
async function initWebGazer() {
    try {
        await webgazer.setRegression('ridge')
            .saveDataAcrossSessions(true)
            .showVideoPreview(true)
            .showPredictionPoints(false)
            .applyKalmanFilter(true)
            .setGazeListener(function (data, elapsedTime) {
                if (data == null) return;

                // Smooth the data
                const smoothed = getSmoothedCoordinates(data.x, data.y);

                // Update custom cursor (when not in focus mode)
                if (!isFocusMode) {
                    updateSmoothCursor(smoothed.x, smoothed.y);
                }

                // Update focus reading position
                updateFocusReadingPosition(smoothed.x);
            })
            .begin();

        console.log("WebGazer initialized with Kalman Filter!");

        // Create custom smooth cursor
        createSmoothCursor();

        // Start Calibration
        startCalibration();

    } catch (e) {
        console.error("WebGazer failed to init:", e);
        alert("WebGazer failed to start. Check console.");
    }
}

// ========== CALIBRATION LOGIC ==========
const points = [
    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
    { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
    { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 }
];

let currentPointIndex = 0;
let clickCount = 0;

function startCalibration() {
    currentPointIndex = 0;
    clickCount = 0;
    showCalibrationPoint();
}

function showCalibrationPoint() {
    const existing = document.querySelectorAll('.calibration-point');
    existing.forEach(el => el.remove());

    if (currentPointIndex >= points.length) {
        finishCalibration();
        return;
    }

    const pt = points[currentPointIndex];
    createPoint(pt.x, pt.y);
}

function createPoint(xPercent, yPercent) {
    const point = document.createElement('div');
    point.className = 'calibration-point';
    point.style.left = xPercent + '%';
    point.style.top = yPercent + '%';
    point.title = `Click ${5 - clickCount} more times`;

    point.addEventListener('click', (e) => {
        clickCount++;
        point.style.opacity = (1 - (clickCount / 6));

        if (clickCount >= 5) {
            clickCount = 0;
            currentPointIndex++;
            showCalibrationPoint();
        }
    });

    document.body.appendChild(point);
}

function finishCalibration() {
    isCalibrated = true;

    // Show success message
    const msg = document.createElement('div');
    msg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        padding: 30px 40px;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        text-align: center;
        z-index: 5000;
        font-family: 'Lexend', sans-serif;
    `;
    msg.innerHTML = `
        <h2 style="color: #11998e; margin-bottom: 15px;">✓ Calibration Complete!</h2>
        <p style="color: #666; margin-bottom: 20px;">Now upload a PDF and click "Start Focus Reading"</p>
        <button id="closeCalibrationMsg" style="
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'Lexend', sans-serif;
            font-size: 16px;
        ">Got it!</button>
    `;
    document.body.appendChild(msg);

    document.getElementById('closeCalibrationMsg').addEventListener('click', () => {
        msg.remove();
        // Show PDF controls again
        document.getElementById('pdf-controls').style.display = 'flex';
    });

    webgazer.showPredictionPoints(false);
}

// ========== SMOOTHING LOGIC ==========
const HISTORY_SIZE = 40;
const gazeHistory = [];

function getSmoothedCoordinates(x, y) {
    gazeHistory.push({ x, y });

    if (gazeHistory.length > HISTORY_SIZE) {
        gazeHistory.shift();
    }

    let weightedX = 0;
    let weightedY = 0;
    let totalWeight = 0;

    for (let i = 0; i < gazeHistory.length; i++) {
        const weight = i + 1;
        weightedX += gazeHistory[i].x * weight;
        weightedY += gazeHistory[i].y * weight;
        totalWeight += weight;
    }

    return {
        x: weightedX / totalWeight,
        y: weightedY / totalWeight
    };
}

// ========== CURSOR UI ==========
let smoothCursor = null;

function createSmoothCursor() {
    if (smoothCursor) return;

    smoothCursor = document.createElement('div');
    smoothCursor.id = 'smoothCursor';
    smoothCursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(102, 126, 234, 0.7);
        box-shadow: 0 0 15px rgba(102, 126, 234, 0.5);
        border: 2px solid white;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: top 0.15s ease-out, left 0.15s ease-out;
    `;

    document.body.appendChild(smoothCursor);
}

function updateSmoothCursor(x, y) {
    if (!smoothCursor) return;
    smoothCursor.style.left = x + 'px';
    smoothCursor.style.top = y + 'px';
}
