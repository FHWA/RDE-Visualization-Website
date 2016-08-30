var FHWA = FHWA || {};
FHWA.Debug = FHWA.Debug || {};

var initialized = false,
    debugColor = BABYLON.Color3.Red(),
    baseVector;

// Only run the initialization code if it's needed
FHWA.Debug.initDebug = function (scene) {
    var vectorCone = BABYLON.MeshBuilder.CreateCylinder('debug-vector-cone', {
        height: 0.1,
        diameterTop: 0.01,
        diameterBottom: 0.05,
        updatable: false,
    }, scene);

    vectorCone.color = debugColor;
    vectorCone.rotation.x = Math.PI/2;
    vectorCone.rotation.z = -Math.PI/2;
    vectorCone.position.x = 0.95;

    var vectorLine = BABYLON.MeshBuilder.CreateCylinder('debug-vector-line', {
        height: 1,
        diameterTop: 0.01,
        diameterBottom: 0.01,
        updatable: false,
    }, scene);

    vectorLine.position.x = 0.5;
    vectorLine.rotation.z = -Math.PI/2;
    vectorLine.color = debugColor;

    baseVector = BABYLON.Mesh.MergeMeshes([vectorCone, vectorLine]);

    baseVector.convertToUnIndexedMesh();
    baseVector.isPickable = false;
    
    initialized = true;

};

/* Draw a vector so we can see where it is --
 * TODO: this only takes y axis rotation into account, so it only
 * works for vectors in the XZ plane. Fix that */
FHWA.Debug.drawVector = function (fromVertex, vector, scene) {
    if (!initialized) {
        FHWA.Debug.initDebug(scene);
    }

    var vectorLength = vector.length(),
        unitVector = BABYLON.Vector3.Normalize(vector),
        toVertex = fromVertex.add(vector),
        rotationAxis = toVertex.subtract(fromVertex),
        rotationMatrix = BABYLON.Matrix.RotationAxis(rotationAxis, 0);

    var vectorCopy = baseVector.clone();

    vectorCopy.scaling.x = vectorLength;
    vectorCopy.position = fromVertex;
    vectorCopy.rotation.y = FHWA.Util.angleBetween(unitVector, BABYLON.Axis.X);

    return vectorCopy;
};
