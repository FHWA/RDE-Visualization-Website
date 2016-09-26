/* Returns a promise that resolves to the HUD object
 * when fonts have finished loading and rendering has
 * finished. */
function initHUD(scene, initTime) {
    var hud = {};

    var CLOCK_FONT = 'Share Tech Mono',
        HUD_FONT = 'Share Tech Mono';
        //HUD_FONT = 'Source Sans Pro';

    var curTime = initTime;

    var canvas,
        clock,
        // BABYLON Canvas2D objects
        selectedLinkDisplay,
        selectedLinkText,
        selectedLinkLinesDisplay,
        selectedLinkLines,
        selectedLinkAFlowLines,
        selectedLinkBFlowLines,
        selectedLinkAText,
        selectedLinkBText,
        selectedLinkDisplayBg,
        selectedLinkSparklinesDisplay,
        linkDirectionHighlight,
        timeSlider,
        timeSliderHandle,
        // List of all the labels for the sparklines
        // and their Canvas2D objects
        sparklineLabels,
        // List of all the sparklines and their Canvas2D
        // objects
        sparklines,
        // Init this to undefined, since that's what
        // it will be if there's no link data (and we want
        // the init case to be the same as the no link data
        // case)
        selectedLinkID = undefined,
        // If a link is selected, this is the direction on the
        // link that the user has currently highlighted ('A'/'B')
        highlightedLinkDirection,
        // If elements on the canvas are given this position,
        // they will be hidden off-screen
        linkDisplayHiddenPosition = new BABYLON.Vector2(-9999, -9999),
        timeFormat = 'hh:mma',
        // minTime and maxTime of data in seconds from midnight
        minTime = 0,
        maxTime = 60 * 60 * 24,
        // Drop every `sparklineDownsampleFactor`th point from the sparklines
        // to prevent super jagged slopes and trying to pack too many points into
        // the small lines
        sparklineDownsampleFactor = 4,
        // Keep track of whether the user is currently dragging the
        // time slider
        draggingTimeSlider = false,
        paused = false;

    hud.timeFormat = function (_) {
        if (!arguments.length) {
            return timeFormat;
        }
        timeFormat = _;
    };

    hud.curTime = function (_) {
        if (!arguments.length) {
            return curTime;
        }
        curTime = _;
    };

    /* Returns true if the HUD isn't handling user input and
     * false otherwise.  Used to let the caller know if they'll be
     * overriding user input if they call `updateTime()`. */
    hud.ready = function () {
        return !(draggingTimeSlider || paused);
    };

    hud.updateTime = function (newTime) {
        curTime = newTime;
        clock.text = formatCurTime();

        // Update the time slider
        // Get the curTime as a fraction of maxTime-minTime;
        // basically, how far through the time period are we, as a float in the
        // range [0,1].
        // Only needed if we're not being dragged
        if (hud.ready()) {
            curTimeFraction = minTime + (curTime.seconds() + curTime.minutes() * 60
                + curTime.hours() * 60 * 60) / (maxTime - minTime);
            moveTimeSliderHandle(curTimeFraction);
        }

        // Update the position of the progress circles on all the sparklines, if any
        sparklines.forEach(function (config) {
            if (config.obj !== null) {
                // Figure out which point corresponds to curTime
                var curPointNdx = 0,
                    curTimeStr = curTime.format('HH:mm:ss');

                while (config.data[curPointNdx].timestamp < curTimeStr) {
                    curPointNdx++;
                    // Wrap back to the beginning if we've gone past the end of the data
                    if (curPointNdx === config.data.length) {
                        curPointNdx = 0;
                        break;
                    }
                }

                var curPoint = config.data[curPointNdx];

                // TODO reduce some of the redundancy
                // between here and the init func
                config.progressPoint.position = new BABYLON.Vector2(
                    config.scaleX * curPointNdx - (config.progressPoint.actualSize.width/2),
                    config.scaleY * curPoint.datum - (config.progressPoint.actualSize.height/2));
            }
        });
    };

    /* Given updated camera angles, update our state accordingly */
    hud.updateCameraAngle = function (alpha, beta) {
        // Need to negate the angle and add an offset here to account
        // for the initial position of the camera (and differences in how
        // it rotates compared to how we should rotate)
        var linkLinesRotation = -alpha - Math.PI/2;
        selectedLinkLinesDisplay.rotation = linkLinesRotation;

        // Apply the same rotation but reversed to the A/B text; we want these to always
        // be facing "up"
        selectedLinkAText.rotation = -linkLinesRotation;
        selectedLinkBText.rotation = -linkLinesRotation;
    };

    hud.updateSelectedLink = function (linkData) {
        // Only update state if this is a new selection event
        if (selectedLinkID !== linkData.linkID) {
            // Unhighlight the direction, since we're switching links
            hud.updateHighlightedLinkDirection(null);
            selectedLinkID = linkData.linkID;

            // Hide/show link name
            var linkName = selectedLinkID
                // Coerce int to string
                ? 'Link ID: ' + selectedLinkID
                : '';
            selectedLinkText.text = linkName;

            // Hide/show link display background
            selectedLinkDisplay.position = selectedLinkID
                ? BABYLON.Vector2.Zero()
                : linkDisplayHiddenPosition;

            // Disable/enable mouse events
            selectedLinkDisplay.isPickable = !!selectedLinkID;

            // Hide/show link lines and labels
            updateLinkLines(linkData);

            // Hide/show sparklines and labels
            updateSparklines(linkData);
        }
    };

    hud.updateHighlightedLinkDirection = function (direction) {
        // Only update state if this is a new highlight event
        if (highlightedLinkDirection != direction) {
            highlightedLinkDirection = direction;

            // Hide/show direction highlight
            highlightLinkDirection(direction);
        }
    };

    /* Draws a dashed line (made up of many smaller lines) along the
     * given points.  Specify the parent of the resulting Group2D,
     * length of dashes, the length of the
     * gap between them, their thickness, and their fill. */
    var drawDashedLine = function (points, parent, lineLength, gapLength, thickness, fill) {
        var dashGroup = new BABYLON.Group2D({
            id: 'hud-dashed-line',
            parent: parent,
        });

        var i = 0,
            // Length of our current dash segment
            curLength = 0,
            // Offset from the current point to the next point -- between 0 and 1
            curOffset = 0,
            curVector = points[i+1].subtract(points[i]),
            curVectorLength = curVector.length(),
            // Vector covering the rest of this interval
            // (accounting for the curOffset)
            remainingVector = curVector
                .scaleInPlace(1-curOffset),
            remainingVectorLength = remainingVector.length(),
            // Current point to start drawing
            curPoint = points[i+1].subtract(remainingVector),
            // Length we have left to draw
            remainingDrawLength = lineLength - curLength,
            remainingGapLength = gapLength - curLength,
            drawPoints = [];

        while (true) {
            drawPoints.push(curPoint);

            // Skip past points where we're just drawing through them, adding
            // them to our line as we go
            while (remainingDrawLength > remainingVectorLength) {
                curLength += remainingVectorLength;
                curOffset = 0;
                drawPoints.push(points[++i]);
                if (points[i+1] === undefined) {
                    break;
                }
                curVector = points[i+1].subtract(points[i]);
                curVectorLength = curVector.length();
                remainingVector = curVector.clone();
                remainingVectorLength = remainingVector.length();
                curPoint = points[i];
                remainingDrawLength = lineLength - curLength;

            }

            // If we've gone past the end of the array, we're done
            if (points[i+1] === undefined) {
                break;
            }

            // Add the endpoint: scale the curVector
            // such that its length is the rest of the length we
            // need to add to curLength to get to lineLength, and add
            // it to the current point.
            curOffset = curOffset + (lineLength - curLength) / curVectorLength;
            drawPoints.push(points[i].add(
                curVector.scale(curOffset)));
            remainingVector = curVector
                .scale(1-curOffset);
            remainingVectorLength = remainingVector.length();
            curPoint = points[i+1].subtract(remainingVector),
            curLength = 0;
            remainingDrawLength = lineLength;

            new BABYLON.Lines2D(drawPoints, {
                id: 'hud-dashed-line-dash',
                parent: dashGroup,
                fillThickness: thickness,
                fill: fill,
                zOrder: 0,
            });
            drawPoints = [];

            // Skip past the next gap
            while (remainingGapLength > remainingVectorLength) {
                curLength += remainingVectorLength;
                curOffset = 0;
                ++i;
                if (points[i+1] === undefined) {
                    break;
                }
                curVector = points[i+1].subtract(points[i]);
                curVectorLength = curVector.length();
                remainingVector = curVector.clone();
                remainingVectorLength = remainingVector.length();
                curPoint = points[i];
                remainingGapLength = gapLength - curLength;
            }

            // If we've gone past the end of the array, we're done
            if (points[i+1] === undefined) {
                break;
            }

            // Keep the curOffset updated for our next go around
            curOffset = curOffset + (gapLength - curLength) / curVectorLength;
            remainingVector = curVector
                .scale(1-curOffset);
            remainingVectorLength = remainingVector.length();
            curPoint = points[i+1].subtract(remainingVector),
            curLength = 0;
            remainingGapLength = gapLength;


        };

        // If we were in the middle of drawing a line, finish it with
        // the end point
        if (drawPoints.length > 0) {
            drawPoints.push(points[points.length-1]);

            new BABYLON.Lines2D(drawPoints, {
                id: 'hud-dashed-line-dash',
                parent: dashGroup,
                fillThickness: thickness,
                fill: fill,
            });
        }

        return dashGroup;
    };


    var updateLinkLines = function (linkData) {
        // Default if there's no link data
        var labelAPosition = BABYLON.Vector2.Zero(),
            labelBPosition = BABYLON.Vector2.Zero(),
            // Offset label text so we can place it with the letters centered
            // instead of from the bottom left
            labelTextOffset = new BABYLON.Vector2(-8, -12);

        if (selectedLinkLines) {
            // Can't update points on a Lines2D ATM, so we have to make a new one
            // each time; dispose of the old ones
            selectedLinkLines.dispose();
            if (selectedLinkAFlowLines) {
                selectedLinkAFlowLines.dispose();
            }
            if (selectedLinkBFlowLines) {
                selectedLinkBFlowLines.dispose();
            }
        }

        // If we have link data, draw the lines/labels
        if (selectedLinkID) {

            // Draw a small version of the link's geometry
            var minBound = new BABYLON.Vector3(Number.MAX_VALUE, 0, Number.MAX_VALUE),
                maxBound = new BABYLON.Vector3(-Number.MAX_VALUE, 0, -Number.MAX_VALUE);

            // Find the max/min; we'll translate everything so the centroid is (0,0)
            // and scale so distance from min/max is 1
            linkData.points.forEach(function (point) {
                if (point.x < minBound.x) {
                    minBound.x = point.x;
                }
                if (point.x > maxBound.x) {
                    maxBound.x = point.x;
                }

                if (point.z < minBound.z) {
                    minBound.z = point.z;
                }
                if (point.z > maxBound.z) {
                    maxBound.z = point.z;
                }
            });

            var centroid = BABYLON.Vector3.Center(minBound, maxBound),
                boundLength = BABYLON.Vector3.Distance(minBound, maxBound),
                // Transform according to centroid, so each link's transformed
                // coordinates are relative to its centroid
                transformation = BABYLON.Matrix.Translation(
                    -centroid.x, -centroid.y, -centroid.z
                ).multiply(BABYLON.Matrix.Scaling(
                    // divide by boundLength to normalize, and multiply
                    // by fraction of link display width for viewing
                    (selectedLinkDisplay.actualSize.width * 0.35) / boundLength,
                    0,
                    (selectedLinkDisplay.actualSize.width * 0.35) / boundLength
                ));

            var points = linkData.points.map(function (point) {
                    var vec = BABYLON.Vector3.TransformCoordinates(point, transformation);
                    return new BABYLON.Vector2(vec.x, vec.z);
                }),
                // Copy the array before reversing, since reverse()
                // operates in-place
                reversePoints = points.slice().reverse();

            // Points representing the initial direction of the A/B links
            var aVector = points.slice(0, 2),
                bVector = reversePoints.slice(0, 2),
                // Thickness of each line depends on how many lanes there are
                // Draw at least one lane's worth of thickness
                laneThickness = 6,
                aThickness = laneThickness * linkData.numLanes,
                bThickness = laneThickness * linkData.reverseNumLanes;
                aFlowLineOffset = aThickness + 1.25*laneThickness,
                bFlowLineOffset = bThickness + 1.25*laneThickness,
                aLabelOffset = aFlowLineOffset + 2.5*laneThickness,
                bLabelOffset = bFlowLineOffset + 2.5*laneThickness;

            // Place the labels at a point a set distance away from each line
            labelAPosition = pointOffsetFromLine(aVector, aLabelOffset);
            labelBPosition = pointOffsetFromLine(bVector, bLabelOffset); 

            var backgroundLinePoints = pathOffsetAlongNormal(points, (aThickness - bThickness)/2);

            // Place the flow lines a distance away from each line based on how many
            // lanes there are
            var flowLineAPoints = lineOffsetFromLine(aVector, aFlowLineOffset),
                flowLineBPoints = lineOffsetFromLine(bVector, bFlowLineOffset);

            selectedLinkLines = new BABYLON.Group2D({
                id: 'hud-selected-link-lines',
                parent: selectedLinkLinesDisplay,
            });
            
            var selectedLinkBackgroundLines = new BABYLON.Lines2D(backgroundLinePoints, {
                id: 'hud-selected-link-background-lines',
                parent: selectedLinkLines,
                fillThickness: aThickness + bThickness,
                fill: BABYLON.Canvas2D.GetBrushFromString('#000000FF'),
                zOrder: 0,
            });

            // Draw direction divider lines (i.e. the median)
            var selectedLinkDividerLines = new BABYLON.Lines2D(points, {
                id: 'hud-selected-link-divider-lines',
                parent: selectedLinkLines,
                fillThickness: 1.5,
                fill: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
                zOrder: 0,
            });

            var lanePoints,
                laneDividerBrush = BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
                lineLength = 5,
                gapLength = 5,
                thickness = 0.75;

            // Draw lane divider lines for each side
            for (var i = 1; i < linkData.numLanes; ++i) {
                lanePoints = pathOffsetAlongNormal(points, i*laneThickness);
                drawDashedLine(lanePoints, selectedLinkLines,
                    lineLength, gapLength, thickness, laneDividerBrush);
            }
            for (var i = 1; i < linkData.reverseNumLanes; ++i) {
                lanePoints = pathOffsetAlongNormal(points, -i*laneThickness);
                drawDashedLine(lanePoints, selectedLinkLines,
                    lineLength, gapLength, thickness, laneDividerBrush);
            }

            var flowLinesBrush = BABYLON.Canvas2D.GetBrushFromString('#fad980FF');

            // Only draw each direction's line if there are lanes in the road
            if (linkData.numLanes > 0) {
                selectedLinkAFlowLines = new BABYLON.Lines2D(flowLineAPoints, {
                    id: 'hud-selected-link-a-flow-lines',
                    parent: selectedLinkLinesDisplay,
                    fillThickness: 5.03,
                    endCap: BABYLON.Lines2D.ArrowCap,
                    fill: flowLinesBrush,
                    zOrder: 0,
                });
                selectedLinkAFlowLines.isPickable = false;

                selectedLinkAText.text = 'A';
                // Label positions are relative to the base link position
                // Also account for the offset needed to get the position in
                // the center of the text
                selectedLinkAText.position = labelAPosition
                    .add(labelTextOffset);
            }
            else {
                selectedLinkAText.text = ' ';
            }

            // WEIRD BUG: for certain links (ex. 782789795), using the same fill
            // thickness for B and A prevents B from displaying.  Use a slightly
            // different fillThickness to attempt to fix this.
            //
            // TODO: try to reproduce in a playground and file as a bug?
            if (linkData.reverseNumLanes > 0) {
                selectedLinkBFlowLines = new BABYLON.Lines2D(flowLineBPoints, {
                    id: 'hud-selected-link-b-flow-lines',
                    parent: selectedLinkLinesDisplay,
                    fillThickness: 5.02,
                    endCap: BABYLON.Lines2D.ArrowCap,
                    fill: flowLinesBrush,
                    zOrder: 0,
                });
                selectedLinkBFlowLines.isPickable = false;

                selectedLinkBText.text = 'B';
                selectedLinkBText.position = labelBPosition
                    .add(labelTextOffset);
            }
            else {
                selectedLinkBText.text = ' ';
            }

        }

    };

    /* Given the link data, draw some sparklines: one for each combination
     * of direction (A, B) and metric (volume, speed). */
    var updateSparklines = function (linkData) {

        // Show/hide labels accordingly
        sparklineLabels.forEach(function (config) {
            if (!selectedLinkID) {
                config.obj.text = ' ';
            }
            else {
                config.obj.text = config.text;
            }
        });

        if (!selectedLinkID) {
            // If the sparklines are there and we now don't have a link
            // selected, destroy them all
            sparklines.forEach(function (config) {
                if (config.obj) {
                    config.obj.dispose();
                    config.obj = null;
                    config.data = null;
                    config.progressPoint = null;
                    // Just set text to whitespace; that will make it
                    // appear invisible
                    config.minYLabel.text = ' ';
                    config.maxYLabel.text = ' ';
                }
            });
        }
        else {
            // Otherwise, draw them all
            var sparklinesData = [
                // A Volume
                // Convert from 5 min link volume to hour
                // lane volume
                linkData.volume,
                // A speed
                linkData.speed,
                // B Volume
                linkData.reverseVolume,
                // B Speed
                linkData.reverseSpeed,
            ];

            // We want the Y scales to be the same in both directions
            // for volume and speed, so calculate those and send them
            // to the drawSparklines function as part of the config.
            var safeMax = function (arr) {
                var max = -Number.MAX_VALUE;
                if (arr) {

                    arr.forEach(function (d) {
                        max = Math.max(d.datum, max);
                    });

                }
                return max;
            };

            var volumeMaxY = Math.max(safeMax(sparklinesData[0]),
                    safeMax(sparklinesData[2])),
                speedMaxY = Math.max(safeMax(sparklinesData[1]),
                    safeMax(sparklinesData[3]));

            var maxYs = [
                // A Volume
                volumeMaxY,
                // A Speed,
                speedMaxY,
                // B Volume
                volumeMaxY,
                // B Speed
                speedMaxY,
            ];

            sparklines.forEach(function (config, i) {
                config.data = sparklinesData[i];
                config.maxY = maxYs[i];

                // Not all links have data in all directions;
                // only draw the line if there's data
                if (config.data) {
                    // Using all data points causes some sort of weird
                    // artifacting when the lines are too jagged --
                    // fix this by downsampling and taking only every `downsampleFactor`th
                    // point
                    config.data = config.data.filter(function (_, i) {
                        return (i % sparklineDownsampleFactor) === 0;
                    });
                    config.obj = drawSparkline(config);
                }
            });
        }
    };

    /* Given data/config, draw a sparkline.  Use curTime to draw an
     * emphasis point */
    var drawSparkline = function (config) {
        // Record what point we're at, for drawing an emphasis point
        var curPointNdx = 0,
            curPoint;

        var points = config.data.map(function (d, i) {
            if (curPointNdx === -1 && d.timestamp > curTime.format('HH:mm:ss')) {
                curPointNdx = i;
            }
            return new BABYLON.Vector2(i, d.datum);
        });

        curPoint = points[curPointNdx];

        // Get bounds of the line so we can scale it down to unit
        // length/height
        var minX = 0,
            maxX = points.length - 1,
            minY = 0,
            maxY = config.maxY;

        // Desired width/height in pixels
        var width = selectedLinkSparklinesDisplay.actualSize.width * 0.33,
            height = selectedLinkSparklinesDisplay.actualSize.height * 0.2;

        // Scale each point down so both X and Y fit into bounds [0, 1]
        // Then scale up to desired width/height
        config.scaleX = (1/maxX) * width;
        // Avoid dividing by zero, since maxY could be zero
        config.scaleY = (maxY === 0)
            ? 0
            : (1/maxY) * height;

        points.forEach(function (point) {
            point.x *= config.scaleX;
            point.y *= config.scaleY;
        });

        var position = new BABYLON.Vector2(
            selectedLinkSparklinesDisplay.actualSize.width * config.xCoeff,
            selectedLinkSparklinesDisplay.actualSize.height * config.yCoeff
        );

        var sparkline = new BABYLON.Lines2D(points, {
            id: 'hud-selected-link-sparkline-' + config.ndx,
            parent: selectedLinkSparklinesDisplay,
            position: position,
            fillThickness: 0.75,
            fill: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
        });

        // Draw ticks with min/max Y values for perspective
        var tickWidth = selectedLinkSparklinesDisplay.actualSize.width * 0.015,
            tickThickness = 2,
            tickFill = BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF');

        var minYTickPoints = [
            new BABYLON.Vector2.Zero(),
            new BABYLON.Vector2(-tickWidth, 0),
        ];
        var maxYTickPoints = [
            new BABYLON.Vector2(0, height),
            new BABYLON.Vector2(-tickWidth, height),
        ];

        var minYTick = new BABYLON.Lines2D(minYTickPoints, {
            id: 'hud-selected-link-sparkline-min-y-tick',
            parent: sparkline,
            fillThickness: tickThickness,
            fill: tickFill,
        });
        var maxYTick = new BABYLON.Lines2D(maxYTickPoints, {
            id: 'hud-selected-link-sparkline-max-y-tick',
            parent: sparkline,
            fillThickness: tickThickness,
            fill: tickFill,
        });

        var labelTextHeight = 8,
            minYLabelText = Math.ceil(minY).toString(),
            maxYLabelText = Math.ceil(maxY).toString();

        // Special case -- if the min/max are the same, set the min to be 0 so it doesn't look funny to
        // have 2 different numbers far apart on the y scale
        if (minYLabelText === maxYLabelText) {
            minYLabelText = '0';

            // Now, if min and max are BOTH 0, set max as "invisible"
            // so it doesn't look funny with both being 0
            // also dispose of the maxYTick since it isn't needed
            if (minYLabelText === maxYLabelText) {
                maxYLabelText = ' ';

                maxYTick.dispose();
            }
        }

        // Calculate an offset (in units of tickWidth)
        // to effectively right-justify each label based on its length
        // (assumes a monospace font)
        var charWidth = 4,
            minYLabelOffset = minYLabelText.length * charWidth,
            maxYLabelOffset = maxYLabelText.length * charWidth,
            minYLabelPosition = new BABYLON.Vector2(-(3*tickWidth + minYLabelOffset), -labelTextHeight/2),
            maxYLabelPosition = new BABYLON.Vector2(-(3*tickWidth + maxYLabelOffset), height - (labelTextHeight/2));

        // Disposing text objects in the Canvas2D is fairly finicky -- we want to create this obj
        // and change its text as necessary to make it visible/invisible
        if (!config.minYLabel) {
            config.minYLabel = new BABYLON.Text2D(minYLabelText, {
                id: 'hud-selected-sparkline-min-y-label',
                fontName: labelTextHeight + 'pt ' + HUD_FONT,
                fontSuperSample: true,
                position: position.add(minYLabelPosition),
                parent: selectedLinkSparklinesDisplay,
            });
        }
        else {
            config.minYLabel.text = minYLabelText;
            // Update position, too, since it affects how the text is justified
            config.minYLabel.position = position.add(minYLabelPosition);
        }

        if (!config.maxYLabel) {
            config.maxYLabel = new BABYLON.Text2D(maxYLabelText, {
                id: 'hud-selected-sparkline-max-y-label',
                fontSuperSample: true,
                fontName: labelTextHeight + 'pt ' + HUD_FONT,
                position: position.add(maxYLabelPosition),
                parent: selectedLinkSparklinesDisplay,
            });
        }
        else {
            config.maxYLabel.text = maxYLabelText;
            config.maxYLabel.position = position.add(maxYLabelPosition);
        }


        // Draw the progress point at the current point
        var ellipseSize = 5;

        config.progressPoint = new BABYLON.Ellipse2D({
            id: 'hud-selected-link-sparkline-progress' + config.ndx,
            parent: sparkline,
            width: ellipseSize,
            height: ellipseSize,
            subdivisions: 32,
            // Ellipse is draw from the bottom left; position it so it's
            // centered on the line
            x: curPoint.x - ellipseSize/2,
            y: curPoint.y - ellipseSize/2,
            fill: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
        });

        return sparkline;

    };

    /* Given a link direction ('A','B',null), highlight
     * that direction on the link info popup */
    var highlightLinkDirection = function (direction) {
        // Dispose of resources from the old direction;
        // if direction === null, we need to get rid of the old one,
        // but if not, there's a chance we're replacing a direction
        // that wasn't disposed yet, so dispose of it here to be safe
        if (linkDirectionHighlight !== null && linkDirectionHighlight !== undefined) {
            linkDirectionHighlight.dispose();
            linkDirectionHighlight = null;
        }

        if (direction !== null) {
            var position = direction === 'A'
                ? BABYLON.Vector2.Zero()
                : new BABYLON.Vector2(0, selectedLinkSparklinesDisplay.actualSize.height * 0.375);

            // Container group
            linkDirectionHighlight = new BABYLON.Group2D({
                id: 'hud-highlighted-link-direction-grp',
                parent: selectedLinkSparklinesDisplay,
                width: selectedLinkSparklinesDisplay.actualSize.width,
                height: selectedLinkSparklinesDisplay.actualSize.height * 0.5,
                position: position,
            });


            // Border made out of a rectangle with no fill
            var borderThickness = 2,
                highlightHeight = selectedLinkSparklinesDisplay.actualSize.height*0.325 - 2*borderThickness,
                highlightWidth = selectedLinkSparklinesDisplay.actualSize.width - 2*borderThickness;

            var highlightBorder = new BABYLON.Rectangle2D({
                parent: linkDirectionHighlight,
                fill: BABYLON.Canvas2D.GetBrushFromString('#00000000'),
                border: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
                borderThickness: borderThickness,
                position: new BABYLON.Vector2(borderThickness, borderThickness),
                width: highlightWidth,
                height: highlightHeight,
                roundRadius: selectedLinkDisplayBg.roundRadius,
            });

        }
    };


    /* Given an array (length 2) of points making up a line,
     * return a point along the line's normal vector in the XZ plane,
     * `offset` pixels away from the line */
    var pointOffsetFromLine = function (points, offset) {
        var line = points[1].subtract(points[0]),
            normal = new BABYLON.Vector2(line.y, -line.x)
                .normalize()
                .scaleInPlace(offset),
            position = points[1].add(normal);

        return position;
    };


    /* Given an array (length 2) of points making up a line,
     * return a parallel line translated `offset` pixels along
     * the original line's normal vector in the XZ plane */
    var lineOffsetFromLine = function (points, offset) {
        var line = points[1].subtract(points[0]),
            normal = new BABYLON.Vector2(line.y, -line.x)
                .normalize()
                .scaleInPlace(offset),
            position1 = points[0].add(normal),
            position2 = points[1].add(normal);

        return [position1, position2];
    };


    /* Given a path (array of Vector3) and an offset, return the path with each point
     * translated `offset` pixels along the surrounding normal vector in the XZ plane */
    var pathOffsetAlongNormal = function (path, offset) {
        var offsetPath = [];

        // Special case for the first point, since we don't have a point behind it
        // of it to draw the normal from; reverse the offset, since we'll be going backwards
        offsetPath.push(pointOffsetFromLine(path.slice(0, 2).reverse(), -offset));

        for (var i = 0; i < path.length - 1; ++i) {
            offsetPath.push(pointOffsetFromLine(path.slice(i, i+2), offset));
        }

        return offsetPath;
    };

            
    var formatCurTime = function () {
        return curTime.format(timeFormat);
    };


    /* Move the time slider handle to a given scaled position in the
     * range [0, 1] */
    var moveTimeSliderHandle = function (position) {
        var newX = timeSliderHandle.parent.actualSize.width * position;

        // If we just set x directly on the old position, it doesn't get marked as dirty and
        // doesn't update correctly; have to make a new vector for this
        timeSliderHandle.position = new BABYLON.Vector2(newX, timeSliderHandle.actualPosition.y);
    };
    
    /* Draw a slider the user can use to set the current time */
    var drawTimeSlider = function () {
        var sliderMargin = 10,
            pauseButtonWidth = 35,
            pauseButtonLeftMargin = 5,
            pauseButtonBottomMargin = 2.5,
            // For width here, we want the whole width of the screen-space canvas,
            // but the canvas doesn't appear to be properly initialized when this code is
            // run, so we'll use the width of the DOM element as determined by the BABYLON
            // engine.
            sliderWidth = canvas.engine.getRenderWidth() -
                selectedLinkDisplay.actualSize.width - 2*sliderMargin -
                pauseButtonWidth - pauseButtonLeftMargin;
            sliderHeight = 10,
            sliderHandleWidth = 20,
            sliderHandleHeight = 20;

        timeSlider = new BABYLON.Group2D({
            id: 'hud-time-slider',
            width: canvas.engine.getRenderWidth() - selectedLinkDisplay.actualSize.width,
            height: 40,
            parent: canvas,
            marginBottom: '80px',
        });
        timeSlider.isPickable = true;

        timeSlider.pointerEventObservable.add(function (event, state) {
            FHWA.Broadcaster.publish(FHWA.Event.HUDEnter, {});
        }, BABYLON.PrimitivePointerInfo.PointerEnter);

        timeSlider.pointerEventObservable.add(function (event, state) {
            FHWA.Broadcaster.publish(FHWA.Event.HUDLeave, {});
        }, BABYLON.PrimitivePointerInfo.PointerLeave);

        var pauseTexture = new BABYLON.Texture('img/pause_play.png', scene);
        pauseTexture.hasAlpha = true;

        var timeSliderPauseButton = new BABYLON.Sprite2D(pauseTexture, {
            id: 'hud-pause-button',
            x: pauseButtonLeftMargin,
            y: pauseButtonBottomMargin,
            spriteSize: new BABYLON.Size(pauseButtonWidth,pauseButtonWidth),
            scale: 0.8,
            parent: timeSlider,
        });
        timeSliderPauseButton.isPickable = true;

        var pauseButtonMouseDown = false;

        // Enable interaction -- switch between play and pause on click
        timeSliderPauseButton.pointerEventObservable.add(function (event, state) {
            pauseButtonMouseDown = true;
        }, BABYLON.PrimitivePointerInfo.PointerDown);

        timeSliderPauseButton.pointerEventObservable.add(function (event, state) {
            if (pauseButtonMouseDown) {
                timeSliderPauseButton.spriteFrame = !timeSliderPauseButton.spriteFrame;
                paused = !paused;
            }
            pauseButtonMouseDown = false;
        }, BABYLON.PrimitivePointerInfo.PointerUp);

        // Put handle/slot under common group set to be pickable
        // so picking works like we want
        var timeSliderControl = new BABYLON.Group2D({
            id: 'hud-time-slider-control',
            width: sliderWidth,
            height: sliderHeight,
            position: new BABYLON.Vector2(pauseButtonWidth + pauseButtonLeftMargin, 15),
            parent: timeSlider,
        });
        timeSliderControl.isPickable = true;

        var timeSliderSlot = new BABYLON.Rectangle2D({
            id: 'hud-time-slider-slot',
            width: sliderWidth,
            height: sliderHeight,
            marginLeft: sliderMargin + 'px',
            marginRight: sliderMargin + 'px',
            fill: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
            roundRadius: sliderHeight / 2,
            parent: timeSliderControl,
        });
        timeSliderSlot.isPickable = false;

        timeSliderHandle = new BABYLON.Rectangle2D({
            id: 'hud-time-slider-handle',
            width: sliderHandleWidth,
            height: sliderHandleHeight,
            position: new BABYLON.Vector2(0,
                -sliderHandleHeight/2 + sliderHeight/2),
            fill: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
            roundRadius: sliderHandleHeight/4,
            parent: timeSliderControl,
        });
        timeSliderHandle.isPickable = true;

        var oldHandleX = null;

        var grab = function (x) {
            draggingTimeSlider = true;
            oldHandleX = x;
        };

        var release = function () {
            draggingTimeSlider = false;
            oldHandleX = null;
        };

        timeSliderHandle.pointerEventObservable.add(function (event) {
            grab(event.canvasPointerPos.x);
        }, BABYLON.PrimitivePointerInfo.PointerDown);

        // Add the mouse move/up events on the canvas, not just the handle;
        // we don't want the user to have to keep their mouse in the handle
        // to drag it
        canvas.pointerEventObservable.add(function (event) {
            if (draggingTimeSlider) {
                var delta = event.canvasPointerPos.x - oldHandleX;
                oldHandleX = event.canvasPointerPos.x;
                // Only let the user drag to the bounds of the background
                var newX = FHWA.Util.clamp(timeSliderHandle.position.x + delta,
                    0, timeSliderSlot.actualSize.width);
                timeSliderHandle.position = new BABYLON.Vector2(newX,
                    timeSliderHandle.position.y
                );

                // Move the current time value according to user input
                var curSeconds = minTime + (
                    newX/timeSliderSlot.actualSize.width * (maxTime-minTime));

                curTime.startOf('day').add(curSeconds, 'seconds');
                hud.updateTime(curTime);
            }
        }, BABYLON.PrimitivePointerInfo.PointerMove);

        canvas.pointerEventObservable.add(function () {
            if (draggingTimeSlider) {
                release();
            }
        }, BABYLON.PrimitivePointerInfo.PointerUp);

    };

    var render = function () {
        canvas = new BABYLON.ScreenSpaceCanvas2D(scene, {
            id: 'hud-canvas',
        });

        var dateLabel = new BABYLON.Text2D('October 1st, 2011', {
            id: 'hud-date-label',
            fontName: '14pt ' + HUD_FONT,
            marginBottom: '165px',
            marginLeft: '10px',
            parent: canvas,
        });
        
        clock = new BABYLON.Text2D(formatCurTime(), {
            id: 'hud-clock',
            fontName: '34pt ' + CLOCK_FONT,
            marginBottom: '120px',
            marginLeft: '10px',
            parent: canvas,
        });

        selectedLinkDisplay = new BABYLON.Group2D({
            id: 'hud-selected-link',
            marginAlignment: 'h:right, v:bottom',
            width: 300,
            height: 400,
            parent: canvas,
            // Start hidden
            position: linkDisplayHiddenPosition,
        });

        // Make the legend visible and move it up, setting
        // its length according to the width of the rendering canvas
        var legendDiv = document.getElementById('babylon-legend-div');
        legendDiv.style.visibility = 'visible';
        legendDiv.style.opacity = 1;
        legendDiv.style.width = canvas.engine.getRenderWidth() -
            selectedLinkDisplay.actualSize.width;

        selectedLinkDisplay.pointerEventObservable.add(function (event, state) {
            FHWA.Broadcaster.publish(FHWA.Event.HUDEnter, {});
        }, BABYLON.PrimitivePointerInfo.PointerEnter);

        selectedLinkDisplay.pointerEventObservable.add(function (event, state) {
            FHWA.Broadcaster.publish(FHWA.Event.HUDLeave, {});
        }, BABYLON.PrimitivePointerInfo.PointerLeave);

        selectedLinkDisplayBg = new BABYLON.Rectangle2D({
            id: 'hud-selected-link-bg',
            parent: selectedLinkDisplay,
            width: selectedLinkDisplay.width,
            height: selectedLinkDisplay.height,
            fill: BABYLON.Canvas2D.GetBrushFromString('#323a45FF'),
        });
        selectedLinkDisplayBg.isPickable = false;

        selectedLinkText = new BABYLON.Text2D('', {
            id: 'hud-selected-link-text',
            fontName: '20pt ' + HUD_FONT,
            marginAlignment: 'h:center, v:top',
            marginTop: '10px',
            parent: selectedLinkDisplay,
            fill: BABYLON.Canvas2D.GetBrushFromString('#FFFFFFFF'),
        });
        selectedLinkText.isPickable = false;

        // Group that will contain the link lines + labels in the preview;
        // will be rotated along with the camera
        selectedLinkLinesDisplay = new BABYLON.Group2D({
            id: 'hud-selected-link-lines-display',
            parent: selectedLinkDisplay,
            position: new BABYLON.Vector2(selectedLinkDisplay.actualSize.width * 0.5,
                selectedLinkDisplay.actualSize.height * 0.7),
        });
        selectedLinkLinesDisplay.isPickable = false;

        selectedLinkAText = new BABYLON.Text2D('A', {
            id: 'hud-selected-link-a-text',
            fontName: '14pt ' + HUD_FONT,
            parent: selectedLinkLinesDisplay,
            zOrder: 0,
        });

        selectedLinkBText = new BABYLON.Text2D('B', {
            id: 'hud-selected-link-b-text',
            fontName: '14pt ' + HUD_FONT,
            parent: selectedLinkLinesDisplay,
            zOrder: 0,
        });

        selectedLinkSparklinesDisplay = new BABYLON.Group2D({
            id: 'hud-selected-link-sparklines',
            width: selectedLinkDisplay.actualSize.width,
            height: selectedLinkDisplay.actualSize.height * 0.6,
            parent: selectedLinkDisplay,
        });
        selectedLinkSparklinesDisplay.isPickable = false;


        // Declare properties for all these texts and init them all at once
        // xCoeff/yCoeff is the fraction of the parent group's width/height
        // that determines the label's position
        sparklineLabels = [{
            text: 'A',
            xCoeff: 0.05,
            yCoeff: 0.48,
        }, {
            text: 'B',
            xCoeff: 0.05,
            yCoeff: 0.1,
        }, {
            text: 'Lane Volume (hr)',
            xCoeff: 0.125,
            yCoeff: 0.7,
        }, {
            text: 'Speed (mph)',
            xCoeff: 0.58,
            yCoeff: 0.7,
        }];

        sparklineLabels.forEach(function (config) {
            // Init with blank space for text so it's hidden
            config.obj = new BABYLON.Text2D(' ', {
                id: 'hud-selected-link-sparklines-label-' + config.text,
                fontName: '10pt ' + HUD_FONT,
                position: new BABYLON.Vector2(
                    selectedLinkSparklinesDisplay.actualSize.width * config.xCoeff,
                    selectedLinkSparklinesDisplay.actualSize.height * config.yCoeff),
                parent: selectedLinkSparklinesDisplay,
            });
        });

        // Declare properties for the lines and init all at once
        // xCoeff/yCoeff: see above
        // We'll do these left to right, top to bottom, so the order will
        // always be the same
        // ex A Volume -> A Speed -> B Volume -> B Speed
        sparklines = [{
            ndx: 0,
            obj: null,
            data: null,
            xCoeff: 0.18,
            yCoeff: 0.43,
        }, {
            ndx: 1,
            obj: null,
            data: null,
            xCoeff: 0.6,
            yCoeff: 0.43,
        }, {
            ndx: 2,
            obj: null,
            data: null,
            xCoeff: 0.18,
            yCoeff: 0.05,
        }, {
            ndx: 3,
            obj: null,
            data: null,
            xCoeff: 0.6,
            yCoeff: 0.05,
        }];


        // Draw the time slider and associated primitives
        drawTimeSlider();

    };

    // Load our custom fonts first so they display properly on the text
    var hudFont = new FontFaceObserver(HUD_FONT),
        clockFont = new FontFaceObserver(CLOCK_FONT),
        fontsReady = Promise.all([hudFont.load(), clockFont.load()]);

    return fontsReady.then(function () {
        render();
        return hud;
    });
};
