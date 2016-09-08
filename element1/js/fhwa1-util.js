var FHWA = FHWA || {};
FHWA.Util = FHWA.Util || {};

FHWA.Util.xhrGet = xhrGet;

FHWA.Util.PapaPromise = PapaPromise;

// Return the given property of an object; initialize
// it with the value `init` if it doesn't exist
FHWA.Util.initProp = function (obj, prop, init) {
    if (!(obj.hasOwnProperty(prop))) {
        obj[prop] = init;
    }

    return obj[prop];
};

// Return the angle between the 2 given vectors in radians
// NOTE: ASSUMES VECTORS ARE ALREADY NORMALIZED; result will be incorrect
// if not
// NOTE: ASSUMES VECTORS LIE IN THE XZ PLANE
FHWA.Util.angleBetween = function (p1, p2) {
    var rotationAngle = Math.acos(BABYLON.Vector3.Dot(p1, p2));

    // If the link vector points in the opposite direction, we need to rotate
    // the other way; using the 2D cross-product (a.x * b.z - a.z * b.x)
    if (((p1.x * p2.z) - (p1.z * p2.x)) < 0) {
        rotationAngle = -rotationAngle;
    }
    return rotationAngle;
};

// Clamp the given value between the given min and max value
FHWA.Util.clamp = function clamp(x, min, max) {
    return Math.max(Math.min(x, max), min);
};

// Convert km/hr to mph
FHWA.Util.kmhrToMph = function (x) {
    return x * 0.62137;
};
