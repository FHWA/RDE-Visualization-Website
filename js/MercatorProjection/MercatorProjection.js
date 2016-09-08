/* Encapsulates functionality related to converting between
 * lat/lng and points on the screen using the Mercator projection */
var MercatorProjection = (function () {
    var proj = {};

    proj.MERCATOR_RANGE = 256;
    proj.PIXEL_ORIGIN_X = proj.MERCATOR_RANGE / 2;
    proj.PIXEL_ORIGIN_Y = proj.MERCATOR_RANGE / 2;
    proj.PIXELS_PER_LNG_DEGREE = proj.MERCATOR_RANGE / 360;
    proj.PIXELS_PER_LNG_RADIAN = proj.MERCATOR_RANGE / (2 * Math.PI);

    var radians = function (degrees) {
        return degrees / (Math.PI / 180);
    };

    var degrees = function (radians) {
        return radians * (Math.PI / 180);
    };

    proj.latlngToPoint = function (latlng) {
        var sinY = Math.sin(radians(latlng.lat));
        return {
            x: proj.PIXEL_ORIGIN_X + latlng.lng
                * proj.PIXELS_PER_LNG_DEGREE,
            y: proj.PIXEL_ORIGIN_Y +
                (0.5 * Math.log((1 + sinY) / (1 - sinY)) *
                (-proj.PIXELS_PER_LNG_RADIAN)),
        };
    };
    proj.pointToLatLng = function (point) {
        var latRadians = (point.py - proj.PIXEL_ORIGIN_X) /
            -proj.PIXELS_PER_LNG_RADIAN;

        return {
            lat: degrees(2 * Math.atan(Math.exp(latRadians)) - Math.PI / 2),
            lng: (point.x - proj.PIXEL_ORIGIN_Y) /
                proj.PIXELS_PER_LNG_DEGREE,
        };
    };

    return proj;
})();
