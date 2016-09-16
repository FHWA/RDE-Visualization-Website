var charts = {
        fsp: {
            margins: { left: 0, right: 0, top_: 0, bottom: 0 },
            // Prefix for dom elements (ex. controls and chart div),
            // which will have common suffixes
            domPrefix: 'fsp',
            // Function used to update data in the viz based on filters;
            // will be defined as a closure and used in initControls()
            updateData: null,
            // Function used to update time interval based on user selection;
            // also defined as a closure and used in initControls()
            updateTimeInterval: null,
            // Size of time interval bins (minutes)
            curTimeInterval: 5,
            // Function to filter out vehicles based on one or more characteristics
            curFilterFunc: _.stubTrue,
            colors: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c',
                '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
            backgroundColor: '#D1D1D1',
            // Name of the relevant intervention, for labeling
            intervention: 'Freight Signal Priority',
            // actual dualHeatChart object
            object: null,
            filterRadios: ['all', 'car', 'truck'],
        },
        tspfsp: {
            margins: { left: 0, right: 0, top_: 0, bottom: 0 },
            domPrefix: 'tspfsp',
            updateData: null,
            updateTimeInterval: null,
            curTimeInterval: 5,
            curFilterFunc: _.stubTrue,
            colors: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5',
                '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081'],
            backgroundColor: '#D1D1D1',
            intervention: 'Transit Signal Priority and Freight Signal Priority',
            object: null,
            filterRadios: ['all', 'car', 'truck', 'transit', 'truck-transit'],
        },
    },
    // Filter out all points above this speed
    MAX_SPEED = 5;

/* Use the given filter function on the given raw data
 * to produce filtered aggregate data. curFilterFunc is given
 * the vehicle corresponding to the data as an argument, so it
 * has access to fields such as vehicleID, source, and type. */
function filterData(vehicles, data, chart) {
    var baseData = [],
        mmitssData = [];

    _.sortBy(vehicles, 'vehicleID').forEach(function (vehicle) {
        if (data[vehicle.vehicleID]) {
            var day = data[vehicle.vehicleID][0].timestamp.format('DD'),
                caseArray = day === '03' ? mmitssData : baseData;

            // Apply filtering here to determine which vehicles make it into
            // the resulting data sets
            if (chart.curFilterFunc(vehicle)) {
                caseArray.push(data[vehicle.vehicleID]);
            }
        }
    });

    // We're going to bin the data by timestamp -- this will be the format used
    // to convert to a string for grouping and back to a moment
    var groupTimestampFormat = 'YYYY-MM-DD HH:mm';

    var cleanChartData = function (data) {
        // Transform data from raw points to counts by minute; filter out undesired points
        return _.chain(data)
            .flatten()
            .groupBy(function (d) {
                // Round to the nearest <curTimeInterval> mins
                // Explicit utcOffset is necessary to keep this from being a
                // local time
                var roundedTimestamp = moment(d.timestamp).utcOffset(-300),
                    roundedMinute = chart.curTimeInterval * Math.round(roundedTimestamp.minute() / chart.curTimeInterval);
                roundedTimestamp.minute(roundedMinute);

                return roundedTimestamp.format(groupTimestampFormat);
            })
            .mapValues(function (v, k) { 
                return {
                    timestamp: moment(k, groupTimestampFormat),
                    count: _.chain(v)
                        .filter(function (d) {
                            return d.speed <= MAX_SPEED;
                        })
                        .size()
                        .value(),
                };
            })
            .values()
            .value();
    };

    return {
        base: _.map(cleanChartData(baseData), function (d) {
            // Use the timestamps in the data, but set the date to the 3rd on the base case;
            // we want to show both days on the same time scale, and d3 will separate
            // them out unless we make sure it's all on the same day
            return _.defaults({
                timestamp: moment(d.timestamp).date(3)
            }, d)
        }),
        mmitss: cleanChartData(mmitssData),
    };
}


function initChart(chart, data, vehicles) {
    // Start with everything showing
    initData = filterData(vehicles, data, chart),

    // Use new here; else the charts will share the same 'this' object
    chart.object = new dualHeatChart(initData.base, initData.mmitss, {
        width: vizWidth(chart),
        height: vizHeight(chart),
        keyAccessor: function (d) { return d.timestamp; },
        valueAccessor: function (d) { return d.count; },
        keyFormat: 'h:mma',
        margins: chart.margins,
        timeInterval: chart.curTimeInterval,
        colors: chart.colors,
        backgroundColor: chart.backgroundColor,
        upperLabel: 'Base Case',
        lowerLabel: chart.intervention,
        tooltipValueLabel: 'vehicle-seconds of delay',
        legendUnits: 'veh-secs',
        updateXAxis: false,
    });

    chart.object.draw(chart.domPrefix + '-chart-div');

    chart.updateData = function (filterFunc) {
        // Reapply filter, since the function changed
        var chartData = filterData(vehicles, data, chart);

        // Upper data: base case
        // Lower data: MMITSS
        chart.object.updateData(chartData.base, chartData.mmitss);
        chart.object.redraw();
    };

    chart.updateTimeInterval = function (timeInterval) {
        // Reapply filter, since the aggregation depends on time interval
        var chartData = filterData(vehicles, data, chart);

        chart.object.timeInterval(chart.curTimeInterval);
        chart.object.updateData(chartData.base, chartData.mmitss);
        chart.object.redraw();
    }
}


function initViz(tspfspBSM, tspfspGPS, fspBSM, fspGPS, vehicles) {
    var cleanBSMGPS = function (data) {
        return _.chain(data)
            .map(function (d) {
                return {
                    timestamp: d.timestamp,
                    speed: d.speed,
                    vehicleID: d.vehicleID,
                };
            })
            .groupBy(function (d) { return d.vehicleID; })
            .value();
    };

    var tspfspBSMVehicleData = cleanBSMGPS(tspfspBSM);
        tspfspGPSVehicleData = cleanBSMGPS(tspfspGPS);
        // Shouldn't have any vehicles in both sets, so we can use defaults here
        tspfspAllVehicleData = _.defaults(tspfspBSMVehicleData, tspfspGPSVehicleData),
        fspBSMVehicleData = cleanBSMGPS(fspBSM);
        fspGPSVehicleData = cleanBSMGPS(fspGPS);
        fspAllVehicleData = _.defaults(fspBSMVehicleData, fspGPSVehicleData);

    initChart(charts.tspfsp, tspfspAllVehicleData, vehicles);
    initChart(charts.fsp, fspAllVehicleData, vehicles);
}

function initControls() {
    _.forOwn(charts, function (chart) {
        // Set up filtering options
        var filterRadioConfigs = {
            'all': {
                filterFunc: _.stubTrue,
            },
            'car': {
                filterFunc: function (d) { return d.type === 'car'; },
            },
            'truck': {
                filterFunc: function (d) { return d.type === 'truck'; },
            },
            'transit': {
                filterFunc: function (d) { return d.type === 'transit'; },
            },
            'truck-transit': {
                filterFunc: function (d) {
                    return d.type === 'transit' || d.type === 'truck';
                },
            },
        };

        // Only keep the filter radios applicable to the chart
        filterRadioConfigs = _.pick(filterRadioConfigs, chart.filterRadios);

        _.forOwn(filterRadioConfigs, function (config, name) {
            var radioID = chart.domPrefix + '-' + name + '-radio';

            d3.select('#' + radioID).on('click', function () {
                if (chart.curFilterFunc !== config.filterFunc) {
                    chart.curFilterFunc = config.filterFunc;
                    chart.updateData(config.filterFunc);
                }
            });
        });


        // Set up time interval options
        d3.selectAll('.' + chart.domPrefix + '-time-interval-radio')
            .on('click', function () {
                var value = parseInt(this.value);

                if (chart.curTimeInterval !== value) {
                    chart.curTimeInterval = value;
                    chart.updateTimeInterval(value);
                }
            });
    });
}


/* Handle certain DOM events; accepts a function that will reinitialize
 * the chart from an empty SVG */
function initHandlers(reinitFunc) {
    d3.select(window)
        .on('resize', function () {
            // Remove all child elements of the SVGs
            _.forOwn(charts, function (chart) {
                d3.select('#' + chart.domPrefix + '-chart-div').selectAll('*').remove();
            });

            // Reinitialize
            reinitFunc();
        });
}

/* Hide elements that indicate the page is loading */
function hideLoading() {
    d3.selectAll('.loading').each(function () {
        this.style.visibility = 'hidden';
        this.style.opacity = '0';
    });
}

/* Functions to calculate viz dimensions based on (possibly changed)
 * page dimensions */
function vizWidth(chart) {

    var parentDivWidth = d3.select('#' + chart.domPrefix + '-chart-div').node()
        .clientWidth;

    // Expand to the size of the parent div, but floor size at 800px
    return Math.max(parentDivWidth, 800);
}

function vizHeight(chart) {
    return 400;
}

/* Calls the given callback with the loaded BSM data */
function loadBSM(filename, cb) {
    d3.csv(filename, function (d) {
        return {
            timestamp: moment.unix(d.timestamp),
            lat: +d.lat,
            lng: +d.lng,
            speed: +d.speed,
            vehicleID: +d.vehicle_ID,
        };
    }, function (bsm) { cb(null, bsm); })
}


/* Calls the given callback with the loaded GPS data */
function loadGPS(filename, cb) {
    d3.csv(filename, function (d) {
        return {
            timestamp: moment.unix(d.timestamp),
            lat: +d.lat,
            lng: +d.lng,
            speed: +d.speed,
            vehicleID: +d.vehicle_ID,
        };
    }, function (gps) { cb(null, gps); })
}


/* Calls the given callback with the loaded vehicle data */
function loadVehicle(cb) {
    d3.csv('data/vehicle.csv', function (d) {
        return {
            vehicleID: +d.vehicle_ID,
            type: d.vehicle_type,
            source: d.source,
        };
    }, function (vehicles) { cb(null, vehicles); });
}


d3.queue()
    .defer(loadBSM, 'data/bsm_tspfsp.csv')
    .defer(loadGPS, 'data/gps_tspfsp.csv')
    .defer(loadBSM, 'data/bsm_fsp.csv')
    .defer(loadGPS, 'data/gps_fsp.csv')
    .defer(loadVehicle)
    .await(function (err, tspfspBSM, tspfspGPS, fspBSM, fspGPS, vehicles) {
        if (err) throw err;
        
        initViz(tspfspBSM, tspfspGPS, fspBSM, fspGPS, vehicles);
        initControls();
        initHandlers(function () {
            initViz(tspfspBSM, tspfspGPS, fspBSM, fspGPS, vehicles);
        });

        hideLoading();
    });
