window.onload = async function() {
    // Force the tracker to use the MediaPipe Facemesh files you just added
    webgazer.setTracker("TFFacemesh");

    await webgazer.setGazeListener(function(data, elapsedTime) {
        if (data == null) {
            return;
        }
        
        var x = data.x; // relative to viewport
        var y = data.y; // relative to viewport
        
        console.log(`Gaze Location: (${x}, ${y}) at ${elapsedTime}ms`);
    }).begin();

    // Visual aids to confirm it's working
    webgazer.showVideoPreview(true) 
             .showPredictionPoints(true); 
};