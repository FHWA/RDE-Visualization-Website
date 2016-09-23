d3.csv("element6_data/ExteriorLightsEvents.csv", function(error, lightsdata) {

  function extLights() {
    var barPadding = 22;
    var firstTransition = true;
    var items = lightsdata;
    var color = d3.scale.ordinal();
    var encoded;

    var thisdiv = d3.select("#ExteriorLightsEvents");
    addentries(items, thisdiv);

    var filtered = items;

    filtered.sort(function(a, b) {
      return a.StartTime - b.Endtime;
    });

    filtered.forEach(function(d) {
      formatStartEndTimes(d);
    });

    filtered.forEach(function(d) {
      var binary = (+d.Value).toString(2);
      var addzeros = ("00000000" + binary);
      var newd = (addzeros.slice(-8));

      d.ParkingLightsOn = newd[0];
      d.FogLightOn = newd[1];
      d.DaytimeRunningLightsOn = newd[2];
      d.AutomaticLightControlOn = newd[3];
      d.RightTurnSignalOn = newd[4];
      d.LeftTurnSignalOn = newd[5];
      d.HighBeamHeadlightsOn = newd[6];
      d.LowBeamHeadlightsOn = newd[7];
      d.HazardSignalOn = "";
      d.AllLightsOff = "";

      if (newd[4] == "1" && newd[5] == "1") {
        d.HazardSignalOn = "1";
        d.RightTurnSignalOn = "0";
        d.LeftTurnSignalOn = "0";
      } else {
        d.HazardSignalOn = "0";
      }
      if (newd == "00000000") {
        d.AllLightsOff = "1"
      } else {
        d.AllLightsOff = "0"
      };

      encoded = (["AllLightsOff", "LowBeamHeadlightsOn", "HighBeamHeadlightsOn", "LeftTurnSignalOn", "RightTurnSignalOn", "HazardSignalOn", "AutomaticLightControlOn", "DaytimeRunningLightsOn", "FogLightOn", "ParkingLightsOn"]);
    }); // end for loop

    color.domain(encoded);

    items.sort(function(a, b) {
      return a.StartTime - b.Endtime;
    });

    var lightrows = color.domain().map(function(name) {
      return {
        name: name,
        value: filtered.map(function(d) {
          return d;
        })
      };
    })

    lightrows.forEach(function(d) {
      var row = d;
      lightrows.sort(function(a, b) {
        return a.StartTime - b.StartTime;
      });
    });

    //this is slightly diff than brake version
    var timeBegin = d3.min(filtered, function(d) {
      return d.StartTime;
    });

    var timeEnd = d3.max(filtered, function(d) {
      return d.Endtime;
    });

    var duration = timeEnd - timeBegin;

    d3.select("#ExteriorLightsEvents .time_span_text").html(function() {

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

    var width = $("#lightsfield").width();
    var height = 380;
    var m = [20, 15, 30, 15], //top right bottom left
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

    //second x for brush to come
    var x2 = d3.time.scale()
      .range([0, w])
      .domain([timeBegin, timeEnd])

    var y = d3.scale.ordinal()
      .range([0, h])
      .domain(color.domain());

    var xAxis = d3.svg.axis()
      .scale(x)
      .orient("bottom")
      .tickSize((h / encoded.length) - barPadding)

    //for brush
    var xAxis2 = d3.svg.axis()
      .scale(x2)
      .orient("bottom")
      .tickSize(h2);

    var lightsbrush = d3.svg.brush()
      .x(x2)
      .on("brush", lights_brushed);

    //initial definitions of things that will get resized 
    var lightssvg = d3.select("#lightsfield")
      .append("svg")
      .attr("class", "chart");

    var lightschart = lightssvg.append("g")
      .attr("class", "lightschart");

    var eventrows = lightschart
      .selectAll("#ExteriorLightsEvents .minilanes")
      .data(lightrows)
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
        return (d.name).replace(/([A-Z])/g, ' $1');
      })
      .attr("dy", -5);

    var mainxaxis = eventrows.append("g")
      .attr("class", "x axis")
      .call(xAxis);

    var context = lightssvg.append("g")
      .attr("class", "context");

    var actualBrush = context.append("g")
      .attr("class", "x brush")

    var contextxaxis = context.append("g")
      .attr("class", "x axis")
      .call(xAxis2);

    //decide if these are useful
    var showStart = d3.select("#ExteriorLightsEvents .showStart")
      .append("div")
      .attr("class", "updatedField")
      .html(timeBegin);

    var showEnd = d3.select("#ExteriorLightsEvents .showEnd")
      .append("div")
      .attr("class", "updatedField")
      .html(timeEnd);

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
        w = width - m[1] - m[3];
        h = height - m[0] - m[2];

        //for brush
        m2 = [20, 15, 30, 15]; //top right bottom left
        w2 = width - m2[1] - m2[3];
        //height of brush is bottom margin 
        h2 = 20;

        x.range([0, w]);
        x2.range([0, w]);

        mainxaxis.call(xAxis);
        contextxaxis.call(xAxis2);

        lightssvg.transition()
          .duration(900)
          .ease("quad-out")
          .attr("width", w + m[1] + m[3])
          .attr("height", h + m[0] + m[2]);

        lightschart.attr("transform", "translate(" + m[3] + "," + (m[0]) + ")");

        eventrows.attr("transform", function(d, i) {
          return "translate(" + 0 + "," + (h / lightrows.length) * i + ")";
        });

        bgrect.transition()
          .duration(900)
          .ease("quad-out")
          .attr("width", w)
          .attr("height", (h / encoded.length) - barPadding);

        xAxis.orient("bottom")
          .tickSize((h / encoded.length) - barPadding);

        eventrows.selectAll("defs").remove();

        eventrows.append("defs")
          .append("clipPath")
          .attr("id", function(d, i) {
            return "lightsclip" + i
          })
          .append("rect")
          .attr("width", w)
          .attr("height", (h / color.domain().length) - barPadding);

        eventrows.each(function(d, i) {
          var chart = {}
          d3.select(this).selectAll(".rectsg").remove();

          var sparkSVG = d3.select(this).append('g')
            .attr("class", "rectsg").attr("id", function(d) {
              return d.name + "rectsg"
            });

          var thisname = d.name;
          var thisdata = d.value;
          var newmap = thisdata.map(function(d) {
            return {
              StartTime: d.StartTime,
              Endtime: d.Endtime,
              val: d[thisname]
            }
          });

          var nozeros = newmap.filter(function(d) {
            return d.val != "0"
          })

          sparkSVG.attr("clip-path", function(d) {
            return "url(#lightsclip" + i + ")"
          });

          sparkSVG.selectAll("rect")
            .data(nozeros)
            .enter()
            .append("rect")
            .attr("class", "timelinerect")
            .attr("x", function(d) {
              return x(d.StartTime)
            })
            .attr("width", function(d) {
              if (x(d.Endtime) - x(d.StartTime) > 0 && x(d.Endtime) - x(d.StartTime) < 1) {
                return 1;
              } else {
                return x(d.Endtime) - x(d.StartTime);
              }
            })
            .attr("height", (h / encoded.length) - barPadding)
            .attr("fill", function(d) {
              if (d.val != "1") {
                return "none"
              }
            })

          charts.push(chart);
        }); //end "each" section

        actualBrush.call(lightsbrush)
          .selectAll("rect")
          .attr("y", (h - h2))
          .attr("height", h2);

        //for brush
        context.attr("transform", "translate(" + m2[3] + "," + (m[2] + 10) + ")");
        contextxaxis.attr("transform", "translate(" + 0 + "," + (h - h2) + ")")
          .call(xAxis2);
        d3.select(".context .x.axis").moveToFront();

        function drawBrush() {
          // define our brush full extent
          lightsbrush.extent([timeBegin, timeEnd]);

          if (firstTransition) {
            lightsbrush(d3.select("#ExteriorLightsEvents .brush").transition().ease("quad-out").delay(2000).duration(2000));
            firstTransition = false;
          } else lightsbrush(d3.select("#ExteriorLightsEvents .brush").transition().ease("quad-out").duration(900));
        }
        drawBrush();

        //replace hard to use handles with big arcs        
        var handleoffset = d3.selectAll("#lightsfield .context .resize.e rect").attr("y");
        d3.selectAll("#lightsfield .context .resize rect").attr("opacity", 0);
        d3.selectAll("#lightsfield .context .resize path").remove();
        brusharcs = actualBrush.selectAll("#lightsfield .resize").append("path").attr("class", "brusharc").attr("transform", "translate(0," + (h - h2 / 2) + ")").attr("d", arc);
        brushrects = actualBrush.selectAll("#lightsfield .resize").append("rect").attr("class", "brushrect").attr("width", 1.5).attr("height", h2 + 10).attr("y", (handleoffset - 5));
      } //end renderingbits

    renderingbits(newwidth, newheight);

    function lights_brushed(width, height) {
      x.domain(lightsbrush.empty() ? x2.domain() : lightsbrush.extent());

      lightschart.selectAll(".x.axis").call(xAxis);

      lightschart.selectAll("#ExteriorLightsEvents .timelinerect").attr("x", function(d) {
          return x(d.StartTime);
        })
        .attr("width", function(d) {
          if (x(d.Endtime) - x(d.StartTime) > 0 && x(d.Endtime) - x(d.StartTime) < 1) {
            return 1;
          } else {
            return x(d.Endtime) - x(d.StartTime);
          }
        })
    } // lightBrush          

    $("#ExteriorLightsEvents .expandToggle").click(function() {
      var parentColumn = $(this).parents(".column");
      var parentFileBox = $(this).parents(".filebox");
      var newwidth, newheight;

      if (parentColumn.hasClass("expanded")) {
        newwidth = width;
        newheight = 380;
        w = newwidth - m[1] - m[3];
        h = newheight - m[0] - m[2];

        renderingbits(newwidth, newheight);
        lights_brushed(newwidth, newheight);
        lightsbrush.extent([timeBegin, timeEnd]);

        window.setTimeout(function() {
          parentColumn.toggleClass("expanded");
          window.setTimeout(function() {
            $('.column').not(parentColumn).toggleClass("shrunk");
            $('.filebox').not(parentFileBox).toggleClass("shrunk");
            document.getElementById("ExteriorLightsEvents").scrollIntoView();
          }, 550);
        }, 950);
      } else {
        parentColumn.toggleClass("expanded");
        $('.column').not(parentColumn).toggleClass("shrunk");
        $('.filebox').not(parentFileBox).toggleClass("shrunk");
        document.getElementById("ExteriorLightsEvents").scrollIntoView();
        window.setTimeout(function() {
          newwidth = $("#lightsfield").width();
          newheight = 450

          w = newwidth - m[1] - m[3];
          h = newheight - m[0] - m[2];

          renderingbits(newwidth, newheight);
          lights_brushed(newwidth, newheight);
          lightsbrush.extent([timeBegin, timeEnd]);
        }, 550);
      }
    });

    $(window).resize(function() {
      width = $("#lightsfield").width();
      w = width - m[1] - m[3];
      w2 = w;

      renderingbits(width, height);
      lights_brushed(width, height);
      lightsbrush.extent([timeBegin, timeEnd]);
    });
    
  } //end lights
  extLights();
}); //end csv