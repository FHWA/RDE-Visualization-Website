function initCamera(engine, scene, canvas, mapSize) {
    var camera = {};
    
    var mouseX, mouseY, lMouseDown, rMouseDown,
        lastMousePosition = new BABYLON.Vector2(0, 0),
        // Determines the proportion of x/y pixel distance
        // that gets reflected in scene coordinate distance
        moveCoeff = 0.03,
        // Determines the proportion of mouse wheel rotation distance
        // that gets reflected in camera radius distance
        wheelCoeff = 0.03,
        // Same for camera alpha/beta angles
        alphaCoeff = 0.01,
        betaCoeff = 0.01,
        // Don't respond to any interaction if we're disabled
        enabled = true;

    camera.enable = function () {
        enabled = true;
    };

    camera.disable = function () {
        enabled = false;
        setLMouseUp();
        setRMouseUp();
    };

    var setLMouseUp = function () {
        lMouseDown = false;
        canvas.classList.remove('grab-cursor');
    };

    var setLMouseDown = function () {
        lMouseDown = true;
        canvas.classList.add('grab-cursor');
    };

    var setRMouseUp = function () {
        rMouseDown = false;
    };

    var setRMouseDown = function () {
        rMouseDown = true;
    };

    var init = function () {
        // Set up initial position
        var babylonCamera = new BABYLON.ArcRotateCamera('camera', -Math.PI/2, Math.PI/4,
            mapSize * 0.3,
            new BABYLON.Vector3(0, 0, 0), scene);

        babylonCamera.setTarget(new BABYLON.Vector3(1, 0, -1));

        // Bound the camera, with a little offset to prevent
        // the user from seeing some awkward clipping when it's
        // all the way in one direction
        var epsilon = 0.2;
        babylonCamera.lowerBetaLimit = epsilon;
        babylonCamera.upperBetaLimit = Math.PI/2 - epsilon;
        babylonCamera.lowerRadiusLimit = 5;
        babylonCamera.upperRadiusLimit = mapSize;


        // Don't give camera control to the canvas; we want to do it ourselves
        //babylonCamera.attachControl(canvas, false);


        // Disable the context menu on the canvas so we can use right-click
        // for other things
        canvas.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            return false;
        });

        // Handle left/right mouse down for panning/angling
        canvas.addEventListener('mousedown', function (e) {
            if (enabled) {
                lastMousePosition.x = e.clientX;
                lastMousePosition.y = e.clientY;

                if (e.which === 1) {
                    setLMouseDown();
                }
                else if (e.which === 3) {
                    setRMouseDown();
                }
            }

            e.preventDefault();
            return false;
        }, false);

        // Handle left/right mouse move
        canvas.addEventListener('mousemove', function (e) {
            if (enabled && (lMouseDown || rMouseDown)) {
                var x = e.clientX,
                    y = e.clientY,
                    xDelta = (x - lastMousePosition.x),
                    zDelta = (y - lastMousePosition.y);

                if (lMouseDown) {
                    // We want to move the camera relative to its current
                    // position; "up" is along the camera's direction, while
                    // "right" is orthogonal to its direction in the XZ plane
                    var cameraDirection = babylonCamera.target
                        .subtract(babylonCamera.position);

                    // We only care about the XZ components, and we need it
                    // normalized
                    cameraDirection.y = 0;
                    cameraDirection.normalize();

                    // Determine the front/back (longitudinal) component of movement
                    // from the up/down mouse movement and scale it with the
                    // camera's direction;
                    // determine the left/right (lateral) component of movement
                    // from the left/right mouse movement and scale it with the
                    // vector orthogonal to the camera's direction in the XZ plane
                    var lngComponent = cameraDirection.scale(zDelta * moveCoeff),
                        latComponent = BABYLON.Vector3.Cross(cameraDirection, BABYLON.Axis.Y)
                            .scale(xDelta * moveCoeff),
                        moveDirection = lngComponent.add(latComponent);

                    babylonCamera.target.x = FHWA.Util.clamp(
                        babylonCamera.target.x + moveDirection.x,
                        -mapSize/2, mapSize/2);
                    babylonCamera.target.z = FHWA.Util.clamp(
                        babylonCamera.target.z + moveDirection.z,
                        -mapSize/2, mapSize/2);

                }
                else if (rMouseDown) {
                    babylonCamera.alpha = babylonCamera.alpha -
                        alphaCoeff * xDelta;
                    babylonCamera.beta = FHWA.Util.clamp(
                        babylonCamera.beta - betaCoeff * zDelta,
                        babylonCamera.lowerBetaLimit,
                        babylonCamera.upperBetaLimit);

                    FHWA.Broadcaster.publish(FHWA.Event.CameraAngleUpdate, {
                       alpha: babylonCamera.alpha,
                       beta: babylonCamera.beta
                    });

                }

                lastMousePosition.x = x;
                lastMousePosition.y = y;
            }

        });

        canvas.addEventListener('mouseup', function (e) {
            if (enabled) {
                if (e.which === 1) {
                    setLMouseUp();
                }
                else if (e.which === 3) {
                    setRMouseUp();
                }
            }
        });

        canvas.addEventListener('mouseleave', function (e) {
            if (enabled) {
                setLMouseUp();
                setRMouseUp();
            }
        });

        var wheelHandler = function (e) {
            if (enabled) {
                babylonCamera.radius = FHWA.Util.clamp(
                    babylonCamera.radius + wheelCoeff * e.deltaY,
                    babylonCamera.lowerRadiusLimit,
                    babylonCamera.upperRadiusLimit);
            }

            // Stop event from scrolling the page
            e.preventDefault();
            return false;
        };

        // Use wheel and mouseWheel events for compatibility
        canvas.addEventListener('wheel', wheelHandler, false);
        canvas.addEventListener('mouseWheel', wheelHandler, false);

        return camera;
    }

    return init();

};
