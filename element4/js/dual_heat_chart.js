/* A chart that displays bars for each time interval in the data, colored
 * based on the data values.  Two different sets of bars are displayed at once,
 * allowing viewers to get a sense of the temporal distribution of each
 * set individually as well as their relationship to each other.
 *
 * Options:
 *
 * width: width of the resulting SVG, including margins
 * height: height of the resulting SVG, including margins
 * keyAccessor: function that takes a datum and returns the key (should be a moment)
 * valueAccessor: function that takes a datum and returns the value (some sort of number, like a count)
 * keyFormat: display format for the time values on the tooltip and on the time axis (momentjs)
 * margins: object containing "top_", "bottom", "left", and "right" properties that determine margins
 * timeInterval: interval (in minutes) width of each bar
 * colors: array of colors to be used as the color scale
 * backgroundColor: color to fill the background (i.e. "no data")
 * transitionDuration: Base duration for transitions
 * upperLabel: Label for the upper data (ex. "Before")
 * lowerLabel: Label for the lower data (ex. "After")
 * tooltipValueLabel: Label for the value in the tooltip; ex. "widgets" -> "5:00pm - 5:10pm, 8 widgets"
 * legendUnits: Label for the units in the legend; should be very short, as the
 *   size for this is currently static.  ex. veh-secs
 * updateXAxis: Whether to update the X axis when data is changed; defaults to true.
 *   Set this to false if you start with a full data set and want to filter it
 *   while preserving the view of the full time frame.
 **/

dualHeatChartID = 0;

// TODO: Switch this from constructor to factory function
function dualHeatChart(upperData, lowerData, userOptions) {
    var chart = {},
        this_ = this;

    /* Autoincrementing ID for generating DOM IDs */
    this_.id = dualHeatChartID++;

    /* Options + combo getter/setters */

    var optionDefaults = {
        width: 800,
        height: 600,
        keyAccessor: function (d) { return d.timestamp; },
        valueAccessor: function (d) { return d.count; },
        keyFormat: 'h:mma',
        margins: {
            top_: 10, right: 30, bottom: 10, left: 50
        },
        timeInterval: 5,
        colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6',
            '#2171b5', '#08519c', '#08306b'],
        backgroundColor: '#ffffff',
        transitionDuration: 750,
        upperLabel: 'Before',
        lowerLabel: 'After',
        tooltipValueLabel: '',
        legendUnits: '',
        updateXAxis: true,
    }
    this_.options = _.defaults(userOptions, optionDefaults);

    chart.width = function (width) {
        if (!arguments.length) return this_.options.width;
        this_.options.width = width;
        return chart;
    }

    chart.height = function (height) {
        if (!arguments.length) return this_.options.height;
        this_.options.height = height;
        return chart;
    }

    chart.keyAccessor = function (keyAccessor) {
        if (!arguments.length) return this_.options.keyAccessor;
        this_.options.keyAccessor = keyAccessor;
        return chart;
    }

    chart.valueAccessor = function (valueAccessor) {
        if (!arguments.length) return this_.options.valueAccessor;
        this_.options.valueAccessor = valueAccessor;
        return chart;
    }

    chart.keyFormat = function (keyFormat) {
        if (!arguments.length) return this_.options.keyFormat;
        this_.options.keyFormat = keyFormat;
        return chart;
    }

    chart.margins = function (margins) {
        if (!arguments.length) return this_.options.margins;
        this_.options.margins = margins;
        return chart;
    }

    chart.timeInterval = function (timeInterval) {
        if (!arguments.length) return this_.options.timeInterval;
        this_.options.timeInterval = timeInterval;
        return chart;
    }

    chart.colors = function (colors) {
        if (!arguments.length) return this_.options.colors;
        this_.options.colors = colors;
        return chart;
    }

    chart.backgroundColor = function (color) {
        if (!arguments.length) return this_.options.backgroundColor;
        this_.options.backgroundColor = color;
        return chart;
    }

    chart.transitionDuration = function (transitionDuration) {
        if (!arguments.length) return this_.options.transitionDuration;
        this_.options.transitionDuration = transitionDuration;
        return chart;
    }

    chart.upperLabel = function (upperLabel) {
        if (!arguments.length) return this_.options.upperLabel;
        this_.options.upperLabel = upperLabel;
        return chart;
    }

    chart.lowerLabel = function (lowerLabel) {
        if (!arguments.length) return this_.options.lowerLabel;
        this_.options.lowerLabel = lowerLabel;
        return chart;
    }

    chart.updateXAxis = function (updateXAxis) {
        if (!arguments.length) return this_.options.updateXAxis;
        this_.options.updateXAxis = updateXAxis;
        return chart;
    }


    this_.upperData = upperData;
    this_.lowerData = lowerData;
    this_.xScale = null;
    this_.colorScale = null;
    this_.xAxis = null;
    this_.yDomain = null;
    this_.svg = null;
    this_.drawn = false;
    this_.legendHeight = 40;
    this_.bottomHeaderHeight = 40;

    this_.getChartBodyTop = function () {
        return this_.options.margins.top_ + this_.legendHeight;
    };

    this_.getChartBodyBottom = function () {
        return this_.options.height - this_.options.margins.bottom - this_.bottomHeaderHeight;
    };

    this_.getChartBodyHeight = function () {
        return this_.getChartBodyBottom() - this_.getChartBodyTop();
    };

    this_.getChartBodyMid = function () {
        return this_.getChartBodyTop() + (this_.getChartBodyHeight() / 2);
    };

    this_.getXScale = function () {
        var xBounds = d3.extent(_.chain(this_.upperData)
            .map(function (d) { return this_.options.keyAccessor(d); })
            .concat(_.map(this_.lowerData, function (d) { return this_.options.keyAccessor(d); }))
            .value());
        
        return (this_.xScale || d3.scaleTime())
            // Convert moments to times
            .domain(_.map(xBounds, function (d) { return d.toDate(); }))
            .range([this_.options.margins.left, this_.options.width]);
    }


    /* Return a function that maps linearly from the given domain to the given color scale */
    this_.getColorScale = function () {
        var colors = d3.interpolateRgbBasis(this_.options.colors),
            // Get the domain (range of possible input values) of counts from the combined data
            domain = d3.extent(_.chain(this_.upperData)
                .map(this_.options.valueAccessor)
                .concat(_.map(this_.lowerData, this_.options.valueAccessor))
                .value()),
            scale = d3.scaleLinear()
                .domain(domain)
                .range([0, 1]);
        return function (d) {
            return colors(scale(d));
        };
    }

    this_.getYDomain = function () {
        return d3.extent(_.chain(this_.upperData)
                .map(this_.options.valueAccessor)
                .concat(_.map(this_.lowerData, this_.options.valueAccessor))
                .value());
    }

    /* Sum up all the values in the specified data orient */
    this_.dataSum = function (orient) {
        var data = (orient === 'upper') ? this_.upperData : this_.lowerData;

        return _.chain(data)
            .map(this_.options.valueAccessor)
            .sum()
            .value();
    }

    /* Drawing bars (redraw uses the same function) */

    this_.drawBars = function (svg) {
        
        // Create the container for all the bars if it doesn't exist
        var barContainer = svg.select('.bar-container');
        if (barContainer.size() === 0) {
            // Use insert instead of append here so we go behind any axes
            // Insert as the 2nd child, because we still want to be in front of the
            // background
            barContainer = svg.insert('g', ':nth-child(2)')
                .classed('bar-container', true);
        }

        // Create the tooltip div if it doesn't exist
        var tooltip = d3.select('#heat-chart-tooltip');
        if (tooltip.size() === 0) {
            tooltip = d3.select('body').append('div')
                .attr('id', 'heat-chart-tooltip')
                .style('opacity', 0);
        }

        /* Draw half of the bars (either upper or lower) */
        var drawHalf = function (data, orient) {

            // Use 1e-6 instead of 0 for opacity to avoid bugs with scientific notation
            var ZERO_OPACITY = 1e-6;

            var bars = barContainer.selectAll('.' + orient + '-bar')
                .data(data, function (d) {
                    // Key function
                    return this_.options.keyAccessor(d).format(this_.options.keyFormat);
                });

            // Functions for displaying various parts of the tooltip
            var tooltipHTML = function (key, value) {
                    var curTick = key,
                        nextTick = moment(key),
                        timeFormat = 'h:mma';
                    nextTick.add(this_.options.timeInterval, 'minutes');

                    return '<span class="tooltip-header">' + curTick.format(this_.options.keyFormat) + ' - '
                        + nextTick.format(this_.options.keyFormat) + '</span><br />'
                        + '<span class="tooltip-body">' + value.toString() + ' '
                        + this_.options.tooltipValueLabel + '</span>';
                },
                tooltipLeft = function () {
                    var eventX = d3.event.pageX,
                        tooltip = d3.select(this),
                        tooltipWidth = parseInt(tooltip.style('width'));

                    // If the tooltip would clip off screen to the left, show it to the right
                    if ((eventX + 10 + tooltipWidth) > window.innerWidth) {
                        return (eventX - 10 - tooltipWidth).toString() + 'px';
                    }
                    // Otherwise, show it to the left
                    else {
                        return (eventX + 10).toString() + 'px';
                    }
                },
                tooltipTop = function () {
                    var eventY = d3.event.pageY,
                        tooltip = d3.select(this),
                        tooltipHeight = parseInt(tooltip.style('height'));

                    // If the tooltip would clip off the screen to the bottom, show it to the top
                    if ((eventY + 10 + tooltipHeight) > window.innerHeight) {
                        return (eventY - 10 - tooltipHeight).toString() + 'px';
                    }
                    // Otherwise, show it to the bottom
                    else {
                        return (eventY + 10).toString() + 'px';
                    }
                };

            // Accessors that might be reused
            var widthFunc = function (d) {
                    // Set the width based on time intervals
                    var thisTick = d.timestamp.toDate();
                    var nextTick = d.timestamp.clone().add(this_.options.timeInterval, 'minutes').toDate();
                    return this_.xScale(nextTick) - this_.xScale(thisTick);
                },
                fillFunc = function (d) { return this_.colorScale(d.count); },
                xFunc = function (d) {
                    return this_.xScale(this_.options.keyAccessor(d).toDate());
                };


            // Update data: transition x attr so axis changes aren't jarring
            var updateTransition = bars.transition()
                .duration(this_.options.transitionDuration)
                .attr('x', xFunc);


            // New data: draw bars
            var enter = bars.enter() // ENTER
                .append('rect')
                .classed(orient + '-bar bar', true)
                // New data: no transition for x attr, so bars don't come flying
                // out of the side
                .attr('x', xFunc)
                .attr('y', orient === 'upper'
                    ? this_.getChartBodyTop()
                    : this_.getChartBodyMid())
                .attr('height', this_.getChartBodyHeight() / 2)
                .style('fill-opacity', ZERO_OPACITY);


            // New and updated data: some transitions, add/update tooltip triggers, sort
            enter.merge(bars) // ENTER + UPDATE
                .on('mouseover', function (d) {
                    tooltip.transition()
                        .duration(this_.options.transitionDuration / 2)
                        .style('opacity', 0.9);

                    tooltip.html(tooltipHTML(this_.options.keyAccessor(d), this_.options.valueAccessor(d)))
                        .style('left', tooltipLeft)
                        .style('top', tooltipTop);
                })
                .on('mouseout',  function (d) {
                    tooltip.transition()
                        .duration(this_.options.transitionDuration / 2)
                        .style('opacity', 0);
                })
                .on('mousemove', function (d) {
                    tooltip.style('left', tooltipLeft)
                        .style('top', tooltipTop);
                })
                .sort(function (a, b) {
                    return a.timestamp.unix() - b.timestamp.unix();

                })
                // Merge with updateTransition so both are applied
              .transition(updateTransition)
                .duration(this_.options.transitionDuration)
                .attr('width', widthFunc)
                .attr('fill', fillFunc)
                .style('fill-opacity', 1);


            // Removed data: remove bars
            bars.exit() // EXIT
              .transition()
                .duration(this_.options.transitionDuration)
                .attr('width', 0)
                .style('fill-opacity', ZERO_OPACITY)
                .remove();

        };

        drawHalf(this_.upperData, 'upper');
        drawHalf(this_.lowerData, 'lower');
    }


    /* Drawing/redrawing axes */

    this_.drawAxes = function (svg) {
        var xAxis = this_.xAxis || d3.axisBottom(this_.xScale);

        svg.append('g')
            .classed('x-axis', true)
            .classed('axis', true)
            .attr('transform', 'translate(0,' + this_.getChartBodyMid().toString() + ')')
          .transition()
            .duration(this_.options.transitionDuration)
            .call(xAxis);

        this_.xAxis = xAxis;
    }

    this_.redrawAxes = function (svg, xAxis) {
        svg.select('.x-axis')
          .transition()
            .duration(this_.options.transitionDuration)
            .call(xAxis);
    }

    /* Drawing/redrawing legend */

    this_.drawLegend = function (svg) {
        var rectWidth = Math.round(this_.options.width / 5),
            textWidth = 80,
            rectHeight = 20,
            rectYOffset = 10,
            // Font size of legend text
            textSize = 14,
            // Left/right padding
            textPadding = 5,
            domain = this_.yDomain,
            divID = svg.node().parentNode.id;

        var legend = svg.append('g')
            .classed('heat-chart-legend', true);

        legend.append('linearGradient')
            .attr('id', 'heat-chart-legend-gradient' + this_.id)
          .selectAll('stop')
            .data(_.map(this_.options.colors, function (color, i) {
                return {
                    offset: Math.round((i / _.size(this_.options.colors)) * 100).toString() + '%',
                    color: color,
                };
            }))
          .enter().append('stop')
            .attr('offset', function (d) { return d.offset; })
            .attr('stop-color', function (d) { return d.color; });

        legend.append('rect')
            .attr('x', this_.options.width - rectWidth - textWidth)
            .attr('y', rectYOffset)
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .style('fill', 'url(#heat-chart-legend-gradient' + this_.id + ')');

        legend.append('text')
            .attr('x', this_.options.width - rectWidth - textWidth - textPadding)
            .attr('y', rectYOffset + textSize)
            .attr('font-size', textSize)
            .attr('text-anchor', 'end')
            .classed('heat-chart-legend-min-text', true)
            .classed('heat-chart-legend-text', true)
            .text(domain[0].toString() + ' ' + this_.options.legendUnits);

        legend.append('text')
            .attr('x', this_.options.width - textWidth + textPadding)
            .attr('y', rectYOffset + textSize)
            .attr('font-size', textSize)
            .classed('heat-chart-legend-max-text', true)
            .classed('heat-chart-legend-text', true)
            .text(domain[1].toString() + ' ' + this_.options.legendUnits);
    };

    this_.redrawLegend = function (svg) {
        var domain = this_.yDomain;

        svg.select('.heat-chart-legend-min-text')
            .text(domain[0].toString() + ' ' + this_.options.legendUnits);

        svg.select('.heat-chart-legend-max-text')
            .text(domain[1].toString() + ' ' + this_.options.legendUnits);
    };

    this_.getLabelSum = function (orient) {
        var total = this_.dataSum(orient);
        return 'Total Delay: ' + total + ' veh-secs';
    };

    this_.drawLabels = function (svg) {
        svg.append('text')
            .attr('x', this_.options.width / 2)
            .attr('y', 2 * this_.legendHeight / 5)
            .attr('text-anchor', 'middle')
            .text(this_.options.upperLabel)
            .classed('heat-chart-label', true)
            .classed('heat-chart-upper-label', true);

        svg.append('text')
            .attr('x', this_.options.width / 2)
            .attr('y', 4 * this_.legendHeight / 5)
            .attr('text-anchor', 'middle')
            .text(this_.getLabelSum('upper'))
            .classed('heat-chart-label-sum', true)
            .classed('heat-chart-label-sum-upper', true);

        svg.append('text')
            .attr('x', this_.options.width / 2)
            .attr('y', this_.getChartBodyBottom() + (2 * this_.legendHeight / 5))
            .attr('text-anchor', 'middle')
            .text(this_.options.lowerLabel)
            .classed('heat-chart-label', true)
            .classed('heat-chart-lower-label', true);

        svg.append('text')
            .attr('x', this_.options.width / 2)
            .attr('y', this_.getChartBodyBottom() + (4 * this_.legendHeight / 5))
            .attr('text-anchor', 'middle')
            .text(this_.getLabelSum('lower'))
            .classed('heat-chart-label-sum', true)
            .classed('heat-chart-label-sum-lower', true);
    };

    this_.redrawLabels = function (svg) {
        svg.select('.heat-chart-upper-label')
            .text(this_.options.upperLabel);

        svg.select('.heat-chart-label-sum-upper')
            .text(this_.getLabelSum('upper'));

        svg.select('.heat-chart-lower-label')
            .text(this_.options.lowerLabel);

        svg.select('.heat-chart-label-sum-lower')
            .text(this_.getLabelSum('lower'));
    };


    chart.draw = function (divID) {
        var svgContainer = d3.select('#' + divID);

        if (svgContainer.select('svg').size() === 0) {
            this_.svg = svgContainer.append('svg')
                .attr('width', this_.options.width)
                .attr('height', this_.options.height)
                .classed('dual-heat-chart', true);

            // Draw the background
            this_.svg.append('rect')
                .attr('x', 0)
                .attr('y', this_.getChartBodyTop())
                .attr('width', this_.svg.attr('width'))
                .attr('height', this_.getChartBodyHeight())
                .style('fill', this_.options.backgroundColor);
        }

        this_.xScale = this_.getXScale();
        this_.colorScale = this_.getColorScale();
        this_.yDomain = this_.getYDomain();

        this_.drawAxes(this_.svg);
        this_.drawBars(this_.svg);
        this_.drawLegend(this_.svg);
        this_.drawLabels(this_.svg);

        drawn = true;
    };

    chart.updateData = function (newUpperData, newLowerData) {
        // Update actual data
        this_.upperData = newUpperData;
        this_.lowerData = newLowerData;

        // Update scales based on new data
        if (this_.options.updateXAxis) {
            this_.xScale = this_.getXScale();
        }
        this_.colorScale = this_.getColorScale();
        this_.yDomain = this_.getYDomain();

        // Update things that depend on scales
        this_.xAxis.scale(this_.xScale);
    };

    chart.redraw = function () {
        if (!drawn) {
            throw new Error("Can't redraw the chart when it hasn't been drawn.");
        }

        this_.redrawAxes(this_.svg, this_.xAxis);
        this_.drawBars(this_.svg);
        this_.redrawLegend(this_.svg);
        this_.redrawLabels(this_.svg);
    };

    return chart;
}
