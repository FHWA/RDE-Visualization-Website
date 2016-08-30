function radians(deg) {
    pi = atan2(0, -1)
    return pi * (deg / 180)
}

# Calculate distance (in meters) between 2 lat/lng points
# using the equirectangular approximation
function lat_lng_distance(lat1, lng1, lat2, lng2) {
    lat1rad = radians(lat1)
    lat2rad = radians(lat2)
    lng1rad = radians(lng1)
    lng2rad = radians(lng2)

    # Radius of the earth in meters
    R = 6371e3

    x = (lng2rad - lng1rad) * cos((lat1rad + lat2rad) / 2)
    y = lat2rad - lat1rad

    return sqrt(x*x + y*y) * R
}
