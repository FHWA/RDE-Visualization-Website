/*
 * Factory function for the road network; returns a promise.
 * Requires the map.
 */
var initRoadNetwork = function (scene, map) {
    var network = {};

    var networkDefFile = 'data/highway_links_manual.geojson';

    var dataLoaded = false,
        // Keys: our unique link IDs, values: array of meshes/link objects that correspond
        // to the link (since it may be curved, with many actual lines)
        links = {},
        // Keys: Pasadena link IDs, values: aggregate data for each link (attributes
        // that apply to the whole link, not single points); used
        // to draw bounding boxes and send to the HUD
        linkAggregateData = {},
        // Keys: Pasadena link IDs, values: array (length 2) of bounding box meshes
        boundingBoxes = {},
        // Map from Pasadena link IDs to our link IDs (which are unique in
        // either direction)
        linkMappings = {},
        // Keep track of the link the user has clicked on, if any
        selectedLinkID = null,
        // Keep track of the link the user is hovering over, if any
        hoveredLinkID = null,
        // Keep track of the direction of the selected link the user has
        // highlighted, if any
        highlightedDirection = null,
        interactionEnabled = true,
        // Record what we should put the hover cursor back to when
        // interaction is re-enabled
        defaultHoverCursor = scene.hoverCursor;

    // Shape to be extruded for bounding boxes
    var boundingBoxSize = 0.25,
        boundingBoxShape = [
            new BABYLON.Vector3(boundingBoxSize, 0.01, 0),
            new BABYLON.Vector3(boundingBoxSize, -0.01, 0),
            new BABYLON.Vector3(0, -0.01, 0),
            new BABYLON.Vector3(0, 0.01, 0),
        ],
        boundingBoxTranslucentMaterial,
        boundingBoxTransparentMaterial,
        boundingBoxOpaqueMaterial,
        boundingBoxHighlightMaterial;

    /* Prevent interaction on meshes */
    network.disableInteraction = function () {
        interactionEnabled = false;
        // Change the cursor so the user is aware interaction is disabled
        scene.hoverCursor = 'auto';

        // Unhover the currently hovered link, if any (as long as it's not also
        // the currently selected link)
        if (hoveredLinkID !== null && hoveredLinkID !== selectedLinkID) {
            boundingBoxes[hoveredLinkID][0].material = boundingBoxTransparentMaterial;
            boundingBoxes[hoveredLinkID][1].material = boundingBoxTransparentMaterial;
            hoveredLinkID = null;
        }
    };

    /* Re-enable interaction on meshes */
    network.enableInteraction = function () {
        interactionEnabled = true;
        scene.hoverCursor = defaultHoverCursor;
    };

    network.isDataLoaded = function () {
        return dataLoaded;
    };

    /* Map from a given Pasadena Link ID and FromNode ID to our link IDs */
    network.getLinkID = function (pasadenaLinkID, fromNodeID) {
        return linkMappings[pasadenaLinkID + '-' + fromNodeID];
    };

    /* Return a list of all links in the road network;
     * will return nothing if data hasn't finished loading. */
    network.getLinks = function () {
        return links;
    };

    /* Given a Pasadena link ID, mark the link as selected and publish
     * the event; only do so if the link isn't currently selected.
     * If another link was previously selected, mark that one as
     * deselected */
    network.selectLink = function (linkID) {
        if (linkID !== selectedLinkID) {
            if (selectedLinkID !== null) {
                network.deselectLink();
            }
            // Publish the event that this link is selected
            selectedLinkID = linkID;
            FHWA.Broadcaster.publish(
                FHWA.Event.LinkSelect, linkAggregateData[linkID]);
        }
    };

    /* Handle events related to deselecting the currently selected link, if
     * any */
    network.deselectLink = function () {
        if (selectedLinkID !== null) {
            // Unhighlight the current highlighted direction, if any
            if (highlightedDirection !== null) {
                network.unhighlightLinkDirection();
            }

            // We can't properly trigger a click outside of a bounding box
            // from the bounding box's action manager, so handle deselecting
            // the box here
            boundingBoxes[selectedLinkID].forEach(function (boundingBox) {
                boundingBox.material = boundingBoxTransparentMaterial;
            });

            FHWA.Broadcaster.publish(
                FHWA.Event.LinkDeselect, linkAggregateData[selectedLinkID]);
            selectedLinkID = null;
        }
    };

    /* Once a link is selected, use highlighting to show which direction the
     * user is currently hovering over; only publish the event if this is
     * a new direction */
    network.highlightLinkDirection = function (direction) {
        if (direction !== highlightedDirection) {
            // Publish event that this direction is highlighted
            highlightedDirection = direction;
            FHWA.Broadcaster.publish(
                FHWA.Event.LinkDirectionHighlight, direction);
        }
    };

    /* Handle events related to unhighlighting the currently highlighted link,
     * if any */
    network.unhighlightLinkDirection = function () {
        if (highlightedDirection != null) {

            FHWA.Broadcaster.publish(
                FHWA.Event.LinkDirectionUnhighlight, highlightedDirection);
            highlightedDirection = null;
        }
    };

        // Publish the event that this link direction is highlighted

    var initMeshes = function () {
        var boundingBoxColor = new BABYLON.Color3(1, 1, 1);
        // Mesh is selected and hovered over
        boundingBoxOpaqueMaterial = new BABYLON.StandardMaterial(
            'bounding-box-opaque-material', scene);
        boundingBoxOpaqueMaterial.diffuseColor = boundingBoxColor;
        boundingBoxOpaqueMaterial.alpha = 0.3;
        boundingBoxOpaqueMaterial.backFaceCulling = false;
        boundingBoxOpaqueMaterial.freeze();

        // Mesh is hovered over but not selected
        boundingBoxTranslucentMaterial = new BABYLON.StandardMaterial(
            'bounding-box-translucent-material', scene);
        boundingBoxTranslucentMaterial.diffuseColor = boundingBoxColor;
        boundingBoxTranslucentMaterial.alpha = 0.2;
        boundingBoxTranslucentMaterial.backFaceCulling = false;
        boundingBoxTranslucentMaterial.freeze();

        // Mesh is hovered over and selected
        boundingBoxHighlightMaterial = new BABYLON.StandardMaterial(
            'bounding-box-highlight-material', scene);
        boundingBoxHighlightMaterial.diffuseColor = boundingBoxColor;
        boundingBoxHighlightMaterial.alpha = 0.6;
        boundingBoxHighlightMaterial.backFaceCulling = false;
        boundingBoxHighlightMaterial.freeze();


        // Mesh is neither hovered over nor selected
        boundingBoxTransparentMaterial = new BABYLON.StandardMaterial(
            'bounding-box-transparent-material', scene);
        boundingBoxTransparentMaterial.diffuseColor = boundingBoxColor;
        boundingBoxTransparentMaterial.alpha = 0;
        boundingBoxTransparentMaterial.backFaceCulling = false;
        boundingBoxTransparentMaterial.freeze();
    };


    /* Load the network definition data from the data file */
    var loadData = function () {
        var dataDownloaded = FHWA.Util.xhrGet(networkDefFile),
            meshesInit = initMeshes();

        return Promise.all([dataDownloaded, meshesInit]).then(function (results) {
            var geoJSON = JSON.parse(results[0]),
                // Keep a list of the lines (Vector3[]) for all links so we can combine them
                // into a LineSystem
                allLinkLines = [];

            geoJSON.features.forEach(function (feature) {
                var props = feature.properties;

                // Exclude bogus links
                if (props.NO !== '') {

                    // Since the Pasadena link ID is the same in both directions,
                    // use the from/to node IDs as the link ID
                    // The geoJSON only has a feature for each link in one direction;
                    // we need to add the reverse links ourselves
                    // Intuitively, we would expect these links to go "from" ->
                    // "to", but it seems everything is backwards if we go by
                    // that assumption, so we should actually go "to" -> "from"
                    // Also reverse the freeflow speed and numLanes
                    var uniqueLinkID = props.TONODENO + '-' + props.FROMNODENO,
                        reverseUniqueLinkID = props.FROMNODENO + '-' + props.TONODENO,
                        // Convert km/hr to mph
                        reverseFreeflowSpeed = FHWA.Util.kmhrToMph(+props.V0PRT),
                        freeflowSpeed = FHWA.Util.kmhrToMph(+props.R_V0PRT),
                        reverseNumLanes = props.NUMLANES,
                        numLanes = props.R_NUMLANES,
                        linkData = FHWA.Util.initProp(links, uniqueLinkID, []),
                        reverseLinkData = FHWA.Util.initProp(links, reverseUniqueLinkID, []),
                        // Accumulate all the bounding box points for the link so we can
                        // make an extrusion out of them
                        boundingBoxPoints = [];

                    var coordinates = feature.geometry.coordinates,
                        from, to,
                        boundingBox;

                    for (var i = 0; i < coordinates.length; i++) {
                        from = convertCoordinates(coordinates[i][1],
                            coordinates[i][0]);

                        boundingBoxPoints.push(from);

                        // Avoid an index error
                        if (i < coordinates.length - 1) {
                            to = convertCoordinates(coordinates[i+1][1],
                                coordinates[i+1][0]);

                            // Use the counterintuitive "to" -> "from"
                            // to draw the links correctly
                            linkData.push({
                                linkID: uniqueLinkID,
                                freeflowSpeed: freeflowSpeed,
                                line: [to, from],
                                numLanes: numLanes,
                            });
                            reverseLinkData.push({
                                linkID: reverseUniqueLinkID,
                                freeflowSpeed: reverseFreeflowSpeed,
                                line: [from, to],
                                numLanes: reverseNumLanes,
                            });

                            // Only draw the link in the forward direction, since it looks
                            // the same either way
                            allLinkLines.push([to, from]);
                        }

                    }

                    // Aggregate data, both directions of the link (recording which is
                    // reverse); used for drawing bounding box and HUD events
                    var aggregateData = {
                        linkID: props.NO,
                        uniqueLinkID: uniqueLinkID,
                        reverseUniqueLinkID: reverseUniqueLinkID,
                        freeflowSpeed: freeflowSpeed,
                        reverseFreeflowSpeed: reverseFreeflowSpeed,
                        numLanes: numLanes,
                        reverseNumLanes: reverseNumLanes,
                        points: boundingBoxPoints,
                    };

                    linkAggregateData[aggregateData.linkID] = aggregateData;

                    var linkBoundingBoxes = drawBoundingBoxes(boundingBoxPoints, aggregateData);
                    
                    boundingBoxes[aggregateData.linkID] = linkBoundingBoxes;

                    // Record the mapping from pasadena link/from node to our
                    // link IDs, for other files that don't have the FromNode
                    // and ToNode
                    // Again, use the counterintuitive "to" -> "from" to make sure
                    // things don't end up backwards
                    linkMappings[props.NO + '-' + props.TONODENO] = uniqueLinkID;
                    linkMappings[props.NO + '-' + props.FROMNODENO] = reverseUniqueLinkID;
                }
            });

            var allLinksMesh = BABYLON.MeshBuilder.CreateLineSystem('link-lines', {
                lines: allLinkLines,
                updatable: false,
            }, scene);
            
            // Performance optimizations
            allLinksMesh.freezeWorldMatrix();
            allLinksMesh.convertToUnIndexedMesh();
            allLinksMesh.isPickable = false;

            // Return the road network so callers can access it when the promise
            // has been fulfilled
            return network;
        });
    };


    /* Convert line coordinates from lat/lng to the a Vector3 in
     * the world coordinate system, using the position of the map */
    var convertCoordinates = function (lat, lng) {
        var worldCoords = map.latlngToWorldCoords({
            lat: lat,
            lng: lng,
        });
        // worldCoords is just x/z
        // Draw links a little above the map so they don't clip through it
        return new BABYLON.Vector3(worldCoords.x, 0.01, worldCoords.y);
    };


    /* Draw bounding boxes for both sides of a given path (Vector3[])
     * Assign hover/click events to the two boxes */
    var drawBoundingBoxes = function (path, linkData) {

        var boundingBox = drawBoundingBox(path, linkData),
            boundingBoxReverse = drawBoundingBox(path.reverse(), linkData),
            boxes = [boundingBox, boundingBoxReverse];

        // Function to generate an action we'll use repeatedly --
        // set the material on a given bounding box
        var createSetMaterialAction = function (boundingBox, material, condition) {
            return new BABYLON.SetValueAction(
                BABYLON.ActionManager.NothingTrigger,
                boundingBox, 'material', material, condition);
        };


        // Set up interaction
        boxes.forEach(function (curBox) {
            // Forward direction is 'A'; reverse is 'B'
            var curDirection = curBox === boundingBox
                ? 'A'
                : 'B';

            curBox.actionManager = new BABYLON.ActionManager(scene);

            // We only want to activate hover events on the link if it isn't
            // selected and interaction is enabled
            var thisLinkIsNotSelected = new BABYLON.PredicateCondition(
                curBox.actionManager, function () {
                    return !(linkData.linkID === selectedLinkID) && interactionEnabled;
                }
            );

            // Only highlight the link on hover if it is selected and interaction is
            // enabled
            var thisLinkIsSelected = new BABYLON.PredicateCondition(
                curBox.actionManager, function () {
                    return (linkData.linkID === selectedLinkID) && interactionEnabled;
                }
            );

            // For other actions... only trigger if interaction is enabled
            var interactionIsEnabled = new BABYLON.PredicateCondition(
                curBox.actionManager, function () {
                    return interactionEnabled;
                }
            );

            // Hover over event, not selected -- highlight with translucent material
            curBox.actionManager.registerAction(new BABYLON.CombineAction(
                BABYLON.ActionManager.OnPointerOverTrigger, [
                    // Trigger our own event for link hover
                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.NothingTrigger,
                        function () {
                            boundingBox.material = boundingBoxTranslucentMaterial;
                            boundingBoxReverse.material = boundingBoxTranslucentMaterial;
                            hoveredLinkID = linkData.linkID;

                            FHWA.Broadcaster.publish(
                                FHWA.Event.LinkMouseOver, linkData);
                        }
                    ),
                ], thisLinkIsNotSelected));

            // Hover over event, selected -- highlight ONLY THIS side with
            // highlight material
            curBox.actionManager.registerAction(new BABYLON.CombineAction(
                BABYLON.ActionManager.OnPointerOverTrigger, [
                    createSetMaterialAction(curBox, boundingBoxHighlightMaterial,
                        thisLinkIsSelected),

                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.NothingTrigger,
                        function () {
                            network.highlightLinkDirection(curDirection);
                        }
                    ),
                ], thisLinkIsSelected)
            );

            // Hover out event, selected -- move ONLY THIS side back to opaque
            // material
            curBox.actionManager.registerAction(new BABYLON.CombineAction(
                BABYLON.ActionManager.OnPointerOutTrigger, [
                    createSetMaterialAction(curBox, boundingBoxOpaqueMaterial,
                        thisLinkIsSelected),

                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.NothingTrigger,
                        function () {
                            network.unhighlightLinkDirection();
                        }
                    ),
                ], thisLinkIsSelected)
            );

            // Hover out event, not selected -- go back to transparent material
            curBox.actionManager.registerAction(new BABYLON.CombineAction(
                BABYLON.ActionManager.OnPointerOutTrigger, [
                    // Trigger our own event for link hover out
                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.NothingTrigger,
                        function () {
                            boundingBox.material = boundingBoxTransparentMaterial;
                            boundingBoxReverse.material = boundingBoxTransparentMaterial;
                            hoveredLinkID = null;

                            FHWA.Broadcaster.publish(
                                FHWA.Event.LinkMouseOut, linkData);
                        }
                    ),
                ], thisLinkIsNotSelected));

            // Click event -- select
            curBox.actionManager.registerAction(new BABYLON.CombineAction(
                BABYLON.ActionManager.OnPickTrigger, [
                    
                    // Run selection first so the material update works properly
                    // in the event we're re-selecting a link that was already
                    // selected
                    new BABYLON.ExecuteCodeAction(
                        BABYLON.ActionManager.NothingTrigger,
                        function () {
                            network.selectLink(linkData.linkID);

                            // One of these is redundant, since we're setting this
                            // box's texture to highlight
                            boundingBox.material = boundingBoxOpaqueMaterial;
                            boundingBoxReverse.material = boundingBoxOpaqueMaterial;

                            curBox.material = boundingBoxHighlightMaterial;

                            // Fire the highlight event, since our mouse is now over
                            // this link
                            network.highlightLinkDirection(curDirection);
                        }
                    ),
                ], interactionIsEnabled));
        });

        return boxes;
    };


    /* Draw geometry for a bounding box determined by the given path
     * Use extruded meshes to make curves look nice */
    var drawBoundingBox = function (path, linkData) {
        var xAxis = BABYLON.Axis.X;

        // Function for calculating rotation angles for the extrusion
        var extrusionRotation = function (i) {
            var rotationAngle = 0;
            if (i < (path.length - 1)) {
                var linkUnitVector = path[i+1].subtract(path[i]).normalize();
                
                rotationAngle = FHWA.Util.angleBetween(linkUnitVector, xAxis);
            }

            return 0;
        };

        var boundingBox = BABYLON.MeshBuilder.ExtrudeShapeCustom(
            'link-bounding-box-' + linkData.linkID,
            {
                shape: boundingBoxShape,
                path: path,
                rotationFunction: extrusionRotation,
                updatable: false,
                // Our shape doesn't close itself, so make the ribbon
                // do it
                ribbonClosePath: true,
                // Make sure lighting affects the mesh properly
                sideOrientation: BABYLON.Mesh.BACKSIDE,
            }, scene);

        boundingBox.material = boundingBoxTransparentMaterial;

        // Optimizations for performance
        boundingBox.freezeWorldMatrix();
        boundingBox.convertToUnIndexedMesh();

        return boundingBox;
    };


    // Set up event listeners that will deselect the link if the mouse is clicked
    // outside of any links
    // NOTE: this assumes the bounding boxes are the only pickable meshes in the scene;
    // if that doesn't hold true anymore, this will need changing
    // Probably will just need to add a predicate to the call to scene.pick
    var canvas = scene.getEngine().getRenderingCanvas(),
        mouseDownCoords = new BABYLON.Vector2(),
        mouseUpCoords = new BABYLON.Vector2(),
        clickDelta = 1;

    canvas.addEventListener('mousedown', function () {
        mouseDownCoords.x = scene.pointerX;
        mouseDownCoords.y = scene.pointerY;
    });

    canvas.addEventListener('mouseup', function () {
        mouseUpCoords.x = scene.pointerX;
        mouseUpCoords.y = scene.pointerY;

        // Check for a minimum movement delta to ensure we don't trigger this from drag
        // events (click events only)
        // Also don't trigger if interaction is currently disabled
        if (interactionEnabled && BABYLON.Vector2.Distance(mouseDownCoords, mouseUpCoords) < clickDelta) {
            var pickResult = scene.pick(scene.pointerX, scene.pointerY);

            if (!pickResult.hit) {
                network.deselectLink();
            }
        }
    });

    // Return the promise that is resolved with the network object when data
    // has been loaded
    return loadData();
};
