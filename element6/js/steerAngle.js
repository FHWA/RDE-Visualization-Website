d3.csv("element6_data/bsm_steerangle.csv", function(error, data) {
  var firstTransition = true;

  function convertSteeringAngle(binary) {
    if (0 <= binary && binary <= 126) {
      return 1.5 + binary * 1.5;
    }
    var masked = ((binary & 127) ^ 127) * -1.5;
    return masked;
  }

  var items = data;
  var thisdiv = d3.select("#SteerAngleEvents");
  addentries(items, thisdiv);

  items.forEach(function(d) {
    formatStartEndTimes(d);
    d.Value = convertSteeringAngle(d.Value);
  }); // end for loop for time parse

  items.sort(function(a, b) {
    return a.StartTime - b.StartTime;
  });

  //nest by vehicle to cull
  items = d3.nest().key(function(d) {
    return d.RxDevice;
  }).entries(items);

  // use only data values from one vehilce
  items = items[0];

  //test with smaller data set to see if rendering is the problem
  items = items.values;

  //get rid to not draw unneseccary elements
  items.filter(function(d) {
    return d.Value != 0
  });

  var timeBegin = d3.min(items, function(d) {
    return d.StartTime;
  });

  var timeEnd = d3.max(items, function(d) {
    return d.Endtime;
  });

  var duration = timeEnd - timeBegin;

  d3.select("#SteerAngleEvents .time_span_text").html(function() {
    if (duration > 86400000) {
      return "full time span ≈ " + parseFloat(duration / 86400000).toFixed(1) + " days"
    } else if (duration > 3600000) {
      return "full time span ≈ " + parseFloat(duration / 3600000).toFixed(1) + " hours"
    } else if (duration > 60000) {
      return "full time span ≈ " + parseFloat(duration / 60000).toFixed(1) + " minutes"
    } else {
      return "full time span ≈ " + parseFloat(duration / 1000).toFixed(1) + " seconds"
    }
  });

  var width = $("#steerfield").width();
  var height = 170;

  var m = [10, 15, 50, 35], //top right bottom left
    w = width - m[1] - m[3],
    h = height - m[0] - m[2];

  //for brush
  var m2 = [0, 0, 0, 0], //top right bottom left
    w2 = width - m[1] - m[3],
    //height of brush is bottom margin 
    h2 = 20;

  var x = d3.time.scale()
    .range([0, w])
    .domain([timeBegin, timeEnd]);

  //second x for brush to come
  var x2 = d3.time.scale()
    .range([0, w])
    .domain([timeBegin, timeEnd])

  var y = d3.scale.linear()
    .range([h, 0])

  .domain([d3.min(items.map(function(d) {
      return d.Value;
    })), d3.max(items.map(function(d) {
      return d.Value;
    }))])
    .nice();

  var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom")
    .tickSize(h);

  //for brush
  var xAxis2 = d3.svg.axis()
    .scale(x2)
    .orient("bottom")
    .tickSize(h2);

  var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left");

  var steerbrush = d3.svg.brush()
    .x(x2)
    .on("brush", steer_brush);

  //initial definitions of things that will get resized 
  var steersvg = d3.select("#steerfield")
    .append("svg")
    .attr("class", "chart");

  var steerchart = steersvg.append("g")
    .attr("class", "steerchart");

  var bgrect = steerchart.append("rect")
    .attr("class", "bgrect");

  var mainxaxis = steerchart.append("g")
    .attr("class", "x axis");

  var mainyaxis = steerchart.append("g")
    .attr("class", "y axis");

  var ylabel = mainyaxis
    .append("text")
    .attr("class", "ylab el");

  var context = steersvg.append("g")
    .attr("class", "context");

  //to clip with brushing
  var clipper = steersvg.append("defs")
    .append("clipPath")
    .attr("id", "steerclip")
    .append("rect");

  var mybrush = context.append("g")
    .attr("class", "x brush");

  var contextxaxis = context.append("g")
    .attr("class", "x axis");

  var rects = steerchart.append("g")
    .attr("class", "rectsg")
    .attr("clip-path", "url(#steerclip)")
    .selectAll("rect")
    .data(items)
    .enter()
    .append("rect")
    .attr("class", "timelinerect");

  //original sparkline sized charts
  var newwidth = width;
  var newheight = height;

  var arc = d3.svg.arc()
    .outerRadius(h2 / 2)
    .startAngle(0)
    .endAngle(function(d, i) {
      return i ? -Math.PI : Math.PI;
    });

  var brusharcs;
  var brushrects;

  // parts that need redraw
  var renderingbits = function(width, height) {
    var m = [10, 15, 50, 35], //top right bottom left
      w = width - m[1] - m[3],
      h = height - m[0] - m[2];

    //for brush
    var m2 = [0, 0, 0, 0], //top right bottom left
      w2 = width - m[1] - m[3],
      //height of brush is bottom margin 
      h2 = 20;

    x.range([0, w]);
    x2.range([0, w]);
    y.range([h, 0]);

    mainxaxis.call(xAxis);
    mainyaxis.call(yAxis);

    yAxis.tickSize(-w)
      .ticks(10);
    xAxis.orient("bottom")
      .tickSize(h);

    steersvg.transition()
      .duration(900)
      .ease("quad-out")
      .attr("width", w + m[1] + m[3])
      .attr("height", h + m[0] + m[2]);

    clipper.attr("width", w)
      .attr("height", h);

    steerchart.attr("transform", "translate(" + m[3] + "," + (m[0]) + ")");

    bgrect.transition()
      .duration(900)
      .ease("quad-out")
      .attr("width", w)
      .attr("height", (h));

    ylabel.attr("transform", "rotate (-90)")
      .attr("y", -24)
      .attr("class", "ylabel")
      .attr("dx", -h / 2)
      .text("degrees")
      .attr("text-anchor", "middle");


    function Y0() {
      return y(0);
    }
    //size y proportional to data
    function Y(d) {
      return y(d.Value);
    }

    rects.transition()
      .duration(900)
      .ease("quad-out")
      .attr("x", function(d) {
        return x(d.StartTime)
      })
      .attr("y", function(d, i) {
        return (d.Value) < 0 ? Y0() : Y(d);
      })
      .attr("width", function(d) {
        if (x(d.Endtime) - x(d.StartTime) > 0 && x(d.Endtime) - x(d.StartTime) < 1) {
          return 1;
        } else {
          return x(d.Endtime) - x(d.StartTime);
        }
      })
      .attr("height", function(d, i) {
        return Math.abs(Y(d) - Y0());
      })
      .attr("class", function(d) {
        if (+d.Value === 127) {
          return ("timelinerect unavailable")
        } else {
          return "timelinerect"
        }
      });

    $(".timelinerect[width='0']").remove();

    mybrush.call(steerbrush)
      .selectAll("rect")
      .attr("y", (h - h2))
      .attr("height", h2);

    //for brush
    context.attr("transform", "translate(" + m[3] + "," + (m[2]) + ")");
    contextxaxis.attr("transform", "translate(0," + (h - h2) + ")")
      .call(xAxis2);

    d3.select(".context .x.axis").moveToFront();

    function drawBrush() {
      //set brush to a view that is interesting 
      var extentFormat = d3.time.format('%Y-%m-%dT%H:%M:%S').parse;
      var parsedExtent = extentFormat('2012-10-01T12:50:56');

      steerbrush.extent([timeBegin, timeEnd]);
      if (firstTransition) {
        steerbrush(d3.select("#SteerAngleEvents .brush").transition().ease("quad-out").delay(2000).duration(2000));
        firstTransition = false;
      } else steerbrush(d3.select("#SteerAngleEvents .brush").transition().ease("quad-out").duration(900));
    }
    drawBrush();

    ////replace hard to use handles with big arcs        
    var handleoffset = d3.selectAll("#SteerAngleEvents .context .resize.e rect").attr("y");
    d3.selectAll("#SteerAngleEvents .context .resize rect").attr("opacity", 0);
    d3.selectAll("#SteerAngleEvents .context .resize path").remove();
    brusharcs = mybrush.selectAll("#SteerAngleEvents .resize").append("path").attr("class", "brusharc").attr("transform", "translate(0," + (h - h2 / 2) + ")").attr("d", arc);
    brushrects = mybrush.selectAll("#SteerAngleEvents .resize").append("rect").attr("class", "brushrect").attr("width", 1.5).attr("height", h2 + 10).attr("y", (handleoffset - 5));
  } //end renderingbits

  renderingbits(newwidth, newheight);

  function steer_brush(width, height) {
    x.domain(steerbrush.empty() ? x2.domain() : steerbrush.extent());
    steerchart.selectAll(".x.axis").call(xAxis);
    steerchart.selectAll(".y.axis").call(yAxis);

    //don't forget this has inverted y scale. 
    rects.attr("x", function(d) {
        return x(d.StartTime)
      })
      .attr("width", function(d) {
        if (x(d.Endtime) - x(d.StartTime) > 0 && x(d.Endtime) - x(d.StartTime) < 1) {
          return 1;
        } else {
          //console.log(x(d.Endtime) - x(d.StartTime));
          return x(d.Endtime) - x(d.StartTime);
        }
      });
  } // end steerbrush      
  steer_brush(newwidth, newheight);

  $("#SteerAngleEvents .expandToggle").click(function() {
    var parentColumn = $(this).parents(".column");
    var parentFileBox = $(this).parents(".filebox");
    var newwidth, newheight;

    if (parentColumn.hasClass("expanded")) {
      newwidth = width;
      newheight = 150;
      yAxis.ticks(5);
      w = newwidth - m[1] - m[3];
      h = newheight - m[0] - m[2];

      steerbrush.extent([timeBegin, timeEnd]);
      renderingbits(newwidth, newheight);
      steer_brush(newwidth, newheight);

      window.setTimeout(function() {
        parentColumn.toggleClass("expanded");
        window.setTimeout(function() {
          $('.column').not(parentColumn).toggleClass("shrunk");
          $('.filebox').not(parentFileBox).toggleClass("shrunk");
          document.getElementById("SteerAngleEvents").scrollIntoView();
        }, 550);
      }, 950);
    } else {
      parentColumn.toggleClass("expanded");
      $('.column').not(parentColumn).toggleClass("shrunk");
      $('.filebox').not(parentFileBox).toggleClass("shrunk");
      document.getElementById("SteerAngleEvents").scrollIntoView();

      window.setTimeout(function() {
        newwidth = $("#steerfield").width();
        newheight = 400;
        w = newwidth - m[1] - m[3];
        h = newheight - m[0] - m[2];
        yAxis
          .ticks(10);
        steerbrush.extent([timeBegin, timeEnd]);
        renderingbits(newwidth, newheight);
        steer_brush(newwidth, newheight);
      }, 550);
    }
  });

  $(window).resize(function() {
    width = $("#steerfield").width();
    w = width - m[1] - m[3];
    w2 = w;

    renderingbits(width, height);
    steer_brush(width, height);
    steerbrush.extent([timeBegin, timeEnd]);
  });


  // black zero y axis since pos/neg chart
  d3.selectAll("#steerfield .y.axis .tick line").style("stroke", function(d) {
    if (d == 0) {
      return "#000"
    }
  });
})