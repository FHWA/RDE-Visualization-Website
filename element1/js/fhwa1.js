/* Hide loading indicators once we've finished loading */
function hideLoading() {
    Array.prototype.forEach.call(document.getElementsByClassName('loading'),
        function (element) {
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
        });
};

function initScene(engine, canvas) {
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3.FromHexString('#0E0E0E');

    var curAngle = -Math.PI,
        radius = 10;

    var mapSize = 36,
        light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene),
        camera = initCamera(engine, scene, canvas, mapSize);

    // Old bounds
    //var swBound = { lat: 34.143107, lng: -118.155855 },
    //    neBound = { lat: 34.149439, lng: -118.141478 },
    // Colorado Blvd
    //var swBound = { lat: 34.131058, lng: -118.130513 },
    //    neBound = { lat: 34.1505534, lng: -118.1031903 },
    // Highway
    var swBound = { lat: 34.144986, lng: -118.162222},
        neBound = { lat: 34.155044, lng: -118.149925},
        zoomLevel = 17,
        map = initMap(scene, mapSize, swBound, neBound, zoomLevel),
        roadNetwork = initRoadNetwork(scene, map),
        particles = initVehicleParticles(scene, roadNetwork);

    particles.then(function (particles) {
        var hud = initHUD(scene, particles.curTime());

        Promise.all([hud, roadNetwork]).then(function (results) {
            var hud = results[0],
                roadNetwork = results[1];

            // Hide loading elements
            hideLoading();

            FHWA.Broadcaster.subscribe(FHWA.Event.HUDEnter, function () {
                camera.disable();
                roadNetwork.disableInteraction();
            });

            FHWA.Broadcaster.subscribe(FHWA.Event.HUDLeave, function () {
                camera.enable();
                roadNetwork.enableInteraction();
            });

            FHWA.Broadcaster.subscribe(FHWA.Event.TimeUpdate, function (curTime) {
                // Only update the HUD if it's not busy responding to user input
                if (hud.ready()) {
                    hud.updateTime(curTime);
                }
            });
            FHWA.Broadcaster.subscribe(FHWA.Event.LinkSelect, function (linkData) {

                // Add the volume/speed data (in both directions)
                // to the base link data
                // so the HUD can draw the sparklines
                var aggLinkData = particles.getAggregateLinkData(
                        linkData.uniqueLinkID),
                    reverseAggLinkData = particles.getAggregateLinkData(
                        linkData.reverseUniqueLinkID);

                linkData.volume = aggLinkData.volume;
                linkData.speed = aggLinkData.speed;
                linkData.reverseVolume = reverseAggLinkData.volume;
                linkData.reverseSpeed = reverseAggLinkData.speed;
                hud.updateSelectedLink(linkData);

                // Make sure the page is scrolled so the div is in full view
                document.getElementById('babylon-viz').scrollIntoView();

            });
            FHWA.Broadcaster.subscribe(FHWA.Event.LinkDeselect, function () {
                hud.updateSelectedLink({});
            });

            FHWA.Broadcaster.subscribe(FHWA.Event.CameraAngleUpdate, function (angle) {
                hud.updateCameraAngle(angle.alpha, angle.beta);
            });

            FHWA.Broadcaster.subscribe(FHWA.Event.LinkDirectionHighlight, function (direction) {
                hud.updateHighlightedLinkDirection(direction);
            });

            FHWA.Broadcaster.subscribe(FHWA.Event.LinkDirectionUnhighlight, function () {
                hud.updateHighlightedLinkDirection(null);
            });

            // Don't start rendering until everything is ready
            engine.runRenderLoop(function () {
                // If the HUD isn't responding to user input, increment time
                // normally
                if (hud.ready()) {
                    particles.incrementTime();
                }
                // Else, set the current time from the HUD
                else {
                    particles.curTime(hud.curTime());
                }
                particles.update();

                FHWA.Broadcaster.publish(FHWA.Event.TimeUpdate, particles.curTime());

                scene.render();
            });

        });
    });

    return scene;
}

/* Modify the alert div to let the user know we weren't able to
 * init a webGL context and can't display the viz */
function alertNoWebGL() {
    var alertHeading = document.getElementById('alert-heading');
    alertHeading.innerHTML = "WebGL Could Not Be Initialized";
  
    var alertText = document.getElementById('alert-text');
    alertText.innerHTML = "Sorry!  Visualization Element 1 requires WebGL.  Your browser was unable to initalize WebGL, so we can't display it for you.  Please see the video below for a demonstration.";
  
    var alertDiv = document.getElementById("alert-div");
    alertDiv.className = 'usa-alert usa-alert-error';

    // Remove the canvas for the viz
    var babylonViz = document.getElementById('babylon-viz');
    babylonViz.remove();
}

function init() {
    var canvas = document.getElementById('babylon-viz');

    try {
        var engine = new BABYLON.Engine(canvas, true, null, false),
            scene = initScene(engine, canvas);

        // Set up the loading background to match the canvas size
        // and position the loading svg within it appropriately
        var loadingBg = document.getElementById('loading-bg'),
            loadingSpinner = document.getElementById('loading-spinner'),
            renderWidth = engine.getRenderWidth(),
            renderHeight = engine.getRenderHeight();

        loadingBg.style.width = renderWidth;
        loadingBg.style.height = renderHeight;

        // Centered based on hard-coded width in CSS
        loadingSpinner.style.left = renderWidth/2 - 100;
        loadingSpinner.style.top = renderHeight/2 - 100;
        // Reveal it, now that it's in the right place
        loadingSpinner.style.opacity = 1.0;
        loadingSpinner.style.visibility = 'visible';

        window.addEventListener('resize', function () {
            engine.resize();
        });
    }
    catch (e) {
        if (e instanceof TypeError) {
            alertNoWebGL();
        }
        else {
            throw e;
        }
    }

}

init();
