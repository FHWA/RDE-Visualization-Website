@include "distance.awk"

BEGIN {
    FS = ","
    OFS = ","
}

# Only rows with a timestamp w/ either nothing 
# or a 0 after the decimal point
/^BSM,[0-9]+(\.0+)?,/ {
    timestamp = int($2)
    speed = int($10)

    # Also only rows with a unique combination of timestamp and
    # vehicle ID, and where the timestamp is between the bounds
    # of our viz
    if (!_[timestamp"-"vid]++ && ((timestamp > min1 && timestamp < max1) || \
        (timestamp > min2 && timestamp < max2))) {
        # ...and only rows less than the max_distance from the intersection
        # and rows with less than the max_speed (indicating stops)
        lat = $7
        lng = $8
        distance = lat_lng_distance(lat, lng, INTERSECTION_LAT, INTERSECTION_LNG)

        if (distance <= max_distance) {
            print timestamp, lat, lng, speed, vid
        }
    }
}
