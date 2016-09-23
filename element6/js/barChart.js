/* Function to create and manipulate a bar chart
 * parameters:
 *   data: the data for the chart, from sampled csv
 *   chartDiv: The div the chart goes inside
 *   parentDiv: The div of the parent.  Used to set expand/collapse toggle
 *   userOptions: custom options for the chart, will expanded once completed functionality
 *     width: The width of the chart, default is width of chartDiv (minus margins)
 *     height: The height of the chart, default is 200 (minus margins)
 *     margins: The margins of the chart, default is [20,10,30,30]
 *     eventFlag: True means the chart is the first/primary chart (responsible for 
 *       expand/collpase of parent). False means chart is secondary (only needs to resize)
 *     yDomain: The domain of y-axis, default is [0, max(data.value)]
 *     yLabel: The label for the y-axis, default is %
 *     timeBegin: Start time for chart, default is earliest time in data
 *     timeEnd: End time for chart, default is latest time in data
 *     expandFlag: True means the chart is expanded, false means the chart is normal size
 *     leftColumn: True means the chart is found in the left column, false means the chart
 *       is found in the right column. Important for how the expand/shrink function works
 * Should return a chart object, add the chart to the page using chart.drawChart(chartDiv) */
function barChart(data, chartDiv, parentDiv, userOptions) {
  //Create chart object and define defaults
  var chart = {},
    optionDefaults = {
      width: $("#" + chartDiv).width() - 10 - 30,
      height: 220 - 0 - 40,
      margins: {
        top: 0,
        right: 10,
        bottom: 40,
        left: 30,
      },
      eventFlag: false,
      yDomain: null,
      yLabel: '%',
      timeBegin: d3.min(data, function(d) {
        return d.StartTime;
      }),
      timeEnd: d3.max(data, function(d) {
        return d.EndTime;
      }),
      expandFlag: false,
      leftColumn: true,

    };
  //Create chart options by combining userOptions and defaultOptions
  chart.options = $.extend({}, optionDefaults, userOptions);
  chart.divId = chartDiv;
  chart.parentId = parentDiv;
  chart.data = data;

  //Combo getter/setters
  chart.width = function(width) {
    if (!arguments.length) return chart.options.width;
    chart.options.width = width;
    return chart;
  }
  chart.height = function(height) {
    if (!arguments.length) return chart.options.height;
    chart.options.height = height;
    return chart;
  }
  chart.margins = function(margins) {
    if (!arguments.length) return chart.options.margins;
    chart.options.margins = margins;
    return chart;
  }

  //More chart propertiees, used in rendering chart
  chart.brush = null;
  chart.xScale = null;
  chart.yScale = null;
  chart.xAxis = null;
  chart.yAxis = null;
  chart.drawn = false;

  //Fetch the xScale and yScale
  chart.getXScale = function() {
    return d3.time.scale()
      .range([0, chart.options.width])
      .domain([chart.options.timeBegin, chart.options.timeEnd]);
  }
  chart.getYScale = function() {
    return d3.scale.linear()
      .range([chart.options.height, 0])
      .domain(chart.options.yDomain)
      .nice();
  }

  //Functions to recreate the axes, as well as function to initalize them
  chart.createXAxis = function() {
    return d3.svg.axis()
      .scale(chart.xScale)
      .orient("bottom")
      .tickSize(chart.options.height);
  }
  chart.createYAxis = function() {
    return d3.svg.axis()
      .scale(chart.yScale)
      .orient("left")
      .tickSize(-(chart.options.width))
      .ticks(5);
  }
  chart.createAxes = function(container) {
    var mainXAxis = container.append("g")
      .attr("class", "x axis")
      .call(chart.createXAxis())
    chart.xAxis = mainXAxis;

    var mainYAxis = container.append("g")
      .attr("class", "y axis")
      .call(chart.createYAxis())
    chart.yAxis = mainYAxis;
  }

  /* Function to create the brush
   * Also sets chart.brushOptions to allow easy access to brush options
   * These include brush margin, width, height, xScale, xAxis */
  chart.createBrush = function() {
    chart.brushOptions = {
      margins: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
      width: chart.options.width,
      height: (chart.options.margins.bottom / 2),
      brushArcs: null,
      brushRects: null,
    };
    chart.brushOptions.xScale = d3.time.scale()
      .range([0, chart.brushOptions.width])
      .domain([chart.options.timeBegin, chart.options.timeEnd]);
    chart.brushOptions.xAxis = d3.svg.axis()
      .scale(chart.brushOptions.xScale)
      .orient("bottom")
      .tickSize(chart.brushOptions.height)
      .tickFormat("");
    chart.brushOptions.arc = d3.svg.arc()
      .outerRadius(chart.brushOptions.height / 2)
      .startAngle(0)
      .endAngle(function(d, i) {
        return i ? -Math.PI : Math.PI;
      });

    return d3.svg.brush()
      .x(chart.brushOptions.xScale);
  }

  //Create the rectangles that make up the chart
  chart.createRects = function(container) {
    return rects = container.append("g")
      .attr("class", "rectsg")
      .attr("clip-path", "url(#" + chart.divId + "_clip)")
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "timelinerect");
  }

  //draw the brush
  chart.drawBrush = function() {
    chart.brush.extent([chart.options.timeBegin, chart.options.timeEnd]);
    if (chart.drawn) chart.brush(d3.select("#" + chart.divId + " .brush").transition().ease("quad-out").duration(900));
    else chart.brush(d3.select("#" + chart.divId + " .brush").transition().ease("quad-out").delay(2000).duration(2000));
  }

  /* Render the chart. Can be called with newWidth/newHeight to 
   * reRender the chart with new width/height */
  chart.renderChart = function(newWidth, newHeight) {
    //arguments mean there is new dimensions so handle that change
    if (arguments.length) {
      //Set the new width and height
      chart.width(newWidth - chart.options.margins.right - chart.options.margins.left);
      chart.height(newHeight - chart.options.margins.top - chart.options.margins.bottom);

      //Update the x and y scale
      chart.xScale.range([0, chart.options.width])
      chart.yScale.range([chart.options.height, 0])

      //Remove the old axis text that does not rerender properly
      chart.context.select('.x.axis').remove();
      chart.yAxis.select('.ylabeltext').remove();

      //Create a new brush
      chart.context.select(".x.brush").selectAll("rect")
        .attr("y", chart.options.height - chart.brushOptions.height)
        .attr("height", chart.brushOptions.height);
      chart.brush = chart.createBrush();
      chart.brush.on("brush", chart.brushChart);
    }

    //Update the clip path for the new chart dimensions
    chart.clipper.attr("width", chart.options.width)
      .attr("height", chart.options.height);

    //Transition the chart and background
    chart.svg.transition()
      .duration(900)
      .ease("quad-out")
      .attr("width", chart.options.width + chart.options.margins.right + chart.options.margins.left)
      .attr("height", chart.options.height + chart.options.margins.top + chart.options.margins.bottom);
    chart.bgrect.transition()
      .duration(900)
      .ease("quad-out")
      .attr("width", chart.options.width)
      .attr("height", chart.options.height);

    //Transition the rectangles as well as updating their attributes
    chart.rects.transition()
      .duration(900)
      .ease("quad-out")
      .attr("x", function(d) {
        return chart.xScale(d.StartTime);
      })
      .attr("y", function(d) {
        return chart.yScale(d.Value);
      })
      .attr("width", function(d) {
        if (chart.xScale(d.EndTime) - chart.xScale(d.StartTime) > 0 && chart.xScale(d.EndTime) - chart.xScale(d.StartTime) < 1) {
          return 1
        } else {
          // return 1;
          return chart.xScale(d.EndTime) - chart.xScale(d.StartTime);
        }
      })
      .attr("height", function(d) {
        return chart.options.height - chart.yScale(d.Value);
      })
      .style("fill-opacity", 0.8);
    chart.container.attr("transform", "translate(" + chart.options.margins.left + "," + chart.options.margins.top + ")");

    //Update the x/y axis
    chart.xAxis.call(chart.createXAxis());
    chart.yAxis.call(chart.createYAxis());
    chart.yAxis.append("text")
      .attr("class", "ylabeltext")
      .attr("dx", -25)
      .text(chart.options.yLabel)
      .attr("y", chart.options.height / 2);

    //Draw the brush and add the context axis to the chart      
    if (!arguments.length) {
      chart.context.append("g")
        .attr("class", "x brush")
        .call(chart.brush)
        .selectAll("rect")
        .attr("y", chart.options.height - chart.brushOptions.height)
        .attr("height", chart.brushOptions.height);
    }
    chart.context.attr("transform", "translate(" + chart.options.margins.left + "," + (chart.options.margins.bottom - 5) + ")");
    chart.drawBrush();
    var contextXAxis = chart.context.append("g")
      .attr("class", "x axis")
      .call(chart.brushOptions.xAxis);
    contextXAxis.attr("transform", "translate(0," + (chart.options.height - chart.brushOptions.height) + ")")
      .call(chart.brushOptions.xAxis);

    //Set up the fancy handles
    var handleoffset = chart.context.selectAll(".context .resize.e rect").attr("y");
    chart.context.selectAll(".context .resize rect").attr("opacity", 0);
    chart.context.selectAll(".context .resize path").remove();
    chart.brushOptions.brushArcs = chart.context.select(".x.brush").selectAll(".resize").append("path")
      .attr("class", "brusharc")
      .attr("transform", "translate(0," + (chart.options.height - chart.brushOptions.height / 2) + ")")
      .attr("d", chart.brushOptions.arc);
    chart.brushOptions.brushRects = chart.context.select(".x.brush").selectAll(".resize").append("rect")
      .attr("class", "brushrect")
      .attr("width", 1.5)
      .attr("height", chart.brushOptions.height + 10)
      .attr("y", handleoffset - 5);

    d3.select(".context .x.axis").moveToFront();
  }

  //Draw the chart for the first time
  chart.draw = function() {
    //Create the necessary viz elements
    chart.svg = d3.select("#" + chart.divId)
      .append("svg")
      .attr("class", "chart");
    chart.container = chart.svg.append("g")
      .attr("class", "posAccByteChart");
    chart.context = chart.svg.append("g")
      .attr("class", "context");
    chart.bgrect = chart.container.append("rect")
      .attr("class", "bgrect");
    chart.clipper = chart.svg.append("defs")
      .append("clipPath")
      .attr("id", chart.divId + "_clip")
      .append("rect");

    //Init the x/y scale
    chart.xScale = chart.getXScale();
    chart.yScale = chart.getYScale();

    //Create the axes, rects, and brush
    chart.createAxes(chart.container);
    chart.rects = chart.createRects(chart.container);
    chart.brush = chart.createBrush();
    chart.brush.on("brush", chart.brushChart); //have to add the eventListener after brush is defined

    //Render the chart for the first time with initalized width/height
    chart.renderChart();
    chart.drawn = true;
  }

  //Event when brush is moved
  chart.brushChart = function() {
    var minExtent = chart.brush.extent()[0],
      maxExtent = chart.brush.extent()[1];

    chart.xScale.domain(chart.brush.empty() ? chart.brushOptions.xScale.domain() : chart.brush.extent());
    chart.container.selectAll(".x.axis").call(chart.createXAxis());
    chart.container.selectAll(".y.axis").call(chart.createYAxis());
    chart.rects.attr("x", function(d) {
        return chart.xScale(d.StartTime);
      })
      .attr("y", function(d) {
        return chart.yScale(d.Value)
      })
      .attr("width", function(d) {
        if (chart.xScale(d.EndTime) - chart.xScale(d.StartTime) > 0 && chart.xScale(d.EndTime) - chart.xScale(d.StartTime) < 1) {
          return 1
        } else {
          return chart.xScale(d.EndTime) - chart.xScale(d.StartTime);
        }
      })
      .attr("height", function(d) {
        return chart.options.height - chart.yScale(d.Value)
      });
  }

  //Add click event for charts expandToggle
  $("#" + chart.parentId + " .expandToggle").click(function() {
    var parentColumn = $(this).parents(".column");
    var parentFileBox = $(this).parents(".filebox");
    var newWidth, newHeight;

    /* Chart is expanded and chart is responsible for toggling classes
     * This block should shrink charts and then toggle classes
     * After this block the classes are NOT expanded */
    if (chart.options.expandFlag && chart.options.eventFlag) {
      newWidth = chart.options.initWidth;
      chart.options.expandFlag = false;
      newHeight = 200;
      chart.renderChart(newWidth, newHeight);
      if (chart.options.eventFlag) {
        //Dirty fix so that throttle (right column) uses different collapse function
        if (chart.options.leftColumn) {
          window.setTimeout(function() {
            parentColumn.toggleClass("expanded");
            $('.column').not(parentColumn).toggleClass("shrunk");
            $('.filebox').not(parentFileBox).toggleClass("shrunk");
            document.getElementById(chart.parentId).scrollIntoView();
          }, 950);
        } else {
          window.setTimeout(function() {
            parentColumn.toggleClass("expanded");
            window.setTimeout(function() {
              $('.column').not(parentColumn).toggleClass("shrunk");
              $('.filebox').not(parentFileBox).toggleClass("shrunk");
              document.getElementById(chart.parentId).scrollIntoView();
            }, 550);
          }, 950);
        }
      }
    }
    /* Chart is expanded and chart is not responsible for toggling classes
     * This block should shink charts. After this block the classes are NOT expanded */
    else if (chart.options.expandFlag && !chart.options.eventFlag) {
      newWidth = chart.options.initWidth;
      chart.options.expandFlag = false;
      newHeight = 200;
      chart.renderChart(newWidth, newHeight);
    }
    /* Chart is not expanded and chart is responsible for toggling classes
     * This block should toggle the classes and then expand the charts.
     * After this block the classes ARE expanded */
    else if (!chart.options.expandFlag && chart.options.eventFlag) {
      chart.options.initWidth = chart.options.width + chart.options.margins.left + chart.options.margins.right;
      chart.options.expandFlag = true;
      parentColumn.toggleClass("expanded");
      $('.column').not(parentColumn).toggleClass("shrunk");
      $('.filebox').not(parentFileBox).toggleClass("shrunk");
      document.getElementById(chart.parentId).scrollIntoView();
      window.setTimeout(function() {
        newWidth = $("#" + chart.divId).width();
        newHeight = 400;
        chart.renderChart(newWidth, newHeight);
      }, 950);
    }
    /* Chart is not expanded and chart is not responsible for toggling classes
     * This block should expand the charts. After this block the classes ARE expanded */
    else if (!chart.options.expandFlag && !chart.options.eventFlag) {
      chart.options.initWidth = chart.options.width + chart.options.margins.left + chart.options.margins.right;
      chart.options.expandFlag = true;
      window.setTimeout(function() {
        newWidth = $("#" + chart.divId).width();
        newHeight = 400;
        chart.renderChart(newWidth, newHeight);
      }, 950);
    }
  });

  $(window).resize(function() {
    newHeight = $("#" + chartDiv).height();
    newWidth = $("#" + chartDiv).width();
    chart.renderChart(newWidth, newHeight);
  });

  //Return the chart to the function call
  return chart;
}