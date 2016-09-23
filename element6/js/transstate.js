d3.csv("element6_data/TransStateEvents.csv", function(error, data) {

  var transstate = function(data) {
      var firstTransition = true;
      var items = data;
      var color = d3.scale.ordinal();
      var encoded;
      var items = data;
      var thisdiv = d3.select("#TransStateEvents");
      addentries(items, thisdiv);

      items.forEach(function(d) {
        formatStartEndTimes(d);

        if (d.Value == "0") {
          status = "neutral"
        } else if (d.Value == "1") {
          status = "park"
        } else if (d.Value == "2") {
          status = "forward"
        } else if (d.Value == "3") {
          status = "reverse"
        } else if (d.Value == "") {
          status = "unavailable"
        } else {
          status = "NA"
        }

        d.status = status;
        encoded = (["neutral", "park", "forward", "reverse", "unavailable"]);
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
        .range(["#806432", "#569590", "#E39300", "#d90223;", "#727171"])
        .domain(encoded);


      var timeBegin = d3.min(items, function(d) {
        return d.StartTime;
      });

      var timeEnd = d3.max(items, function(d) {
        return d.Endtime;
      });

      var duration = timeEnd - timeBegin;

      d3.select("#TransStateEvents .time_span_text").html(function() {

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

      var width = $("#transfield").width();
      var height = 95;

      var m = [0, 15, 50, 15], //top right bottom left
        w = width - m[1] - m[3],
        h = height - m[0] - m[2];

      //for brush
      var m2 = [(h / 2), 0, 0, 0], //top right bottom left
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
      var transsvg = d3.select("#transfield")
        .append("svg")
        .attr("class", "chart");

      //to clip with brushing
      var clipper = transsvg.append("defs")
        .append("clipPath")
        .attr("id", "transclip")
        .append("rect");

      var transchart = transsvg.append("g")
        .attr("class", "transchart")
        .data(rows)
        .attr('class', function(d) {
          return ("minilanes")
        });

      var bgrect = transchart.append("rect")
        .attr("class", "bgrect");

      var mainxaxis = transchart.append("g")
        .attr("class", "x axis");

      var transcontext = transsvg.append("g")
        .attr("class", "context");

      var transbrush = d3.svg.brush()
        .x(x2)
        .on("brush", trans_brushed);

      var mybrush = transcontext.append("g")
        .attr("class", "x brush");

      var contextxaxis = transcontext.append("g")
        .attr("class", "x axis");

      var rects = transchart.selectAll("rect")
        .data(function(d) {
          return d.value
        })
        .enter()
        .append("rect")
        .attr("class", "timelinerect");

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
          w = width - m[1] - m[3];
          h = height - m[0] - m[2];

          //for brush
          var m2 = [(h / 2), 0, 0, 0], //top right bottom left
            //uses same margins as top 
            w2 = w,
            h2 = 20;

          x.range([0, w]);
          x2.range([0, w]);

          bgrect.transition()
            .duration(900)
            .ease("quad-out")
            .attr("width", w)
            .attr("height", (h));

          mainxaxis.call(xAxis);

          xAxis.orient("bottom")
            .tickSize(h);

          transsvg.transition()
            .duration(900)
            .ease("quad-out")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2]);

          //to clip with brushing
          clipper.attr("width", w)
            .attr("height", h)
            .attr("transform", "translate(" + m[3] + "," + (m[0]) + ")");

          transchart.attr("transform", "translate(" + m[3] + "," + (m[0]) + ")")

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
            .style("fill", function(d) {
              return color2(d.status);
            })
            .attr("class", function(d) {
              return d.status;
            });

          transcontext.attr("transform", "translate(" + m[3] + "," + (m[2] - 10) + ")");

          mybrush.call(transbrush)
            .selectAll("rect")
            .attr("y", (h - h2))
            .attr("height", h2);

          contextxaxis
            .attr("transform", "translate(" + 0 + "," + (h - h2) + ")")
            .call(xAxis2);

          function drawBrush() {
            //set brush to a view that is interesting 
            var extentFormat = d3.time.format('%Y-%m-%dT%H:%M:%S').parse;
            var parsedExtent = extentFormat('2012-10-01T12:50:56');

            // define our brush full extent
            transbrush.extent([timeBegin, timeEnd]);

            if (firstTransition) {
              transbrush(d3.select("#transfield .brush").transition().ease("quad-out").delay(2000).duration(2000));
              firstTransition = false;
            } else transbrush(d3.select("#transfield .brush").transition().ease("quad-out").duration(900));
          }

          drawBrush();

          ////replace hard to use handles with big arcs        
          var handleoffset = d3.selectAll("#transfield .context .resize.e rect").attr("y");
          d3.selectAll("#transfield .context .resize rect").attr("opacity", 0);
          d3.selectAll("#transfield .context .resize path").remove();
          brusharcs = mybrush.selectAll("#transfield .resize").append("path").attr("class", "brusharc").attr("transform", "translate(0," + (h - h2 / 2) + ")").attr("d", arc);
          brushrects = mybrush.selectAll("#transfield .resize").append("rect").attr("class", "brushrect").attr("width", 1.5).attr("height", h2 + 10).attr("y", (handleoffset - 5));
        } //end renderingbits

      renderingbits(newwidth, newheight);

      function trans_brushed() {
        x.domain(transbrush.empty() ? x2.domain() : transbrush.extent());
        transchart.selectAll(".x.axis").call(xAxis);

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
      } // end trans_brushed          

      $("#TransStateEvents .expandToggle").click(function() {
        var parentColumn = $(this).parents(".column");
        var parentFileBox = $(this).parents(".filebox");
        var newwidth, newheight;

        if (parentColumn.hasClass("expanded")) {
          newwidth = width;
          newheight = 90;
          m = [0, 15, 50, 15];

          renderingbits(newwidth, newheight);
          trans_brushed(newwidth, newheight);
          transbrush.extent([timeBegin, timeEnd]);

          window.setTimeout(function() {
            parentColumn.toggleClass("expanded");
            window.setTimeout(function() {
              $('.column').not(parentColumn).toggleClass("shrunk");
              $('.filebox').not(parentFileBox).toggleClass("shrunk");
              document.getElementById("TransStateEvents").scrollIntoView();
            }, 550);
          }, 950);
        } else {
          parentColumn.toggleClass("expanded");
          $('.column').not(parentColumn).toggleClass("shrunk");
          $('.filebox').not(parentFileBox).toggleClass("shrunk");
          document.getElementById("TransStateEvents").scrollIntoView();

          window.setTimeout(function() {
            newwidth = $("#transfield").width();
            newheight = 150;
            m = [0, 15, 50, 15];
            w = newwidth - m[1] - m[3];
            h = newheight - m[0] - m[2];
            renderingbits(newwidth, newheight);
            trans_brushed(newwidth, newheight);
            transbrush.extent([timeBegin, timeEnd]);
          }, 550);
        }
      });

      $(window).resize(function() {
        width = $("#transfield").width();
        w = width - m[1] - m[3];
        w2 = w;

        renderingbits(width, height);
        trans_brushed(width, height);
        transbrush.extent([timeBegin, timeEnd]);
      });

      d3.select(".context .x.axis").moveToFront();
    } //end transstate

  transstate(data);
}); //end csv