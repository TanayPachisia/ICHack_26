// ========== GLOBAL STATE ==========
let pdfTextLines = []; // Array of text lines extracted from PDF
let currentLineIndex = 0;
let currentWordIndex = 0;
let currentLineWords = []; // Words in the current line
let isCalibrated = false;
let isFocusMode = false;

// Pagination
let wordsPerPage = 10;
let currentPageInLine = 0;
let totalPagesInLine = 1;

// Gaze tracking with assistance
let lastConfirmedWordIndex = 0;  // Last word we're confident about
let gazeProgressAccumulator = 0; // Accumulated rightward gaze movement
let autoAdvanceTimer = null; // Timer to trigger auto-advance when user stays on second-last word
const ADVANCE_THRESHOLD = 0.08;  // How much rightward movement needed to advance (fraction of screen)
const RETREAT_THRESHOLD = 0.15;  // Larger threshold for going backwards (harder to go back accidentally)
let lastGazeX = 0;

// For "looking at screen" detection
let isLookingAtScreen = true; 
let lastGazeTime = Date.now();
const GAZE_TIMEOUT = 800;

// Helper: split fullWords into pages obeying wordsPerPage and char limit (66 chars including spaces)
function paginateWords(fullWords) {
    const pages = [];
    let page = [];
    let charCount = 0;

    for (const w of fullWords) {
        const needed = (page.length > 0 ? 1 : 0) + w.length; // include a space if not first word

        // If adding this word would exceed either limit, push current page and start a new one
        if (page.length >= wordsPerPage || (charCount + needed) > 66) {
            pages.push(page);
            page = [];
            charCount = 0;
        }

        page.push(w);
        charCount += needed;
    }

    if (page.length) pages.push(page);
    // ensure at least one empty page
    return pages.length ? pages : [[]];
}

// ========== DOM ELEMENTS ==========
const startBtn = document.getElementById('startBtn');
const instruction = document.getElementById('instruction');
const pdfUpload = document.getElementById('pdf-upload');
const pdfViewer = document.getElementById('pdf-viewer');
const startFocusBtn = document.getElementById('startFocusBtn');
const focusReader = document.getElementById('focus-reader');
const readingWindow = document.getElementById('reading-window');
const lineProgress = document.getElementById('line-progress');
const gazePosition = document.getElementById('gaze-position');
const exitFocusBtn = document.getElementById('exit-focus-btn');
const prevLineBtn = document.getElementById('prev-line-btn');
const nextLineBtn = document.getElementById('next-line-btn');
const pauseBtn = document.getElementById('pause-btn');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');

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

    // Navigation Buttons
    if (prevLineBtn) {
        prevLineBtn.addEventListener('click', () => {
            goToPreviousLine();
        });
    }

    if (nextLineBtn) {
        nextLineBtn.addEventListener('click', () => {
            goToNextLine();
        });
    }

    // Sensitivity Slider (repurposed from speed)
    if (speedSlider) {
        speedSlider.min = 1;
        speedSlider.max = 10;
        speedSlider.value = 5;
        if (speedValue) {
            speedValue.textContent = 'Medium';
        }
        
        speedSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            // Map 1-10 to sensitivity descriptions
            const labels = ['Very Sticky', 'Sticky', 'Sticky', 'Medium-Sticky', 'Medium', 
                          'Medium', 'Responsive', 'Responsive', 'Quick', 'Very Quick'];
            if (speedValue) {
                speedValue.textContent = labels[val - 1];
            }
            // Adjust threshold based on sensitivity (lower = more sensitive)
            // Range: 0.15 (sticky) to 0.03 (quick)
            window.currentAdvanceThreshold = 0.15 - (val - 1) * 0.012;
        });
        
        window.currentAdvanceThreshold = ADVANCE_THRESHOLD;
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

            const lineMap = new Map();

            textContent.items.forEach((item) => {
                if (!item.str || item.str.trim() === '') return;
                const yKey = Math.round(item.transform[5]);
                if (!lineMap.has(yKey)) {
                    lineMap.set(yKey, []);
                }
                lineMap.get(yKey).push({
                    text: item.str,
                    x: item.transform[4]
                });
            });

            const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

            sortedYs.forEach(y => {
                const lineItems = lineMap.get(y);
                lineItems.sort((a, b) => a.x - b.x);
                const lineText = lineItems.map(item => item.text).join(' ');
                if (lineText.trim()) {
                    pdfTextLines.push(lineText);
                }
            });
        }

        console.log(`Extracted ${pdfTextLines.length} lines from PDF`);

        if (startFocusBtn) {
            startFocusBtn.style.display = 'block';
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
    currentWordIndex = 0;
    lastConfirmedWordIndex = 0;
    gazeProgressAccumulator = 0;
    lastGazeX = window.innerWidth / 2; // Start from center
    currentPageInLine = 0;

    focusReader.style.display = 'flex';
    document.getElementById('pdf-controls').style.display = 'none';

    if (smoothCursor) {
        smoothCursor.style.display = 'none';
    }

    // Update label for sensitivity slider
    const label = document.querySelector('#speed-control label');
    if (label) {
        label.textContent = 'Sensitivity:';
    }

    displayCurrentLine();
}

function exitFocusMode() {
    isFocusMode = false;
    focusReader.style.display = 'none';
    document.getElementById('pdf-controls').style.display = 'flex';

    if (smoothCursor) {
        smoothCursor.style.display = 'block';
    }

    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

    // clear auto-advance timer when exiting focus mode
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
}

function displayCurrentLine() {
    if (currentLineIndex >= pdfTextLines.length) {
        readingWindow.innerHTML = '<span class="word highlighted">📚 End of document!</span>';
        lineProgress.textContent = 'Reading complete!';
        return;
    }

    const currentLine = pdfTextLines[currentLineIndex] || '';
    const fullWords = currentLine.split(/\s+/).filter(w => w.length > 0);

    // Create pages obeying words per page and character limit
    const pages = paginateWords(fullWords);
    totalPagesInLine = pages.length;
    if (currentPageInLine >= totalPagesInLine) currentPageInLine = totalPagesInLine - 1;

    const pageWords = pages[currentPageInLine] || [];
    currentLineWords = pageWords;
    currentWordIndex = 0;
    lastConfirmedWordIndex = 0;
    gazeProgressAccumulator = 0;

    // clear any pending auto-advance timer when a new line/page is displayed
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

    readingWindow.innerHTML = '';
    currentLineWords.forEach((word, index) => {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word;
        span.dataset.index = index;
        
        span.addEventListener('click', () => {
            currentWordIndex = index;
            lastConfirmedWordIndex = index;
            gazeProgressAccumulator = 0;
            updateWordHighlight(currentWordIndex);
        });
        
        readingWindow.appendChild(span);
    });

    updateWordHighlight(0);
    lineProgress.textContent = `Line ${currentLineIndex + 1} of ${pdfTextLines.length} (Page ${currentPageInLine + 1} of ${totalPagesInLine})`;
}

function updateWordHighlight(wordIndex) {
    // clear any previous auto-advance timer whenever highlight changes
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }

    const words = readingWindow.querySelectorAll('.word');
    words.forEach((word, index) => {
        word.classList.remove('highlighted');
        if (index < wordIndex) {
            word.classList.add('read');
        } else {
            word.classList.remove('read');
        }
    });

    if (words[wordIndex]) {
        words[wordIndex].classList.add('highlighted');
        words[wordIndex].classList.remove('read');

        // If this is the second-last word of the current line, set a 0.5s auto-advance guard
        const secondLastIndex = currentLineWords.length - 2;
        if (wordIndex === secondLastIndex && currentLineIndex < pdfTextLines.length - 1) {
            autoAdvanceTimer = setTimeout(() => {
                // Only advance if we're still on the same word (no progress)
                if (currentWordIndex === wordIndex) {
                    goToNextLine();
                }
                autoAdvanceTimer = null;
            }, 300); 
        }
    }
}

// ========== GAZE-DRIVEN WORD ADVANCEMENT ==========
function updateGazePosition(gazeX, gazeY) {
    if (!isFocusMode || currentLineWords.length === 0) return;
    
    lastGazeTime = Date.now();
    
    const screenWidth = window.innerWidth;
    
    // Update gaze indicator
    if (gazePosition && gazePosition.parentElement) {
        const normalizedX = Math.max(0, Math.min(1, gazeX / screenWidth));
        const indicatorWidth = gazePosition.parentElement.offsetWidth - 20;
        gazePosition.style.marginLeft = `${normalizedX * indicatorWidth}px`;
    }
    
    // Calculate relative movement (normalized to screen width)
    const deltaX = (gazeX - lastGazeX) / screenWidth;
    lastGazeX = gazeX;
    
    // Get current threshold (from slider)
    const advanceThreshold = window.currentAdvanceThreshold || ADVANCE_THRESHOLD;
    
    // FORWARD MOVEMENT: Accumulate rightward movement
    if (deltaX > 0) {
        gazeProgressAccumulator += deltaX;
        
        // Check if we've accumulated enough to advance
        if (gazeProgressAccumulator >= advanceThreshold) {
            gazeProgressAccumulator = 0; // Reset
            
            if (currentWordIndex < currentLineWords.length - 1) {
                currentWordIndex++;
                lastConfirmedWordIndex = currentWordIndex;
                updateWordHighlight(currentWordIndex);
            } else {
                // End of line - advance to next
                goToNextLine();
            }
        }
    }
    
    // BACKWARD MOVEMENT: Requires more significant leftward movement
    if (deltaX < 0) {
        // Subtract from accumulator (can go negative)
        gazeProgressAccumulator += deltaX;
        
        // If we've moved significantly left, go back a word
        if (gazeProgressAccumulator < -RETREAT_THRESHOLD) {
            gazeProgressAccumulator = 0;
            
            if (currentWordIndex > 0) {
                currentWordIndex--;
                lastConfirmedWordIndex = currentWordIndex;
                updateWordHighlight(currentWordIndex);
            }
        }
    }
}

// Check if user is still looking at screen
setInterval(() => {
    if (!isFocusMode) return;
    
    const timeSinceLastGaze = Date.now() - lastGazeTime;
    if (timeSinceLastGaze > GAZE_TIMEOUT) {
        isLookingAtScreen = false;
    } else {
        isLookingAtScreen = true;
    }
}, 200);

function goToNextLine() {
    // If there are more pages in the current line, go to the next page first
    if (currentPageInLine < totalPagesInLine - 1) {
        currentPageInLine++;
        lastGazeX = 0;
        displayCurrentLine();
        return;
    }

    // Otherwise move to the next physical line
    if (currentLineIndex < pdfTextLines.length - 1) {
        currentLineIndex++;
        currentPageInLine = 0;
        lastGazeX = 0; // Reset to left side for new line
        displayCurrentLine();
    }
}

function goToPreviousLine() {
    // If we're not at the first page of this line, go back a page
    if (currentPageInLine > 0) {
        currentPageInLine--;
        displayCurrentLine();
        return;
    }

    // Otherwise go to the previous physical line (last page)
    if (currentLineIndex > 0) {
        currentLineIndex--;
        // compute pages for previous line
        const prevLine = pdfTextLines[currentLineIndex] || '';
        const prevWords = prevLine.split(/\s+/).filter(w => w.length > 0);
        const prevPages = Math.max(1, Math.ceil(prevWords.length / wordsPerPage));
        currentPageInLine = Math.max(0, prevPages - 1);
        displayCurrentLine();
    }
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!isFocusMode) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextLine();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPreviousLine();
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentWordIndex < currentLineWords.length - 1) {
            currentWordIndex++;
            lastConfirmedWordIndex = currentWordIndex;
            gazeProgressAccumulator = 0;
            updateWordHighlight(currentWordIndex);
        } else {
            goToNextLine();
        }
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentWordIndex > 0) {
            currentWordIndex--;
            lastConfirmedWordIndex = currentWordIndex;
            gazeProgressAccumulator = 0;
            updateWordHighlight(currentWordIndex);
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

                const smoothed = getSmoothedCoordinates(data.x, data.y);

                if (!isFocusMode) {
                    updateSmoothCursor(smoothed.x, smoothed.y);
                }

                updateGazePosition(smoothed.x, smoothed.y);
            })
            .begin();

        console.log("WebGazer initialized!");
        createSmoothCursor();
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

    point.addEventListener('click', () => {
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
        document.getElementById('pdf-controls').style.display = 'flex';
    });

    webgazer.showPredictionPoints(false);
}

// ========== SMOOTHING LOGIC ==========
const HISTORY_SIZE = 30; // Slightly less smoothing for more responsiveness
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
