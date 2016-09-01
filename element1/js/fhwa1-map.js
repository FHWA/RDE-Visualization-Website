var initMap = function (scene, size, swBound, neBound, zoomLevel) {
    var map = {};

    var baseTileURL = 'http://a.basemaps.cartocdn.com/dark_all',
        baseVectorTileURL = 'https://vector.mapzen.com/osm/buildings',
        vectorTileAPIKey = 'vector-tiles-Qx2mPub';

    var xMin = -size / 2,
        xMax = size / 2,
        zMin = -size / 2,
        zMax = size / 2;

    /* Return the position of the map */
    map.position = function () {
        return new BABYLON.Vector3(0, 0, size);
    };

    var buildingMaterial = new BABYLON.StandardMaterial('building-mat', scene);
    buildingMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    buildingMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    buildingMaterial.backFaceCulling = false;
    // Freeze the material for performance, since we won't be updating it further
    buildingMaterial.freeze();

    var baseBuildingHeight = 0.3;

    map.tileToLatLng = function (tile) {
        var n = Math.PI - 2*Math.PI*tile.y/Math.pow(2,zoomLevel);
        return {
            lat: (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)))),
            lng: (tile.x/Math.pow(2,zoomLevel)*360 - 180),
        };
    };

    map.latlngToTile = function (latlng) {
        return {
            x: (Math.floor((latlng.lng+180)/360 * Math.pow(2, zoomLevel))),
            y: (Math.floor((1-Math.log(Math.tan(latlng.lat*Math.PI/180) +
                1/Math.cos(latlng.lat*Math.PI/180))/Math.PI)/2 * Math.pow(2,zoomLevel))),
        };
    };

    var swTile = map.latlngToTile(swBound),
        neTile = map.latlngToTile(neBound),
        // Converting tiles to latlon gives us the top left corner; to get the southwest corner
        // and northeast corner of our tiles, we need to find the tile one south of the SW tile
        // and one east of the NE tile.
        swTileBound = map.tileToLatLng({
            x: swTile.x,
            y: swTile.y + 1,
        }),
        neTileBound = map.tileToLatLng({
            x: neTile.x + 1,
            y: neTile.y,
        });

    /*
     * Convert the given lat/lon to world coordinates, based on the mapMesh we've drawn.
     */
    map.latlngToWorldCoords = function (latlng) {
        var x = ((latlng.lng - swTileBound.lng)
                / (neTileBound.lng - swTileBound.lng)
                * (xMax - xMin)) + xMin,
            z = ((latlng.lat - swTileBound.lat)
                / (neTileBound.lat - swTileBound.lat)
                * (zMax - zMin)) + zMin;

        return new BABYLON.Vector2(x, z);
    };

    /* Determine whether a given building's geoJSON coordinates are in the bounds
     * of the map and therefore should be rendered (geoJSON tile results include
     * buildings who are at least partially included in a tile) */
    var buildingInBounds = function (buildingCoords) {
        var minLat = swTileBound.lat,
            minLng = swTileBound.lng,
            maxLat = neTileBound.lat,
            maxLng = neTileBound.lng;

        return buildingCoords.every(function (coord) {
            var lat = coord[1],
                lng = coord[0];

            return minLat <= lat && lat <= maxLat
                && minLng <= lng && lng <= maxLng;
        });
    };

    /* Convert an array of world coordinates (x, y) to a BABYLON.Path2 */
    var worldCoordsToPath = function (worldCoords) {
        if (worldCoords.length === 0) {
            throw new Error("Need at least one point to make a path.");
        }
        // GeoJSON includes the same point twice to start and end the path; Babylon
        // doesn't like it when paths start and end at the same point, so we'll cut
        // out the last point
        var path = BABYLON.Path2.StartingAt(worldCoords[0].x, worldCoords[0].y);

        worldCoords.slice(1, -1).forEach(function (coord) {
            path.addLineTo(coord.x, coord.y);
        });

        return path.close();
    };

    /* Convert a (closed) Path to an extruded mesh used to represent part of a building */
    var pathToExtrusion = function (path, buildingHeight) {
        var shape = path.getPoints().map(function (vec2) {
                // Have to negate x here in order to avoid mirroring the whole mesh for
                // some reason.
                return new BABYLON.Vector3(-vec2.x, vec2.y, 0);
            }),
            // Extrude the shape along just 2 points -- enough to make it as tall as the building
            // should be
            path = [
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(0, buildingHeight, 0),
            ];

        // Close the building shape, since the path doesn't close itself
        shape.push(shape[0]);

        var extrusion = BABYLON.MeshBuilder.ExtrudeShape('building-side', {
                shape: shape,
                path: path,
            }, scene);
        extrusion.material = buildingMaterial;

        // This rotation is needed to put the buildings in the right place, for
        // some reason
        extrusion.rotation.y = Math.PI/2;

        return extrusion;
    };

    map.renderBuildingTile = function (z, x, y) {
        var url = baseVectorTileURL + '/' + z + '/' + x + '/' + y + '.json?api_key='
            + vectorTileAPIKey;
        return FHWA.Util.xhrGet(url).then(function (response) {
            var geoJSON = JSON.parse(response);

            var geoJSONToWorldCoords = function (coord) {
                return map.latlngToWorldCoords({
                    lat: coord[1],
                    lng: coord[0],
                });
            };

            var buildingMeshes = [];
            // Only render polygons (don't care about points)
            geoJSON.features.filter(function (d) {
                return d.geometry.type === 'Polygon';
            }).forEach(function (feature) {
                // First array of coords is the outer polygon; any extra arrays
                // are inner rings
                var outerCoords = feature.geometry.coordinates[0];

                // Don't render the building if it's partially out of bounds
                if (!buildingInBounds(outerCoords)) {
                    return;
                }
                
                var outerWorldCoords = outerCoords.map(geoJSONToWorldCoords),
                    polyPath = worldCoordsToPath(outerWorldCoords),
                    buildingHeight = feature.properties.height
                        ? feature.properties.height / 50
                        : baseBuildingHeight;

                // Create an extrusion for the side of the building
                var buildingSide = pathToExtrusion(polyPath, buildingHeight);

                // NOTE: Have to use the Path2 version of the constructor here,
                // NOT the Vector2 one; Vector2 throws WebGL errors for paths
                // longer than 4 points
                polygonBuilder = new BABYLON.PolygonMeshBuilder('building-bottom', polyPath, scene);

                // Add the holes in the buildings + extrusions of them
                var holeExtrusions = [];
                if (feature.geometry.coordinates.length > 1) {

                    feature.geometry.coordinates.slice(1).forEach(function (ringCoords) {
                        var holePath = worldCoordsToPath(ringCoords.map(geoJSONToWorldCoords)),
                            holeExtrusion = pathToExtrusion(holePath, buildingHeight);

                        // addHole expects an array of Vector2, not a Path2
                        polygonBuilder.addHole(holePath.getPoints());
                        holeExtrusions.push(holeExtrusion);
                    });
                }

                // Bottom mesh -- polygon defined by GeoJSON points
                var buildingBottom = polygonBuilder.build(false);
                // Draw the bottom a tiny bit above the map, so the meshes don't clip together
                buildingBottom.position.y = 0.01;
                
                // Top mesh -- same as the bottom, just transformed
                // We use clones instead of instances here because they work better with merging
                var buildingTop = buildingBottom.clone('building-top');
                // Move the tops on top of the buildings
                buildingTop.position.y = buildingHeight;

                // Put it all together
                var buildingParts = [buildingSide, buildingBottom, buildingTop].concat(holeExtrusions);

                var buildingMesh = BABYLON.Mesh.MergeMeshes(buildingParts, true);
                buildingMesh.material = buildingMaterial;
                buildingMeshes.push(buildingMesh);

            });

            if (buildingMeshes.length > 0) {
                var tileBuildingMultiMesh = BABYLON.Mesh.MergeMeshes(buildingMeshes, true);
                // Since these meshes are simple, convert them to unindexed
                // meshes for a performance boost
                tileBuildingMultiMesh.convertToUnIndexedMesh();
                
                // Since the meshes don't move, freeze their world matrix for
                // a performance boost
                tileBuildingMultiMesh.freezeWorldMatrix();

                // Also don't bother checking whether they're in the frustum
                tileBuildingMultiMesh.alwaysSelectAsActiveMesh = true;

                // We don't need interaction on the buildings, so no need
                // for them to be pickable
                tileBuildingMultiMesh.isPickable = false;
            }
        });
    };

    map.createMap = function () {
        var xTiles = Math.abs(swTile.x-neTile.x) + 1,
            yTiles = Math.abs(neTile.y-swTile.y) + 1,
            subdivisions = { w: xTiles, h: yTiles },
            precision = { w: 2, h: 2 };

        var mapMesh = BABYLON.Mesh.CreateTiledGround('map', xMin, zMin,
            xMax, zMax, subdivisions, precision, scene);

        var mapMultiMaterial = new BABYLON.MultiMaterial('mapMultiMaterial', scene);
        var tileBase = map.latlngToTile(swBound);

        var buildingPromises = [];

        // Download all the tiles and add them as subMaterials
        for (var row = 0; row < subdivisions.h; row++) {
            for (var col = 0; col < subdivisions.w; col++) {
                var material = new BABYLON.StandardMaterial(
                    'material' + row + '-' + col, scene);
                
                // Construct the map URL; @2x gives us retina tiles, which are
                // higher res and less fuzzy
                var z = zoomLevel,
                    x = (tileBase.x + col),
                    y = (tileBase.y - row),
                    url = baseTileURL + '/' + z + '/' + x + '/' + y + '@2x.png';

                buildingPromises.push(map.renderBuildingTile(z, x, y));

                material.diffuseTexture = new BABYLON.Texture(url, scene);
                material.diffuseTexture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
                material.diffuseTexture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

                material.specularColor = new BABYLON.Color3(0, 0, 0);
                // Freeze the material for performance since we won't
                // be updating it aagin
                material.freeze();
                mapMultiMaterial.subMaterials.push(material);
            }
        }
        mapMultiMaterial.freeze();

        // Apply the multiMaterial to the mesh
        mapMesh.material = mapMultiMaterial;

        // Set the subMeshes of the main mesh to display using subMaterials
        var verticesCount = mapMesh.getTotalVertices(),
            tileIndicesLength = mapMesh.getIndices().length /
                (subdivisions.w * subdivisions.h);

        mapMesh.subMeshes = [];
        var index = 0,
            base = 0;

        for (var row = 0; row < subdivisions.h; row++) {
            for (var col = 0; col < subdivisions.w; col++) {
                var subMesh = new BABYLON.SubMesh(index++, 0, verticesCount,
                    base, tileIndicesLength, mapMesh);

                mapMesh.subMeshes.push(subMesh);
                base += tileIndicesLength;
            }
        }

        // Optimizations for performance
        mapMesh.freezeWorldMatrix();
        mapMesh.convertToUnIndexedMesh();
        mapMesh.alwaysSelectAsActiveMesh = true;
        mapMesh.isPickable = false;

        return Promise.all(buildingPromises);
    }


    map.createMap().then(function () {
    });

    return map;

}
