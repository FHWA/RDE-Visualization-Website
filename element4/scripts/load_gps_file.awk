@include "distance.awk"

BEGIN {
    FS = ",";
    OFS = ",";
}
{
    # Parse a UNIX timestamp from the local date/time columns ($7/$8)
    # since mktime assumes local time zone
    split($7, date_parts, "/")
    split($8, time_parts, ":")
    timestamp = mktime(date_parts[3] " " date_parts[1] " " date_parts[2] " " \
              time_parts[1] " " time_parts[2] " " time_parts[3])

    # Date parsing -- works in regular awk, but is super, super slow
    #date_cmd = "date -j -f \"%m/%d/%Y %H:%M:%S\" \"" $7 " " $8"\" \"+%s\""
    #date_cmd | getline timestamp
    #close(date_cmd)

    # Only output rows with an even number of milliseconds
    # between the bounds of our viz
    # i.e. we're downsampling from 10Hz to 1Hz
    if (int($9) == 0 && ((timestamp > min1 && timestamp < max1) || \
        (timestamp > min2 && timestamp < max2))) {
        if ($11 == "N") {
            lat = $10
        }
        else {
            lat = "-" $10
        }

        if ($13 == "E") {
            lng = $12
        }
        else {
            lng = "-" $12
        }

        # Coerce to numbers
        lat = 0 + lat
        lng = 0 + lng

        # only show rows closer than max_distance from the intersection
        # and having less than max_speed (indicating stops)
        distance = lat_lng_distance(lat, lng, INTERSECTION_LAT, INTERSECTION_LNG)
        speed = int($15)

        if (distance <= max_distance) {
            print timestamp, lat, lng, speed, vid
        }
    }
}
