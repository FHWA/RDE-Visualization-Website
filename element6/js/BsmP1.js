d3.csv("element6_data/bsm_p1.csv", function(error, data) {

  function bsmp1() {
    var barPadding = 25;
    var firstTransition = true;
    var thisdiv = d3.select("#BsmP1");
    addentries(data, thisdiv);

    function convertSignalValuesToIntegers(d) {
      d.Ax = +d.Ax;
      d.Ay = +d.Ay;
      d.Az = +d.Az;
      d.Yawrate = +d.Yawrate;
      d.PathCount = +d.PathCount;
      d.Elevation = +d.Elevation;
      d.RadiusOfCurve = +d.RadiusOfCurve;
      d.MsgCount = +d.MsgCount;
      d.Speed = +d.Speed;
    }

    var drawGraph = function(currentGraph, h, w, x, d, i) {
      //make map with just column needed for each area chart
      var thisname = d.name;
      var thisdata = d.value;
      var newmap = thisdata.map(function(d) {
        return {
          GenTime: d.GenTime,
          val: d[thisname]
        }
      });

      var yMax = d3.max(newmap, function(d) {
        return parseFloat(d.val);
      });

      var yMin = d3.min(newmap, function(d) {
        return parseFloat(d.val);
      });

      var domsetter;

      if (thisname == "Elevation" || thisname == "PathCount") {
        domsetter = [0, yMax * 1.2]
      } else {
        domsetter = [yMin * 1.2, yMax * 1.2]
      };

      //linear y scale for indiv charts
      var y2 = d3.scale.linear()
        .range([((h / color.domain().length) - barPadding), 0])
        .domain(domsetter)
        .nice();

      //drawn y axis for indiv charts
      var yAxis2 = d3.svg.axis()
        .scale(y2)
        .orient("left")
        .tickSize(-w)
        .ticks(4);

      var line = d3.svg.area()
        .interpolate("monotone")
        .x(function(d) {
          return x(d.GenTime);
        })
        .y1(function(d) {
          if (d[1] <= 0) {
            return y2(0);
          } else {
            return y2(d.val);
          }
        })
        .y0(function(d) {
          if (d[1] <= 0) {
            return y2(d.val);
          } else {
            return y2(0);
          }
        })
        .defined(function(d) {
          return d.val != null;
        });

      return {
        axis: yAxis2,
        line: line,
        datum: newmap
      };
    };

    var color = d3.scale.ordinal()
      .range(['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00']);

    var testpaths = function(data, width) {
        var items = data;

        items.forEach(function(d) {
          addGenTime(d);
          convertSignalValuesToIntegers(d);
        }); // end for loop

        items.sort(function(a, b) {
          return a.GenTime - b.GenTime;
        });

        //nest by vehicle to cull
        items = d3.nest().key(function(d) {
          return d.RxDevice;
        }).entries(items);

        vehicle = items[0].values;

        color.domain(
          d3.keys(vehicle[0]).filter(function(key) {
            return key !== 'DSecond' && key !== 'Heading' && key !== 'Latitude' && key !== 'Longitude' && key !== 'RxDevice' && key !== 'TxDevice' && key !== 'TxRandom' && key !== 'GenTime' && key !== 'FileId' && key !== 'Confidence' && key !== 'MsgCount'
          })
        )

        var rows = color.domain().map(function(name) {
          return {
            name: name,
            value: vehicle
          };
        })

        rows.forEach(function(d) {
          var row = d;
          rows.sort(function(a, b) {
            return a.GenTime - b.GenTime;
          });
        });

        var timeBegin = d3.min(vehicle, function(d) {
          return d.GenTime;
        });

        var timeEnd = d3.max(vehicle, function(d) {
          return d.GenTime;
        });

        var duration = timeEnd - timeBegin;


        d3.select("#BsmP1 .time_span_text").html(function() {
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

        var width = $("#BsmPfield").width();
        var height = 550;

        //small view version has 0 left margin
        var m = [20, 15, 30, 30], //top right bottom left
          w = width - m[1] - m[3],
          h = height - m[0] - m[2];

        //for brush
        var m2 = [0, 20, 0, 20], //top right bottom left
          w2 = width - m2[1] - m2[3],
          //height of brush is bottom margin
          h2 = 20;

        var x = d3.time.scale()
          .range([0, w])
          .domain([timeBegin, timeEnd]);

        var x2 = d3.time.scale()
          .range([0, w])
          .domain([timeBegin, timeEnd]);

        //r and d defined early for laying out charts
        var y = d3.scale.ordinal()
          .range([0, h])
          .domain(color.domain());

        var xAxis = d3.svg.axis()
          .scale(x)
          .orient("bottom")
          .tickSize((h / color.domain().length) - barPadding)

        //for brush
        var xAxis2 = d3.svg.axis()
          .scale(x2)
          .orient("bottom")
          .tickSize(h2);

        var BsmPbrush = d3.svg.brush()
          .x(x2)
          .on("brush", BsmP_brush);

        //initial definitions of things that will get resized
        var BsmPsvg = d3.select("#BsmPfield")
          .append("svg")
          .attr("class", "chart");

        var BsmPchart = BsmPsvg.append("g")
          .attr("class", "bsmchart");

        var eventrows = BsmPchart
          .selectAll("BsmP1 .minilanes")
          .data(rows)
          .enter().append('g')
          .attr('class', function(d) {
            return ("minilanes" + " " + d.name)
          })
          .attr('title', function(d) {
            return d.name
          });

        var bgrect = eventrows.append("rect")
          .attr("class", "bgrect");

        var labels = eventrows.append("text")
          .text(function(d) {
            return d.name;
          })
          .attr("dy", -5);

        var mainxaxis = eventrows.append("g")
          .attr("class", "x axis");

        var BsmPcontext = BsmPsvg.append("g")
          .attr("class", "context");

        var actualBrush = BsmPcontext.append("g")
          .attr("class", "x brush");

        var BsmPcontextxaxis = BsmPcontext.append("g")
          .attr("class", "x axis");

        var showStart = d3.select("#BsmP1 .showStart")
          .append("div")
          .attr("class", "updatedField")
          .html(timeBegin);

        var showEnd = d3.select("#BsmP1 .showEnd")
          .append("div")
          .attr("class", "updatedField")
          .html(timeEnd);

        // var newwidth = $("#BsmPfield").width();
        var newwidth = width;
        var newheight = height;
        var charts = [];
        var brusharcs;
        var brushrects;

        var arc = d3.svg.arc()
          .outerRadius(h2 / 2)
          .startAngle(0)
          .endAngle(function(d, i) {
            return i ? -Math.PI : Math.PI;
          });

        // parts that need redraw
        var renderingbits = function(width, height) {
            m = [20, 15, 30, 50]; //top right right bottom left
            w = width - m[1] - m[3];
            h = height - m[0] - m[2];

            //for brush
            m2 = [0, 20, 0, 20]; //top right bottom left
            w2 = width - m2[1] - m2[3],
              //height of brush is bottom margin
              h2 = 20;

            x.range([0, w]);
            x2.range([0, w]);

            mainxaxis.call(xAxis);

            BsmPsvg.transition()
              .duration(900)
              .ease("quad-out")
              .attr("width", w + m[1] + m[3])
              .attr("height", h + m[0] + m[2]);

            BsmPchart.attr("transform", "translate(" + m[3] + "," + (m[0]) + ")")

            eventrows.attr("transform", function(d, i) {
              return "translate(" + 0 + "," + (h / rows.length) * i + ")";
            });

            bgrect.transition()
              .duration(900)
              .ease("quad-out")
              .attr("width", w)
              .attr("height", ((h / color.domain().length) - barPadding));

            xAxis.orient("bottom")
              .tickSize((h / color.domain().length) - barPadding);

            eventrows.selectAll("defs").remove();

            eventrows.append("defs")
              .append("clipPath")
              .attr("id", function(d, i) {
                return "BsmPclip" + i
              })
              .append("rect")
              .attr("width", w)
              .attr("height", (h / color.domain().length) - barPadding);

            setTimeout(function() {
              eventrows.each(function(d, i) {
                var chart = {}

                d3.select(this).selectAll(".pathg").remove();

                var sparkSVG = d3.select(this).append('g')
                  .attr("class", "pathg").attr("id", function(d) {
                    return d.name + "pathg"
                  });

                var graphInstructions = drawGraph(sparkSVG, h, w, x, d, i);

                sparkSVG.append('g').attr('class', 'y axis').call(graphInstructions.axis);

                sparkSVG.append("path")
                  .datum(graphInstructions.datum)
                  .attr("class", "area")
                  .attr("d", graphInstructions.line)
                  .attr("clip-path", function(d) {
                    return "url(#BsmPclip" + i + ")"
                  })
                  .transition()
                  .duration(900);


                sparkSVG.select(".y.axis")
                  .append("text")
                  .attr("transform", "rotate (-90)")
                  .attr("y", -10)
                  .attr("class", "ylabel")
                  .attr("dx", -h2 / 1.8)
                  .text(function(d) {
                    if (d.name == "MsgCount") {
                      return "#"
                    } else if (d.name == "Elevation") {
                      return "meters"
                    } else if (d.name == "Speed") {
                      return "m/sec"
                    } else if (d.name == "Ax" || d.name == "Ay" || d.name == "Az") {
                      return "m/sec^2"
                    } else if (d.name == "Yawrate") {
                      return "deg/sec"
                    } else if (d.name == "PathCount") {
                      return "#"
                    } else if (d.name == "RadiusOfCurve") {
                      return "centimers"
                    } else {
                      return ""
                    }

                  })
                  .attr("text-anchor", "middle");

                charts.push(chart);
              }); //end "each" section
            }, 0);

            actualBrush.call(BsmPbrush)
              .selectAll("rect")
              .attr("y", (h - h2))
              .attr("height", h2);

            //for brush
            BsmPcontext.attr("transform", "translate(" + m[3] + "," + (m[2] + 10) + ")");

            function drawBrush() {
              BsmPbrush.extent([timeBegin, timeEnd]);

              //set brush to a view that is interesting 
              var extentFormat = d3.time.format('%Y-%m-%dT%H:%M:%S').parse;
              var parsedExtent = extentFormat('2013-04-01T02:44:05');

              if (firstTransition) {
                BsmPbrush(d3.select("#BsmP1 .brush").transition().ease("quad-out").delay(2000).duration(2000));
                firstTransition = false;
              } else BsmPbrush(d3.select("#BsmP1 .brush").transition().ease("quad-out").duration(900));
            }

            drawBrush();

            ////replace hard to use handles with big arcs        
            var handleoffset = d3.selectAll("#BsmP1 .context .resize.e rect").attr("y");
            d3.selectAll("#BsmP1 .context .resize rect").attr("opacity", 0);
            d3.selectAll("#BsmP1 .context .resize path").remove();
            brusharcs = actualBrush.selectAll("#BsmP1 .resize").append("path").attr("class", "brusharc").attr("transform", "translate(0," + (h - h2 / 2) + ")").attr("d", arc);
            brushrects = actualBrush.selectAll("#BsmP1 .resize").append("rect").attr("class", "brushrect").attr("width", 1.5).attr("height", h2 + 10).attr("y", (handleoffset - 5));

            BsmPcontextxaxis.attr("transform", "translate(0," + (h - h2) + ")")
              .call(xAxis2);

            var addDescriptors = function() {}
          } //end renderingbits

        renderingbits(newwidth, newheight);

        function BsmP_brush(width, height) {
          x.domain(BsmPbrush.empty() ? x2.domain() : BsmPbrush.extent());
          BsmPchart.selectAll("#BsmP1 .x.axis").call(xAxis);

          eventrows.each(function(d, i) {
            var currentGraph = d3.select(this);
            var graphInstructions = drawGraph(currentGraph, h, w, x, d, i);
            currentGraph.selectAll("#BsmP1 .area").attr("d", graphInstructions.line);
          });

          d3.selectAll("#BsmP1 .y.axis .tick line").style("stroke", function(d) {
            // console.log(d);
            if (d == 0) {
              return "#000"
            }
          });
        } // end makechart

        BsmP_brush(newwidth, newheight);

        $("#BsmP1 .expandToggle").click(function() {
          var parentColumn = $(this).parents(".column");
          var parentFileBox = $(this).parents(".filebox");
          var newwidth, newheight;

          if (parentColumn.hasClass("expanded")) {
            newwidth = width;
            newheight = 550;
            var m = [20, 0, 30, 50],
              m2 = [0, 5, 0, 5],
              w2 = width - m[1] - m[3],
              barPadding = 25;
            w = newwidth - m[1] - m[3];
            h = newheight - m[0] - m[2];
            renderingbits(newwidth, newheight);
            BsmP_brush(newwidth, newheight);
            BsmPbrush.extent([timeBegin, timeEnd]);
            window.setTimeout(function() {
              d3.selectAll("#BsmP1 .y.axis text.ylabel")
                .attr("dx", -h2 / 1.8)
                .attr("y", -10)
            }, 50);

            window.setTimeout(function() {
              parentColumn.toggleClass("expanded");
              $('.column').not(parentColumn).toggleClass("shrunk");
              $('.filebox').not(parentFileBox).toggleClass("shrunk");
              document.getElementById("BsmP1").scrollIntoView();
            }, 950);
          } else {
            newheight = 700;
            var m = [20, 0, 30, 0],
              m2 = [0, 5, 0, 5],
              w2 = width - m[1] - m[3],
              barPadding = 20;
            parentColumn.toggleClass("expanded");
            $('.column').not(parentColumn).toggleClass("shrunk");
            $('.filebox').not(parentFileBox).toggleClass("shrunk");
            document.getElementById("BsmP1").scrollIntoView();

            window.setTimeout(function() {
              newwidth = $("#BsmPfield").width();
              w = newwidth - m[1] - m[3];
              h = newheight - m[0] - m[2];
              renderingbits(newwidth, newheight);
              BsmP_brush(newwidth, newheight);
              BsmPbrush.extent([timeBegin, timeEnd]);
              window.setTimeout(function() {
                d3.selectAll("#BsmP1 .y.axis text.ylabel").attr("dx", -h2 / 1.3)
                  .attr("y", -35)
              }, 50);
            }, 550);
          }
        });

        $(window).resize(function() {
          width = $("#BsmPfield").width();

          w2 = width - m[1] - m[3];
          w = width - m[1] - m[3];

          renderingbits(width, height);
          BsmP_brush(width, height);
          BsmPbrush.extent([timeBegin, timeEnd]);
          window.setTimeout(function() {
            d3.selectAll("#BsmP1 .y.axis text.ylabel")
              .attr("dx", -h2 / 1.8)
              .attr("y", -10)
          }, 50);
        });
      } //end test

    testpaths(data);
  } //end bsmp1 funct
  bsmp1();
}); //end csv