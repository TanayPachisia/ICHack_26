window.onload = async function () {
    const startBtn = document.getElementById('startBtn');
    const instruction = document.getElementById('instruction');

    startBtn.addEventListener('click', async () => {
        instruction.style.display = 'none'; // Hide start menu
        initWebGazer();
    });
};

async function initWebGazer() {
    // 1. Initialize WebGazer
    // We try to use TFFacemesh as requested, but you can comment it out to use the default (clmtrackr) if it fails.
    try {
        await webgazer.setRegression('ridge')
            // .setTracker('TFFacemesh') // Uncomment if needed
            .saveDataAcrossSessions(true)
            .showVideoPreview(true)
            .showPredictionPoints(false) // Hide default dot, we'll draw a smoother one
            .applyKalmanFilter(true) // Keep Kalman as first pass
            // Custom smoothing logic
            .setGazeListener(function (data, elapsedTime) {
                if (data == null) return;

                // Smooth the data
                const smoothed = getSmoothedCoordinates(data.x, data.y);

                // Update custom cursor
                updateSmoothCursor(smoothed.x, smoothed.y);

                // console.log(`Raw: (${data.x.toFixed(0)}, ${data.y.toFixed(0)}) -> Smooth: (${smoothed.x.toFixed(0)}, ${smoothed.y.toFixed(0)})`);
            })
            .begin();

        console.log("WebGazer initialized with Kalman Filter!");

        // Create custom smooth cursor
        createSmoothCursor();

        // 2. Start Calibration
        startCalibration();

    } catch (e) {
        console.error("WebGazer failed to init:", e);
        alert("WebGazer failed to start. Check console.");
    }
}

// Calibration Logic
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
    // Clean up previous points
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

    // Visual indicator of clicks needed (optional)
    point.title = `Click ${5 - clickCount} more times`;

    point.addEventListener('click', (e) => {
        const x = e.clientX;
        const y = e.clientY;

        // WebGazer automatically learns from clicks, so we just track progress
        clickCount++;

        // Visual feedback (flash or shrink)
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
    alert("Calibration Complete! The red dot should now follow your eyes.");

    // Show instruction again or some success message
    const msg = document.createElement('div');
    msg.style.position = 'fixed';
    msg.style.top = '10px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.background = 'rgba(0,255,0,0.8)';
    msg.style.padding = '10px';
    msg.style.borderRadius = '5px';
    msg.innerText = "Tracking Active";
    document.body.appendChild(msg);

    // Keep prediction points HIDDEN so user sees our smooth dot instead
    webgazer.showPredictionPoints(false);
}


// --- CUSTOM SMOOTHING LOGIC ---

// History buffer for smoothing (higher logic = smoother but more lag)
const HISTORY_SIZE = 40; // Doubled buffer size for extreme smoothness
const gazeHistory = [];

function getSmoothedCoordinates(x, y) {
    gazeHistory.push({ x, y });

    // Keep history at fixed size
    if (gazeHistory.length > HISTORY_SIZE) {
        gazeHistory.shift();
    }

    // Calculate Weighted Average
    // Newest points get more weight
    let weightedX = 0;
    let weightedY = 0;
    let totalWeight = 0;

    for (let i = 0; i < gazeHistory.length; i++) {
        // High smoothing weight
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


// --- CUSTOM CURSOR UI ---
let smoothCursor = null;

function createSmoothCursor() {
    if (smoothCursor) return;

    smoothCursor = document.createElement('div');
    smoothCursor.id = 'smoothCursor';
    smoothCursor.style.position = 'fixed';
    smoothCursor.style.width = '20px'; // Size
    smoothCursor.style.height = '20px';
    smoothCursor.style.borderRadius = '50%';
    smoothCursor.style.backgroundColor = 'rgba(0, 255, 255, 0.7)'; // Cyan color
    smoothCursor.style.boxShadow = '0 0 10px rgba(0,255,255,0.5)';
    smoothCursor.style.border = '2px solid white';
    smoothCursor.style.pointerEvents = 'none'; // Click through
    smoothCursor.style.zIndex = '999999';
    smoothCursor.style.transform = 'translate(-50%, -50%)'; // Center pivot
    smoothCursor.style.transition = 'top 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; // Slow, buttery transition

    document.body.appendChild(smoothCursor);
}

function updateSmoothCursor(x, y) {
    if (!smoothCursor) return;
    smoothCursor.style.left = x + 'px';
    smoothCursor.style.top = y + 'px';
}
