// Handle the sticky filter bar
$(document).ready(function(){
    $("#sticky").sticky({topSpacing:0,zIndex:9999,responsiveWidth:true,getWidthFrom:'#dashboard-wrapper'});
});

var charts,
    dataTable;

function formatDateInterval(dateInterval) {
    var formatter = d3.time.format('%b %Y');
    return formatter(dateInterval[0]) + '-' + formatter(dateInterval[1]);
}

/* If length of the string <= len, return the string.
 * Else, return the string truncated to len + '…' */
function truncate(str, len) {
    return _.size(str) > len
        ? str.substr(0, len) + '…'
        : str;
}

function refreshFilterList() {
    var filters = _.chain(charts)
        .pickBy(function (chart) { return _.size(chart.filters()) > 0; })
        .reduce(function (filters, chart, chartName) {
            return _.chain(chart.filters())
                .map(function (filter) {
                    // Filters are either strings or a date interval (from the active
                    // over time chart).  record them appropriately
                    var filter = typeof filter === 'string'
                            ? truncate(filter, 20)
                            : formatDateInterval(filter),
                        // Cut out 'chart', add spaces in front of caps, and convert to Init Caps
                        displayName = _.upperFirst(chartName.slice(0, -5).replace(/([A-Z])/g, ' $1')) + ': ' + filter;

                    return {
                        chartName: chartName,
                        filter: filter,
                        key: chartName + '|' + filter,
                        displayName: displayName,
                    };
                })
                .concat(filters)
                .value();
        }, [])
        .value();

    if (_.size(filters) === 0) {
        filters.push({
            key: null,
            displayName: 'No Filters Applied',
        });
    }

    var filterElements = d3.select('#chart-filters').selectAll('.chart-filter')
        .data(filters, function (d) { return d.key; });

    filterElements.enter()
        .append('div') // CLAY CHANGE
        .classed('chart-filter', true)
        .text(function (d) { return d.displayName; });

    filterElements.exit()
        .remove();
}

function refreshDataTable(dim) {
    dc.events.trigger(function () {
        dataTable.api()
            .clear()
            .rows.add(dim.top(Infinity))
            .draw();
    });
}


function resetChart(chartName) {
    charts[chartName].filterAll();
    dc.redrawAll();
}

function resetAllCharts() {
    _.forOwn(charts, function (chart) {
        chart.filterAll();
    });
    dc.redrawAll();
}

function resizeCharts() {
    // Don't resize the leaflet chart; leaflet takes care of it for us
    var resizeCharts = _.omit(charts, 'locationChart'),
        transitionDurations = _.mapValues(resizeCharts, function (chart) {
            return chart.transitionDuration();
        });

    _.forOwn(resizeCharts, function (chart) {
        // Resize the chart to fit the parent div's width
        chart.width(chart.root().node().parentNode.clientWidth)
            .transitionDuration(0);
    });

    // Don't include the location chart in the re-render here, or
    // it will throw an annoying error about leaflet already being initialized
    dc.deregisterChart(charts.locationChart);
    dc.redrawAll();
    dc.registerChart(charts.locationChart);

    // Put the transitionDurations back
    _.forOwn(resizeCharts, function (chart, chartName) {
        chart.transitionDuration(transitionDurations[chartName]);
    });
};


/* Location names are all lower case in the data.  Fix that here. */
function fixLocationTag(loc) {
    if (!(typeof loc === 'string')) {
        return loc;
    }

    var commaNdx = _.findIndex(loc, function (d) { return d === ','; });

    /* Capitalize a state name, but initCaps everything else */
    var initCaps, allCaps;
    if (commaNdx !== -1) {
        initCaps = loc.slice(0, commaNdx);
        allCaps = loc.slice(commaNdx);
    }
    else {
        initCaps = loc;
        allCaps = '';
    }

    var cleanedLoc = _.chain(initCaps)
        .words()
        .map(_.capitalize)
        .join(' ')
        .value();
    
    if (allCaps !== '') {
        cleanedLoc += _.toUpper(allCaps);
    }

    return cleanedLoc;
}


/* Call the given callback with the RDE data */
function loadRDE(cb) {
    var inDateFormat = d3.time.format('%Y-%m-%d'),
        RDE_BASE_URL = 'http://www.its-rde.net/',
        RDE_DATASET_URL = RDE_BASE_URL + 'data/showdf?dataSetNumber=',
        RDE_DATAENV_URL = RDE_BASE_URL + 'data/showds?dataEnvironmentNumber=';

    function convertDate(date) {
        return inDateFormat.parse(date);
    }

    d3.csv('data/rde.csv',
        function (d) {
            var returnVal = {
                datasetID: d.dataset_id,
                url: RDE_DATASET_URL + d.dataset_id,
                dataset: d.dataset_title,
                description: d.dataset_description,
                startDate: convertDate(d.dataset_start_date),
                endDate: convertDate(d.dataset_end_date),
                createDate: convertDate(d.dataset_create_date),
                location: d.dataset_location,
                size: +d.dataset_datasize,
                environment: d.data_environment_title,
                environmentURL: RDE_DATAENV_URL + d.data_environment_id,
                environmentDescription: d.data_environment_description,
                environmentBounds: d.data_environment_bounds,
                tag: d.tag,
                tagCategory: d.tag_category,
            };

            returnVal.interval = [returnVal.startDate.getTime(), returnVal.endDate.getTime()];

            if (returnVal.tagCategory === 'Location') {
                returnVal.tag = fixLocationTag(returnVal.tag);
            }

            return returnVal;
        }, function (rde) {
            cb(rde);
        });
}

/* Call the given callback with the location data */
function loadLocations(cb) {
    var locations = {};
    d3.csv('data/locations.csv',
        function (d) {
            locations[fixLocationTag(d.location)] = {
                latlng: [+d.lat, +d.lng],
            };
        }, function () {
            cb(locations);
        });
}


/* Init the dc.js viz; requires RDE and location data */
function initViz(rde, locations) {
    /* Clean up data */
    var datasets = _.chain(rde)
        .map(function (d) { return _.omit(d, ['tag', 'tagCategory']); })
        .uniqBy(function (d) { return d.datasetID; })
        .value();

    var firstDate = d3.min(datasets, function (d) { return d.startDate; }),
        lastDate = d3.max(datasets, function (d) { return d.endDate; });

    var tags = _.chain(rde)
        .map(function (d) { return _.pick(d, ['datasetID', 'tag', 'tagCategory']); })
        .groupBy(function (d) { return d.datasetID; })
        .value();

    /* Crossfilter dims/groups */
    var ndx = crossfilter(datasets);
    var countGroup = ndx.groupAll();

    var sizeGroup = ndx.groupAll().reduceSum(function (d) {
        return d.size;
    });

    var environmentDim = ndx.dimension(function (d) {
        return d.environment;
    });
    var environmentGroup = environmentDim.group();

    var datasetDim = ndx.dimension(function (d) {
        return d.dataset;
    });
    var datasetGroup = datasetDim.group();

    var activeOverTimeDim = ndx.dimension(function (d) {
        return d.interval;
    });
    var activeOverTimeTree = ndx.groupAll().reduce(
        function (p, v) {
            p.insert(v.interval);
            return p;
        },
        function (p, v) {
            p.remove(v.interval);
            return p;
        },
        function () {
            return lysenkoIntervalTree(null);
        }).value();
    var activeOverTimeGroup = intervalTreeGroup(activeOverTimeTree, firstDate, lastDate);


    /* Set up charts */
    charts = {
        locationChart: dc.leafletMarkerChart('#location-map-chart'),
        environmentChart: dc.rowChart('#environment-chart'),
        dataTypeChart: dc.rowChart('#data-type-chart'),
        facilityChart: dc.rowChart('#facility-chart'),
        frequencyChart: dc.rowChart('#frequency-chart'),
        activeOverTimeChart: dc.barChart('#active-over-time-chart'),
        datasetCountDisplay: dc.numberDisplay('#dataset-count-display'),
        datasetSizeDisplay: dc.numberDisplay('#dataset-size-display'),
    };

    setTagCategoryDimGroup(charts.dataTypeChart, ndx, tags, 'Data Type');

    setTagCategoryDimGroup(charts.locationChart, ndx, tags, 'Location');

    setTagCategoryDimGroup(charts.facilityChart, ndx, tags, 'Facility');

    setTagCategoryDimGroup(charts.frequencyChart, ndx, tags, 'Frequency');


    var barColors = ['#8ba6ca'],
        transitionDuration = 750,
        tickFormat = d3.format('d');

    function initTagCategoryRowChart(height) {
        return function (chart) {
            chart.height(height)
                .elasticX(true)
                .ordinalColors(barColors)
                .xAxis().tickFormat(tickFormat);
        };
    };

    var chartInitFuncs = {
        environmentChart: function (chart) {
            chart.height(400)
                .dimension(environmentDim)
                .group(environmentGroup)
                .elasticX(true)
                .ordinalColors(barColors)
                .xAxis().tickFormat(tickFormat);
        },
        dataTypeChart: initTagCategoryRowChart(400),
        facilityChart: initTagCategoryRowChart(200),
        frequencyChart: initTagCategoryRowChart(200),
        activeOverTimeChart: function (chart) {
            chart.height(200)
                .dimension(activeOverTimeDim)
                .group(activeOverTimeGroup)
                .x(d3.time.scale())
                .xUnits(d3.time.months)
                .elasticX(true)
                .elasticY(true)
                .ordinalColors(barColors)
                .yAxis().tickFormat(tickFormat);

            // Hack to prevent chart from hijacking mouse scroll events
            chart._disableMouseZoom = function () {};

            /* Hack to handle filtering on time intervals */
            chart.filterHandler(function (dim, filters) {
                if (filters && filters.length) {
                    if (filters.length !== 1) {
                        throw new Error('No more than one range filter allowed.');
                    }
                    var range = filters[0];
                    dim.filterFunction(function (i) {
                        return !(i[1] < range[0].getTime() || i[0] > range[1].getTime());
                    });
                }
                else {
                    dim.filterAll();
                }
                return filters;
            });

        },
        locationChart: function (chart) {
            var home = {
                // Center of contiguous US
                lat: 37.83333,
                lng: -98.5855,
                // Enough to see the whole US
                zoom: 4
            };

            chart.height(800) // This is ignored and set in CSS
                .mapOptions({
                    attributionControl: false,
                    scrollWheelZoom: false,
                    zoomControl: false,
                })
                // Custom center point/zoom
                .fitOnRender(false)
                .center([home.lat, home.lng])
                .zoom(home.zoom)
                .locationAccessor(function (d) {
                    return locations[d.key].latlng;
                })
                .tiles(function (map) {
                    L.tileLayer('http://tile.stamen.com/terrain/{z}/{x}/{y}.png')
                        .addTo(map);
                })
                .on('postRender', function (chart) {
                    // Add custom attribution
                    L.control.attribution({position: 'bottomright'})
                        .addAttribution('Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.')
                        .addTo(chart.map());

                    // Add custom zoom controls
                    L.easyBar([
                        L.easyButton('<big>+</big>', function (control, map) {
                            map.setZoom(map.getZoom() + 1);
                        }),
                        L.easyButton('fa-home fa-lg', function (control, map) {
                            map.setView([home.lat, home.lng], home.zoom);
                        }),
                        L.easyButton('<big>-</big>', function (control, map) {
                            map.setZoom(map.getZoom() - 1);
                        })
                    ])
                    .addTo(chart.map());
                });

        },
        datasetCountDisplay: function (chart) {
            var htmlTemplate = 'Datasets Selected: %number';
            chart.height(50)
                .html({
                    one: htmlTemplate,
                    some: htmlTemplate,
                    none: htmlTemplate,
                })
                .group(countGroup)
                .valueAccessor(function (d) {
                    return d;
                })
                .formatNumber(d3.format('f'));
        },
        datasetSizeDisplay: function (chart) {
            var htmlTemplate = 'Total File Size: %numberB (compressed)';
            chart.height(50)
                .html({
                    one: htmlTemplate,
                    zero: htmlTemplate,
                    some: htmlTemplate,
                })
                .group(sizeGroup)
                .valueAccessor(function (d) {
                    return d;
                })
                .formatNumber(d3.format('.4s'));
        },
    };


    /* Init dc charts */
    _.forOwn(charts, function (chart, chartName) {
        chartInitFuncs[chartName](chart);
        
        // Common initialization for all charts
        chart.turnOnControls(true)
            .controlsUseVisibility(true)
            .transitionDuration(transitionDuration)
            .on('filtered', function () {
                refreshFilterList();
                refreshDataTable(datasetDim);
            });

        // Don't resize the leaflet chart; leaflet takes care of it for us
        if (chartName !== 'locationChart') {
            // Set the initial width based on the size of the chart's parent div
            chart.width(chart.root().node().parentNode.clientWidth);
        }
    });

    // Init the filter list
    refreshFilterList();

    /* Init data table */
    var dataTableDateFormat = d3.time.format('%Y-%m-%d');

    // Function to handle rendering data set name/environment name with
    // hyperlinks
    var renderDataSetEnv = function (data, type) {
        if (type === 'display') {
            return '<a target="_blank" title="' + data.name
                + '" href="' + data.url + '">' + data.name
                + '</a>';
        }
        else {
            return data.name;
        }
    };


    dataTable = $('#data-table-chart').dataTable({
        lengthChange: false,
        pagingType: "numbers",
        "autoWidth": false,
        dom: 'T<"clear-l"l><"clear-l"i><"clear-r"f><"clear-r"p>t',
        order: [[0, 'asc']],
        columnDefs: [{
            targets: 0,
            data: function (d) {
                return {
                    name: d.dataset,
                    url: d.url,
                };
            },
            type: 'html',
            width: '30%',
            render: renderDataSetEnv,
        }, {
            targets: 1,
            data: function (d) { return dataTableDateFormat(d.startDate); },
            width: '10%',
        }, {
            targets: 2,
            data: function (d) { return dataTableDateFormat(d.endDate); },
            width: '10%',
        }, {
            targets: 3,
            data: function (d) { return d.location; },
            width: '10%',
            render: function (data, type) {
                if (type === 'display') {
                    return '<span title="' + data + '">' + data + '</span>';
                }
                else {
                    return data;
                }
            },
        }, {
            targets: 4,
            data: function (d) { return d.size; },
            // Format size using D3's scientific format specifier
            createdCell: function (cell, data) {
                $(cell).text(d3.format('.4s')(data) + 'B');
            },
        }, {
            targets: 5,
            data: function (d) {
                return {
                    name: d.environment,
                    url: d.environmentURL,
                };
            },
            type: 'html',
            render: renderDataSetEnv,
            width: '30%',
        }]
    });

    refreshDataTable(datasetDim);

    dc.renderAll();

    // Make charts responsive by changing width on window resize
    resizeCharts();
    window.onresize = function () {
        resizeCharts();
    }

    d3.select('#reset-all-btn').on('click', function () {
        resetAllCharts();
    });

    // Set all the reset buttons to being hidden initially; dc will take care of hiding/showing
    // them as necessary
    Array.prototype.forEach.call(document.getElementsByClassName('reset'), function (node) {
        node.style.visibility = 'hidden';
    });

    
}

/* Load all the data and initialize the viz */
function init() {
    loadRDE(function (rde) {
        loadLocations(function (locations) {
            initViz(rde, locations);
        });
    });
}

init();
