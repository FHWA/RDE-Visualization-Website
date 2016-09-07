// Use papaparse with promise
var PapaPromise = (function () {
  function PapaPromise() {
  }
  PapaPromise.parse = function (file, options) {
    return new Promise(function (resolve, reject) {
      options.complete = resolve;
      options.error = reject;
      Papa.parse(file, options);
    });
  };
  return PapaPromise;
}());

//Main leaflet app
var App = (function () {
  function App() {
    //App variables
    var _this = this;
    this.geoData = { type: "FeatureCollection", features: []};
    this.hexLayer;
    this.rseIcon = new L.Icon({
      iconUrl: 'images/radar.svg',
      iconSize: [50,50],
    });
    this.rse_loc = new L.LayerGroup();
    this.rse_range = new L.LayerGroup();
    this.hexbin_group = new L.LayerGroup();

    //Initialize the leaflet map
    this.initLeaflet();

    //Load the data then allow using map
    this.loadData().then(function () {
      //Function that hexlayer needs to set the style of the hexbins
      function hexbinStyle(hexagons) {
        hexagons
          .attr("stroke", "black")
          .attr("fill", function (d) {
            //Get the total count of messages per group
            //zero = rsm, one = p1
            var zerocount = 0;
            var onecount = 0;
            for (var i = 0, len = d.length; i < len; i++){
              if (d[i][2].group === 0) zerocount += d[i][2].count;
              else onecount += d[i][2].count;
            }
            //Set the color to the ratio of received/sent
            //Account for both more received than sent and
            //zero sent.
            var color;
            if (onecount !== 0) {
              color = (zerocount / onecount);
              if (color > 1) return 'red';
            }
            else {
              color = 0;
            }
            return cscale(color);
          });
      }      

      //Function that hexlayer needs to create the mouseover tooltip
      function makePie(data) {
        //Remove old tooltips
        d3.select("#tooltip").selectAll(".arc").remove()
        d3.select("#tooltip").selectAll(".pie").remove()
        /* Sort the data so larger value is drawn first, also create new data
         * array so that we can keep track of which data value corresponds to
         * sent vs received */
        if (data[0] > data[1]){
          my_data = [[data[0], 'sent'], [data[1], 'rec']];
        }
        else{
          my_data = [[data[1], 'rec'], [data[0], 'sent']];
        }

        //d3 variables for the pie chart and each pie section
        var arc = d3.arc()
          .outerRadius(45)
          .innerRadius(10);
        var border = d3.arc()
          .outerRadius(45+1)
          .innerRadius(45);
        var pie = d3.pie()
          .value(function(d) { return d[0]; });
        var svg = d3.select("#tooltip").select("svg")
          .append("g")
            .attr("class", "pie")
            .attr("transform", "translate(50,50)");

        //Drop shadow for the pies
        var defs = svg.append("defs");
        var filter = defs.append("filter")
          .attr("id", "dropShadow")
        filter.append("feGaussianBlur")
          .attr("in", "SourceAlpha")
          .attr("stdDeviation", 2)
          .attr("result", "blur");
        filter.append("feOffset")
          .attr("in", "blur")
          .attr("dx", 1)
          .attr("dy", 2)
          .attr("result", "offsetBlur");
        var feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
          .attr("in", "offsetBlur")
        feMerge.append("feMergeNode")
          .attr("in", "SourceGraphic");
        svg.attr("filter", "url(#dropShadow)")

        //Create the pie sections, pie themselves, and text on the pies.
        var g = svg.selectAll(".arc")
          .data(pie(my_data))
          .enter().append("g")
            .attr("class", "arc");
        g.append("path")
          .attr("d", arc)
          .style("fill", function(d, i) { return d.data[1] == 'rec' ? '#dce4ef':'#205493'; });
        g.append("text")
          .attr("transform", function(d) { return "translate(" + arc.centroid(d) + ")"; })
          .style("text-anchor", "middle")
          .style("font-size", "14px")
          .style("paint-order", "stroke")
          .style("fill", "white")
          .style("stroke", "black")
          .style("stroke-width", "3")
          .text(function (d) { return d.value <= 0 ? "" : numShortFormat(d.value); });
        g.append("path")
          .attr("d", border)
          .attr("fill", "black");
      }

      //Create the hexlayer
      _this.hexLayer = L.hexbinLayer(_this.geoData, {
        style: hexbinStyle,
        mouse: makePie
      }).addTo(_this.hexbin_group)
    })
  }

  //Important variables
  Object.defineProperty(App, "TILE_URL", {
    get: function () {
      return 'http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "MAP_DIV_ID", {
    get: function () {
      return 'map';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "BSMP1_FILE", {
    get: function () {
      return location.href + 'data/p1_latlon_min.csv';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "RSE_FILE", {
    get: function () {
      return location.href + 'data/rse_latlon_min.csv';
    },
    enumerable: true,
    configurable: true
  });

  //Function that calls all the data loading functions 
  App.prototype.loadData = function () {
    var _this = this;
    var ourData = _this.loadRSE()
      .then(function () {
        return _this.loadP1();
      });

    return Promise.all([ourData]);
  };
  //Load RSE Data
  App.prototype.loadRSE = function () {
    var _this = this;
    return PapaPromise.parse(App.RSE_FILE, {
      worker: true,
      download: true,
      header: true,
      fastMode: true,
      chunkSize: 50000,
      skipEmptyLines: true,
      chunk: function (results, parser) {
        //For every row in the result push the data onto a tempfeatures array
        var tempfeautres = []
        for (var i = 0; i < results.data.length; i++){
          //Get the data from the row
          var row = results.data[i];
          var lat = parseFloat(row.lat);
          var lon = parseFloat(row.lon);
          var num = parseInt(row.count);

          /* Create the feature using the data from the current row
           * properties: type = fileType, count = aggregated numMessages,
           *   group: 0 (binary flag for fileType RSE)
           * geometry: coordinates = [lon, lat] of the aggregated point */
          var myfeature = {
            type: "Feature",
            properties: {
              type: "rse",
              count: num,
              group: 0,
            },
            geometry: {
              type: "Point",
              coordinates: [lon, lat],
            },
          };
          //Push the current feature onto the tempfeatures array
          tempfeautres.push(myfeature)
        }
      //Once all rows are done merge the tempfeatures with the total app features
      _this.geoData.features = _this.geoData.features.concat(tempfeautres);
      }
    });
  };
  //Load P1 Data
  App.prototype.loadP1 = function () {
    var _this = this;
    return PapaPromise.parse(App.BSMP1_FILE, {
      worker: true,
      download: true,
      header: true,
      fastMode: true,
      chunkSize: 50000,
      skipEmptyLines: true,
      chunk: function (results, parser) {
        //For every row in the result push the data onto a tempfeatures array
        var tempfeautres = []
        for (var i = 0; i < results.data.length; i++){
          //Get the data from the row
          var row = results.data[i];
          var lat = parseFloat(row.lat);
          var lon = parseFloat(row.lon);
          var num = parseInt(row.count);

          /* Create the feature using the data from the current row
           * properties: type = fileType, count = aggregated numMessages,
           *   group: 1 (binary flag for fileType BSMp1)
           * geometry: coordinates = [lon, lat] of the aggregated point */
          var myfeature = {
            type: "Feature",
            properties: {
              type: "p1",
              count: num,
              group: 1,
            },
            geometry: {
              type: "Point",
              coordinates: [lon, lat],
            },
          };
          //Push the current feature onto the tempfeatures array
          tempfeautres.push(myfeature)
        }
      //Once all rows are done merge the tempfeatures with the total app features
      _this.geoData.features = _this.geoData.features.concat(tempfeautres);
      }
    });
  };

  //Function that initializes the leaflet map
  App.prototype.initLeaflet = function () {
    //Arbitrary bounds for the map
    var center = new L.LatLng(42.289141, -83.747333); //Center of MN
    var tileLayer = L.tileLayer(App.TILE_URL, {});
    this.map = L.map(App.MAP_DIV_ID, {
      center: center,
      layers: [tileLayer],
      zoom: 16, minZoom: 14, maxZoom: 18,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    //Add the hexbin layer to the map by deafult
    this.hexbin_group.addTo(this.map);

    //Create marker for RSE #153 location and circle for RSE #153 range
    new L.Marker([42.289141,-83.747333], {icon:this.rseIcon}).addTo(this.rse_loc);
    new L.Circle([42.289141,-83.747333], 300, {}).addTo(this.rse_range);

    //Add and remove th range circle so we can change its pointEvents
    this.rse_range.addTo(this.map);
    this.map.removeLayer(this.rse_range);

    //Change the pointerEvents for rseRange and rseLocation so that it does not interfere with tooltips
    document.getElementsByClassName('leaflet-marker-pane')[0].style.pointerEvents = 'none';
    document.getElementsByClassName('leaflet-zoom-animated')[0].style.pointerEvents = 'none'

    //Add the layer controls
    L.control.layers({}, {
      '<img src="images/radar.svg" height="18" width="18"> RSE #153 Location': this.rse_loc, 
      '<img src="images/radar.svg" height="18" width="18"> RSE #153 Range':this.rse_range,
      'Hexbin Layer':this.hexbin_group,
    },{collapsed:false}).addTo(this.map);

    // Add the Carto attribution to the attribution control
    L.control.attribution({ position: 'bottomleft' })
      .addAttribution('Map tiles by <a href="https://carto.com/attributions">CARTO</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.')
      .addTo(this.map);
  };

  return App;
}());
my_app = new App();

//******************HEXBIN LEAFLET FROM ***************************************
//****http://www.delimited.io/blog/2013/12/1/hexbins-with-d3-and-leaflet-maps**
//****Updated for d3.js v4 and for our purposes********************************
//*****************************************************************************

//**********************************************************************************
//********  LEAFLET HEXBIN LAYER CLASS *********************************************
//**********************************************************************************
L.HexbinLayer = L.Class.extend({
  includes: L.Mixin.Events,
  initialize: function (rawData, options) {
    this.levels = {};
    this.layout = d3.hexbin().radius(10);
    this.rscale = d3.scaleLog().range([2, 11]).clamp(true);
    this.rwData = rawData;
    this.config = options;
  },
  project: function(x) {
    var point = this.map.latLngToLayerPoint([x[1], x[0]]);
    return [point.x, point.y];
  },
  getBounds: function(d) {
    var b = d3.geoBounds(d)
    return L.bounds(this.project([b[0][0], b[1][1]]), this.project([b[1][0], b[0][1]]));
  },
  update: function () {
    var pad = 100, xy = this.getBounds(this.rwData), zoom = this.map.getZoom();

    this.container
      .attr("width", xy.getSize().x + (2 * pad))
      .attr("height", xy.getSize().y + (2 * pad))
      .style("margin-left", (xy.min.x - pad) + "px")
      .style("margin-top", (xy.min.y - pad) + "px");

    if (!(zoom in this.levels)) {
        this.levels[zoom] = this.container.append("g").attr("class", "zoom-" + zoom);
        /* genHexagons uses setTimeouts and uses promises to say when it is done
         * Want to hide the loading div once the hexagons are generated. So after the
         * hexagons are generated get the loading elements and check if they are visible
         * if they are visibile than hide them.  Every other time genHexagons is called
         * the loading elments should already be hidden so nothing will happen after the
         * genHexagons promise is returned */
        this.genHexagons(this.levels[zoom]).then(function () {
          var loadEles = document.getElementsByClassName('loading');
          if(loadEles[0].style.visibility === ''){
            loadEles[0].style.visibility = 'hidden';
            loadEles[0].style.opacity = '0';
            loadEles[1].style.visibility = 'hidden';
            loadEles[1].style.opacity = '0';
          }
        })
        this.levels[zoom].attr("transform", "translate(" + -(xy.min.x - pad) + "," + -(xy.min.y - pad) + ")");
    }
    if (this.curLevel) {
      this.curLevel.style("display", "none");
    }
    this.curLevel = this.levels[zoom];
    this.curLevel.style("display", "inline");

    /* When updating the zoom have to check if the hexLayer is 'active'
     * If the hexlayer is active make sure it is visible and pointerEvents
     * enabled */
    if (this.active) {
      this.container.style('opacity', 1);
      this.container.style('pointer-events', 'auto');
    }
  },
  /* Heavy lifting function that generates the hexagons and addes their mouse
   * events.  This function uses setTimeouts and Promises to keep the browser 
   * responsive.  It also returns a promise when all the setTimeouts are finished
   * This promise it returns is used to hide the loading elmenets if they are 
   * visible. */
  genHexagons: function (container) {
    var data = []
    /* setTimeout function that chunks the data loop to keep the browser responsive.
     * returns a promise when it is finished so the rest of the genHexagons function
     * can use the data array */
    function processArray(mythis) {
      var d = jQuery.Deferred();
      var array = mythis.rwData.features;
      var chunk = 25000;
      var index = 0;

      //Process the current chunk of data
      var doChunk = function() {
        var cnt = chunk;
        while (cnt-- && index < array.length) {
          var coords = mythis.project(array[index].geometry.coordinates)
          data.push([coords[0],coords[1], array[index].properties]);
          ++index;
        }
        if (index < array.length) {
          //set Timeout for async iteration
          setTimeout(doChunk, 100);
        }
        else {
          //Resolve the promise so the next part of genHexagons can continute
          d.resolve(mythis);
        }
      }
      doChunk();
      return d.promise();
    }
    /* Call the data chunking function once it resolves.  The function that
     * is called also returns a promise because setTimeout is used within this
     * function. */
    var done = processArray(this).then(function (mythis) {
      var c = jQuery.Deferred();
      var bins = mythis.layout(data);
      var hexagons = container.selectAll(".hexagon").data(bins);

      var counts = [];
      bins.map(function (elem) { 
        var tot_count = 0;
        //instead of count of unique points get count of actual points
        for(var i = 0; i < elem.length; i++){
          tot_count += elem[i][2].count;
        }
        counts.push(tot_count)
      });
      mythis.rscale.domain([(ss.min(counts)), (ss.max(counts))]);

      /* Create each hexagon one at a time using setTimeout.  This will keep the
       * browser responsive.  The setTimeout resolves the promise that will be
       * returned by genHexagons.  This promise says that all the hexagons are
       * generated */
      that = mythis
      hexagons.enter().each(function(d, i) {
        var temp = this;
        setTimeout(function () {
          var p = d3.select(temp).append("path")
            .attr("class", "hexagon")
            .attr("d", function(d) { 
              var tot_count = 0;
              for(var i = 0, len = d.length; i < len; i++){
                tot_count += d[i][2].count
              }
              return that.layout.hexagon(that.rscale(tot_count)); 
            })
            .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
            .style('cursor', 'pointer')
            .on("mouseover", function (d) { 
              var msg_received=0, msg_sent=0;
              d.map(function(e){
                if (e[2].group === 1){
                  msg_sent += e[2].count;
                }
                else {
                  msg_received += e[2].count;
                }
              });
              that.config.mouse.call(this, [msg_received,msg_sent-msg_received]);
              d3.select("#tooltip")
                .style("visibility", "visible")
                .style("top", function () { return (d3.event.pageY-305)+"px"})
                .style("left", function () { return (d3.event.pageX-105)+"px";})
            })
            .on("mouseout", function (d) { d3.select("#tooltip").style("visibility", "hidden") });  
          that.config.style.call(that,p);
          return c.resolve();
          }, 0)
      })      
    })
    //Return the promise saying all the hexagons are generated
    return done;
  },
  addTo: function (map) {
    map.addLayer(this);
    this.active = true;
    return this;
  },
  onAdd: function (map) {
    this.map = map;
    var overlayPane = this.map.getPanes().overlayPane;

    if (!this.container || overlayPane.empty) {
        this.container = d3.select(overlayPane)
            .append('svg')
                .attr("id", "hex-svg")
                .attr('class', 'leaflet-layer leaflet-zoom-hide');
    }
    map.on({ 'moveend': this.update }, this);
    //Add extra variable that says if the hexLayer is active on the map
    this.active = true;
    this.update();
  },
  onRemove: function (map) {
    /* If the hexLayer is currently active on the map set it to not-active
     * hide the layer, and turn off the pointerEvents so the tooltip does not 
     * show when the layer is hidden */
    if (this.active) {
      this.container.style('opacity', 0);
      this.container.style('pointer-events', 'none');
      this.active = false;
    }
  },
});

//Function to create leaflet hexbin layer
L.hexbinLayer = function (data, styleFunction) {
  return new L.HexbinLayer(data, styleFunction);
};

//The scale of color determined between by value between 0-1
var cscale = d3.scaleLinear().domain([0,1]).range(["#dce4ef","#205493"]);

//Funciton to center the map to the initial load position
function goToCenter () {
  my_app.map.setView([42.289141, -83.747333], 16);
}

//Button to handle centering the map
var centerMap = L.easyButton({
  id: 'center-map-button',
  position: 'topleft',
  states: [{
    stateName: 'center',
    icon: 'ion-home',
    title: 'Center Map',
    onClick: function() {
      goToCenter();
    }
  }]
});

//Button to toggle between showing/hiding the legend
var infoButton = L.easyButton({
  id: 'info-button',
  position: 'topleft',
  states: [{
    stateName: 'hide-info',
    icon: 'ion-ios-information',
    title: 'Hide Legend',
    onClick: function (btn) {
      var div = document.getElementsByClassName("info legend")[0];
      div.style.visibility = "hidden";
      btn.state('show-info');
    }
  }, {
    stateName: 'show-info',
    icon: 'ion-ios-information-outline',
    title: 'Show Legend',
    onClick: function (btn) {
      var div = document.getElementsByClassName("info legend")[0];
      div.style.visibility = "visible";
      btn.state('hide-info');
    }
  }]
});

//Add all out buttons to the map
centerMap.addTo(my_app.map);
infoButton.addTo(my_app.map);

function makeGradient(div, w, h, c1, c2, gradID) {
  var svg = d3.select(div).append("svg")
  .attr("width", w)
  .attr("height", h);

  var gradient = svg.append("defs")
    .append("linearGradient")
      .attr("id", gradID)
      .attr("x1", "0%")
      .attr("x2", "100%")
      .attr("spreadMethod", "pad");

  gradient.append("stop")
    .attr("offset", "10%")
    .attr("stop-color", c1)
    .attr("stop-opacity", 1);

  gradient.append("stop")
    .attr("offset", "90%")
    .attr("stop-color", c2)
    .attr("stop-opacity", 1);

  svg.append("rect")
    .attr("width", w)
    .attr("height", h)
    .style("fill", "url(#"+gradID+")");
}

//Code that adds the legend to the map and fills it with the correct information
var legend = L.control({position: 'bottomright'});
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'info legend');

  makeGradient(div, 200, 25, "#dce4ef", "#205493", 'hex')
  div.innerHTML = 'Percentage of Messages Received:<br>0%  ' + div.innerHTML;
  div.innerHTML += '  100%'

  div.style.visibility = "visible";
  return div;
}
legend.addTo(my_app.map);

/* Add a red circle and a red hexagon to the info alert box */
d3.select(".anchorHere").append("svg")
  .attr("class", "alert-hex")
  .attr("width", 20)
  .attr("height", 20)
  .append("polyline")
    .attr("points", "02,05 10,01 18,05 18,15 10,19 02,15, 02,05")
    .attr("fill", "red")
    .attr("stroke", "black")
    .attr("stroke-width", "1");

d3.select(".anchorHere").append("svg")
  .attr("class", "alert-circle")
  .attr("width", 18)
  .attr("height", 18)
  .append("circle")
    .attr("cx", 9)
    .attr("cy", 9)
    .attr("r", 9)
    .style("fill", "red")
    .attr("stroke", "black")
    .attr("stroke-width", "1");
