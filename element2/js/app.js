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
    this.rse_loc = new L.LayerGroup();
    this.rse_range = new L.LayerGroup();
    this.hexbin_group = new L.LayerGroup();

    //Initialize the leaflet map
    this.initLeaflet();

    //Load the data then allow using map
    this.loadData().then(function () { 
      //Function that hexlayer needs to create the popup on mouseover
      function createPopup(data) {
        //Remove old tooltips
        d3.select("#popup").selectAll(".arc").remove()
        d3.select("#popup").selectAll(".pie").remove()

        //d3 variables for the pie chart and each pie section
        var arc = d3v4.arc()
          .outerRadius(45)
          .innerRadius(10);
        var border = d3v4.arc()
          .outerRadius(45+1)
          .innerRadius(45);
        var pie = d3v4.pie()
          .value(function(d) { return d[0]; })
          .sort(null);
        var svg = d3v4.select("#popup").select("svg")
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
          .data(pie(data))
          .enter().append("g")
            .attr("class", "arc");
        g.append("path")
          .attr("d", arc)
          .style("fill", function(d, i) { return d.data[1] == 'rec' ? '#205493':'#dce4ef'; });
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

        d3v4.selectAll('g .arc > text').moveToFront();
      }

      //Create the hexlayer
      _this.hexLayer = L.hexbinLayer({
        opacity: 1,
        colorRange: ["#dce4ef","#205493"],
        onmouseover: function (d) {
          var msg_received=0, msg_sent=0;
          d.map(function(e){
            if (e.properties.group === 1){
              msg_sent += e.properties.count;
            }
            else {
              msg_received += e.properties.count;
            }
          });
          createPopup([[msg_sent-msg_received, 'not_rec'],[msg_received, 'rec']]);
          d3.select("#popup")
            .style("visibility", "visible")
            .style("top", function () { return (d3.event.pageY-305)+"px"})
            .style("left", function () { return (d3.event.pageX-105)+"px";})
        },
        onmouseout: function (d) {
          d3.select("#popup")
            .style("visibility", "hidden");
        },
      }).data(_this.geoData).addTo(_this.hexbin_group)
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
    var rsemarker = L.ExtraMarkers.icon({
      markerColor: 'orange'
    });
    new L.Marker([42.289141,-83.747333], {icon: rsemarker})
      .bindPopup('RSE #153')
      .addTo(this.rse_loc);
    this.rse_loc.addTo(this.map);
    new L.Circle([42.289141,-83.747333], 300, {color:'#ebb02b', fillColor:'#eb9c2b'}).addTo(this.rse_range);

    //Add and remove the range circle so we can change its pointEvents
    this.rse_range.addTo(this.map);
    this.map.removeLayer(this.rse_range);

    //Change the pointerEvents for rseRange and rseLocation so that it does not interfere with tooltips
    document.getElementsByClassName('leaflet-zoom-animated')[0].style.pointerEvents = 'none';
    document.getElementsByClassName('leaflet-marker-pane')[0].style.pointerEvents = 'none'; 
    document.getElementsByClassName('leaflet-shadow-pane')[0].style.pointerEvents = 'none'; 

    //Add the layer controls
    L.control.layers({}, {
      'RSE #153 Location': this.rse_loc, 
      'RSE #153 Range':this.rse_range,
      'Hexbin Layer':this.hexbin_group,
    },{collapsed:false}).addTo(this.map);

    /* Change the pointerEvents for rseRange and rseLocation so that it does not interfere with tooltips
     * whenever the layer is toggled */
    this.map.on('overlayadd', function () {
      document.getElementsByClassName('leaflet-marker-pane')[0].style.pointerEvents = 'none';
      document.getElementsByClassName('leaflet-shadow-pane')[0].style.pointerEvents = 'none';
      document.getElementsByClassName('leaflet-zoom-animated')[0].style.pointerEvents = 'none';
    });

    // Add the Carto attribution to the attribution control
    L.control.attribution({ position: 'bottomleft' })
      .addAttribution('Map tiles by <a href="https://carto.com/attributions">CARTO</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.')
      .addTo(this.map);
  };

  return App;
}());
my_app = new App();

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

//Add a d3 moveToFront function
d3v4.selection.prototype.moveToFront = function () {
   return this.each(function () {
       this.parentNode.parentNode.appendChild(this);
   });
};
