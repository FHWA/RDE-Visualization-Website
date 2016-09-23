d3.csv("element6_data/TripSummaryNew.csv", function(error, data) {
    function tripsumfunct() {
      var firstTransition = true;
      var items = data;
      var thisdiv = d3.select("#BSM_Trip_Summary_File");
      addentries(items, thisdiv);

      items.forEach(function(d) {
        //epoch time specific to this chart
        d.TotalTripDistance = parseFloat(d.TotalTripDistance);
        d.DistanceOver25MPH = parseFloat(d.DistanceOver25MPH);
        d.AverageSpeed = parseFloat(d.AverageSpeed);
        d.EpochStartTime = new Date(d.EpochStartTime * 1000);
        d.EpochEndTime = new Date(d.EpochEndTime * 1000);
        d.TripDuration = parseFloat(d.TripDuration);
      })

      var color = d3.scale.linear()
        .range(["#ff3c02", "#7bb221"]);

      color.domain(d3.extent(items, function(d) {
        return d.AverageSpeed
      }));

      var items = d3.nest()
        .key(function(d) {
          return d.DeviceID;
        })
        //.key(function(d) { return d.Value; })
        .entries(data);

      items = items[0];
      items = items.values;

      var timeBegin = d3.min(items, function(d) {
        return d.EpochStartTime;
      });
      var timeEnd = d3.max(items, function(d) {
        return d.EpochEndTime;
      });

      var duration = timeEnd - timeBegin;


      d3.selectAll("#BSM_Trip_Summary_File .time_span_text").html(function() {

        if (duration > 86400000) {
          return "full time span ≈ " + parseFloat(duration / 86400000).toFixed(1) + " days"
        } else if (duration > 3600000) {
          return "full time span ≈ " + parseFloat(duration / 3600000).toFixed(1) + " hours"
        } else if (duration > 60000) {
          return "full time span ≈ " + parseFloat(duration / 60000).toFixed(1) + " minutes"
        } else {
          return "full time span ≈ " + parseFloat(duration / 1000).toFixed(1) + " seconds"
        }


      })

      items.sort(function(a, b) {
        return a.EpochStartTime - b.EpochStartTime
      });

      var width = $("#tripSumfield").width();

      var height = 270;

      var m = [20, 10, 60, 35], //top right bottom left
        w = width - m[1] - m[3],
        h = height - m[0] - m[2];

      //for brush
      var m2 = [0, 0, 0, 0], //top right bottom left
        w2 = width - m[1] - m[3],
        //height of brush is bottom margin 
        // h2 = m[2];
        h2 = 20


      var x = d3.time.scale()
        .range([0, w])
        .domain([timeBegin, timeEnd]);

      //second x for brush to come
      var x2 = d3.time.scale()
        .range([0, w])
        .domain([timeBegin, timeEnd])

      var y = d3.scale.linear()
        .range([h, 0])
        .domain([0, d3.max(items.map(function(d) {
          return d.TotalTripDistance;
        }))])
        .nice();

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickSize(h)

      //for brush
      var xAxis2 = d3.svg.axis()
        .scale(x2)
        .orient("bottom")
        .tickSize(h2);

      var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .tickSize(-w);

      //initial definitions of things that will get resized 
      var tripsumsvg = d3.select("#tripSumfield")
        .append("svg")
        .attr("class", "chart");

      var context = tripsumsvg.append("g")
        .attr("class", "context");

      var actualBrush = context.append("g")
        .attr("class", "x brush")

      var contextxaxis = context.append("g")
        .attr("class", "x axis");

      var tripsumbrush = d3.svg.brush()
        .x(x2)
        .on("brush", tripsum_brushed);

      var tripsumchart = tripsumsvg.append("g")
        .attr("class", "tripsumchart");

      var tripsumchart2 = tripsumsvg.append("g")
        .attr("class", "tripsumchart2");

      var bgrect = tripsumchart.append("rect")
        .attr("class", "bgrect");

      var bgrect2 = tripsumchart.append("rect")
        .attr("class", "bgrect2");

      var mainxaxis = tripsumchart.append("g")
        .attr("class", "x axis");

      var mainyaxis = tripsumchart.append("g")
        .attr("class", "y axis");

      var ylabel = mainyaxis
        .append("text")
        .attr("class", "ylabel");

      var xlabel = mainxaxis
        .append("text")
        .attr("class", "xlabel");

      var xunitlabel = mainxaxis
        .append("text")
        .attr("class", "xlabel");


      var chartlabel = tripsumsvg
        .append("text")
        .attr("class", "chartlabel");

      //to clip with brushing
      var clipper = tripsumchart.append("defs")
        .append("clipPath")
        .attr("id", "tripclip")
        .append("rect");

      var gholder = tripsumchart.append("g")
        .attr("class", "gholder");

      var totalg = gholder.selectAll("g")
        .data(items)
        .enter()
        .append("g")
        .attr("class", "totalg");

      var totalrects = totalg.append("rect")
        .attr("class", "timelinerect total");

      var over25rects = totalg.append("rect")
        .attr("class", "timelinerect over25");

      var over55rects = totalg.append("rect")
        .attr("class", "timelinerect over55");

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
          var m = [20, 10, 60, 35]; //top right bottom left
          var w = width - m[1] - m[3],
            h = height - m[0] - m[2];

          //for brush
          var m2 = [0, 0, 0, 0]; //top right bottom left

          x.range([0, w]);
          x2.range([0, w]);
          y.range([h, 0]);

          mainxaxis.call(xAxis);
          mainyaxis.call(yAxis);

          xAxis.orient("bottom")
            .tickSize(h);
          yAxis.tickSize(-w)
            .ticks(5);

          ylabel.attr("transform", "rotate (-90)")
            .attr("y", -24)
            .attr("dx", -h / 2)
            .text("Total Trip Distance (km)")
            .attr("text-anchor", "middle");

          xlabel.attr("y", -10)
            .attr("x", w / 2)
            .text("Trip Duration")
            .attr("text-anchor", "middle");

          chartlabel
            .append("text")
            .attr("dy", 12)
            .attr("dx", w / 2)

          .text("Bar width represents Trip Segment Duration (s) ")
            .attr("text-anchor", "middle");

          tripsumsvg.transition()
            .duration(900)
            .ease("quad-out")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2]);

          clipper.attr("width", w)
            .attr("height", h);

          tripsumchart.attr("transform", "translate(" + m[3] + "," + (m[0]) + ")");

          bgrect.transition()
            .duration(900)
            .ease("quad-out")
            .attr("width", w)
            .attr("height", (h));

          gholder.attr("clip-path", "url(#tripclip)");

          totalg.transition()
            .duration(900)
            .attr("transform", function(d) {
              return "translate(" + x(d.EpochStartTime) + "," + 0 + ")"
            });

          totalrects.transition()
            .duration(900)
            .attr("title", function(d) {
              return d.Value;
            })
            .attr("width", function(d) {

              var timesum = d3.time.second.offset(d.EpochStartTime, d.TripDuration);
              return (x(timesum) - x(d.EpochStartTime));
            })
            .attr("height", function(d) {
              return Math.abs(h - y(d.TotalTripDistance))
            })
            .attr("y", function(d) {
              return y(d.TotalTripDistance);
            })

          over25rects.transition()
            .duration(900)
            .attr("title", function(d) {
              return d.Value;
            })
            .attr("width", function(d) {

              var timesum = d3.time.second.offset(d.EpochStartTime, d.TripDuration);
              return (x(timesum) - x(d.EpochStartTime));
            })
            .attr("height", function(d) {
              return Math.abs(h - y(d.DistanceOver25MPH))
            })
            .attr("y", function(d) {
              return y(d.DistanceOver25MPH);
            })

          over55rects.transition()
            .duration(900)
            .attr("title", function(d) {
              return d.Value;
            })
            .attr("width", function(d) {
              var timesum = d3.time.second.offset(d.EpochStartTime, d.TripDuration);
              return (x(timesum) - x(d.EpochStartTime));
            })
            .attr("height", function(d) {
              return Math.abs(h - y(d.DistanceOver55MPH))
            })
            .attr("y", function(d) {
              return y(d.DistanceOver55MPH);
            })

          actualBrush.call(tripsumbrush)
            .selectAll("rect")
            .attr("y", (h - h2))
            .attr("height", h2);

          //for brush
          context.attr("transform", "translate(" + m[3] + "," + (m[2] + 10) + ")");

          contextxaxis.attr("transform", "translate(0," + (h - h2) + ")")
            .call(xAxis2);

          d3.select(".context .x.axis").moveToFront();

          function drawBrush() {
            tripsumbrush.extent([timeBegin, timeEnd]);

            if (firstTransition) {
              tripsumbrush(d3.select("#tripSumfield .brush").transition().ease("quad-out").delay(2000).duration(2000));
              firstTransition = false;
            } else tripsumbrush(d3.select("#tripSumfield .brush").transition().ease("quad-out").duration(900));
          }

          drawBrush();

          //replace hard to use handles with big arcs        
          var handleoffset = d3.selectAll("#tripSumfield .context .resize.e rect").attr("y");
          d3.selectAll("#tripSumfield .context .resize rect").attr("opacity", 0);
          d3.selectAll("#tripSumfield .context .resize path").remove();
          brusharcs = actualBrush.selectAll("#tripSumfield .resize").append("path").attr("class", "brusharc").attr("transform", "translate(0," + (h - h2 / 2) + ")").attr("d", arc);
          brushrects = actualBrush.selectAll("#tripSumfield .resize").append("rect").attr("class", "brushrect").attr("width", 1.5).attr("height", h2 + 10).attr("y", (handleoffset - 5));

          contextxaxis.call(xAxis2);
        } //end renderingbits

      renderingbits(newwidth, newheight);


      function tripsum_brushed(width, height) {
        x.domain(tripsumbrush.empty() ? x2.domain() : tripsumbrush.extent());
        tripsumchart.selectAll(".x.axis").call(xAxis);
        tripsumchart.selectAll(".y.axis").call(yAxis);

        //move the group of bars
        tripsumchart.selectAll(".totalg")
          .attr("transform", function(d) {
            return "translate(" + x(d.EpochStartTime) + "," + 0 + ")"
          });

        tripsumchart.selectAll(".totalg .timelinerect")
          .attr("width", function(d) {

            var timesum = d3.time.second.offset(d.EpochStartTime, d.TripDuration);
            return (x(timesum) - x(d.EpochStartTime));
          })
      } // tripsum_brushed    
      d3.select("path.domain").remove();


      $("#BSM_Trip_Summary_File .expandToggle").click(function() {
        var parentColumn = $(this).parents(".column");
        var parentFileBox = $(this).parents(".filebox");
        var newwidth, newheight;

        if (parentColumn.hasClass("expanded")) {
          newwidth = width;
          newheight = 270;
          w = newwidth - m[1] - m[3];
          h = newheight - m[0] - m[2];

          tripsumbrush.extent([timeBegin, timeEnd]);
          tripsum_brushed(newwidth, newheight);
          renderingbits(newwidth, newheight);
          //calling again bc of set timeout hangup     
          tripsum_brushed(newwidth, newheight);

          window.setTimeout(function() {
            parentColumn.toggleClass("expanded");
            $('.column').not(parentColumn).toggleClass("shrunk");
            $('.filebox').not(parentFileBox).toggleClass("shrunk");
            document.getElementById("BSM_Trip_Summary_File").scrollIntoView();
          }, 950);
        } 
        else {
          parentColumn.toggleClass("expanded");
          $('.column').not(parentColumn).toggleClass("shrunk");
          $('.filebox').not(parentFileBox).toggleClass("shrunk");
          document.getElementById("BSM_Trip_Summary_File").scrollIntoView();

          window.setTimeout(function() {
            newwidth = $("#tripSumfield").width();
            newheight = 400;
            w = newwidth - m[1] - m[3];
            h = newheight - m[0] - m[2];

            tripsumbrush.extent([timeBegin, timeEnd]);
            tripsum_brushed(newwidth, newheight);
            renderingbits(newwidth, newheight);

            tripsum_brushed(newwidth, newheight);
          }, 550);
        }
      });

      $(window).resize(function() {
        width = $("#tripSumfield").width();

        w2 = width - m[1] - m[3];
        w = width - m[1] - m[3];

        renderingbits(width, height);
        tripsum_brushed(width, height);
        tripsumbrush.extent([timeBegin, timeEnd]);
      });
    } // endtripsumfunt
    
    tripsumfunct();
  }) //end csv