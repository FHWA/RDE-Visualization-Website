d3.csv("element6_data/WiperStatus.csv", function(error, data) {
  var wipersstate = function(data) {
      var items = data;
      var color = d3.scale.ordinal();
      var encoded;
      var firstTransition = true;
      var thisdiv = d3.select("#WiperStatusFrontEvents");
      addentries(items, thisdiv);

      items.forEach(function(d) {
        formatStartEndTimes(d);
        var status;

        if (d.Value == "0") {
          status = "unavailable";
        }
        if (d.Value == "1") {
          status = "off";
        }
        if (d.Value == "2") {
          status = "intermittent";
        }
        if (d.Value == "3") {
          status = "low";
        }
        if (d.Value == "4") {
          status = "high";
        }
        if (d.Value == "126") {
          status = "washer";
        }
        if (d.Value == "126") {
          status = "automaticpresent";
        }
        d.status = status;
        encoded = (["unavailable", "off", "intermittent", "low", "high", "washer", "automaticpresent"]);
      }); // end for loop

      color.domain(encoded);


      items.sort(function(a, b) {
        return a.StartTime - b.Endtime;
      });

      var rows = color.domain().map(function(name) {
        return {
          name: name,
          value: items.map(function(d) {
            return d;
          })
        };
      })

      rows.forEach(function(d) {
        var row = d;
        rows.sort(function(a, b) {
          return a.StartTime - b.Endtime;
        });
      });

      //colors should be tints- but may not even come up if TCS is just always at "on" 
      var color2 = d3.scale.ordinal()
        .range(["#a5a3a3", "#000", "#346363", "#569590", "#E39300", "#d90223;", "#E39300"])
        .domain(encoded);

      encoded = (["unavailable", "off", "intermittent", "low", "high", "washer", "automaticpresent"]);

      var timeBegin = d3.min(items, function(d) {
        return d.StartTime;
      });
      var timeEnd = d3.max(items, function(d) {
        return d.Endtime;
      });

      var duration = timeEnd - timeBegin;


      d3.select("#WiperStatusFrontEvents .time_span_text").html(function() {

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


      var width = $("#wipersfield").width();
      var height = 95;
      var m = [0, 15, 50, 15], //top right bottom left
        w = width - m[1] - m[3],
        h = height - m[0] - m[2];

      //for brush
      var m2 = [(h / 2), 0, 0, 0], //top right bottom left
        //uses same margins as top 
        w2 = w,
        h2 = 20;

      var x = d3.time.scale()
        .range([0, w])
        .domain([timeBegin, timeEnd]);

      //second x for brush to come
      var x2 = d3.time.scale()
        .range([0, w])
        .domain([timeBegin, timeEnd]);

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickSize(h)

      //for brush
      var xAxis2 = d3.svg.axis()
        .scale(x2)
        .orient("bottom")
        .tickSize(h2);

      //initial definitions of things that will get resized 
      var wiperssvg = d3.select("#wipersfield")
        .append("svg")
        .attr("class", "chart");

      //to clip with brushing
      var clipper = wiperssvg.append("defs")
        .append("clipPath")
        .attr("id", "wipersclip")
        .append("rect");

      var wiperschart = wiperssvg.append("g")
        .attr("class", "wiperschart")
        .data(rows)
        .attr('class', function(d) {
          return ("minilanes")
        });

      var bgrect = wiperschart.append("rect")
        .attr("class", "bgrect");

      var mainxaxis = wiperschart.append("g")
        .attr("class", "x axis");

      var wiperscontext = wiperssvg.append("g")
        .attr("class", "context");

      var wipersbrush = d3.svg.brush()
        .x(x2)
        .on("brush", wipers_brushed);

      var mybrush = wiperscontext.append("g")
        .attr("class", "x brush");

      var contextxaxis = wiperscontext.append("g")
        .attr("class", "x axis");

      var rects = wiperschart.selectAll("rect")
        .data(function(d) {
          return d.value
        })
        .enter()
        .append("rect")
        .attr("class", "timelinerect");

      var newwidth = width;
      var newheight = height;
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
          w = width - m[1] - m[3];
          h = height - m[0] - m[2];

          //for brush
          m2 = [(h / 2), 0, 0, 0]; //top right bottom left
          //uses same margins as top 
          w2 = w;
          h2 = 20;

          x.range([0, w]);
          x2.range([0, w]);

          bgrect.transition()
            .duration(900)
            .ease("quad-out")
            .attr("width", w)
            .attr("height", (h));

          mainxaxis.call(xAxis)
            .attr("transform", "translate(" + 0 + "," + (m[0]) + ")");

          xAxis.orient("bottom")
            .tickSize(h);

          wiperssvg.transition()
            .duration(900)
            .ease("quad-out")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2]);

          //to clip with brushing
          clipper.attr("width", w)
            .attr("height", h)
            .attr("transform", "translate(" + m[3] + "," + (m[0]) + ")");

          wiperschart.attr("transform", "translate(" + m[3] + "," + (m[0]) + ")")

          rects.transition()
            .duration(900)
            .ease("quad-out")
            .attr("x", function(d) {
              return x(d.StartTime)
            })
            .attr("width", function(d) {
              if (x(d.Endtime) - x(d.StartTime) > 0 && x(d.Endtime) - x(d.StartTime) < 1) {
                return "1px";
              } else {
                return x(d.Endtime) - x(d.StartTime);
              }
            })
            .attr("height", h)
            .attr("class", function(d) {
              return "timelinerect" + " " + d.status;
            });

          mybrush.call(wipersbrush)
            .selectAll("rect")
            .attr("y", (h - h2))
            .attr("height", h2);

          wiperscontext.attr("transform", "translate(" + m[3] + "," + (m[2] - 10) + ")");
          contextxaxis
            .attr("transform", "translate(" + 0 + "," + (h - h2) + ")")
            .call(xAxis2);

          d3.select(".context .x.axis").moveToFront();

          function drawBrush() {
            //set brush to a view that is interesting 
            var extentFormat = d3.time.format('%Y-%m-%dT%H:%M:%S').parse;
            var parsedExtent = extentFormat('2012-10-01T12:50:56');

            // define our brush full extent
            wipersbrush.extent([timeBegin, timeEnd]);

            if (firstTransition) {
              wipersbrush(d3.select("#wipersfield .brush").transition().ease("quad-out").delay(2000).duration(2000));
              firstTransition = false;
            } else wipersbrush(d3.select("#wipersfield .brush").transition().ease("quad-out").duration(900));
          }


          drawBrush();

          //replace hard to use handles with big arcs        
          var handleoffset = d3.selectAll("#wipersfield .context .resize.e rect").attr("y");
          d3.selectAll("#wipersfield .context .resize rect").attr("opacity", 0);
          d3.selectAll("#wipersfield .context .resize path").remove();
          brusharcs = mybrush.selectAll("#wipersfield .resize").append("path").attr("class", "brusharc").attr("transform", "translate(0," + (h - h2 / 2) + ")").attr("d", arc);
          brushrects = mybrush.selectAll("#wipersfield .resize").append("rect").attr("class", "brushrect").attr("width", 1.5).attr("height", h2 + 10).attr("y", (handleoffset - 5));
        } //end renderingbits

      renderingbits(newwidth, newheight);

      function wipers_brushed() {
        x.domain(wipersbrush.empty() ? x2.domain() : wipersbrush.extent());
        wiperschart.selectAll(".x.axis").call(xAxis);

        rects.attr("x", function(d) {
            return x(d.StartTime)
          })
          .attr("width", function(d) {
            if (x(d.Endtime) - x(d.StartTime) > 0 && x(d.Endtime) - x(d.StartTime) < 1) {
              return "1px";
            } else {
              return x(d.Endtime) - x(d.StartTime);
            }
          });
      } // end wipers_brushed          

      $("#WiperStatusFrontEvents .expandToggle").click(function() {
        var parentColumn = $(this).parents(".column");
        var parentFileBox = $(this).parents(".filebox");
        var newwidth, newheight;

        if (parentColumn.hasClass("expanded")) {
          newwidth = width;
          newheight = 90;

          renderingbits(newwidth, newheight);
          wipers_brushed(newwidth, newheight);
          wipersbrush.extent([timeBegin, timeEnd]);

          window.setTimeout(function() {
            parentColumn.toggleClass("expanded");
            window.setTimeout(function() {
              $('.column').not(parentColumn).toggleClass("shrunk");
              $('.filebox').not(parentFileBox).toggleClass("shrunk");
              document.getElementById("WiperStatusFrontEvents").scrollIntoView();
            }, 550);
          }, 950);
        } else {
          parentColumn.toggleClass("expanded");
          $('.column').not(parentColumn).toggleClass("shrunk");
          $('.filebox').not(parentFileBox).toggleClass("shrunk");
          document.getElementById("WiperStatusFrontEvents").scrollIntoView();

          window.setTimeout(function() {
            newwidth = $("#wipersfield").width();
            newheight = 150;
            w = newwidth - m[1] - m[3];
            h = newheight - m[0] - m[2];
            renderingbits(newwidth, newheight);
            wipers_brushed(newwidth, newheight);
            wipersbrush.extent([timeBegin, timeEnd]);
          }, 550);
        }
      });

      $(window).resize(function() {
        width = $("#wipersfield").width();
        w = width - m[1] - m[3];
        w2 = w;

        renderingbits(width, height);
        wipers_brushed(width, height);
        wipersbrush.extent([timeBegin, timeEnd]);
      });
    } //end wipersstate

  wipersstate(data);
}); //end csv