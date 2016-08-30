#!/bin/bash

# Bail at first error
set -e

# Incrementing vehicle ID for GPS/BSM files
gps_vehicle_id=0

# Add the contents of the given bsm file to our output
load_bsm_file() {
    local file=$1
    local vehicle_id=$2

    # tail: Get rid of the header
    # tr: Convert DOS to UNIX line endings by removing \r characters
    # awk: Downsample -- keep only lines with whole second timestamps and a unique
    #      combination of timestamp and vehicle ID.  Strip decimal points from timestamp,
    #      heading, and speed. See "load_bsm_file.awk" for details.
    tail -n +2 $file | \
        tr -d "\r" | \
        gawk -v vid="$vehicle_id" -v min1="$min_day1" -v min2="$min_day2" -v max1="$max_day1" -v max2="$max_day2" -v max_distance="$max_distance" -v max_speed="$max_speed" -v INTERSECTION_LAT="$INTERSECTION_LAT" -v INTERSECTION_LNG="$INTERSECTION_LNG" -f load_bsm_file.awk >> "$bsm_file"
    echo "Loaded BSM file $file"
}

load_gps_file() {
    local file=$1
    local vehicle_id=$2

    # tail: Get rid of the header
    # tr: Convert DOS to UNIX line endings by removing \r characters
    # awk: Downsample; keep only required fields; combine some fields together.  See
    #      "load_gps_file.awk" for details.
    tail -n +2 $file | \
        tr -d "\r" | \
        gawk -v vid="$vehicle_id" -v min1="$min_day1" -v min2="$min_day2" -v max1="$max_day1" -v max2="$max_day2" -v max_distance="$max_distance" -v max_speed="$max_speed" -v INTERSECTION_LAT="$INTERSECTION_LAT" -v INTERSECTION_LNG="$INTERSECTION_LNG" -f load_gps_file.awk >> "$gps_file"
    echo "Loaded GPS file $file"

}

# Add the given vehicle to our vehicles file; have to check for duplicates afterward
add_vehicle() {
    local vehicle_id=$1
    local vehicle_type=$2
    local data_source=$3

    echo "$vehicle_id,$vehicle_type,$data_source" >> "$vehicle_file"

    # Eliminate duplicates from the vehicle file (since we could load
    # multiple files for the same vehicle)
    awk -F"," '!_[$1]++' "$vehicle_file" > "/tmp/vehicle.csv"
    mv "/tmp/vehicle.csv" "$vehicle_file"
    
}

# Unzip the given zip to a temp dir and load the important part into our data file
# This is for zips that could contain multiple vehicles; we have to parse out the IDs
# from the file names
# Also save the vehicle info to the vehicle file
load_multiple_vehicle_zip() {
    local vehicle_type=$1
    local zip_file=$2
    local data_source=$3
    
    mkdir -p /tmp/bsm
    unzip "$bsm_dir/$zip_file" -d /tmp/bsm
    for file in /tmp/bsm/*; do
        ((gps_vehicle_id++))
        local vehicle_id=$gps_vehicle_id
        load_bsm_file "$file" "$vehicle_id"
        add_vehicle "$vehicle_id" "$vehicle_type" "$data_source"
    done
    rm -rf /tmp/bsm
}

load_gps_zip() {
    local zip_file=$1
    local data_source=$2

    # It appeared at first glance that we could use the number
    # following "GPS" as a vehicle ID, but apparently
    # the vehicle types can be different for the same GPS number,
    # so we'll use our own incrementing ID.
    #local vehicle_id_regex="GPS([0-9]+)"
    local vehicle_type_lookup_regex="([0-9]{4}_[0-9]{2}_[0-9]{2})_(GPS.*)\.csv"
    local ignore_regex="temp"

    mkdir -p /tmp/gps
    unzip "$gps_dir/$zip_file" -d /tmp/gps
    for file in /tmp/gps/*; do
        ((gps_vehicle_id++))
        local vehicle_id=$gps_vehicle_id

        if [[ "$file" =~ $vehicle_type_lookup_regex ]]; then
            local date="${BASH_REMATCH[1]}"
            local vehicle_type_lookup="${BASH_REMATCH[2]}"
            local vehicle_type=""

            # Figure out what the vehicle type is
            case $date in
                2015_03_03)
                    case $vehicle_type_lookup in
                        GPS1_*|GPS2\ *|GPS3*|GPS4_*|GPS5_*|GPS6_*|GPS7_*|GPS8*|GPS9*|GPS10*)
                            vehicle_type="car"
                            ;;
                        GPS11_*|GPS13_*)
                            vehicle_type="truck"
                            ;;
                        GPS12*|GPS14_*)
                            vehicle_type="transit"
                            ;;
                    esac
                    ;;
                2015_03_04)
                    case $vehicle_type_lookup in
                        GPS1_*|GPS2_*|GPS3_AM*|GPS4_*|GPS5_AM*|GPS6*|GPS7*|GPS8_AM*)
                            vehicle_type="car"
                            ;;
                        GPS8_PM*|GPS9_*)
                            vehicle_type="truck"
                            ;;
                        GPS3_PM*|GPS5_PM*)
                            vehicle_type="transit"
                            ;;
                    esac
                    ;;
            esac

            if [[ ! "$file" =~ $ignore_regex ]]; then
                load_gps_file "$file" "$vehicle_id"
                add_vehicle "$vehicle_id" "$vehicle_type" "$data_source"
            fi
        else
            echo "$file doesn't match vehicle type regex"
            rm -rf /tmp/gps
            exit 1
        fi
    done
    rm -rf /tmp/gps
}

# Make sure the directory where the BSM .zip was unzipped is the first argument
if [[ $# -ne 2 ]]; then
    echo "Usage: ./create_bsm_data.sh <BSM_DIR> <GPS_DIR>"
    echo "'BSM_DIR' should be the directory where you unzipped the main BSM file."
    echo "'GPS_DIR' should be the directory where you unzipped the main GPS file."
    exit 1
fi

# Set up the data directory
bsm_dir=$1
gps_dir=$2
data_dir="../data"
if [[ ! -d "$data_dir" ]]; then
    mkdir "$data_dir"
fi
vehicle_file="$data_dir/vehicle.csv"

# Spatial/other boundaries for the data
# max distance from the intersection, in meters
max_distance=50
INTERSECTION_LAT=33.842963
INTERSECTION_LNG=-112.135186
# max speed of observations, in km/h
max_speed=5

old_ifs=$IFS
IFS=','

# First, load the combination TSP/FSP data:
#  Base case: Mar 4th PM
#  TSP/FSP: Mar 3rd PM
gps_file="$data_dir/gps_tspfsp.csv"
bsm_file="$data_dir/bsm_tspfsp.csv"

# Add the header to output
echo "timestamp,lat,lng,speed,vehicle_ID" > "$bsm_file"
echo "timestamp,lat,lng,speed,vehicle_ID" > "$gps_file"
echo "vehicle_ID,vehicle_type,source" > "$vehicle_file"

# Time boundaries for the data - UNIX timestamp format, in UTC
min_day1=1425413400 # 2015-03-03, 3:10pm
max_day1=1425445200 # 2015-03-04, 12:00am
min_day2=1425499800 # 2015-03-04, 3:10pm
max_day2=1425531600 # 2015-03-05, 12:00am

for i in "car","bsm_mar04_2015_obe_vehicle","BSM" \
    "car","bsm_mar04_2015_asd_vehicle","BSM" \
    "truck","bsm_mar0315_PM_truck33","BSM" \
    "transit","bsm_mar0315_PM_transit35","BSM" \
    ; do set -- $i

    load_multiple_vehicle_zip "$1" "$2" "$3"
done

for i in "2015_03_03_GPS","GPS" \
    "2015_03_04_GPS","GPS" \
    ; do set -- $i

    load_gps_zip "$1" "$2"
done

# Now, load the FSP data:
#  Base case: Mar 4th AM
#  FSP: Mar 3rd AM
gps_file="$data_dir/gps_fsp.csv"
bsm_file="$data_dir/bsm_fsp.csv"

# Add the header to output
echo "timestamp,lat,lng,speed,vehicle_ID" > "$bsm_file"
echo "timestamp,lat,lng,speed,vehicle_ID" > "$gps_file"
# not the vehicle header, since we're just appending to that one

# Time boundaries for the data - UNIX timestamp format, in UTC
min_day1=1425373200 # 2015-03-03, 9:00am
max_day1=1425405600 # 2015-03-03, 6:00pm
min_day2=1425459600 # 2015-03-04, 9:00am
max_day2=1425492000 # 2015-03-04, 6:00pm

for i in "car","bsm_mar04_2015_obe_vehicle","BSM" \
    "car","bsm_mar04_2015_asd_vehicle","BSM" \
    "car","bsm_mar03_15_AM_asd_veh1233","BSM" \
    "truck","bsm_mar03_15_AM_truck34_log_02_03_15_07_41.csv.zip","BSM" \
    ; do set -- $i

    load_multiple_vehicle_zip "$1" "$2" "$3"
done

for i in "2015_03_03_GPS","GPS" \
    "2015_03_04_GPS","GPS" \
    ; do set -- $i

    load_gps_zip "$1" "$2"
done

IFS=$old_ifs
