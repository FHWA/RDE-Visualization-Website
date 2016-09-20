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

//Handy global variables
var isRunning = false;
var weatherDataChosen = 'Precipitation';

var App = (function () {
  function App() {
    //Check if webGL is enabled
    this.checkWebGL();

    //App variables
    var _this = this;
    this.coeff = 1000 * 60 * 10;
    this.generatedVertices = vertex;
    this.plows = {};
    this.plowMarkers = {};
    this.tempMarkers = {}
    this.condMarkers = {}
    this.stations = {};
    this.piMarkers = {};
    this.essMarkers = {};
    this.road_condition = new L.LayerGroup();
    this.road_temperature = new L.LayerGroup();
    this.plow_locations = new L.LayerGroup();
    this.tower_locations = new L.LayerGroup();
    this.minnesota;
    this.timestamp = App.START_TIME
    this.plowIcon = new L.Icon({
      iconUrl: '../img/snowplow.png',
      iconSize: [20, 20],
    });
    this.stationIcon = new L.Icon({
      iconUrl: 'images/radar.svg',
      iconSize: [20, 20],
    });
    this.timeIncrement = 5;

    var canvas = L.CanvasLayer.extend({
      render: function () {
        drawScene();
      }
    });
    this.canvasLayer = new canvas();

    this.initLeaflet();
    //Function that calls requestAnimationFrame
    this.update = function () {
      //Only animate if the time is currently at a 10th minute (not 5min)
      if (_this.timestamp.minute() % 10 == 0){
        //Animate the map, remove old makers, update the UI
        _this.refresh();
      }
      //Run the animation at 10fps
      var framesPerSecond = 10;
      if (isRunning) {
        _this.incrementTime();
        setTimeout(function() {
          window.requestAnimationFrame(_this.update);        
        }, 1000 / framesPerSecond);
      }
    };
    //Load the data then start the animation frames
    this.loadData().then(function () {
      _this.loadTowerLocations();
      _this.canvasLayer.addTo(_this.map);
      _this.hideLoading();
      window.requestAnimationFrame(_this.update);
    });
    this.refresh = function () {
      _this.animate();
      _this.removeOld();
      _this.updateUI();
      //Only attempt to draw the webGL scene if the canvas exists
      if (document.getElementById("webglcanvas") !== null){ 
        drawScene(true);
      }
    };
  }

  //Important variables
  Object.defineProperty(App, "TILE_URL", {
    get: function () {
      return 'http://tile.stamen.com/toner-lite/{z}/{x}/{y}.png';
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
  Object.defineProperty(App, "VEHICLE_FILE", {
    get: function () {
      return location.href + 'data/vehicle_data.csv';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "WEATHER_FILE", {
    get: function () {
      return location.href + 'data/weather_data.csv';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "MDTX_FILE", {
    get: function () {
      return location.href + 'data/mdtx_data.csv';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "VAIX_FILE", {
    get: function () {
      return location.href + 'data/vaix_data.csv';
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "START_TIME", {
    get: function () {
      return moment('2014-02-19 00:00');
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(App, "END_TIME", {
    get: function () {
      return moment('2014-02-23 00:00');
    },
    enumerable: true,
    configurable: true
  });

/* Functions to handle the animation */
  //Increment the time
  App.prototype.incrementTime = function () {
    this.timestamp.add(this.timeIncrement, 'minutes');
    if (this.timestamp.isAfter(App.END_TIME)) {
      //Loop time
      this.timestamp = App.START_TIME;
      //Reset knob position
      myTimeDimensionControl._sliderTime.options.curPosition = 0;
      myTimeDimensionControl._sliderTime.setPosition(myTimeDimensionControl._sliderTime.options.curPosition);      
    }
  };
  //Hide the load icon [called when data loading is finished]
  App.prototype.hideLoading = function () {
    Array.prototype.forEach.call(document.getElementsByClassName('loading'), function (element) {
      element.style.visibility = 'hidden';
      element.style.opacity = '0';
    });
    Array.prototype.forEach.call(document.getElementsByClassName('nav'), function (element) {
      element.style.top = '0px';
    });
  };
  //Load the locations of the towers so we can map them
  App.prototype.loadTowerLocations = function () {
    var _this = this;
    Object.keys(this.stations).forEach(function (stationID) {
      var station = _this.stations[stationID];
      //Make a marker at this station location
      var curMarker = new L.Marker([station.lat, station.long], {
        icon: _this.stationIcon,
      });
      curMarker.addTo(_this.tower_locations).bindPopup('Station ID: '+stationID);
    });
  };

  //Function that handles moving of vehicle markers and vehicle data markers
  App.prototype.animate = function () {
    var _this = this;
    var tstamp = this.timestamp.format('YYYY-MM-DD HH:mm:ss').toString();
    var map = this.map;
    //For every plow update the animation markers for current timestamp
    Object.keys(this.plows).forEach(function (vehicleName) {
      var plow = _this.plows[vehicleName];
      var curData = plow.data[tstamp];
      var curMarker = _this.plowMarkers[vehicleName]; //plow marker
      var curTempMark = _this.tempMarkers[vehicleName+'|'+tstamp]; //temp data marker
      var curCondMark = _this.condMarkers[vehicleName+'|'+tstamp]; //condition data marker
      var icon = _this.plowIcon;
      //If plow data is defined at this timestamp
      if (curData !== undefined){
        //If marker does not exist, create it
        if (curMarker === undefined) {
          curMarker = new L.Marker([curData.lat, curData.long], {
            icon: icon,
          });
          curMarker.addTo(_this.plow_locations).bindPopup('Vehicle ID: '+vehicleName);
          _this.plowMarkers[vehicleName] = curMarker;
        }
        //Otherwise update marker position
        else {
          curMarker.setLatLng([curData.lat, curData.long]);
          curMarker.setOpacity(1);
        }
        //If the data is interesting road condition and no marker exists, create marker
        if (curCondMark === undefined && curData.roadCon !== undefined) {
          var my_cond_icon;
          var message;
          var my_cond_color;
          //1 = Dry
          if (curData.roadCon == 1) {
            my_cond_icon = "ion-checkmark";
            message = "Dry";
            //my_cond_color = "green";
          }
          //2=wet, 3=slush, 4=frost
          else if (curData.roadCon == 2 || curData.roadCon == 3 || curData.roadCon == 4) {
            my_cond_icon = "ion-waterdrop";
            message = "Wet";
            //my_cond_color = "yellow"
          }
          //5=Snow, 7=compacted snow
          else if (curData.roadCon == 5 || curData.roadCon == 7) {
            my_cond_icon = "ion-ios-snowy";
            message = "Snow";
            //my_cond_color = "orange";
          }
          //8 = ice
          else if (curData.roadCon == 8) {
            my_cond_icon = "ion-alert-circled";
            message = "Ice";
            //my_cond_color = "red";            
          }
          if (my_cond_icon !== undefined) {
            var condiIcon = new L.ExtraMarkers.icon({
              icon: my_cond_icon,
              markerColor: 'black',
              shape: 'circle',
              prefix: 'icon'
            });
            curCondMark = L.marker([curData.lat, curData.long], {icon: condiIcon}).bindPopup(message);
            curCondMark.addTo(_this.road_condition);
            _this.condMarkers[vehicleName+'|'+tstamp] = curCondMark;
          }
        }
        //If the data is interesting road temperature and line does not exist, create one
        if (curTempMark === undefined && curData.roadTemp !== undefined) {
          var my_temp_icon;
          var my_temp_color;
          //Subzero
          if (curData.roadTemp <= 0) {
            my_temp_icon = "ion-ios-snowy";
            //my_temp_color = "red";
          }
          //Below freezing
          else if (curData.roadTemp <= 32) {
            my_temp_icon = "ion-cloud";
            //my_temp_color = "orange";
          }
          //Cold
          else if (curData.roadTemp <= 60) {
            my_temp_icon = "ion-ios-partlysunny";
            //my_temp_color = "yellow";
          }
          //Summer in Feb
          else if (curData.roadTemp <= 80) {
            my_temp_icon = "ion-ios-sunny";
            //my_temp_color = "green";
          }
          if (my_temp_icon !== undefined) {
            var tempIcon = new L.ExtraMarkers.icon({
              icon: my_temp_icon,
              markerColor: 'black',
              shape: 'square',
              prefix: 'icon'
            });
            curTempMark = L.marker([curData.lat, curData.long], {icon: tempIcon}).bindPopup(curData.roadTemp+"&deg;F");
            curTempMark.addTo(_this.road_temperature);
            _this.tempMarkers[vehicleName+'|'+tstamp] = curTempMark;            
          }
        }
      }
      //If plow has no data at this timestamp hide the marker
      else {
        if (curMarker !== undefined) {
          curMarker.setOpacity(0);
          if (curMarker.getPopup()._isOpen) _this.map.closePopup();
        }
      }
    });
  };
  //Function that updates the clock
  App.prototype.updateUI = function () {
    //Update clock at top and on controls
    var format = 'h:mm a MMM Do, YYYY';
    //document.getElementById('timestamp-text').textContent = this.timestamp.format(format);
    //Update datetime on timecontrol... unless drag is in process
    //Update position of knob on controls... do not set position if drag in process
    myTimeDimensionControl._sliderTime.options.curPosition+=1;
    if(!myTimeDimensionControl._sliderTime._element.className.includes('drag')){
      myTimeDimensionControl._displayDate.textContent = this.timestamp.format(format);
      myTimeDimensionControl._sliderTime.setPosition(myTimeDimensionControl._sliderTime.options.curPosition);
    }
  };
  //Function that removes markers older than one hour or when time wraps
  App.prototype.removeOld = function (){
    var _this = this;
    var tstamp = moment(this.timestamp);
    //If time-wrap remove all markers
    if (tstamp.isSame(App.START_TIME)) {
      this.road_condition.clearLayers();
      this.road_temperature.clearLayers();
      this.condMarkers = {};
      this.tempMarkers = {};
    }
    //Remove any markers for interesting data older than 10 minutes
    else {
      tstamp.subtract(10, 'minutes')
      tstamp = tstamp.format('YYYY-MM-DD HH:mm:ss').toString();
      Object.keys(this.plows).forEach(function (vehicleName) {
        if (_this.condMarkers[vehicleName+'|'+tstamp] !== undefined) {
          _this.road_condition.removeLayer(_this.condMarkers[vehicleName+'|'+tstamp]);
        }
        if (_this.tempMarkers[vehicleName+'|'+tstamp] !== undefined) {
          _this.road_temperature.removeLayer(_this.tempMarkers[vehicleName+'|'+tstamp]);
        }
      });      
    }
  };

  //Function that checks if webGL is enabled
  App.prototype.checkWebGL = function () {
    //Check that webGL is enabled before loading data
    var testCanvas = document.createElement("canvas");
    var testGL;
    try {
      testGl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
    }
    catch (x) {
      testGl = null;
    }

    if (testGl == null){
      noWebGLErrorCatcher();
    }
  };

  //Function that calls all the data loading functions 
  App.prototype.loadData = function () {
    var _this = this;
    var vehicleData = _this.loadPlows()
        .then(function () {
            return _this.loadMdtx();
        })
        .then(function () {
            return _this.loadVaix();
        });

    var weatherData = _this.loadWeather();

    return Promise.all([vehicleData, weatherData]);
  };
  /* Iterate over the vehicle location file creating plow object for each
   * vehicle and adding a data object that has key corresponding to the timestamp
   * of the reading. That data object contains lat/long */
  App.prototype.loadPlows = function () {
    var _this = this;
    var currentPlow = null;
    return PapaPromise.parse(App.VEHICLE_FILE, {
      worker: true,
      download: true,
      header: true,
      fastMode: true,
      skipEmptyLines: true,
      chunkSize: 50000,
      chunk: function (results, parser) {
        /* Copy our vairables so that we are not accessing main thread from 
         * worker too often */
        var currentPlowCopy = currentPlow;
        var thisPlowsCopy = _this.plows;
        //Loop over the chunk of data
        for (var i = 0; i < results.data.length; i++) {
          var row = results.data[i];
          /* Check if row is for new plow
           * if so then create a new plow
           * else load the data into an existing plow */
          var vehicleName = row.VehicleName;
          if (vehicleName !== currentPlowCopy) {
            var plow = {
              name: vehicleName,
              data: []
            };
            thisPlowsCopy[vehicleName] = plow; 
            currentPlowCopy = vehicleName;
          }
          //Have to round the time down to the actual timestamp we want       
          var vehicleTime = row.Timestamp.substring(0,15)+'0:00';
          var vehicleLatitude = row.Latitude;
          var vehicleLongitude = row.Longitude;
          thisPlowsCopy[vehicleName].data[vehicleTime] = {
            lat: vehicleLatitude,
            long: vehicleLongitude
          };        
        }
        // Write out copies back to the main thread
        _this.plows = thisPlowsCopy;
        currentPlow = currentPlowCopy;          
      }
    });
  };
  /* Iterate over the Mdtx data file and for each plow update the corresponding 
   * data object at the corresponding timestamp data for road condition+Weather condition */
  App.prototype.loadMdtx = function () {
    var _this = this;
    return PapaPromise.parse(App.MDTX_FILE, {
      worker: true,
      download: true,
      header: true,
      fastMode: true,
      skipEmptyLines: true,
      chunkSize: 50000,
      chunk: function (results, parser) {
        /* Copy our vairables so that we are not accessing main thread from 
         * worker too often */
        var thisPlowsCopy = _this.plows;
        //Loop over the chunk of data
        for (var i = 0; i < results.data.length; i++){
          var row = results.data[i];
          var vehicleName = row.VehicleName;
          //Have to round the time down to the actual timestamp we want
          var vehicleTime = row.Timestamp.substring(0,15)+'0:00';
          var vehicleLatitude = row.Latitude;
          var vehicleLongitude = row.Longitude;
          var roadc = row.RoadCondition;
          /* Check if the vehicle already has a timestamp.
           * If not add lat/long of vehicle as new data
           * If so then just add the interesting data */
          if (thisPlowsCopy[vehicleName].data[vehicleTime] === undefined) {
            thisPlowsCopy[vehicleName].data[vehicleTime] = {
              lat: vehicleLatitude,
              long: vehicleLongitude,
              roadCon: roadc,
            };
          }
          else {
            thisPlowsCopy[vehicleName].data[vehicleTime]['roadCon'] = roadc;
          }          
        }
      //Write out copies back to the main thread
      _this.plows = thisPlowsCopy;
      }
    });
  };
  /* Iterate over the Vaix data file and for each plow update the corresponding 
   * data object at the corresponding timestamp for road temp, air temp, dew point, humidity */
  App.prototype.loadVaix = function () {
    var _this = this;
    return PapaPromise.parse(App.VAIX_FILE, {
      worker: true,
      download: true,
      header: true,
      fastMode: true,
      skipEmptyLines: true,
      chunkSize: 50000,
      chunk: function (results, parser) {
        /* Copy our vairables so that we are not accessing main thread from 
         * worker too often */
        var thisPlowsCopy = _this.plows;
        //Loop over the chunk of data
        for (var i = 0; i < results.data.length; i++){
          var row = results.data[i];
          var vehicleName = row.VehicleName;
          //Have to round the time down to the actual timestamp we want
          var vehicleTime = row.Timestamp.substring(0,15)+'0:00';
          var vehicleLatitude = row.Latitude;
          var vehicleLongitude = row.Longitude;
          var roadTemp = row.RoadTemp;
          /* Check if the vehicle already has a timestamp.
           * If not add lat/long of vehicle as new data
           * If so then just add the interesting data */
          if (thisPlowsCopy[vehicleName].data[vehicleTime] === undefined) {
            thisPlowsCopy[vehicleName].data[vehicleTime] = {
              lat: vehicleLatitude,
              long: vehicleLongitude,
              roadTemp: roadTemp,
            };
          }
          else {
            thisPlowsCopy[vehicleName].data[vehicleTime]['roadTemp'] = roadTemp;
          }
        }
      //Write out copies back to the main thread
      _this.plows = thisPlowsCopy;
      }
    });
  };
  /* Iterate over the weather file creating a station object for each weather station
   * that includes id, lat, long, and a data object.  The keys for the data object
   * are the corresponding timestamps. The data object contains objects for each 
   * Observation type.  These observation type objects in turn then have information
   * on the obs, obs units, english value of obs, and english value units. */
  App.prototype.loadWeather = function () {
    var _this = this;
    var currentStation = null;
    return PapaPromise.parse(App.WEATHER_FILE, {
      worker: true,
      download: true,
      header: true,
      fastMode: true,
      skipEmptyLines: true,
      chunkSize: 50000,
      chunk: function (results, parser) {
        /* Copy our vairables so that we are not accessing main thread from 
         * worker too often */
        var currentStationCopy = currentStation;
        var thisStationCopy = _this.stations;
        //Loop over the chunk of data
        for (var i = 0; i < results.data.length; i++) {
          var row = results.data[i];
          /* Check if row is for new station
           * if so then create a new station
           * else load the data into an existing station */
          var stationID = row.StationID;
          //Apparently stationID can be "".... not sure what is causing this
          if (stationID !== "") {
            if (stationID !== currentStationCopy) {
              var latitude = row.Latitude;
              var longitude = row.Longitude;
              var station = {
                id: stationID,
                lat: parseFloat(latitude),
                long: parseFloat(longitude),
                data: []
              };
              thisStationCopy[stationID] = station; 
              currentStationCopy = stationID;
            }
            //Have to round the time down to the actual timestamp we want
            var stationTime = row.Timestamp.substring(0,15)+'0:00';
            var stationLatitude = row.Latitude;
            var stationLongitude = row.Longitude;
            var obsType = row.ObsTypeName;
            var obs = row.Observation;

            /* Check if station already has data at time stamp
             * It could if it is not the first obstype for that station
             * If there is no data than create data
             * Otherwise add new observation */
            if (thisStationCopy[stationID].data[stationTime] === undefined){
              var myData = {}
              myData[obsType] = {
                  obs: parseFloat(obs),
              };
              thisStationCopy[stationID].data[stationTime] = myData
            }
            else {
              thisStationCopy[stationID].data[stationTime][obsType] = {
                obs: parseFloat(obs),      
              };
            }
          }
        }
        // Write out copies back to the main thread
        _this.stations = thisStationCopy;
        currentStation = currentStationCopy;
      }
    });
  };

  //Function that initializes the leaflet map
  App.prototype.initLeaflet = function () {
    //Arbitrary bounds for the map
    var swBound = new L.LatLng(30, -110);
    var neBound = new L.LatLng(60, -80);
    var center = new L.LatLng(44.9778, -93.2650); //Center of MN
    var tileLayer = L.tileLayer(App.TILE_URL, {});
    this.map = L.map(App.MAP_DIV_ID, {
      center: center,
      zoom: 8, minZoom: 5, maxZoom: 15,
      layers: [tileLayer],
      attributionControl: false,
      scrollWheelZoom: false,
    });
    var interesting_views = {
      '<img src="../img/snowplow.png" height="18" width="18" style="margin-right:3px">Road Condition': this.road_condition,
      '<img src="../img/snowplow.png" height="18" width="18" style="margin-right:3px">Road Temperature': this.road_temperature,
      '<img src="../img/snowplow.png" height="18" width="18" style="margin-right:3px">Plow Truck Locations': this.plow_locations,
      '<img src="images/radar.svg" height="18" width="18">Weather Tower Locations': this.tower_locations
    }
    L.control.layers({}, interesting_views,{collapsed:false}).addTo(this.map);
    this.map.addLayer(this.plow_locations);
    // Add the Stamen attribution to the attribution control
    L.control.attribution({ position: 'bottomleft' })
      .addAttribution('Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Snowplow icon by <a href=http://icons8.com/>Icons8</a>, under <a href="http://creativecommons.org/licenses/by-nd/3.0/">CC BY-ND 3.0</a>.  Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.')
      .addTo(this.map);
    var minnesota_bounds = [{"type": "Feature", "properties": { "GEO_ID": "0400000US27", "STATE": "27", "NAME": "Minnesota", "LSAD": "", "CENSUSAREA": 79626.743000 }, "geometry": { "type": "Polygon", "coordinates": [ [ [ -91.371608, 43.500945 ], [ -91.376950, 43.500482 ], [ -91.397319, 43.500887 ], [ -91.441786, 43.500438 ], [ -91.445932, 43.500588 ], [ -91.461403, 43.500642 ], [ -91.465063, 43.500608 ], [ -91.491042, 43.500690 ], [ -91.533806, 43.500560 ], [ -91.541220, 43.500515 ], [ -91.551021, 43.500539 ], [ -91.591073, 43.500536 ], [ -91.610895, 43.500530 ], [ -91.615293, 43.500550 ], [ -91.616895, 43.500663 ], [ -91.617407, 43.500687 ], [ -91.620785, 43.500677 ], [ -91.625611, 43.500727 ], [ -91.634244, 43.500479 ], [ -91.634495, 43.500439 ], [ -91.635626, 43.500463 ], [ -91.639772, 43.500573 ], [ -91.644924, 43.500529 ], [ -91.651396, 43.500454 ], [ -91.658401, 43.500533 ], [ -91.670872, 43.500513 ], [ -91.700749, 43.500581 ], [ -91.730359, 43.500680 ], [ -91.733330, 43.500623 ], [ -91.736558, 43.500561 ], [ -91.738446, 43.500525 ], [ -91.761414, 43.500637 ], [ -91.777688, 43.500711 ], [ -91.779290, 43.500803 ], [ -91.804925, 43.500716 ], [ -91.807156, 43.500648 ], [ -91.824848, 43.500684 ], [ -91.941837, 43.500554 ], [ -91.949879, 43.500485 ], [ -92.079954, 43.500647 ], [ -92.089970, 43.500684 ], [ -92.103886, 43.500735 ], [ -92.178863, 43.500713 ], [ -92.198788, 43.500527 ], [ -92.277425, 43.500466 ], [ -92.279084, 43.500436 ], [ -92.368908, 43.500454 ], [ -92.388298, 43.500483 ], [ -92.406130, 43.500476 ], [ -92.408832, 43.500614 ], [ -92.464505, 43.500345 ], [ -92.553161, 43.500300 ], [ -92.649194, 43.500049 ], [ -92.653318, 43.500050 ], [ -92.672580, 43.500055 ], [ -92.689033, 43.500062 ], [ -92.692786, 43.500063 ], [ -92.707312, 43.500069 ], [ -92.752088, 43.500084 ], [ -92.790317, 43.499567 ], [ -92.870277, 43.499548 ], [ -93.007871, 43.499604 ], [ -93.024429, 43.499572 ], [ -93.228861, 43.499567 ], [ -93.271800, 43.499356 ], [ -93.399035, 43.499485 ], [ -93.428509, 43.499478 ], [ -93.468563, 43.499473 ], [ -93.472804, 43.499400 ], [ -93.482009, 43.499482 ], [ -93.488261, 43.499417 ], [ -93.497405, 43.499456 ], [ -93.528482, 43.499471 ], [ -93.532178, 43.499472 ], [ -93.558631, 43.499521 ], [ -93.576728, 43.499520 ], [ -93.617131, 43.499548 ], [ -93.699345, 43.499576 ], [ -93.704916, 43.499568 ], [ -93.708771, 43.499564 ], [ -93.716217, 43.499563 ], [ -93.794285, 43.499542 ], [ -93.795793, 43.499520 ], [ -93.970760, 43.499605 ], [ -94.092894, 43.500302 ], [ -94.094339, 43.500302 ], [ -94.108068, 43.500300 ], [ -94.109880, 43.500283 ], [ -94.377466, 43.500379 ], [ -94.390597, 43.500469 ], [ -94.442835, 43.500583 ], [ -94.447048, 43.500639 ], [ -94.470420, 43.500340 ], [ -94.560838, 43.500377 ], [ -94.565665, 43.500330 ], [ -94.615916, 43.500544 ], [ -94.857867, 43.500615 ], [ -94.860192, 43.500546 ], [ -94.872725, 43.500564 ], [ -94.874235, 43.500557 ], [ -94.887291, 43.500502 ], [ -94.914523, 43.500450 ], [ -94.914905, 43.500450 ], [ -94.914955, 43.500450 ], [ -94.934625, 43.500490 ], [ -94.954477, 43.500467 ], [ -94.974359, 43.500508 ], [ -94.994460, 43.500523 ], [ -95.014245, 43.500872 ], [ -95.034000, 43.500811 ], [ -95.053504, 43.500769 ], [ -95.054289, 43.500860 ], [ -95.114874, 43.500667 ], [ -95.122633, 43.500755 ], [ -95.154936, 43.500449 ], [ -95.167294, 43.500771 ], [ -95.167891, 43.500885 ], [ -95.180423, 43.500774 ], [ -95.214938, 43.500885 ], [ -95.244844, 43.501196 ], [ -95.250762, 43.500406 ], [ -95.250969, 43.500464 ], [ -95.374737, 43.500314 ], [ -95.375269, 43.500322 ], [ -95.387812, 43.500240 ], [ -95.387851, 43.500240 ], [ -95.434199, 43.500314 ], [ -95.434293, 43.500360 ], [ -95.454706, 43.500648 ], [ -95.454706, 43.500563 ], [ -95.475065, 43.500335 ], [ -95.486737, 43.500274 ], [ -95.486803, 43.500246 ], [ -95.514774, 43.499865 ], [ -95.740813, 43.499894 ], [ -95.741569, 43.499891 ], [ -95.821277, 43.499965 ], [ -95.834421, 43.499966 ], [ -95.861152, 43.499966 ], [ -96.198484, 43.500335 ], [ -96.198766, 43.500312 ], [ -96.208814, 43.500391 ], [ -96.332062, 43.500415 ], [ -96.351059, 43.500333 ], [ -96.453049, 43.500415 ], [ -96.453352, 43.587040 ], [ -96.453383, 43.588183 ], [ -96.453356, 43.607544 ], [ -96.453387, 43.609944 ], [ -96.453408, 43.675008 ], [ -96.453380, 43.689637 ], [ -96.453281, 43.791435 ], [ -96.453088, 43.805123 ], [ -96.453264, 43.849604 ], [ -96.453335, 43.877029 ], [ -96.453304, 43.878583 ], [ -96.453183, 43.878650 ], [ -96.453352, 43.949122 ], [ -96.453289, 43.950814 ], [ -96.453165, 43.966540 ], [ -96.453292, 43.967180 ], [ -96.453389, 43.978060 ], [ -96.453263, 43.980277 ], [ -96.453328, 43.992871 ], [ -96.453297, 43.994723 ], [ -96.453116, 44.006876 ], [ -96.453053, 44.008887 ], [ -96.453373, 44.023744 ], [ -96.453405, 44.025413 ], [ -96.453313, 44.036430 ], [ -96.453187, 44.038350 ], [ -96.452774, 44.196895 ], [ -96.452673, 44.254588 ], [ -96.452419, 44.255274 ], [ -96.452369, 44.268967 ], [ -96.452365, 44.271972 ], [ -96.452617, 44.282702 ], [ -96.452500, 44.285687 ], [ -96.452334, 44.297009 ], [ -96.452239, 44.298655 ], [ -96.452369, 44.312071 ], [ -96.452248, 44.313362 ], [ -96.452372, 44.325991 ], [ -96.452309, 44.328094 ], [ -96.452248, 44.340642 ], [ -96.452152, 44.342219 ], [ -96.452305, 44.345332 ], [ -96.452282, 44.354857 ], [ -96.452213, 44.360149 ], [ -96.452134, 44.383679 ], [ -96.452073, 44.389690 ], [ -96.451924, 44.441549 ], [ -96.451816, 44.460402 ], [ -96.452218, 44.470873 ], [ -96.452122, 44.473043 ], [ -96.451974, 44.506849 ], [ -96.452010, 44.516929 ], [ -96.452236, 44.526871 ], [ -96.452016, 44.543533 ], [ -96.451888, 44.544058 ], [ -96.451720, 44.630708 ], [ -96.451761, 44.631194 ], [ -96.451543, 44.703135 ], [ -96.451232, 44.718375 ], [ -96.451573, 44.760510 ], [ -96.451380, 44.761788 ], [ -96.451620, 44.776191 ], [ -96.451823, 44.790471 ], [ -96.451888, 44.792299 ], [ -96.451829, 44.797691 ], [ -96.451559, 44.805468 ], [ -96.452009, 44.890080 ], [ -96.451853, 44.906672 ], [ -96.452047, 44.910695 ], [ -96.452347, 44.962734 ], [ -96.452092, 44.977475 ], [ -96.452240, 45.042347 ], [ -96.452177, 45.050185 ], [ -96.452210, 45.051602 ], [ -96.452219, 45.093836 ], [ -96.452026, 45.095138 ], [ -96.452418, 45.122677 ], [ -96.452353, 45.124071 ], [ -96.452304, 45.178563 ], [ -96.452162, 45.203109 ], [ -96.452152, 45.204849 ], [ -96.452315, 45.208986 ], [ -96.452949, 45.269059 ], [ -96.452791, 45.284280 ], [ -96.453067, 45.298115 ], [ -96.454094, 45.301546 ], [ -96.456941, 45.303652 ], [ -96.457781, 45.307610 ], [ -96.461910, 45.313884 ], [ -96.466644, 45.317162 ], [ -96.468027, 45.318619 ], [ -96.468756, 45.320564 ], [ -96.469246, 45.324941 ], [ -96.479323, 45.339644 ], [ -96.482556, 45.346273 ], [ -96.489065, 45.357071 ], [ -96.502006, 45.365473 ], [ -96.508132, 45.367832 ], [ -96.521787, 45.375645 ], [ -96.530944, 45.378495 ], [ -96.539722, 45.380338 ], [ -96.545973, 45.381050 ], [ -96.562142, 45.386090 ], [ -96.571364, 45.389871 ], [ -96.578879, 45.392295 ], [ -96.584764, 45.395705 ], [ -96.601180, 45.403181 ], [ -96.617726, 45.408092 ], [ -96.631204, 45.409238 ], [ -96.640624, 45.409227 ], [ -96.647888, 45.410126 ], [ -96.662258, 45.409011 ], [ -96.670301, 45.410545 ], [ -96.675447, 45.410216 ], [ -96.680454, 45.410499 ], [ -96.683753, 45.411556 ], [ -96.692541, 45.417338 ], [ -96.702006, 45.426247 ], [ -96.710786, 45.436930 ], [ -96.724250, 45.451482 ], [ -96.731396, 45.457020 ], [ -96.732739, 45.458737 ], [ -96.736837, 45.466775 ], [ -96.738446, 45.473499 ], [ -96.742509, 45.478723 ], [ -96.743486, 45.480649 ], [ -96.743683, 45.484439 ], [ -96.745487, 45.488712 ], [ -96.752865, 45.502163 ], [ -96.760591, 45.514895 ], [ -96.765280, 45.521414 ], [ -96.781036, 45.535972 ], [ -96.784863, 45.541300 ], [ -96.793840, 45.550724 ], [ -96.799102, 45.554225 ], [ -96.801987, 45.555414 ], [ -96.835451, 45.586129 ], [ -96.843957, 45.594003 ], [ -96.844334, 45.594375 ], [ -96.849444, 45.598944 ], [ -96.853646, 45.602307 ], [ -96.857751, 45.605962 ], [ -96.856657, 45.609041 ], [ -96.852392, 45.614840 ], [ -96.851621, 45.619412 ], [ -96.844211, 45.639583 ], [ -96.840746, 45.645294 ], [ -96.835769, 45.649648 ], [ -96.832659, 45.651716 ], [ -96.827428, 45.653067 ], [ -96.826160, 45.654164 ], [ -96.800156, 45.668355 ], [ -96.760866, 45.687518 ], [ -96.757174, 45.690957 ], [ -96.750350, 45.698782 ], [ -96.745086, 45.701576 ], [ -96.711157, 45.717561 ], [ -96.687224, 45.725931 ], [ -96.672665, 45.732336 ], [ -96.662595, 45.738682 ], [ -96.652226, 45.746809 ], [ -96.641941, 45.759871 ], [ -96.639685, 45.765400 ], [ -96.638726, 45.770171 ], [ -96.636646, 45.773702 ], [ -96.630512, 45.781157 ], [ -96.629426, 45.784211 ], [ -96.627778, 45.786239 ], [ -96.625347, 45.787924 ], [ -96.618195, 45.791063 ], [ -96.612512, 45.794442 ], [ -96.607621, 45.799070 ], [ -96.601863, 45.806343 ], [ -96.596704, 45.811801 ], [ -96.593216, 45.813873 ], [ -96.587093, 45.816445 ], [ -96.583085, 45.820024 ], [ -96.579740, 45.825820 ], [ -96.577484, 45.833108 ], [ -96.577534, 45.837930 ], [ -96.576544, 45.839945 ], [ -96.574517, 45.843098 ], [ -96.572984, 45.861602 ], [ -96.574417, 45.865010 ], [ -96.574667, 45.866816 ], [ -96.571871, 45.871846 ], [ -96.572651, 45.876474 ], [ -96.571354, 45.886673 ], [ -96.568772, 45.888072 ], [ -96.568281, 45.891203 ], [ -96.568053, 45.898697 ], [ -96.568315, 45.902902 ], [ -96.567268, 45.905393 ], [ -96.564420, 45.909415 ], [ -96.565541, 45.910883 ], [ -96.566534, 45.911876 ], [ -96.567030, 45.915682 ], [ -96.566562, 45.916931 ], [ -96.564002, 45.919560 ], [ -96.564317, 45.921074 ], [ -96.564518, 45.926256 ], [ -96.563280, 45.935238 ], [ -96.562525, 45.937087 ], [ -96.561334, 45.945655 ], [ -96.562135, 45.947718 ], [ -96.564803, 45.950349 ], [ -96.570350, 45.963595 ], [ -96.572384, 45.980231 ], [ -96.572483, 45.989577 ], [ -96.573605, 46.002309 ], [ -96.574064, 46.004434 ], [ -96.575869, 46.007999 ], [ -96.574264, 46.016545 ], [ -96.577315, 46.023560 ], [ -96.577940, 46.026874 ], [ -96.573644, 46.037911 ], [ -96.566295, 46.051416 ], [ -96.560945, 46.055415 ], [ -96.559271, 46.058272 ], [ -96.556907, 46.064830 ], [ -96.556611, 46.068920 ], [ -96.558055, 46.071159 ], [ -96.558088, 46.072096 ], [ -96.554507, 46.083978 ], [ -96.556345, 46.086880 ], [ -96.556672, 46.097232 ], [ -96.557952, 46.102442 ], [ -96.559167, 46.105024 ], [ -96.563175, 46.107995 ], [ -96.565723, 46.111963 ], [ -96.566920, 46.114750 ], [ -96.562811, 46.116250 ], [ -96.563043, 46.119512 ], [ -96.570023, 46.123756 ], [ -96.571439, 46.125720 ], [ -96.570081, 46.127037 ], [ -96.569260, 46.133686 ], [ -96.574784, 46.143146 ], [ -96.577381, 46.144951 ], [ -96.579453, 46.147601 ], [ -96.580408, 46.151234 ], [ -96.577715, 46.162797 ], [ -96.577952, 46.165843 ], [ -96.578620, 46.168135 ], [ -96.580531, 46.169186 ], [ -96.582823, 46.170905 ], [ -96.583779, 46.173563 ], [ -96.583324, 46.174154 ], [ -96.584495, 46.177123 ], [ -96.585647, 46.177309 ], [ -96.586739, 46.177305 ], [ -96.587408, 46.178164 ], [ -96.587599, 46.178928 ], [ -96.587599, 46.180075 ], [ -96.587408, 46.181221 ], [ -96.587217, 46.182749 ], [ -96.587503, 46.183609 ], [ -96.588554, 46.185233 ], [ -96.588579, 46.189689 ], [ -96.587724, 46.191838 ], [ -96.587694, 46.195262 ], [ -96.584929, 46.197231 ], [ -96.584272, 46.198053 ], [ -96.583582, 46.201047 ], [ -96.584372, 46.204155 ], [ -96.584899, 46.204383 ], [ -96.586744, 46.209912 ], [ -96.591652, 46.218183 ], [ -96.595670, 46.219850 ], [ -96.597550, 46.227733 ], [ -96.598645, 46.241626 ], [ -96.598119, 46.243112 ], [ -96.594234, 46.245329 ], [ -96.592375, 46.246076 ], [ -96.591037, 46.247222 ], [ -96.590369, 46.247891 ], [ -96.590082, 46.248655 ], [ -96.590369, 46.249515 ], [ -96.590942, 46.250183 ], [ -96.592470, 46.250757 ], [ -96.594189, 46.251712 ], [ -96.594571, 46.253335 ], [ -96.593712, 46.254959 ], [ -96.593616, 46.256679 ], [ -96.594571, 46.258302 ], [ -96.595909, 46.259926 ], [ -96.598870, 46.260690 ], [ -96.599729, 46.262123 ], [ -96.599087, 46.263701 ], [ -96.596822, 46.267913 ], [ -96.595014, 46.275135 ], [ -96.595509, 46.276689 ], [ -96.598392, 46.280080 ], [ -96.598774, 46.281417 ], [ -96.598201, 46.283136 ], [ -96.596100, 46.286097 ], [ -96.596077, 46.290536 ], [ -96.596968, 46.291838 ], [ -96.599347, 46.292879 ], [ -96.600302, 46.294407 ], [ -96.598679, 46.297750 ], [ -96.599156, 46.299183 ], [ -96.600270, 46.300406 ], [ -96.601360, 46.304130 ], [ -96.598233, 46.312563 ], [ -96.598399, 46.314482 ], [ -96.601040, 46.319554 ], [ -96.599761, 46.330386 ], [ -96.601048, 46.331139 ], [ -96.608075, 46.332576 ], [ -96.614676, 46.337418 ], [ -96.619991, 46.340135 ], [ -96.620454, 46.341346 ], [ -96.618147, 46.344295 ], [ -96.620790, 46.347607 ], [ -96.628522, 46.349569 ], [ -96.629378, 46.350529 ], [ -96.629211, 46.352654 ], [ -96.631586, 46.353752 ], [ -96.640267, 46.351585 ], [ -96.644335, 46.351908 ], [ -96.645959, 46.353532 ], [ -96.647296, 46.358499 ], [ -96.646341, 46.360982 ], [ -96.646532, 46.362510 ], [ -96.650718, 46.363655 ], [ -96.655206, 46.365964 ], [ -96.658009, 46.370512 ], [ -96.658436, 46.373391 ], [ -96.666028, 46.374566 ], [ -96.667189, 46.375458 ], [ -96.669794, 46.384644 ], [ -96.669132, 46.390037 ], [ -96.678507, 46.404823 ], [ -96.680687, 46.407383 ], [ -96.682008, 46.407840 ], [ -96.684834, 46.407021 ], [ -96.688082, 46.407880 ], [ -96.688846, 46.409409 ], [ -96.688318, 46.410948 ], [ -96.688941, 46.413134 ], [ -96.694290, 46.414280 ], [ -96.696583, 46.415617 ], [ -96.696869, 46.416859 ], [ -96.696392, 46.418483 ], [ -96.696869, 46.420011 ], [ -96.697920, 46.420680 ], [ -96.701358, 46.420584 ], [ -96.702314, 46.422685 ], [ -96.702314, 46.423832 ], [ -96.701167, 46.426506 ], [ -96.701645, 46.428607 ], [ -96.703078, 46.429467 ], [ -96.706134, 46.429754 ], [ -96.706994, 46.430231 ], [ -96.707471, 46.432715 ], [ -96.709095, 46.435294 ], [ -96.711770, 46.436153 ], [ -96.715495, 46.436153 ], [ -96.718074, 46.438255 ], [ -96.718647, 46.439974 ], [ -96.717967, 46.442021 ], [ -96.716438, 46.444567 ], [ -96.716641, 46.447233 ], [ -96.717119, 46.448093 ], [ -96.718169, 46.448666 ], [ -96.718933, 46.451054 ], [ -96.718551, 46.451913 ], [ -96.715593, 46.453867 ], [ -96.714861, 46.459132 ], [ -96.715557, 46.463232 ], [ -96.717453, 46.464474 ], [ -96.720414, 46.468008 ], [ -96.721274, 46.470014 ], [ -96.720891, 46.471446 ], [ -96.721560, 46.472115 ], [ -96.722420, 46.472784 ], [ -96.724712, 46.473166 ], [ -96.726718, 46.474121 ], [ -96.726914, 46.476432 ], [ -96.735123, 46.478897 ], [ -96.736365, 46.480138 ], [ -96.736270, 46.481380 ], [ -96.735028, 46.483863 ], [ -96.735505, 46.484914 ], [ -96.737129, 46.485965 ], [ -96.737989, 46.487875 ], [ -96.737798, 46.489785 ], [ -96.734570, 46.494254 ], [ -96.733612, 46.497224 ], [ -96.735499, 46.497932 ], [ -96.737702, 46.500770 ], [ -96.735888, 46.504973 ], [ -96.735888, 46.506310 ], [ -96.738562, 46.509366 ], [ -96.736147, 46.513478 ], [ -96.737408, 46.517636 ], [ -96.738475, 46.525793 ], [ -96.742020, 46.529036 ], [ -96.744341, 46.533006 ], [ -96.744341, 46.534630 ], [ -96.742239, 46.536827 ], [ -96.742335, 46.538546 ], [ -96.745009, 46.540457 ], [ -96.745105, 46.541125 ], [ -96.745009, 46.541698 ], [ -96.743003, 46.542940 ], [ -96.742812, 46.543609 ], [ -96.743577, 46.544850 ], [ -96.746347, 46.546283 ], [ -96.744341, 46.550104 ], [ -96.744532, 46.551346 ], [ -96.746824, 46.555071 ], [ -96.748161, 46.556408 ], [ -96.748830, 46.558127 ], [ -96.748161, 46.559847 ], [ -96.746633, 46.560706 ], [ -96.744436, 46.565960 ], [ -96.746442, 46.574078 ], [ -96.748161, 46.575798 ], [ -96.751600, 46.576371 ], [ -96.752746, 46.577517 ], [ -96.753033, 46.578950 ], [ -96.752078, 46.582197 ], [ -96.752746, 46.582770 ], [ -96.755421, 46.582866 ], [ -96.756949, 46.583534 ], [ -96.756662, 46.585827 ], [ -96.757999, 46.586878 ], [ -96.761820, 46.588501 ], [ -96.762393, 46.589743 ], [ -96.761820, 46.592991 ], [ -96.762584, 46.593946 ], [ -96.763865, 46.594595 ], [ -96.766596, 46.597957 ], [ -96.770226, 46.598148 ], [ -96.772446, 46.600129 ], [ -96.772457, 46.601491 ], [ -96.772476, 46.603716 ], [ -96.771802, 46.605742 ], [ -96.772088, 46.606315 ], [ -96.774763, 46.607461 ], [ -96.775622, 46.609276 ], [ -96.774094, 46.613288 ], [ -96.774954, 46.614625 ], [ -96.778488, 46.616153 ], [ -96.778965, 46.617873 ], [ -96.778201, 46.619305 ], [ -96.779061, 46.620834 ], [ -96.783932, 46.621598 ], [ -96.784505, 46.625418 ], [ -96.783837, 46.627329 ], [ -96.784123, 46.628666 ], [ -96.784792, 46.629430 ], [ -96.789950, 46.631531 ], [ -96.791096, 46.633155 ], [ -96.790523, 46.636880 ], [ -96.789572, 46.639079 ], [ -96.789405, 46.641639 ], [ -96.790663, 46.649112 ], [ -96.796767, 46.653363 ], [ -96.798823, 46.658071 ], [ -96.798357, 46.665314 ], [ -96.793914, 46.669212 ], [ -96.792576, 46.672173 ], [ -96.793723, 46.674943 ], [ -96.793340, 46.676854 ], [ -96.792958, 46.677427 ], [ -96.788947, 46.678382 ], [ -96.787801, 46.679815 ], [ -96.788159, 46.681879 ], [ -96.784339, 46.685054 ], [ -96.784205, 46.686768 ], [ -96.785068, 46.687636 ], [ -96.786941, 46.688220 ], [ -96.787801, 46.691181 ], [ -96.786845, 46.692805 ], [ -96.786654, 46.695861 ], [ -96.787801, 46.700446 ], [ -96.790906, 46.702970 ], [ -96.791204, 46.703747 ], [ -96.786184, 46.712840 ], [ -96.784751, 46.720495 ], [ -96.779899, 46.722915 ], [ -96.779252, 46.727429 ], [ -96.779920, 46.729149 ], [ -96.781544, 46.730104 ], [ -96.784279, 46.732993 ], [ -96.781617, 46.737197 ], [ -96.781216, 46.740944 ], [ -96.784601, 46.743094 ], [ -96.785269, 46.746246 ], [ -96.784568, 46.748669 ], [ -96.783455, 46.750353 ], [ -96.783646, 46.753123 ], [ -96.787466, 46.756753 ], [ -96.787466, 46.758472 ], [ -96.786129, 46.760956 ], [ -96.784601, 46.761338 ], [ -96.783646, 46.762579 ], [ -96.785556, 46.764394 ], [ -96.785651, 46.766113 ], [ -96.784314, 46.766973 ], [ -96.784314, 46.767546 ], [ -96.784983, 46.768788 ], [ -96.788612, 46.771271 ], [ -96.789090, 46.773373 ], [ -96.788135, 46.776238 ], [ -96.788803, 46.777575 ], [ -96.792051, 46.778339 ], [ -96.792433, 46.778913 ], [ -96.792624, 46.780632 ], [ -96.791096, 46.783688 ], [ -96.791478, 46.785694 ], [ -96.793102, 46.787700 ], [ -96.796195, 46.789881 ], [ -96.796992, 46.791572 ], [ -96.795756, 46.807795 ], [ -96.796488, 46.808709 ], [ -96.801446, 46.810401 ], [ -96.802544, 46.811521 ], [ -96.802013, 46.812464 ], [ -96.800360, 46.813500 ], [ -96.799336, 46.815436 ], [ -96.800160, 46.819664 ], [ -96.797960, 46.822364 ], [ -96.791559, 46.827864 ], [ -96.789377, 46.827435 ], [ -96.787657, 46.827817 ], [ -96.787275, 46.829059 ], [ -96.789663, 46.832306 ], [ -96.789377, 46.833166 ], [ -96.785365, 46.834025 ], [ -96.783550, 46.835936 ], [ -96.783264, 46.837464 ], [ -96.784028, 46.838897 ], [ -96.783837, 46.840234 ], [ -96.783359, 46.840807 ], [ -96.780398, 46.841189 ], [ -96.779347, 46.842144 ], [ -96.779347, 46.843672 ], [ -96.780207, 46.845392 ], [ -96.779729, 46.847302 ], [ -96.777915, 46.849594 ], [ -96.777915, 46.850741 ], [ -96.779061, 46.851696 ], [ -96.780876, 46.852269 ], [ -96.782022, 46.853415 ], [ -96.781926, 46.856472 ], [ -96.781162, 46.857809 ], [ -96.781067, 46.859146 ], [ -96.781353, 46.860483 ], [ -96.782881, 46.862585 ], [ -96.782881, 46.864590 ], [ -96.780758, 46.867163 ], [ -96.779302, 46.872699 ], [ -96.779258, 46.875963 ], [ -96.780358, 46.877063 ], [ -96.781358, 46.879363 ], [ -96.780358, 46.880163 ], [ -96.775558, 46.879163 ], [ -96.771258, 46.877463 ], [ -96.769758, 46.877563 ], [ -96.768458, 46.879563 ], [ -96.767358, 46.883663 ], [ -96.768058, 46.884763 ], [ -96.769758, 46.884763 ], [ -96.771858, 46.884063 ], [ -96.773558, 46.884763 ], [ -96.776558, 46.895663 ], [ -96.773558, 46.903563 ], [ -96.770458, 46.906763 ], [ -96.767458, 46.905163 ], [ -96.765657, 46.905063 ], [ -96.763557, 46.909463 ], [ -96.763973, 46.912507 ], [ -96.762871, 46.916886 ], [ -96.759241, 46.918223 ], [ -96.759337, 46.919560 ], [ -96.760865, 46.920897 ], [ -96.761343, 46.922234 ], [ -96.760961, 46.923858 ], [ -96.759528, 46.925769 ], [ -96.761725, 46.927297 ], [ -96.762011, 46.928347 ], [ -96.762011, 46.929303 ], [ -96.760292, 46.932073 ], [ -96.760292, 46.933410 ], [ -96.761757, 46.934663 ], [ -96.763257, 46.935063 ], [ -96.775157, 46.930863 ], [ -96.780258, 46.928263 ], [ -96.783120, 46.925482 ], [ -96.785126, 46.925769 ], [ -96.786845, 46.928921 ], [ -96.790380, 46.929398 ], [ -96.791048, 46.929876 ], [ -96.791621, 46.931213 ], [ -96.791558, 46.934264 ], [ -96.790058, 46.937664 ], [ -96.791558, 46.944464 ], [ -96.792863, 46.946018 ], [ -96.797734, 46.946400 ], [ -96.799358, 46.947355 ], [ -96.798758, 46.952988 ], [ -96.799606, 46.954316 ], [ -96.799910, 46.959228 ], [ -96.798737, 46.962399 ], [ -96.799310, 46.964118 ], [ -96.801316, 46.965933 ], [ -96.802749, 46.965933 ], [ -96.809814, 46.963900 ], [ -96.819558, 46.967453 ], [ -96.821852, 46.969372 ], [ -96.822043, 46.971091 ], [ -96.819894, 46.977357 ], [ -96.822566, 46.990141 ], [ -96.824598, 46.993309 ], [ -96.824470, 46.996173 ], [ -96.823189, 46.998026 ], [ -96.823180, 46.999965 ], [ -96.826198, 47.001895 ], [ -96.827489, 47.001611 ], [ -96.831798, 47.004353 ], [ -96.834221, 47.006671 ], [ -96.834603, 47.007721 ], [ -96.834508, 47.008867 ], [ -96.833504, 47.010110 ], [ -96.832303, 47.015184 ], [ -96.833038, 47.016029 ], [ -96.829499, 47.021537 ], [ -96.826358, 47.023205 ], [ -96.819416, 47.024914 ], [ -96.817984, 47.026538 ], [ -96.818557, 47.027780 ], [ -96.821231, 47.029977 ], [ -96.821613, 47.031505 ], [ -96.821422, 47.032842 ], [ -96.818843, 47.034179 ], [ -96.818557, 47.035516 ], [ -96.818748, 47.037618 ], [ -96.820563, 47.039528 ], [ -96.820849, 47.041438 ], [ -96.818843, 47.047074 ], [ -96.819321, 47.052900 ], [ -96.822568, 47.055861 ], [ -96.824479, 47.059682 ], [ -96.824097, 47.061497 ], [ -96.822186, 47.062070 ], [ -96.821327, 47.062930 ], [ -96.821804, 47.064362 ], [ -96.823491, 47.065911 ], [ -96.824097, 47.070666 ], [ -96.823715, 47.071717 ], [ -96.821231, 47.073150 ], [ -96.820849, 47.073818 ], [ -96.821613, 47.076302 ], [ -96.819479, 47.078181 ], [ -96.819078, 47.081152 ], [ -96.820216, 47.082111 ], [ -96.820650, 47.083619 ], [ -96.819034, 47.087573 ], [ -96.820563, 47.089770 ], [ -96.820085, 47.091393 ], [ -96.818366, 47.093304 ], [ -96.818557, 47.097888 ], [ -96.819894, 47.099321 ], [ -96.819990, 47.100849 ], [ -96.818175, 47.104193 ], [ -96.817984, 47.106007 ], [ -96.818843, 47.107154 ], [ -96.821590, 47.108457 ], [ -96.822694, 47.109622 ], [ -96.822192, 47.111679 ], [ -96.820619, 47.113712 ], [ -96.821189, 47.115723 ], [ -96.827344, 47.120144 ], [ -96.827726, 47.121481 ], [ -96.826712, 47.122852 ], [ -96.825440, 47.123354 ], [ -96.824807, 47.124968 ], [ -96.824476, 47.127188 ], [ -96.827631, 47.129504 ], [ -96.828777, 47.131510 ], [ -96.827631, 47.134758 ], [ -96.827631, 47.136572 ], [ -96.828597, 47.139800 ], [ -96.831547, 47.142017 ], [ -96.832407, 47.143736 ], [ -96.830114, 47.146793 ], [ -96.830114, 47.148512 ], [ -96.831069, 47.149467 ], [ -96.831260, 47.150900 ], [ -96.828013, 47.153956 ], [ -96.822706, 47.156229 ], [ -96.822405, 47.156914 ], [ -96.822707, 47.157668 ], [ -96.824670, 47.159019 ], [ -96.824861, 47.159783 ], [ -96.824288, 47.161120 ], [ -96.822377, 47.162744 ], [ -96.822091, 47.165036 ], [ -96.824479, 47.167042 ], [ -96.824288, 47.170863 ], [ -96.825147, 47.172295 ], [ -96.829637, 47.174970 ], [ -96.829828, 47.176307 ], [ -96.829446, 47.177262 ], [ -96.826962, 47.180128 ], [ -96.826676, 47.181561 ], [ -96.826962, 47.182802 ], [ -96.828299, 47.183948 ], [ -96.830401, 47.184617 ], [ -96.831451, 47.185572 ], [ -96.832407, 47.187483 ], [ -96.832502, 47.188342 ], [ -96.831165, 47.190826 ], [ -96.831260, 47.191781 ], [ -96.833075, 47.193596 ], [ -96.836800, 47.195028 ], [ -96.838233, 47.196366 ], [ -96.838806, 47.197894 ], [ -96.838615, 47.199613 ], [ -96.837660, 47.201141 ], [ -96.832789, 47.203911 ], [ -96.832120, 47.204866 ], [ -96.833457, 47.206490 ], [ -96.835177, 47.207445 ], [ -96.835463, 47.208401 ], [ -96.833648, 47.210406 ], [ -96.833362, 47.211457 ], [ -96.833553, 47.212794 ], [ -96.836514, 47.216137 ], [ -96.835654, 47.219289 ], [ -96.835941, 47.221009 ], [ -96.838329, 47.222059 ], [ -96.839284, 47.223874 ], [ -96.838806, 47.225020 ], [ -96.835654, 47.226549 ], [ -96.835654, 47.227217 ], [ -96.837374, 47.229254 ], [ -96.837564, 47.231802 ], [ -96.836036, 47.233999 ], [ -96.833362, 47.235050 ], [ -96.832693, 47.236196 ], [ -96.832946, 47.237588 ], [ -96.837660, 47.240876 ], [ -96.838233, 47.241831 ], [ -96.838233, 47.242882 ], [ -96.837278, 47.244219 ], [ -96.834890, 47.246416 ], [ -96.834699, 47.248135 ], [ -96.835368, 47.250428 ], [ -96.840143, 47.253102 ], [ -96.840525, 47.253866 ], [ -96.839857, 47.255490 ], [ -96.840048, 47.256159 ], [ -96.841672, 47.258164 ], [ -96.841003, 47.259215 ], [ -96.840717, 47.261221 ], [ -96.841290, 47.262463 ], [ -96.842531, 47.262845 ], [ -96.842627, 47.263991 ], [ -96.842054, 47.265328 ], [ -96.839857, 47.265997 ], [ -96.838997, 47.267716 ], [ -96.839761, 47.268767 ], [ -96.842531, 47.269531 ], [ -96.843200, 47.270486 ], [ -96.842245, 47.273351 ], [ -96.840353, 47.275496 ], [ -96.840220, 47.276981 ], [ -96.841465, 47.284041 ], [ -96.844088, 47.289981 ], [ -96.843922, 47.293020 ], [ -96.832884, 47.304490 ], [ -96.832884, 47.307069 ], [ -96.835735, 47.310843 ], [ -96.837045, 47.311391 ], [ -96.841003, 47.311558 ], [ -96.842531, 47.312418 ], [ -96.841958, 47.316907 ], [ -96.841194, 47.317575 ], [ -96.836991, 47.318817 ], [ -96.836036, 47.320059 ], [ -96.835845, 47.321014 ], [ -96.836609, 47.323975 ], [ -96.835177, 47.326267 ], [ -96.835177, 47.328560 ], [ -96.836036, 47.329706 ], [ -96.838329, 47.331043 ], [ -96.838520, 47.332380 ], [ -96.835845, 47.335914 ], [ -96.836609, 47.338684 ], [ -96.840586, 47.340956 ], [ -96.844012, 47.346182 ], [ -96.845158, 47.349430 ], [ -96.843439, 47.354397 ], [ -96.844298, 47.356021 ], [ -96.846877, 47.356785 ], [ -96.848119, 47.358026 ], [ -96.849265, 47.359841 ], [ -96.849456, 47.363662 ], [ -96.852417, 47.366241 ], [ -96.852226, 47.367291 ], [ -96.849552, 47.368247 ], [ -96.848597, 47.369584 ], [ -96.848907, 47.370565 ], [ -96.852035, 47.371876 ], [ -96.853754, 47.373405 ], [ -96.852676, 47.374973 ], [ -96.848931, 47.375363 ], [ -96.846925, 47.376891 ], [ -96.845588, 47.381571 ], [ -96.841099, 47.384150 ], [ -96.840621, 47.389881 ], [ -96.840717, 47.391314 ], [ -96.841767, 47.392460 ], [ -96.845492, 47.394179 ], [ -96.845874, 47.396185 ], [ -96.844919, 47.399815 ], [ -96.845110, 47.400483 ], [ -96.848071, 47.403158 ], [ -96.852739, 47.405909 ], [ -96.852656, 47.407647 ], [ -96.853325, 47.408889 ], [ -96.858094, 47.410317 ], [ -96.861833, 47.414337 ], [ -96.862070, 47.415159 ], [ -96.861095, 47.417056 ], [ -96.861231, 47.417810 ], [ -96.863593, 47.418775 ], [ -96.864261, 47.419539 ], [ -96.864261, 47.420972 ], [ -96.862924, 47.422309 ], [ -96.859581, 47.424028 ], [ -96.858721, 47.426129 ], [ -96.860632, 47.427658 ], [ -96.861014, 47.428995 ], [ -96.860823, 47.430237 ], [ -96.858530, 47.433389 ], [ -96.860059, 47.435681 ], [ -96.859772, 47.437209 ], [ -96.857480, 47.440457 ], [ -96.857480, 47.441603 ], [ -96.859537, 47.445662 ], [ -96.859239, 47.451557 ], [ -96.858244, 47.453351 ], [ -96.858148, 47.454498 ], [ -96.859677, 47.456026 ], [ -96.859963, 47.457363 ], [ -96.859581, 47.458700 ], [ -96.857480, 47.460229 ], [ -96.856811, 47.463190 ], [ -96.859555, 47.466865 ], [ -96.859868, 47.470926 ], [ -96.859103, 47.472837 ], [ -96.855856, 47.475702 ], [ -96.854710, 47.478281 ], [ -96.854996, 47.479618 ], [ -96.858148, 47.481624 ], [ -96.858530, 47.482484 ], [ -96.858530, 47.483917 ], [ -96.857957, 47.484681 ], [ -96.856142, 47.485540 ], [ -96.855665, 47.487260 ], [ -96.855856, 47.488310 ], [ -96.858530, 47.489934 ], [ -96.858530, 47.490889 ], [ -96.857957, 47.492513 ], [ -96.857002, 47.493468 ], [ -96.851653, 47.497098 ], [ -96.851844, 47.499390 ], [ -96.853317, 47.501322 ], [ -96.853286, 47.503881 ], [ -96.853052, 47.506828 ], [ -96.851749, 47.507891 ], [ -96.851367, 47.509037 ], [ -96.851749, 47.510088 ], [ -96.853181, 47.511425 ], [ -96.853468, 47.513813 ], [ -96.854204, 47.514368 ], [ -96.858454, 47.514892 ], [ -96.861422, 47.515873 ], [ -96.863245, 47.517266 ], [ -96.863551, 47.520304 ], [ -96.866363, 47.524893 ], [ -96.866363, 47.525944 ], [ -96.864739, 47.527663 ], [ -96.862379, 47.529055 ], [ -96.860524, 47.529536 ], [ -96.854710, 47.535973 ], [ -96.855092, 47.537310 ], [ -96.856429, 47.538456 ], [ -96.856716, 47.540271 ], [ -96.854614, 47.542850 ], [ -96.854232, 47.544665 ], [ -96.854423, 47.545333 ], [ -96.856429, 47.546957 ], [ -96.856620, 47.548103 ], [ -96.856238, 47.548963 ], [ -96.854328, 47.550491 ], [ -96.853755, 47.552497 ], [ -96.855092, 47.554598 ], [ -96.858002, 47.556578 ], [ -96.859057, 47.558591 ], [ -96.859153, 47.559741 ], [ -96.857427, 47.561658 ], [ -96.856852, 47.563288 ], [ -96.857236, 47.564055 ], [ -96.858673, 47.564534 ], [ -96.859153, 47.566355 ], [ -96.858769, 47.567410 ], [ -96.856661, 47.567889 ], [ -96.853689, 47.570381 ], [ -96.854073, 47.572010 ], [ -96.855894, 47.573352 ], [ -96.856373, 47.575749 ], [ -96.853273, 47.579483 ], [ -96.851293, 47.589264 ], [ -96.851964, 47.591469 ], [ -96.854743, 47.594728 ], [ -96.854456, 47.596261 ], [ -96.853114, 47.596836 ], [ -96.852826, 47.597891 ], [ -96.853785, 47.599808 ], [ -96.855618, 47.600890 ], [ -96.856903, 47.602329 ], [ -96.854812, 47.606328 ], [ -96.855421, 47.608750 ], [ -96.857112, 47.610760 ], [ -96.860255, 47.612175 ], [ -96.873671, 47.613654 ], [ -96.874078, 47.614774 ], [ -96.871005, 47.616832 ], [ -96.870600, 47.617563 ], [ -96.870871, 47.618042 ], [ -96.876355, 47.619181 ], [ -96.879496, 47.620576 ], [ -96.882393, 47.633489 ], [ -96.888573, 47.638450 ], [ -96.888166, 47.639730 ], [ -96.884515, 47.640755 ], [ -96.882857, 47.641714 ], [ -96.882376, 47.649025 ], [ -96.882882, 47.650168 ], [ -96.886970, 47.653049 ], [ -96.887607, 47.658853 ], [ -96.885710, 47.661547 ], [ -96.885573, 47.663443 ], [ -96.887126, 47.666369 ], [ -96.889627, 47.668587 ], [ -96.889726, 47.670643 ], [ -96.891922, 47.673157 ], [ -96.895271, 47.673570 ], [ -96.896724, 47.674758 ], [ -96.899352, 47.689473 ], [ -96.900264, 47.690775 ], [ -96.901719, 47.691621 ], [ -96.902971, 47.691576 ], [ -96.905273, 47.689246 ], [ -96.907236, 47.688493 ], [ -96.908928, 47.688722 ], [ -96.909909, 47.689522 ], [ -96.910144, 47.691235 ], [ -96.907266, 47.693976 ], [ -96.907604, 47.695119 ], [ -96.909769, 47.697313 ], [ -96.911527, 47.700512 ], [ -96.912846, 47.701746 ], [ -96.913762, 47.701468 ], [ -96.915242, 47.702369 ], [ -96.915242, 47.703527 ], [ -96.914405, 47.704814 ], [ -96.914856, 47.707003 ], [ -96.915500, 47.707968 ], [ -96.920119, 47.710383 ], [ -96.920321, 47.712394 ], [ -96.919811, 47.714339 ], [ -96.920391, 47.716527 ], [ -96.923544, 47.718201 ], [ -96.923480, 47.719809 ], [ -96.919471, 47.722515 ], [ -96.918556, 47.723863 ], [ -96.919131, 47.724731 ], [ -96.925089, 47.729051 ], [ -96.930574, 47.734352 ], [ -96.932809, 47.737139 ], [ -96.933316, 47.738716 ], [ -96.933011, 47.739949 ], [ -96.929319, 47.742988 ], [ -96.928506, 47.744884 ], [ -96.928505, 47.748037 ], [ -96.929051, 47.750331 ], [ -96.934173, 47.752412 ], [ -96.934463, 47.752956 ], [ -96.934209, 47.754517 ], [ -96.932648, 47.755315 ], [ -96.932684, 47.756804 ], [ -96.935555, 47.758276 ], [ -96.937859, 47.760195 ], [ -96.938435, 47.762411 ], [ -96.936909, 47.764536 ], [ -96.939179, 47.768397 ], [ -96.949585, 47.775228 ], [ -96.956635, 47.776188 ], [ -96.956501, 47.779798 ], [ -96.961926, 47.783292 ], [ -96.964400, 47.782995 ], [ -96.965316, 47.783474 ], [ -96.965350, 47.784937 ], [ -96.963521, 47.787290 ], [ -96.961554, 47.788707 ], [ -96.957283, 47.790147 ], [ -96.957216, 47.790970 ], [ -96.957860, 47.792021 ], [ -96.963523, 47.794601 ], [ -96.966068, 47.797297 ], [ -96.971698, 47.798255 ], [ -96.973585, 47.797884 ], [ -96.975131, 47.798326 ], [ -96.976088, 47.799577 ], [ -96.976176, 47.801544 ], [ -96.980579, 47.805614 ], [ -96.981168, 47.806792 ], [ -96.980947, 47.808337 ], [ -96.978894, 47.809882 ], [ -96.977946, 47.811619 ], [ -96.980391, 47.815662 ], [ -96.980726, 47.820411 ], [ -96.980137, 47.821441 ], [ -96.979327, 47.821809 ], [ -96.979327, 47.824533 ], [ -96.981683, 47.825785 ], [ -96.982272, 47.826668 ], [ -96.981725, 47.830421 ], [ -96.986685, 47.837639 ], [ -96.992963, 47.837911 ], [ -96.998295, 47.841724 ], [ -96.997890, 47.843163 ], [ -96.996364, 47.844398 ], [ -96.996816, 47.854405 ], [ -96.998144, 47.858882 ], [ -97.000356, 47.860915 ], [ -97.001759, 47.861266 ], [ -97.005557, 47.863977 ], [ -97.005857, 47.865277 ], [ -97.003356, 47.865877 ], [ -97.001556, 47.867377 ], [ -97.002456, 47.868677 ], [ -97.005356, 47.870177 ], [ -97.017356, 47.871578 ], [ -97.021256, 47.872578 ], [ -97.023156, 47.873978 ], [ -97.023156, 47.874978 ], [ -97.018955, 47.876878 ], [ -97.017955, 47.878478 ], [ -97.019355, 47.880278 ], [ -97.023355, 47.882078 ], [ -97.025355, 47.884278 ], [ -97.024955, 47.886878 ], [ -97.019155, 47.889778 ], [ -97.018955, 47.891078 ], [ -97.024955, 47.894978 ], [ -97.023955, 47.898078 ], [ -97.020155, 47.900478 ], [ -97.020255, 47.902178 ], [ -97.024155, 47.905278 ], [ -97.024955, 47.908178 ], [ -97.023555, 47.908478 ], [ -97.020355, 47.906378 ], [ -97.017254, 47.905678 ], [ -97.015054, 47.907178 ], [ -97.015354, 47.910278 ], [ -97.017254, 47.913078 ], [ -97.023754, 47.915878 ], [ -97.018054, 47.918078 ], [ -97.017754, 47.919778 ], [ -97.029654, 47.927578 ], [ -97.035754, 47.930179 ], [ -97.037354, 47.933279 ], [ -97.035554, 47.936579 ], [ -97.036054, 47.939379 ], [ -97.039154, 47.940479 ], [ -97.044954, 47.941079 ], [ -97.051054, 47.943379 ], [ -97.054554, 47.946279 ], [ -97.055554, 47.949079 ], [ -97.055154, 47.950779 ], [ -97.052554, 47.954779 ], [ -97.052454, 47.957179 ], [ -97.054054, 47.959679 ], [ -97.059054, 47.962080 ], [ -97.061454, 47.963580 ], [ -97.061854, 47.964480 ], [ -97.061554, 47.965880 ], [ -97.057854, 47.968980 ], [ -97.057153, 47.970480 ], [ -97.059353, 47.973980 ], [ -97.059153, 47.975380 ], [ -97.056481, 47.980556 ], [ -97.053537, 47.987948 ], [ -97.053089, 47.990252 ], [ -97.053553, 47.991612 ], [ -97.054945, 47.992924 ], [ -97.062257, 47.995948 ], [ -97.064289, 47.998508 ], [ -97.066762, 48.009558 ], [ -97.065411, 48.011337 ], [ -97.063012, 48.013179 ], [ -97.063289, 48.014989 ], [ -97.064927, 48.015658 ], [ -97.069284, 48.016176 ], [ -97.070654, 48.016918 ], [ -97.072239, 48.019107 ], [ -97.071911, 48.021395 ], [ -97.068987, 48.026267 ], [ -97.068711, 48.027694 ], [ -97.070411, 48.041765 ], [ -97.072257, 48.048068 ], [ -97.074015, 48.051212 ], [ -97.075641, 48.052725 ], [ -97.082895, 48.055794 ], [ -97.086986, 48.058222 ], [ -97.097772, 48.071080 ], [ -97.103052, 48.071669 ], [ -97.104483, 48.072428 ], [ -97.104697, 48.073094 ], [ -97.104154, 48.074578 ], [ -97.100771, 48.077452 ], [ -97.099431, 48.082106 ], [ -97.099798, 48.085884 ], [ -97.102165, 48.089122 ], [ -97.105226, 48.090440 ], [ -97.105616, 48.091362 ], [ -97.105475, 48.092780 ], [ -97.103879, 48.094517 ], [ -97.103950, 48.096184 ], [ -97.104872, 48.097851 ], [ -97.108428, 48.099824 ], [ -97.109535, 48.104723 ], [ -97.111470, 48.105913 ], [ -97.113194, 48.106188 ], [ -97.119773, 48.105381 ], [ -97.123205, 48.106648 ], [ -97.123666, 48.108004 ], [ -97.123135, 48.109497 ], [ -97.121040, 48.112281 ], [ -97.120592, 48.113365 ], [ -97.120702, 48.114987 ], [ -97.121586, 48.116925 ], [ -97.126862, 48.124277 ], [ -97.128279, 48.127185 ], [ -97.129453, 48.133133 ], [ -97.132176, 48.135829 ], [ -97.132520, 48.137641 ], [ -97.131956, 48.139563 ], [ -97.134299, 48.141833 ], [ -97.141401, 48.143590 ], [ -97.142133, 48.144981 ], [ -97.142279, 48.148056 ], [ -97.140295, 48.150894 ], [ -97.139497, 48.153108 ], [ -97.138911, 48.155304 ], [ -97.138911, 48.157793 ], [ -97.139643, 48.159111 ], [ -97.141950, 48.160202 ], [ -97.144242, 48.162490 ], [ -97.146745, 48.168556 ], [ -97.146672, 48.171484 ], [ -97.145243, 48.174046 ], [ -97.142352, 48.176609 ], [ -97.141620, 48.177781 ], [ -97.141474, 48.179099 ], [ -97.141840, 48.181734 ], [ -97.142938, 48.182686 ], [ -97.144622, 48.183199 ], [ -97.146013, 48.184590 ], [ -97.146233, 48.186054 ], [ -97.141518, 48.192518 ], [ -97.141233, 48.193602 ], [ -97.138007, 48.197587 ], [ -97.139131, 48.202820 ], [ -97.138765, 48.204650 ], [ -97.137740, 48.206188 ], [ -97.134738, 48.207506 ], [ -97.134372, 48.210434 ], [ -97.137006, 48.212537 ], [ -97.137407, 48.215245 ], [ -97.135177, 48.217243 ], [ -97.135201, 48.219156 ], [ -97.135617, 48.220904 ], [ -97.137522, 48.221713 ], [ -97.138154, 48.223104 ], [ -97.137690, 48.225126 ], [ -97.136304, 48.226176 ], [ -97.136003, 48.228082 ], [ -97.136304, 48.228984 ], [ -97.139311, 48.230187 ], [ -97.140815, 48.232032 ], [ -97.141254, 48.234668 ], [ -97.139790, 48.235913 ], [ -97.135763, 48.237596 ], [ -97.135617, 48.238988 ], [ -97.138618, 48.242429 ], [ -97.138765, 48.244991 ], [ -97.138033, 48.246236 ], [ -97.133434, 48.249873 ], [ -97.129384, 48.250429 ], [ -97.127967, 48.251474 ], [ -97.127276, 48.253323 ], [ -97.127594, 48.254383 ], [ -97.129235, 48.256398 ], [ -97.129533, 48.257815 ], [ -97.129384, 48.258785 ], [ -97.127146, 48.260874 ], [ -97.127146, 48.262889 ], [ -97.128551, 48.264816 ], [ -97.130951, 48.265276 ], [ -97.131921, 48.266023 ], [ -97.131846, 48.267589 ], [ -97.130280, 48.269305 ], [ -97.125348, 48.270452 ], [ -97.124080, 48.271250 ], [ -97.116570, 48.279661 ], [ -97.116717, 48.281246 ], [ -97.117726, 48.283488 ], [ -97.122160, 48.290056 ], [ -97.125348, 48.291855 ], [ -97.127236, 48.291827 ], [ -97.128862, 48.292882 ], [ -97.129086, 48.295792 ], [ -97.128638, 48.297657 ], [ -97.127295, 48.298478 ], [ -97.123341, 48.298627 ], [ -97.122520, 48.299299 ], [ -97.122072, 48.300865 ], [ -97.122296, 48.301388 ], [ -97.126176, 48.303701 ], [ -97.126176, 48.309147 ], [ -97.127146, 48.310192 ], [ -97.130951, 48.311609 ], [ -97.131921, 48.312728 ], [ -97.132443, 48.315489 ], [ -97.131697, 48.318324 ], [ -97.131250, 48.319543 ], [ -97.129826, 48.320516 ], [ -97.127601, 48.323319 ], [ -97.127436, 48.325709 ], [ -97.127766, 48.326781 ], [ -97.131227, 48.327935 ], [ -97.133751, 48.327847 ], [ -97.134772, 48.328677 ], [ -97.134854, 48.331314 ], [ -97.131969, 48.335518 ], [ -97.131145, 48.339722 ], [ -97.131722, 48.341123 ], [ -97.137904, 48.344585 ], [ -97.138481, 48.347470 ], [ -97.137492, 48.350602 ], [ -97.137822, 48.352003 ], [ -97.139851, 48.353425 ], [ -97.143861, 48.354503 ], [ -97.147748, 48.359905 ], [ -97.147748, 48.366959 ], [ -97.147356, 48.368723 ], [ -97.146376, 48.370290 ], [ -97.144221, 48.371270 ], [ -97.142066, 48.374209 ], [ -97.140106, 48.380479 ], [ -97.140106, 48.382242 ], [ -97.140890, 48.384006 ], [ -97.143633, 48.386161 ], [ -97.145201, 48.388904 ], [ -97.145592, 48.394195 ], [ -97.145201, 48.395566 ], [ -97.143829, 48.397134 ], [ -97.140106, 48.399289 ], [ -97.135795, 48.404187 ], [ -97.135012, 48.406735 ], [ -97.135600, 48.411829 ], [ -97.138343, 48.415944 ], [ -97.142457, 48.416727 ], [ -97.142849, 48.419471 ], [ -97.142066, 48.420450 ], [ -97.136971, 48.422018 ], [ -97.135600, 48.424369 ], [ -97.135600, 48.426524 ], [ -97.137813, 48.428056 ], [ -97.139173, 48.430528 ], [ -97.139296, 48.432011 ], [ -97.136206, 48.434606 ], [ -97.134970, 48.436337 ], [ -97.134229, 48.439797 ], [ -97.135094, 48.442269 ], [ -97.137319, 48.443505 ], [ -97.137689, 48.444247 ], [ -97.137689, 48.447583 ], [ -97.137072, 48.449067 ], [ -97.133611, 48.452280 ], [ -97.132622, 48.456482 ], [ -97.132746, 48.459942 ], [ -97.134229, 48.461178 ], [ -97.141768, 48.464021 ], [ -97.143127, 48.466246 ], [ -97.144116, 48.469212 ], [ -97.143745, 48.473661 ], [ -97.142015, 48.474650 ], [ -97.141397, 48.476256 ], [ -97.142757, 48.477987 ], [ -97.144611, 48.478975 ], [ -97.144981, 48.481571 ], [ -97.143869, 48.482930 ], [ -97.140291, 48.484722 ], [ -97.139276, 48.486310 ], [ -97.138864, 48.494362 ], [ -97.140347, 48.496834 ], [ -97.146279, 48.499677 ], [ -97.147638, 48.501531 ], [ -97.148133, 48.503384 ], [ -97.153076, 48.524148 ], [ -97.151964, 48.529215 ], [ -97.149122, 48.532305 ], [ -97.148874, 48.534282 ], [ -97.150481, 48.536877 ], [ -97.153942, 48.539102 ], [ -97.159697, 48.541339 ], [ -97.163105, 48.543855 ], [ -97.162717, 48.546765 ], [ -97.162099, 48.548124 ], [ -97.160863, 48.549236 ], [ -97.155791, 48.551173 ], [ -97.153447, 48.551214 ], [ -97.152459, 48.552326 ], [ -97.152211, 48.553933 ], [ -97.153942, 48.556034 ], [ -97.156413, 48.557146 ], [ -97.158267, 48.558753 ], [ -97.158762, 48.560112 ], [ -97.158638, 48.564067 ], [ -97.157402, 48.565921 ], [ -97.151638, 48.567630 ], [ -97.149616, 48.569876 ], [ -97.148998, 48.571977 ], [ -97.148874, 48.575067 ], [ -97.149616, 48.576921 ], [ -97.149740, 48.579516 ], [ -97.148429, 48.581028 ], [ -97.144922, 48.581452 ], [ -97.143654, 48.582358 ], [ -97.142915, 48.583733 ], [ -97.141585, 48.590820 ], [ -97.142237, 48.592595 ], [ -97.143931, 48.594594 ], [ -97.143684, 48.597066 ], [ -97.142818, 48.598425 ], [ -97.140841, 48.600032 ], [ -97.138246, 48.604234 ], [ -97.137380, 48.607324 ], [ -97.138246, 48.609301 ], [ -97.137504, 48.612268 ], [ -97.136145, 48.613256 ], [ -97.132931, 48.613380 ], [ -97.131448, 48.613998 ], [ -97.130707, 48.616593 ], [ -97.131325, 48.619065 ], [ -97.130089, 48.621166 ], [ -97.125639, 48.620919 ], [ -97.124774, 48.621537 ], [ -97.124033, 48.623267 ], [ -97.124175, 48.625387 ], [ -97.125887, 48.626975 ], [ -97.125887, 48.629076 ], [ -97.125269, 48.629694 ], [ -97.120819, 48.631053 ], [ -97.115043, 48.629821 ], [ -97.111559, 48.630266 ], [ -97.109515, 48.631453 ], [ -97.108466, 48.632658 ], [ -97.108276, 48.634396 ], [ -97.109651, 48.638888 ], [ -97.111921, 48.642918 ], [ -97.111179, 48.644525 ], [ -97.107814, 48.647728 ], [ -97.105910, 48.652632 ], [ -97.104566, 48.654416 ], [ -97.101790, 48.656294 ], [ -97.100551, 48.658614 ], [ -97.100674, 48.661951 ], [ -97.102652, 48.664793 ], [ -97.101539, 48.666771 ], [ -97.100009, 48.667926 ], [ -97.099811, 48.671377 ], [ -97.100674, 48.679624 ], [ -97.100056, 48.681355 ], [ -97.097708, 48.683950 ], [ -97.097337, 48.685186 ], [ -97.097584, 48.686298 ], [ -97.098697, 48.687534 ], [ -97.108655, 48.691484 ], [ -97.118286, 48.700573 ], [ -97.119027, 48.703292 ], [ -97.116926, 48.705022 ], [ -97.116185, 48.709348 ], [ -97.121253, 48.713593 ], [ -97.124328, 48.719166 ], [ -97.126398, 48.721101 ], [ -97.134229, 48.725167 ], [ -97.135588, 48.726403 ], [ -97.136083, 48.727763 ], [ -97.135094, 48.729740 ], [ -97.134847, 48.733324 ], [ -97.135341, 48.734560 ], [ -97.138996, 48.736654 ], [ -97.139611, 48.738129 ], [ -97.139488, 48.746611 ], [ -97.143176, 48.750913 ], [ -97.150060, 48.754724 ], [ -97.151043, 48.755707 ], [ -97.151289, 48.757428 ], [ -97.147478, 48.763698 ], [ -97.147478, 48.766033 ], [ -97.152588, 48.772602 ], [ -97.153871, 48.773286 ], [ -97.154854, 48.774515 ], [ -97.155223, 48.775499 ], [ -97.154854, 48.776728 ], [ -97.153871, 48.777712 ], [ -97.153256, 48.781031 ], [ -97.154116, 48.781891 ], [ -97.157067, 48.783120 ], [ -97.157804, 48.784104 ], [ -97.157797, 48.787680 ], [ -97.157093, 48.790024 ], [ -97.158102, 48.791145 ], [ -97.161231, 48.791778 ], [ -97.162959, 48.792930 ], [ -97.163535, 48.795070 ], [ -97.163699, 48.799513 ], [ -97.165921, 48.803792 ], [ -97.165921, 48.805273 ], [ -97.164874, 48.807129 ], [ -97.164874, 48.808253 ], [ -97.165624, 48.809627 ], [ -97.168497, 48.811002 ], [ -97.174045, 48.812108 ], [ -97.177045, 48.814124 ], [ -97.178611, 48.815839 ], [ -97.180028, 48.818450 ], [ -97.177747, 48.824815 ], [ -97.180991, 48.828992 ], [ -97.181116, 48.832741 ], [ -97.180366, 48.834365 ], [ -97.175727, 48.836158 ], [ -97.174275, 48.837261 ], [ -97.173811, 48.838309 ], [ -97.174355, 48.842619 ], [ -97.177243, 48.846483 ], [ -97.176993, 48.847733 ], [ -97.175618, 48.849857 ], [ -97.175618, 48.853105 ], [ -97.179071, 48.856866 ], [ -97.180116, 48.861601 ], [ -97.182365, 48.863725 ], [ -97.185488, 48.864849 ], [ -97.187113, 48.866098 ], [ -97.187362, 48.867598 ], [ -97.185738, 48.872220 ], [ -97.186238, 48.873470 ], [ -97.187737, 48.874594 ], [ -97.190486, 48.875594 ], [ -97.197982, 48.880341 ], [ -97.198857, 48.882215 ], [ -97.197982, 48.884839 ], [ -97.197857, 48.886838 ], [ -97.199981, 48.891086 ], [ -97.198107, 48.893959 ], [ -97.197982, 48.898332 ], [ -97.198857, 48.899831 ], [ -97.207688, 48.902629 ], [ -97.210541, 48.904390 ], [ -97.212706, 48.908143 ], [ -97.212553, 48.909860 ], [ -97.210809, 48.913950 ], [ -97.211161, 48.916649 ], [ -97.212926, 48.918033 ], [ -97.217992, 48.919735 ], [ -97.219095, 48.922078 ], [ -97.219185, 48.924860 ], [ -97.217463, 48.927659 ], [ -97.217549, 48.929892 ], [ -97.218666, 48.931781 ], [ -97.224505, 48.934100 ], [ -97.226394, 48.938651 ], [ -97.226823, 48.943545 ], [ -97.227854, 48.945864 ], [ -97.232147, 48.948955 ], [ -97.232319, 48.950501 ], [ -97.230859, 48.958229 ], [ -97.230859, 48.960891 ], [ -97.231460, 48.962437 ], [ -97.232491, 48.963897 ], [ -97.237541, 48.965341 ], [ -97.238882, 48.966573 ], [ -97.239209, 48.968684 ], [ -97.238025, 48.975143 ], [ -97.238387, 48.982631 ], [ -97.237297, 48.985696 ], [ -97.234214, 48.988966 ], [ -97.230833, 48.991303 ], [ -97.230403, 48.993366 ], [ -97.231490, 48.995995 ], [ -97.231397, 48.997212 ], [ -97.229039, 49.000687 ], [ -96.930960, 48.999984 ], [ -95.975390, 48.999984 ], [ -95.368698, 48.998729 ], [ -95.355819, 48.998735 ], [ -95.340962, 48.998740 ], [ -95.322946, 48.998767 ], [ -95.153711, 48.998903 ], [ -95.153309, 49.184880 ], [ -95.153424, 49.249995 ], [ -95.153333, 49.305655 ], [ -95.153319, 49.307720 ], [ -95.153331, 49.308442 ], [ -95.153330, 49.309287 ], [ -95.153284, 49.343409 ], [ -95.153344, 49.343662 ], [ -95.153407, 49.354397 ], [ -95.153330, 49.365886 ], [ -95.153259, 49.367691 ], [ -95.153293, 49.369107 ], [ -95.153350, 49.383079 ], [ -95.153314, 49.384358 ], [ -95.150235, 49.382964 ], [ -95.149747, 49.380565 ], [ -95.145306, 49.378280 ], [ -95.141808, 49.378301 ], [ -95.126467, 49.369439 ], [ -95.115866, 49.366518 ], [ -95.109535, 49.366315 ], [ -95.105057, 49.364962 ], [ -95.102818, 49.363554 ], [ -95.089806, 49.361114 ], [ -95.058404, 49.353170 ], [ -95.049382, 49.353056 ], [ -95.014415, 49.356405 ], [ -94.988908, 49.368897 ], [ -94.974286, 49.367738 ], [ -94.957465, 49.370186 ], [ -94.952111, 49.368679 ], [ -94.909273, 49.350176 ], [ -94.907036, 49.348508 ], [ -94.878454, 49.333193 ], [ -94.854245, 49.324154 ], [ -94.836876, 49.324068 ], [ -94.816222, 49.320987 ], [ -94.824291, 49.308834 ], [ -94.825160, 49.294283 ], [ -94.797244, 49.214284 ], [ -94.797527, 49.197791 ], [ -94.774228, 49.124994 ], [ -94.773223, 49.120733 ], [ -94.750221, 49.099763 ], [ -94.750218, 48.999992 ], [ -94.718932, 48.999991 ], [ -94.683069, 48.883929 ], [ -94.683127, 48.883376 ], [ -94.684217, 48.872399 ], [ -94.692527, 48.868950 ], [ -94.690302, 48.863711 ], [ -94.690246, 48.863363 ], [ -94.693044, 48.853392 ], [ -94.685681, 48.840119 ], [ -94.697055, 48.835731 ], [ -94.701968, 48.831778 ], [ -94.704284, 48.824284 ], [ -94.694974, 48.809206 ], [ -94.695975, 48.799771 ], [ -94.694312, 48.789352 ], [ -94.690889, 48.778066 ], [ -94.690863, 48.778047 ], [ -94.687951, 48.775896 ], [ -94.672812, 48.769315 ], [ -94.667110, 48.766115 ], [ -94.660063, 48.760288 ], [ -94.651765, 48.755913 ], [ -94.645164, 48.749975 ], [ -94.646256, 48.749975 ], [ -94.645150, 48.748991 ], [ -94.645083, 48.744143 ], [ -94.640803, 48.741171 ], [ -94.619010, 48.737374 ], [ -94.610539, 48.731893 ], [ -94.601384, 48.728356 ], [ -94.595855, 48.724222 ], [ -94.591018, 48.719494 ], [ -94.587150, 48.717599 ], [ -94.568368, 48.715522 ], [ -94.555835, 48.716207 ], [ -94.549069, 48.714653 ], [ -94.545514, 48.712185 ], [ -94.538372, 48.702840 ], [ -94.533057, 48.701262 ], [ -94.524600, 48.701556 ], [ -94.508862, 48.700362 ], [ -94.500203, 48.698175 ], [ -94.486503, 48.698054 ], [ -94.472938, 48.696849 ], [ -94.464481, 48.695503 ], [ -94.452332, 48.692444 ], [ -94.446604, 48.692900 ], [ -94.438701, 48.694889 ], [ -94.424203, 48.705352 ], [ -94.421405, 48.708756 ], [ -94.418919, 48.710172 ], [ -94.416191, 48.710948 ], [ -94.406318, 48.710535 ], [ -94.388848, 48.711945 ], [ -94.384221, 48.711806 ], [ -94.378216, 48.710272 ], [ -94.368583, 48.706434 ], [ -94.353046, 48.704132 ], [ -94.342758, 48.703382 ], [ -94.328434, 48.704481 ], [ -94.308446, 48.710239 ], [ -94.290737, 48.707747 ], [ -94.281797, 48.705255 ], [ -94.274345, 48.699882 ], [ -94.264473, 48.698919 ], [ -94.260541, 48.696381 ], [ -94.258130, 48.691834 ], [ -94.252753, 48.686325 ], [ -94.251169, 48.683514 ], [ -94.250623, 48.678236 ], [ -94.254643, 48.663888 ], [ -94.254577, 48.661375 ], [ -94.250497, 48.656654 ], [ -94.250191, 48.656323 ], [ -94.246841, 48.654224 ], [ -94.244394, 48.653442 ], [ -94.233575, 48.652336 ], [ -94.224276, 48.649527 ], [ -94.214448, 48.649382 ], [ -94.199517, 48.650996 ], [ -94.188581, 48.650402 ], [ -94.167725, 48.648104 ], [ -94.157387, 48.645766 ], [ -94.138682, 48.645714 ], [ -94.126336, 48.644447 ], [ -94.110031, 48.644192 ], [ -94.099898, 48.645863 ], [ -94.091244, 48.643669 ], [ -94.076675, 48.644203 ], [ -94.071357, 48.645895 ], [ -94.065775, 48.646104 ], [ -94.064243, 48.643717 ], [ -94.060267, 48.643115 ], [ -94.052452, 48.644020 ], [ -94.043187, 48.643416 ], [ -94.035616, 48.641018 ], [ -94.029491, 48.640861 ], [ -94.006933, 48.643193 ], [ -94.000675, 48.642777 ], [ -93.990082, 48.639738 ], [ -93.976535, 48.637573 ], [ -93.963375, 48.637151 ], [ -93.960632, 48.636496 ], [ -93.954413, 48.633744 ], [ -93.944221, 48.632294 ], [ -93.927004, 48.631220 ], [ -93.916649, 48.632156 ], [ -93.915494, 48.632667 ], [ -93.914357, 48.634320 ], [ -93.911530, 48.634673 ], [ -93.886934, 48.630779 ], [ -93.851618, 48.630108 ], [ -93.844008, 48.629395 ], [ -93.840754, 48.628548 ], [ -93.837392, 48.627098 ], [ -93.834323, 48.624954 ], [ -93.827959, 48.613001 ], [ -93.824144, 48.610724 ], [ -93.822644, 48.609067 ], [ -93.820067, 48.603755 ], [ -93.818518, 48.595314 ], [ -93.812037, 48.584944 ], [ -93.807984, 48.580297 ], [ -93.806763, 48.577616 ], [ -93.805270, 48.570299 ], [ -93.805369, 48.568393 ], [ -93.806748, 48.561779 ], [ -93.808973, 48.555897 ], [ -93.812098, 48.550664 ], [ -93.812278, 48.549111 ], [ -93.811303, 48.545543 ], [ -93.811201, 48.542385 ], [ -93.812223, 48.540509 ], [ -93.817572, 48.535833 ], [ -93.818375, 48.534442 ], [ -93.818853, 48.532669 ], [ -93.818253, 48.530046 ], [ -93.815178, 48.526508 ], [ -93.812149, 48.524778 ], [ -93.801520, 48.520551 ], [ -93.797436, 48.518356 ], [ -93.794454, 48.516021 ], [ -93.784657, 48.515490 ], [ -93.771741, 48.515825 ], [ -93.763176, 48.516118 ], [ -93.756483, 48.515366 ], [ -93.752942, 48.515120 ], [ -93.741843, 48.517347 ], [ -93.732139, 48.517995 ], [ -93.723680, 48.517329 ], [ -93.709147, 48.518029 ], [ -93.703303, 48.517150 ], [ -93.694676, 48.514774 ], [ -93.690901, 48.514588 ], [ -93.674568, 48.516297 ], [ -93.656652, 48.515731 ], [ -93.645397, 48.517281 ], [ -93.643091, 48.518294 ], [ -93.641440, 48.519238 ], [ -93.638199, 48.522533 ], [ -93.635476, 48.527702 ], [ -93.632327, 48.530092 ], [ -93.628865, 48.531210 ], [ -93.626447, 48.530985 ], [ -93.622333, 48.526510 ], [ -93.618321, 48.523970 ], [ -93.612844, 48.521876 ], [ -93.610618, 48.521661 ], [ -93.605870, 48.522472 ], [ -93.603752, 48.523326 ], [ -93.598212, 48.527154 ], [ -93.594379, 48.528793 ], [ -93.587957, 48.528881 ], [ -93.580711, 48.526667 ], [ -93.578333, 48.526520 ], [ -93.562062, 48.528897 ], [ -93.547191, 48.528684 ], [ -93.540369, 48.529877 ], [ -93.532087, 48.532453 ], [ -93.518691, 48.533997 ], [ -93.515457, 48.534792 ], [ -93.500153, 48.541202 ], [ -93.481471, 48.543146 ], [ -93.467504, 48.545664 ], [ -93.465392, 48.546668 ], [ -93.460798, 48.550552 ], [ -93.458246, 48.555291 ], [ -93.456675, 48.561834 ], [ -93.457046, 48.567199 ], [ -93.461731, 48.574030 ], [ -93.466007, 48.587291 ], [ -93.465199, 48.590659 ], [ -93.464308, 48.591792 ], [ -93.438494, 48.593380 ], [ -93.434141, 48.595138 ], [ -93.428328, 48.599777 ], [ -93.425483, 48.601300 ], [ -93.414026, 48.605605 ], [ -93.408560, 48.608415 ], [ -93.405269, 48.609344 ], [ -93.404205, 48.609351 ], [ -93.403660, 48.607593 ], [ -93.398974, 48.603905 ], [ -93.395022, 48.603303 ], [ -93.383807, 48.605149 ], [ -93.371156, 48.605085 ], [ -93.367666, 48.607020 ], [ -93.367025, 48.608283 ], [ -93.362132, 48.613832 ], [ -93.356410, 48.611778 ], [ -93.355410, 48.611595 ], [ -93.354135, 48.612350 ], [ -93.353240, 48.613378 ], [ -93.353138, 48.615709 ], [ -93.349095, 48.624935 ], [ -93.348183, 48.626414 ], [ -93.347528, 48.626620 ], [ -93.254854, 48.642784 ], [ -93.207398, 48.642474 ], [ -93.184091, 48.628375 ], [ -93.179990, 48.624926 ], [ -93.178095, 48.623339 ], [ -93.142420, 48.624924 ], [ -93.088438, 48.627597 ], [ -92.984963, 48.623731 ], [ -92.954876, 48.631493 ], [ -92.950120, 48.630419 ], [ -92.949839, 48.608269 ], [ -92.929614, 48.606874 ], [ -92.909947, 48.596313 ], [ -92.894687, 48.594915 ], [ -92.728046, 48.539290 ], [ -92.657881, 48.546263 ], [ -92.634931, 48.542873 ], [ -92.627833, 48.522167 ], [ -92.625739, 48.518189 ], [ -92.625541, 48.517549 ], [ -92.626639, 48.514374 ], [ -92.626365, 48.513620 ], [ -92.625151, 48.513048 ], [ -92.625374, 48.512916 ], [ -92.631117, 48.508252 ], [ -92.631137, 48.508077 ], [ -92.631463, 48.506790 ], [ -92.629126, 48.505303 ], [ -92.627237, 48.503383 ], [ -92.630644, 48.500917 ], [ -92.636696, 48.499428 ], [ -92.647114, 48.499905 ], [ -92.654039, 48.501635 ], [ -92.661418, 48.496557 ], [ -92.684866, 48.497611 ], [ -92.698824, 48.494892 ], [ -92.701298, 48.484586 ], [ -92.709267, 48.473091 ], [ -92.708647, 48.470349 ], [ -92.712562, 48.463013 ], [ -92.687998, 48.443889 ], [ -92.663271, 48.440184 ], [ -92.656027, 48.436709 ], [ -92.575636, 48.440827 ], [ -92.537202, 48.447703 ], [ -92.514910, 48.448313 ], [ -92.507285, 48.447875 ], [ -92.492078, 48.433709 ], [ -92.489190, 48.430328 ], [ -92.484074, 48.429530 ], [ -92.482082, 48.428662 ], [ -92.480844, 48.426583 ], [ -92.481152, 48.425349 ], [ -92.475585, 48.418793 ], [ -92.456325, 48.414204 ], [ -92.456389, 48.401134 ], [ -92.476750, 48.371760 ], [ -92.469948, 48.351836 ], [ -92.453691, 48.329514 ], [ -92.441286, 48.315597 ], [ -92.437825, 48.309839 ], [ -92.432003, 48.305063 ], [ -92.428919, 48.305771 ], [ -92.426077, 48.304491 ], [ -92.416285, 48.295463 ], [ -92.406706, 48.279351 ], [ -92.397645, 48.265546 ], [ -92.393781, 48.260562 ], [ -92.389305, 48.253316 ], [ -92.387049, 48.249268 ], [ -92.388112, 48.246732 ], [ -92.387191, 48.244606 ], [ -92.386438, 48.244194 ], [ -92.383906, 48.244696 ], [ -92.384387, 48.242914 ], [ -92.384355, 48.240720 ], [ -92.383161, 48.238367 ], [ -92.378922, 48.235782 ], [ -92.378343, 48.233383 ], [ -92.378449, 48.230801 ], [ -92.377903, 48.229635 ], [ -92.372802, 48.223717 ], [ -92.369174, 48.220268 ], [ -92.362097, 48.222876 ], [ -92.353177, 48.230328 ], [ -92.349177, 48.231404 ], [ -92.341207, 48.232480 ], [ -92.339430, 48.234537 ], [ -92.336831, 48.235383 ], [ -92.335394, 48.235200 ], [ -92.333649, 48.233898 ], [ -92.332247, 48.233876 ], [ -92.325304, 48.237030 ], [ -92.321746, 48.237304 ], [ -92.314665, 48.240527 ], [ -92.280727, 48.244269 ], [ -92.269742, 48.248241 ], [ -92.273706, 48.256747 ], [ -92.290368, 48.265527 ], [ -92.294541, 48.271560 ], [ -92.292999, 48.276404 ], [ -92.295053, 48.276587 ], [ -92.295668, 48.278118 ], [ -92.301451, 48.288608 ], [ -92.294527, 48.306454 ], [ -92.306309, 48.316442 ], [ -92.304561, 48.322977 ], [ -92.295412, 48.323957 ], [ -92.288994, 48.342991 ], [ -92.262280, 48.354933 ], [ -92.222813, 48.349203 ], [ -92.219658, 48.348130 ], [ -92.216983, 48.345114 ], [ -92.206803, 48.345596 ], [ -92.207009, 48.346891 ], [ -92.207729, 48.347812 ], [ -92.203684, 48.352063 ], [ -92.194874, 48.350396 ], [ -92.194188, 48.348728 ], [ -92.193571, 48.348613 ], [ -92.178418, 48.351881 ], [ -92.178897, 48.355285 ], [ -92.177354, 48.357228 ], [ -92.162161, 48.363279 ], [ -92.145049, 48.365651 ], [ -92.143583, 48.356121 ], [ -92.092256, 48.354617 ], [ -92.083513, 48.353865 ], [ -92.077961, 48.358253 ], [ -92.066269, 48.359602 ], [ -92.055228, 48.359213 ], [ -92.048648, 48.348861 ], [ -92.045734, 48.347901 ], [ -92.045152, 48.345776 ], [ -92.047655, 48.343766 ], [ -92.046562, 48.334740 ], [ -92.037721, 48.333183 ], [ -92.030872, 48.325824 ], [ -92.000133, 48.321355 ], [ -92.012980, 48.297391 ], [ -92.012066, 48.287268 ], [ -92.007246, 48.280388 ], [ -92.006577, 48.265421 ], [ -91.989545, 48.260214 ], [ -91.980772, 48.247801 ], [ -91.977555, 48.247140 ], [ -91.977486, 48.246340 ], [ -91.977725, 48.245723 ], [ -91.976903, 48.244626 ], [ -91.975809, 48.244535 ], [ -91.971056, 48.247667 ], [ -91.970371, 48.249358 ], [ -91.972565, 48.250396 ], [ -91.971779, 48.252977 ], [ -91.970240, 48.253594 ], [ -91.959565, 48.253551 ], [ -91.954432, 48.251678 ], [ -91.954397, 48.251199 ], [ -91.953806, 48.249412 ], [ -91.952095, 48.247131 ], [ -91.952209, 48.244394 ], [ -91.957683, 48.242683 ], [ -91.957798, 48.239490 ], [ -91.959166, 48.236296 ], [ -91.957798, 48.232989 ], [ -91.953398, 48.232978 ], [ -91.951297, 48.232647 ], [ -91.945155, 48.230442 ], [ -91.941838, 48.230602 ], [ -91.940709, 48.232019 ], [ -91.937356, 48.234213 ], [ -91.929045, 48.235834 ], [ -91.920802, 48.236747 ], [ -91.915772, 48.238871 ], [ -91.907597, 48.238183 ], [ -91.906967, 48.237770 ], [ -91.905991, 48.237132 ], [ -91.903767, 48.237040 ], [ -91.893470, 48.237699 ], [ -91.884691, 48.227321 ], [ -91.867882, 48.219095 ], [ -91.864382, 48.207031 ], [ -91.845821, 48.208636 ], [ -91.839463, 48.209643 ], [ -91.834404, 48.209804 ], [ -91.831975, 48.209302 ], [ -91.815772, 48.211748 ], [ -91.814473, 48.208664 ], [ -91.809038, 48.206013 ], [ -91.798099, 48.202813 ], [ -91.791810, 48.202492 ], [ -91.789011, 48.196549 ], [ -91.786140, 48.196412 ], [ -91.781182, 48.200432 ], [ -91.764672, 48.200586 ], [ -91.763236, 48.201499 ], [ -91.760874, 48.204789 ], [ -91.756637, 48.205022 ], [ -91.753939, 48.201198 ], [ -91.749075, 48.198844 ], [ -91.744973, 48.198458 ], [ -91.741932, 48.199122 ], [ -91.742313, 48.204491 ], [ -91.738861, 48.204173 ], [ -91.714931, 48.199130 ], [ -91.710519, 48.193898 ], [ -91.711611, 48.189100 ], [ -91.712430, 48.187500 ], [ -91.721413, 48.180255 ], [ -91.722574, 48.178335 ], [ -91.724584, 48.170657 ], [ -91.723285, 48.169263 ], [ -91.717548, 48.171801 ], [ -91.709383, 48.172717 ], [ -91.705318, 48.170775 ], [ -91.705109, 48.159716 ], [ -91.707260, 48.153661 ], [ -91.708523, 48.152701 ], [ -91.703569, 48.145390 ], [ -91.701691, 48.144773 ], [ -91.699336, 48.144728 ], [ -91.698448, 48.143791 ], [ -91.698174, 48.141643 ], [ -91.699981, 48.131840 ], [ -91.704143, 48.124894 ], [ -91.708099, 48.122985 ], [ -91.712226, 48.116883 ], [ -91.712498, 48.115718 ], [ -91.711986, 48.114713 ], [ -91.703524, 48.113548 ], [ -91.692843, 48.116360 ], [ -91.691512, 48.117617 ], [ -91.692366, 48.119330 ], [ -91.682845, 48.122118 ], [ -91.683801, 48.117731 ], [ -91.687623, 48.111698 ], [ -91.680902, 48.108111 ], [ -91.676876, 48.107264 ], [ -91.671519, 48.108360 ], [ -91.667527, 48.108359 ], [ -91.665208, 48.107011 ], [ -91.663092, 48.108861 ], [ -91.662647, 48.111489 ], [ -91.653261, 48.114137 ], [ -91.652204, 48.113725 ], [ -91.651624, 48.112742 ], [ -91.653571, 48.109567 ], [ -91.640175, 48.096926 ], [ -91.615255, 48.101906 ], [ -91.588953, 48.102166 ], [ -91.575853, 48.106509 ], [ -91.559272, 48.108268 ], [ -91.552962, 48.103012 ], [ -91.569746, 48.093348 ], [ -91.575471, 48.066294 ], [ -91.573015, 48.057292 ], [ -91.575672, 48.048791 ], [ -91.567254, 48.043719 ], [ -91.542512, 48.053268 ], [ -91.488646, 48.068065 ], [ -91.465499, 48.066770 ], [ -91.450330, 48.068806 ], [ -91.446580, 48.067390 ], [ -91.447125, 48.063186 ], [ -91.438093, 48.052104 ], [ -91.438877, 48.049979 ], [ -91.437582, 48.049248 ], [ -91.429642, 48.048608 ], [ -91.413862, 48.053518 ], [ -91.391128, 48.057075 ], [ -91.379463, 48.065295 ], [ -91.370872, 48.069410 ], [ -91.365143, 48.066968 ], [ -91.350521, 48.071680 ], [ -91.340159, 48.073236 ], [ -91.336715, 48.070884 ], [ -91.336578, 48.069627 ], [ -91.332589, 48.069331 ], [ -91.330033, 48.069811 ], [ -91.328738, 48.070588 ], [ -91.327886, 48.071388 ], [ -91.324784, 48.072599 ], [ -91.314693, 48.073422 ], [ -91.311829, 48.072942 ], [ -91.302625, 48.073033 ], [ -91.290215, 48.073945 ], [ -91.275961, 48.078488 ], [ -91.266380, 48.078713 ], [ -91.250112, 48.084087 ], [ -91.234932, 48.095923 ], [ -91.226203, 48.099671 ], [ -91.214428, 48.102940 ], [ -91.190461, 48.124891 ], [ -91.183207, 48.122235 ], [ -91.176181, 48.125811 ], [ -91.156107, 48.140475 ], [ -91.137733, 48.149150 ], [ -91.138311, 48.151024 ], [ -91.138482, 48.151458 ], [ -91.139402, 48.153186 ], [ -91.139402, 48.154738 ], [ -91.138580, 48.155844 ], [ -91.120047, 48.160412 ], [ -91.117965, 48.162081 ], [ -91.114862, 48.166057 ], [ -91.108887, 48.168436 ], [ -91.097892, 48.171157 ], [ -91.092258, 48.173101 ], [ -91.088708, 48.177351 ], [ -91.082731, 48.180756 ], [ -91.081160, 48.180414 ], [ -91.080408, 48.179272 ], [ -91.075660, 48.179204 ], [ -91.065549, 48.181215 ], [ -91.062918, 48.185213 ], [ -91.056562, 48.187566 ], [ -91.043613, 48.189163 ], [ -91.035858, 48.189436 ], [ -91.035550, 48.189459 ], [ -91.034800, 48.188956 ], [ -91.031589, 48.188452 ], [ -91.024208, 48.190072 ], [ -91.022667, 48.192470 ], [ -91.012411, 48.198062 ], [ -91.003353, 48.200183 ], [ -91.004239, 48.202628 ], [ -90.976955, 48.219452 ], [ -90.925092, 48.229897 ], [ -90.914971, 48.230603 ], [ -90.906829, 48.237339 ], [ -90.885480, 48.245784 ], [ -90.881451, 48.240459 ], [ -90.875107, 48.237784 ], [ -90.867079, 48.238177 ], [ -90.847352, 48.244443 ], [ -90.843624, 48.243576 ], [ -90.839176, 48.239511 ], [ -90.837772, 48.234714 ], [ -90.839820, 48.228294 ], [ -90.839615, 48.227700 ], [ -90.837700, 48.226512 ], [ -90.837323, 48.225621 ], [ -90.834854, 48.202161 ], [ -90.834166, 48.188660 ], [ -90.836313, 48.176963 ], [ -90.832589, 48.173765 ], [ -90.826135, 48.177147 ], [ -90.825418, 48.181237 ], [ -90.825726, 48.183567 ], [ -90.821115, 48.184709 ], [ -90.819304, 48.182699 ], [ -90.817698, 48.179569 ], [ -90.810628, 48.179661 ], [ -90.804207, 48.177833 ], [ -90.800693, 48.163235 ], [ -90.796596, 48.159373 ], [ -90.785874, 48.160902 ], [ -90.783380, 48.163939 ], [ -90.781263, 48.164693 ], [ -90.777917, 48.163801 ], [ -90.776279, 48.161927 ], [ -90.777512, 48.156696 ], [ -90.778031, 48.148723 ], [ -90.785781, 48.145504 ], [ -90.796809, 48.139521 ], [ -90.797970, 48.136894 ], [ -90.795308, 48.135523 ], [ -90.793841, 48.135569 ], [ -90.790312, 48.135788 ], [ -90.788101, 48.135081 ], [ -90.787305, 48.134196 ], [ -90.787305, 48.133665 ], [ -90.787563, 48.132872 ], [ -90.789919, 48.129902 ], [ -90.787122, 48.127709 ], [ -90.783471, 48.126885 ], [ -90.776814, 48.124103 ], [ -90.776133, 48.122481 ], [ -90.775962, 48.122229 ], [ -90.774225, 48.118894 ], [ -90.774191, 48.118575 ], [ -90.772998, 48.117523 ], [ -90.769110, 48.116585 ], [ -90.767615, 48.110302 ], [ -90.761555, 48.100133 ], [ -90.761625, 48.098283 ], [ -90.751608, 48.090968 ], [ -90.741520, 48.094583 ], [ -90.703702, 48.096009 ], [ -90.686617, 48.100510 ], [ -90.641596, 48.103515 ], [ -90.626886, 48.111846 ], [ -90.620350, 48.111895 ], [ -90.616154, 48.112491 ], [ -90.606402, 48.115966 ], [ -90.591460, 48.117546 ], [ -90.590574, 48.119762 ], [ -90.582217, 48.123784 ], [ -90.579897, 48.123922 ], [ -90.577065, 48.121272 ], [ -90.575905, 48.120907 ], [ -90.570481, 48.121501 ], [ -90.566113, 48.122620 ], [ -90.559290, 48.121683 ], [ -90.555845, 48.117069 ], [ -90.569763, 48.106951 ], [ -90.567482, 48.101178 ], [ -90.564341, 48.098773 ], [ -90.556838, 48.096008 ], [ -90.517075, 48.099402 ], [ -90.510871, 48.097389 ], [ -90.508141, 48.099238 ], [ -90.505485, 48.099644 ], [ -90.496148, 48.098781 ], [ -90.495637, 48.099444 ], [ -90.495398, 48.099787 ], [ -90.493797, 48.101318 ], [ -90.489873, 48.099012 ], [ -90.487077, 48.099082 ], [ -90.483361, 48.100363 ], [ -90.480294, 48.102099 ], [ -90.477635, 48.105458 ], [ -90.471019, 48.106076 ], [ -90.467712, 48.108818 ], [ -90.465495, 48.108659 ], [ -90.463210, 48.107357 ], [ -90.452022, 48.105006 ], [ -90.447384, 48.103430 ], [ -90.443462, 48.100575 ], [ -90.438449, 48.098747 ], [ -90.410347, 48.105048 ], [ -90.403219, 48.105114 ], [ -90.393469, 48.100359 ], [ -90.390162, 48.100061 ], [ -90.386413, 48.098209 ], [ -90.385597, 48.095833 ], [ -90.384575, 48.094599 ], [ -90.382258, 48.093182 ], [ -90.374542, 48.090942 ], [ -90.373042, 48.091217 ], [ -90.372261, 48.093639 ], [ -90.367658, 48.094577 ], [ -90.353713, 48.095016 ], [ -90.346689, 48.094104 ], [ -90.344234, 48.094447 ], [ -90.343484, 48.095064 ], [ -90.342939, 48.095590 ], [ -90.338438, 48.096207 ], [ -90.337177, 48.099771 ], [ -90.330052, 48.102399 ], [ -90.317230, 48.103793 ], [ -90.312386, 48.105300 ], [ -90.305634, 48.105117 ], [ -90.298099, 48.102512 ], [ -90.293326, 48.099131 ], [ -90.289337, 48.098993 ], [ -90.274636, 48.103260 ], [ -90.264986, 48.103301 ], [ -90.253870, 48.102245 ], [ -90.233797, 48.107071 ], [ -90.224692, 48.108148 ], [ -90.216404, 48.106505 ], [ -90.211426, 48.106278 ], [ -90.195090, 48.108381 ], [ -90.188679, 48.107947 ], [ -90.176605, 48.112445 ], [ -90.164227, 48.109725 ], [ -90.150721, 48.110269 ], [ -90.145230, 48.111637 ], [ -90.143762, 48.112641 ], [ -90.136191, 48.112136 ], [ -90.132645, 48.111768 ], [ -90.128647, 48.108436 ], [ -90.125090, 48.107702 ], [ -90.123900, 48.107131 ], [ -90.122603, 48.105602 ], [ -90.116259, 48.104303 ], [ -90.091639, 48.104630 ], [ -90.073873, 48.101138 ], [ -90.057644, 48.096364 ], [ -90.049020, 48.091681 ], [ -90.045577, 48.091360 ], [ -90.029626, 48.087588 ], [ -90.023595, 48.084708 ], [ -90.018835, 48.072032 ], [ -90.015057, 48.067188 ], [ -90.010866, 48.067917 ], [ -90.010013, 48.068853 ], [ -90.008446, 48.068396 ], [ -89.997852, 48.057567 ], [ -89.993822, 48.049027 ], [ -89.995994, 48.041649 ], [ -89.996702, 48.035391 ], [ -89.994687, 48.030733 ], [ -89.993050, 48.028404 ], [ -89.988894, 48.025666 ], [ -89.987293, 48.025484 ], [ -89.985217, 48.026215 ], [ -89.984332, 48.026079 ], [ -89.977180, 48.023501 ], [ -89.973433, 48.020350 ], [ -89.968255, 48.014482 ], [ -89.963490, 48.014643 ], [ -89.954605, 48.011516 ], [ -89.950590, 48.015901 ], [ -89.934489, 48.015628 ], [ -89.932991, 48.013161 ], [ -89.932617, 48.010398 ], [ -89.930745, 48.008160 ], [ -89.921633, 47.999886 ], [ -89.915341, 47.994866 ], [ -89.911258, 47.993267 ], [ -89.904828, 47.992261 ], [ -89.903501, 47.991667 ], [ -89.900237, 47.988765 ], [ -89.897414, 47.987599 ], [ -89.886528, 47.986305 ], [ -89.880710, 47.986405 ], [ -89.873286, 47.985419 ], [ -89.871245, 47.985945 ], [ -89.868153, 47.989898 ], [ -89.847571, 47.992442 ], [ -89.846244, 47.992717 ], [ -89.842709, 47.997422 ], [ -89.842568, 48.001368 ], [ -89.842629, 48.001945 ], [ -89.842629, 48.002391 ], [ -89.842183, 48.002773 ], [ -89.841673, 48.002900 ], [ -89.838689, 48.002214 ], [ -89.834049, 47.999516 ], [ -89.831825, 47.999400 ], [ -89.830385, 48.000284 ], [ -89.822594, 48.010737 ], [ -89.820483, 48.014665 ], [ -89.819802, 48.015099 ], [ -89.807445, 48.017224 ], [ -89.806016, 48.014026 ], [ -89.804926, 48.013775 ], [ -89.797744, 48.014505 ], [ -89.796212, 48.014870 ], [ -89.795224, 48.017154 ], [ -89.794237, 48.017656 ], [ -89.791853, 48.018204 ], [ -89.782696, 48.017837 ], [ -89.779427, 48.018361 ], [ -89.773944, 48.021694 ], [ -89.763967, 48.022969 ], [ -89.749314, 48.023325 ], [ -89.744206, 48.022186 ], [ -89.743046, 48.019971 ], [ -89.742569, 48.019834 ], [ -89.739131, 48.020384 ], [ -89.736851, 48.021321 ], [ -89.731300, 48.019747 ], [ -89.731163, 48.018788 ], [ -89.724048, 48.018996 ], [ -89.723571, 48.019156 ], [ -89.724117, 48.020207 ], [ -89.723164, 48.020481 ], [ -89.722210, 48.020162 ], [ -89.721038, 48.017965 ], [ -89.721569, 48.017499 ], [ -89.723019, 48.017553 ], [ -89.724318, 48.016485 ], [ -89.724044, 48.013675 ], [ -89.721287, 48.014430 ], [ -89.719245, 48.016349 ], [ -89.717102, 48.017172 ], [ -89.716114, 48.016441 ], [ -89.716417, 48.010251 ], [ -89.715906, 48.009246 ], [ -89.713183, 48.010024 ], [ -89.708145, 48.010162 ], [ -89.707090, 48.009522 ], [ -89.706068, 48.007992 ], [ -89.702528, 48.006325 ], [ -89.701438, 48.006211 ], [ -89.688879, 48.010780 ], [ -89.686495, 48.010643 ], [ -89.685986, 48.009798 ], [ -89.684931, 48.009821 ], [ -89.679790, 48.010278 ], [ -89.676896, 48.011237 ], [ -89.673798, 48.011510 ], [ -89.671892, 48.010939 ], [ -89.671620, 48.010162 ], [ -89.669374, 48.008312 ], [ -89.667128, 48.007421 ], [ -89.664813, 48.007900 ], [ -89.663212, 48.010618 ], [ -89.657051, 48.009954 ], [ -89.655793, 48.007532 ], [ -89.653208, 48.004608 ], [ -89.651065, 48.003625 ], [ -89.649057, 48.003853 ], [ -89.647830, 48.005132 ], [ -89.645447, 48.006204 ], [ -89.641465, 48.005906 ], [ -89.639833, 48.003964 ], [ -89.637995, 48.003780 ], [ -89.637280, 48.004100 ], [ -89.637177, 48.004945 ], [ -89.637652, 48.006658 ], [ -89.638774, 48.008166 ], [ -89.637173, 48.009308 ], [ -89.625087, 48.011517 ], [ -89.620454, 48.010740 ], [ -89.617867, 48.010947 ], [ -89.616133, 48.012364 ], [ -89.614161, 48.015495 ], [ -89.611678, 48.017529 ], [ -89.610351, 48.017780 ], [ -89.609396, 48.016684 ], [ -89.608507, 48.012482 ], [ -89.609730, 48.009398 ], [ -89.607821, 48.006566 ], [ -89.601659, 48.004764 ], [ -89.594749, 48.004332 ], [ -89.588996, 48.001821 ], [ -89.586000, 47.999885 ], [ -89.582117, 47.996314 ], [ -89.581007, 47.995899 ], [ -89.570671, 47.998020 ], [ -89.564288, 48.002930 ], [ -89.489226, 48.014528 ], [ -89.491739, 48.005212 ], [ -89.495344, 48.002356 ], [ -89.541521, 47.992841 ], [ -89.551555, 47.987305 ], [ -89.551688, 47.972645 ], [ -89.585372, 47.956147 ], [ -89.588230, 47.966200 ], [ -89.595890, 47.971046 ], [ -89.611412, 47.980731 ], [ -89.624559, 47.983153 ], [ -89.631825, 47.980039 ], [ -89.637015, 47.973465 ], [ -89.640129, 47.967930 ], [ -89.639844, 47.959826 ], [ -89.638285, 47.954275 ], [ -89.639545, 47.953590 ], [ -89.660616, 47.951216 ], [ -89.697619, 47.941288 ], [ -89.729730, 47.925245 ], [ -89.737539, 47.918183 ], [ -89.758714, 47.906993 ], [ -89.793539, 47.891358 ], [ -89.853960, 47.873997 ], [ -89.871580, 47.874194 ], [ -89.923649, 47.862062 ], [ -89.930844, 47.857723 ], [ -89.927520, 47.850825 ], [ -89.933899, 47.846760 ], [ -89.974296, 47.830514 ], [ -90.013730, 47.821373 ], [ -90.042761, 47.817568 ], [ -90.072025, 47.811105 ], [ -90.072241, 47.807727 ], [ -90.075559, 47.803303 ], [ -90.082354, 47.803619 ], [ -90.088160, 47.803041 ], [ -90.116800, 47.795380 ], [ -90.132078, 47.795720 ], [ -90.160790, 47.792807 ], [ -90.178755, 47.786414 ], [ -90.187636, 47.778130 ], [ -90.229145, 47.776198 ], [ -90.248794, 47.772763 ], [ -90.295952, 47.759054 ], [ -90.306340, 47.756627 ], [ -90.313958, 47.756681 ], [ -90.323446, 47.753771 ], [ -90.330254, 47.750892 ], [ -90.332686, 47.746387 ], [ -90.386234, 47.741100 ], [ -90.393823, 47.738271 ], [ -90.421390, 47.735150 ], [ -90.437712, 47.731612 ], [ -90.441912, 47.726404 ], [ -90.458365, 47.721400 ], [ -90.537105, 47.703055 ], [ -90.551291, 47.690266 ], [ -90.584954, 47.680740 ], [ -90.647837, 47.656176 ], [ -90.686382, 47.643594 ], [ -90.735927, 47.624343 ], [ -90.868270, 47.556900 ], [ -90.907494, 47.532873 ], [ -90.910127, 47.530178 ], [ -90.909801, 47.526215 ], [ -90.914247, 47.522639 ], [ -90.919375, 47.519784 ], [ -90.927975, 47.519008 ], [ -90.939072, 47.514532 ], [ -91.023124, 47.464964 ], [ -91.032945, 47.458236 ], [ -91.045646, 47.456525 ], [ -91.077712, 47.428767 ], [ -91.097569, 47.413888 ], [ -91.106218, 47.411806 ], [ -91.128131, 47.399619 ], [ -91.131268, 47.393567 ], [ -91.146958, 47.381464 ], [ -91.156513, 47.378816 ], [ -91.170037, 47.366266 ], [ -91.188772, 47.340082 ], [ -91.206248, 47.329182 ], [ -91.238658, 47.304976 ], [ -91.250163, 47.290490 ], [ -91.262512, 47.279290 ], [ -91.265950, 47.279479 ], [ -91.270697, 47.277134 ], [ -91.288478, 47.265960 ], [ -91.326019, 47.238993 ], [ -91.353850, 47.212686 ], [ -91.357803, 47.206743 ], [ -91.374191, 47.197800 ], [ -91.387021, 47.187293 ], [ -91.398455, 47.183916 ], [ -91.418805, 47.172152 ], [ -91.452031, 47.145158 ], [ -91.456965, 47.139156 ], [ -91.477351, 47.125667 ], [ -91.497902, 47.122579 ], [ -91.506998, 47.118489 ], [ -91.518793, 47.108121 ], [ -91.573817, 47.089917 ], [ -91.591508, 47.068684 ], [ -91.600969, 47.063425 ], [ -91.604949, 47.063309 ], [ -91.613173, 47.059192 ], [ -91.626824, 47.049953 ], [ -91.637164, 47.040429 ], [ -91.644564, 47.026491 ], [ -91.660248, 47.019288 ], [ -91.666477, 47.014297 ], [ -91.704649, 47.005246 ], [ -91.737098, 46.982853 ], [ -91.777300, 46.951799 ], [ -91.780675, 46.945881 ], [ -91.806851, 46.933727 ], [ -91.826068, 46.927199 ], [ -91.834852, 46.927135 ], [ -91.841349, 46.925215 ], [ -91.871286, 46.908352 ], [ -91.883238, 46.905728 ], [ -91.906483, 46.891236 ], [ -91.914984, 46.883836 ], [ -91.952985, 46.867037 ], [ -91.985086, 46.849637 ], [ -91.997987, 46.838737 ], [ -92.013405, 46.833727 ], [ -92.058888, 46.809938 ], [ -92.062088, 46.804038 ], [ -92.086089, 46.794339 ], [ -92.094089, 46.787839 ], [ -92.088289, 46.773639 ], [ -92.064490, 46.745439 ], [ -92.025789, 46.710839 ], [ -92.015290, 46.706469 ], [ -92.020289, 46.704039 ], [ -92.033990, 46.708939 ], [ -92.089490, 46.749240 ], [ -92.108190, 46.749140 ], [ -92.116590, 46.748640 ], [ -92.137890, 46.739540 ], [ -92.143290, 46.734640 ], [ -92.143391, 46.728140 ], [ -92.141291, 46.725240 ], [ -92.146291, 46.715940 ], [ -92.148691, 46.715140 ], [ -92.155191, 46.715940 ], [ -92.167291, 46.719941 ], [ -92.174291, 46.717241 ], [ -92.178891, 46.716741 ], [ -92.189091, 46.717541 ], [ -92.191491, 46.716241 ], [ -92.193291, 46.711241 ], [ -92.197391, 46.707641 ], [ -92.201591, 46.705941 ], [ -92.204691, 46.704041 ], [ -92.205692, 46.702541 ], [ -92.205192, 46.698341 ], [ -92.198491, 46.696141 ], [ -92.183091, 46.695241 ], [ -92.177891, 46.691841 ], [ -92.176491, 46.690241 ], [ -92.176091, 46.686341 ], [ -92.177591, 46.683441 ], [ -92.181391, 46.680241 ], [ -92.187592, 46.678941 ], [ -92.192492, 46.676741 ], [ -92.199492, 46.670241 ], [ -92.204092, 46.666941 ], [ -92.205492, 46.664741 ], [ -92.202192, 46.658941 ], [ -92.201592, 46.656641 ], [ -92.202292, 46.655041 ], [ -92.207092, 46.651941 ], [ -92.212392, 46.649941 ], [ -92.216392, 46.649841 ], [ -92.223492, 46.652641 ], [ -92.228492, 46.652941 ], [ -92.235592, 46.650041 ], [ -92.242493, 46.649241 ], [ -92.256592, 46.658741 ], [ -92.259692, 46.657141 ], [ -92.265993, 46.651041 ], [ -92.270592, 46.650741 ], [ -92.272792, 46.652841 ], [ -92.274392, 46.657441 ], [ -92.278492, 46.658641 ], [ -92.283692, 46.658841 ], [ -92.286192, 46.660342 ], [ -92.287092, 46.662842 ], [ -92.287392, 46.667342 ], [ -92.291292, 46.668142 ], [ -92.292192, 46.666042 ], [ -92.292192, 46.663242 ], [ -92.291597, 46.624941 ], [ -92.291647, 46.604649 ], [ -92.291976, 46.503997 ], [ -92.292371, 46.495585 ], [ -92.292510, 46.478761 ], [ -92.292727, 46.431993 ], [ -92.292847, 46.420876 ], [ -92.292860, 46.417220 ], [ -92.292999, 46.321894 ], [ -92.292782, 46.319312 ], [ -92.292803, 46.314628 ], [ -92.292880, 46.313752 ], [ -92.292839, 46.307107 ], [ -92.292840, 46.304319 ], [ -92.293007, 46.297987 ], [ -92.293074, 46.295129 ], [ -92.293619, 46.244043 ], [ -92.293558, 46.224578 ], [ -92.293857, 46.180073 ], [ -92.293744, 46.166838 ], [ -92.293530, 46.113824 ], [ -92.294069, 46.078346 ], [ -92.294033, 46.074377 ], [ -92.298638, 46.072989 ], [ -92.306756, 46.072410 ], [ -92.319329, 46.069289 ], [ -92.327868, 46.066180 ], [ -92.329806, 46.065216 ], [ -92.332912, 46.062697 ], [ -92.335335, 46.059422 ], [ -92.338239, 46.052149 ], [ -92.338590, 46.050111 ], [ -92.341278, 46.045424 ], [ -92.343459, 46.042990 ], [ -92.343604, 46.040917 ], [ -92.342429, 46.034541 ], [ -92.343745, 46.028525 ], [ -92.344244, 46.027430 ], [ -92.346345, 46.025429 ], [ -92.349281, 46.023624 ], [ -92.350004, 46.021888 ], [ -92.350319, 46.018980 ], [ -92.349977, 46.016982 ], [ -92.351760, 46.015685 ], [ -92.357965, 46.013413 ], [ -92.362141, 46.013103 ], [ -92.372717, 46.014198 ], [ -92.381707, 46.017034 ], [ -92.392681, 46.019540 ], [ -92.408259, 46.026630 ], [ -92.410649, 46.027259 ], [ -92.420696, 46.026769 ], [ -92.428555, 46.024241 ], [ -92.435627, 46.021232 ], [ -92.442259, 46.016177 ], [ -92.444356, 46.011777 ], [ -92.444294, 46.009161 ], [ -92.449630, 46.002252 ], [ -92.451627, 46.000441 ], [ -92.452952, 45.997782 ], [ -92.453635, 45.996171 ], [ -92.453373, 45.992913 ], [ -92.456494, 45.990243 ], [ -92.462477, 45.987850 ], [ -92.464512, 45.985038 ], [ -92.464173, 45.982423 ], [ -92.463429, 45.981507 ], [ -92.461138, 45.980216 ], [ -92.461260, 45.979427 ], [ -92.464481, 45.976267 ], [ -92.469354, 45.973811 ], [ -92.472761, 45.972952 ], [ -92.479478, 45.973992 ], [ -92.484633, 45.975872 ], [ -92.490996, 45.975560 ], [ -92.502535, 45.979995 ], [ -92.519488, 45.983917 ], [ -92.522032, 45.984203 ], [ -92.527052, 45.983245 ], [ -92.530516, 45.981918 ], [ -92.537709, 45.977818 ], [ -92.545682, 45.970118 ], [ -92.548459, 45.969056 ], [ -92.549806, 45.967986 ], [ -92.550672, 45.960759 ], [ -92.549858, 45.957039 ], [ -92.551186, 45.952240 ], [ -92.551933, 45.951651 ], [ -92.561256, 45.951006 ], [ -92.569764, 45.948146 ], [ -92.574892, 45.948103 ], [ -92.580565, 45.946250 ], [ -92.590138, 45.941773 ], [ -92.602460, 45.940815 ], [ -92.608329, 45.938112 ], [ -92.614314, 45.934529 ], [ -92.622720, 45.935186 ], [ -92.627723, 45.932682 ], [ -92.629260, 45.932404 ], [ -92.636316, 45.934634 ], [ -92.638824, 45.934166 ], [ -92.639936, 45.933541 ], [ -92.640115, 45.932478 ], [ -92.638474, 45.925971 ], [ -92.639116, 45.924555 ], [ -92.656125, 45.924442 ], [ -92.659549, 45.922937 ], [ -92.670352, 45.916247 ], [ -92.676167, 45.912072 ], [ -92.676807, 45.910930 ], [ -92.675737, 45.907478 ], [ -92.676607, 45.906370 ], [ -92.683924, 45.903939 ], [ -92.698983, 45.896451 ], [ -92.703265, 45.896155 ], [ -92.707702, 45.894901 ], [ -92.712503, 45.891705 ], [ -92.721128, 45.883805 ], [ -92.734039, 45.868108 ], [ -92.736484, 45.863356 ], [ -92.736117, 45.859129 ], [ -92.739278, 45.847580 ], [ -92.739991, 45.846283 ], [ -92.745557, 45.841455 ], [ -92.749180, 45.840717 ], [ -92.759458, 45.835341 ], [ -92.761712, 45.833861 ], [ -92.765146, 45.830183 ], [ -92.765681, 45.827252 ], [ -92.764906, 45.824859 ], [ -92.761889, 45.817928 ], [ -92.760023, 45.815475 ], [ -92.757947, 45.811216 ], [ -92.757815, 45.806574 ], [ -92.759010, 45.803965 ], [ -92.761833, 45.801258 ], [ -92.768430, 45.798010 ], [ -92.772065, 45.795230 ], [ -92.776496, 45.790014 ], [ -92.779617, 45.782563 ], [ -92.781373, 45.773062 ], [ -92.784621, 45.764196 ], [ -92.798645, 45.753654 ], [ -92.802630, 45.751888 ], [ -92.803971, 45.749805 ], [ -92.805348, 45.747493 ], [ -92.809837, 45.744172 ], [ -92.812939, 45.742709 ], [ -92.816559, 45.742037 ], [ -92.826013, 45.736650 ], [ -92.828981, 45.733714 ], [ -92.830685, 45.733120 ], [ -92.835917, 45.732802 ], [ -92.841051, 45.730024 ], [ -92.843079, 45.729163 ], [ -92.848851, 45.728751 ], [ -92.850388, 45.727576 ], [ -92.850537, 45.724376 ], [ -92.850933, 45.723831 ], [ -92.853405, 45.723152 ], [ -92.862598, 45.722241 ], [ -92.865688, 45.720623 ], [ -92.869193, 45.717568 ], [ -92.869689, 45.715142 ], [ -92.868862, 45.711993 ], [ -92.871775, 45.699774 ], [ -92.870025, 45.697272 ], [ -92.870145, 45.696757 ], [ -92.875488, 45.689014 ], [ -92.876891, 45.675289 ], [ -92.878932, 45.665606 ], [ -92.882504, 45.659471 ], [ -92.883987, 45.654870 ], [ -92.885711, 45.646017 ], [ -92.887067, 45.644148 ], [ -92.887929, 45.639006 ], [ -92.886963, 45.636777 ], [ -92.886827, 45.633403 ], [ -92.888114, 45.628377 ], [ -92.888035, 45.624959 ], [ -92.886669, 45.619760 ], [ -92.882970, 45.613738 ], [ -92.882529, 45.610216 ], [ -92.884900, 45.605001 ], [ -92.886442, 45.598679 ], [ -92.886421, 45.594881 ], [ -92.883277, 45.589831 ], [ -92.884954, 45.578818 ], [ -92.883749, 45.575483 ], [ -92.881136, 45.573409 ], [ -92.871082, 45.567581 ], [ -92.846447, 45.566515 ], [ -92.843783, 45.566135 ], [ -92.834156, 45.563096 ], [ -92.823309, 45.560934 ], [ -92.812083, 45.561122 ], [ -92.801503, 45.562854 ], [ -92.790143, 45.566915 ], [ -92.785741, 45.567888 ], [ -92.775988, 45.568478 ], [ -92.773412, 45.568235 ], [ -92.770223, 45.566939 ], [ -92.764574, 45.563592 ], [ -92.756906, 45.557499 ], [ -92.745591, 45.553016 ], [ -92.726082, 45.541112 ], [ -92.724762, 45.538617 ], [ -92.724650, 45.536744 ], [ -92.728023, 45.525652 ], [ -92.727744, 45.518811 ], [ -92.726677, 45.514462 ], [ -92.724337, 45.512223 ], [ -92.715814, 45.506676 ], [ -92.711890, 45.503281 ], [ -92.702224, 45.493046 ], [ -92.695212, 45.482882 ], [ -92.691619, 45.476273 ], [ -92.686793, 45.472271 ], [ -92.680234, 45.464344 ], [ -92.677219, 45.462864 ], [ -92.661131, 45.458278 ], [ -92.653549, 45.455346 ], [ -92.652698, 45.454527 ], [ -92.646602, 45.441635 ], [ -92.646768, 45.437929 ], [ -92.649152, 45.429618 ], [ -92.650269, 45.419168 ], [ -92.649467, 45.416408 ], [ -92.646943, 45.414265 ], [ -92.646676, 45.413227 ], [ -92.648157, 45.407423 ], [ -92.650570, 45.403308 ], [ -92.650422, 45.398507 ], [ -92.658486, 45.396058 ], [ -92.664102, 45.393309 ], [ -92.669505, 45.389111 ], [ -92.676961, 45.380137 ], [ -92.678756, 45.376201 ], [ -92.678223, 45.373604 ], [ -92.679193, 45.372710 ], [ -92.696499, 45.363529 ], [ -92.702720, 45.358472 ], [ -92.703705, 45.356330 ], [ -92.704054, 45.353660 ], [ -92.699524, 45.342421 ], [ -92.698920, 45.339364 ], [ -92.698967, 45.336374 ], [ -92.699956, 45.333716 ], [ -92.704794, 45.326526 ], [ -92.709968, 45.321302 ], [ -92.727737, 45.309288 ], [ -92.732594, 45.304224 ], [ -92.737122, 45.300459 ], [ -92.750819, 45.292980 ], [ -92.758710, 45.290965 ], [ -92.761013, 45.289028 ], [ -92.761868, 45.287013 ], [ -92.761868, 45.284938 ], [ -92.760615, 45.278827 ], [ -92.758022, 45.274822 ], [ -92.752666, 45.269565 ], [ -92.751659, 45.265910 ], [ -92.751709, 45.261666 ], [ -92.755199, 45.256733 ], [ -92.758907, 45.253407 ], [ -92.760249, 45.249600 ], [ -92.757503, 45.238308 ], [ -92.757456, 45.230526 ], [ -92.755732, 45.225949 ], [ -92.753931, 45.222905 ], [ -92.752192, 45.221051 ], [ -92.751708, 45.218666 ], [ -92.754008, 45.212766 ], [ -92.758008, 45.209566 ], [ -92.762108, 45.207166 ], [ -92.763908, 45.204866 ], [ -92.766932, 45.195111 ], [ -92.767408, 45.190166 ], [ -92.766808, 45.185466 ], [ -92.764872, 45.182812 ], [ -92.752404, 45.173916 ], [ -92.752542, 45.171772 ], [ -92.756907, 45.165166 ], [ -92.757775, 45.160519 ], [ -92.757707, 45.155466 ], [ -92.756807, 45.151866 ], [ -92.749427, 45.138117 ], [ -92.745694, 45.123112 ], [ -92.742925, 45.119918 ], [ -92.740611, 45.118454 ], [ -92.739528, 45.116515 ], [ -92.739584, 45.115598 ], [ -92.740509, 45.113396 ], [ -92.744938, 45.108309 ], [ -92.746749, 45.107051 ], [ -92.754387, 45.103146 ], [ -92.765602, 45.095730 ], [ -92.774010, 45.089138 ], [ -92.791528, 45.079647 ], [ -92.800851, 45.069477 ], [ -92.802163, 45.067555 ], [ -92.802911, 45.065403 ], [ -92.803079, 45.060978 ], [ -92.802056, 45.057423 ], [ -92.797081, 45.050648 ], [ -92.793282, 45.047178 ], [ -92.787910, 45.043516 ], [ -92.778815, 45.039327 ], [ -92.770362, 45.033803 ], [ -92.764604, 45.028767 ], [ -92.762060, 45.024320 ], [ -92.761904, 45.022467 ], [ -92.762533, 45.020551 ], [ -92.768118, 45.009115 ], [ -92.771231, 45.001378 ], [ -92.770834, 44.994131 ], [ -92.769049, 44.988195 ], [ -92.770346, 44.983327 ], [ -92.770304, 44.978967 ], [ -92.769445, 44.972150 ], [ -92.768545, 44.969839 ], [ -92.767218, 44.968084 ], [ -92.760701, 44.964979 ], [ -92.754603, 44.955767 ], [ -92.750802, 44.941567 ], [ -92.750645, 44.937299 ], [ -92.757557, 44.911214 ], [ -92.758701, 44.908979 ], [ -92.759556, 44.907857 ], [ -92.761341, 44.906904 ], [ -92.773103, 44.901367 ], [ -92.774022, 44.900083 ], [ -92.774571, 44.898084 ], [ -92.774907, 44.892797 ], [ -92.773946, 44.889997 ], [ -92.769603, 44.882967 ], [ -92.764133, 44.875905 ], [ -92.763402, 44.874167 ], [ -92.763706, 44.872129 ], [ -92.767102, 44.866767 ], [ -92.769102, 44.862167 ], [ -92.768574, 44.854368 ], [ -92.765278, 44.841070 ], [ -92.765278, 44.837186 ], [ -92.766102, 44.834966 ], [ -92.769367, 44.831800 ], [ -92.772266, 44.828046 ], [ -92.772663, 44.826337 ], [ -92.771902, 44.823067 ], [ -92.772663, 44.821424 ], [ -92.780430, 44.812589 ], [ -92.781498, 44.809408 ], [ -92.782963, 44.798131 ], [ -92.785206, 44.792303 ], [ -92.788776, 44.787794 ], [ -92.796039, 44.782056 ], [ -92.800313, 44.777379 ], [ -92.805287, 44.768361 ], [ -92.807362, 44.758909 ], [ -92.807988, 44.751470 ], [ -92.807317, 44.750364 ], [ -92.804035, 44.748433 ], [ -92.802875, 44.746847 ], [ -92.802402, 44.745167 ], [ -92.787906, 44.737432 ], [ -92.766054, 44.729604 ], [ -92.756990, 44.723829 ], [ -92.754200, 44.722767 ], [ -92.750200, 44.722120 ], [ -92.737259, 44.717155 ], [ -92.713198, 44.701085 ], [ -92.700948, 44.693751 ], [ -92.696491, 44.689436 ], [ -92.686511, 44.682096 ], [ -92.664699, 44.663380 ], [ -92.660988, 44.660884 ], [ -92.655807, 44.658040 ], [ -92.632105, 44.649027 ], [ -92.621733, 44.638983 ], [ -92.619779, 44.634195 ], [ -92.619774, 44.629214 ], [ -92.622571, 44.623518 ], [ -92.623348, 44.620713 ], [ -92.623163, 44.618224 ], [ -92.621456, 44.615017 ], [ -92.618025, 44.612870 ], [ -92.614569, 44.611730 ], [ -92.607141, 44.612433 ], [ -92.601516, 44.612052 ], [ -92.590467, 44.605936 ], [ -92.588797, 44.601698 ], [ -92.586216, 44.600088 ], [ -92.584711, 44.599861 ], [ -92.581591, 44.600863 ], [ -92.578850, 44.603939 ], [ -92.577148, 44.605054 ], [ -92.572943, 44.604649 ], [ -92.569434, 44.603539 ], [ -92.567226, 44.601770 ], [ -92.560796, 44.594956 ], [ -92.549777, 44.581130 ], [ -92.549280, 44.577704 ], [ -92.549685, 44.576000 ], [ -92.551182, 44.573449 ], [ -92.551510, 44.571607 ], [ -92.549957, 44.568988 ], [ -92.548060, 44.567792 ], [ -92.544346, 44.566986 ], [ -92.540551, 44.567258 ], [ -92.527337, 44.573554 ], [ -92.520878, 44.575200 ], [ -92.518358, 44.575183 ], [ -92.512564, 44.571801 ], [ -92.508759, 44.570325 ], [ -92.493808, 44.566063 ], [ -92.490472, 44.566205 ], [ -92.484740, 44.568067 ], [ -92.481001, 44.568276 ], [ -92.470209, 44.565036 ], [ -92.455105, 44.561886 ], [ -92.440745, 44.562833 ], [ -92.433256, 44.565500 ], [ -92.431101, 44.565786 ], [ -92.425774, 44.564602 ], [ -92.420702, 44.562041 ], [ -92.415089, 44.560359 ], [ -92.399281, 44.558292 ], [ -92.389040, 44.557697 ], [ -92.368298, 44.559182 ], [ -92.361518, 44.558935 ], [ -92.347567, 44.557149 ], [ -92.336114, 44.554004 ], [ -92.329013, 44.550895 ], [ -92.319938, 44.544940 ], [ -92.317357, 44.542512 ], [ -92.314071, 44.538014 ], [ -92.310827, 44.528756 ], [ -92.307957, 44.524475 ], [ -92.303527, 44.519822 ], [ -92.303046, 44.518646 ], [ -92.302466, 44.516487 ], [ -92.302961, 44.503601 ], [ -92.302215, 44.500298 ], [ -92.297122, 44.492732 ], [ -92.291005, 44.485464 ], [ -92.282364, 44.477707 ], [ -92.276784, 44.473649 ], [ -92.262476, 44.465149 ], [ -92.249071, 44.459524 ], [ -92.244884, 44.456842 ], [ -92.242010, 44.454254 ], [ -92.237325, 44.449417 ], [ -92.232472, 44.445434 ], [ -92.221083, 44.440386 ], [ -92.215163, 44.438503 ], [ -92.195378, 44.433792 ], [ -92.170280, 44.428598 ], [ -92.162454, 44.427208 ], [ -92.139569, 44.424673 ], [ -92.124513, 44.422115 ], [ -92.121106, 44.420572 ], [ -92.115296, 44.416056 ], [ -92.111085, 44.413948 ], [ -92.097415, 44.411464 ], [ -92.087241, 44.408848 ], [ -92.078605, 44.404869 ], [ -92.072267, 44.404017 ], [ -92.061637, 44.404124 ], [ -92.056486, 44.402729 ], [ -92.053549, 44.401375 ], [ -92.046285, 44.394398 ], [ -92.038147, 44.388731 ], [ -92.019313, 44.381217 ], [ -92.008589, 44.379626 ], [ -92.006179, 44.378825 ], [ -92.002838, 44.377118 ], [ -92.000165, 44.374966 ], [ -91.993984, 44.371800 ], [ -91.987289, 44.369119 ], [ -91.983974, 44.368448 ], [ -91.978574, 44.368372 ], [ -91.974922, 44.367516 ], [ -91.970266, 44.365842 ], [ -91.963600, 44.362112 ], [ -91.959523, 44.359404 ], [ -91.952820, 44.352982 ], [ -91.949599, 44.348796 ], [ -91.941311, 44.340978 ], [ -91.928224, 44.335473 ], [ -91.925590, 44.333548 ], [ -91.918625, 44.322671 ], [ -91.916191, 44.318094 ], [ -91.913534, 44.311392 ], [ -91.913574, 44.310392 ], [ -91.914360, 44.308230 ], [ -91.921028, 44.301069 ], [ -91.924102, 44.297095 ], [ -91.924975, 44.294819 ], [ -91.924613, 44.291815 ], [ -91.922205, 44.287811 ], [ -91.920282, 44.286496 ], [ -91.905789, 44.281614 ], [ -91.898697, 44.277172 ], [ -91.896388, 44.274690 ], [ -91.895652, 44.273008 ], [ -91.896760, 44.265447 ], [ -91.896008, 44.262871 ], [ -91.889132, 44.256060 ], [ -91.887824, 44.254171 ], [ -91.887040, 44.251772 ], [ -91.887905, 44.246398 ], [ -91.892963, 44.235149 ], [ -91.892698, 44.231105 ], [ -91.889790, 44.226286 ], [ -91.880265, 44.216555 ], [ -91.877429, 44.212921 ], [ -91.876356, 44.209575 ], [ -91.876056, 44.202728 ], [ -91.875158, 44.200575 ], [ -91.872369, 44.199167 ], [ -91.864387, 44.196574 ], [ -91.844754, 44.184878 ], [ -91.832479, 44.180308 ], [ -91.829167, 44.178350 ], [ -91.817302, 44.164235 ], [ -91.808064, 44.159262 ], [ -91.796669, 44.154335 ], [ -91.774486, 44.147539 ], [ -91.768574, 44.143508 ], [ -91.756719, 44.136804 ], [ -91.751747, 44.134786 ], [ -91.730648, 44.132900 ], [ -91.721552, 44.130342 ], [ -91.719097, 44.128853 ], [ -91.710597, 44.120480 ], [ -91.709476, 44.117565 ], [ -91.708082, 44.110929 ], [ -91.708207, 44.105186 ], [ -91.707491, 44.103906 ], [ -91.695310, 44.098570 ], [ -91.691281, 44.097858 ], [ -91.685748, 44.098419 ], [ -91.681530, 44.097400 ], [ -91.667006, 44.086964 ], [ -91.665263, 44.085041 ], [ -91.663442, 44.080910 ], [ -91.659511, 44.074203 ], [ -91.657000, 44.071409 ], [ -91.652247, 44.068634 ], [ -91.647873, 44.064109 ], [ -91.644717, 44.062782 ], [ -91.643400, 44.062711 ], [ -91.640535, 44.063679 ], [ -91.638115, 44.063285 ], [ -91.633365, 44.060364 ], [ -91.627900, 44.055807 ], [ -91.623784, 44.054106 ], [ -91.615375, 44.051598 ], [ -91.610487, 44.049310 ], [ -91.607339, 44.047357 ], [ -91.603550, 44.043681 ], [ -91.597617, 44.034965 ], [ -91.592070, 44.031372 ], [ -91.582604, 44.027381 ], [ -91.580019, 44.026925 ], [ -91.573283, 44.026901 ], [ -91.559004, 44.025315 ], [ -91.547028, 44.022226 ], [ -91.533778, 44.021433 ], [ -91.524315, 44.021433 ], [ -91.507121, 44.018980 ], [ -91.502163, 44.016856 ], [ -91.494988, 44.012536 ], [ -91.480870, 44.008145 ], [ -91.478498, 44.008030 ], [ -91.468472, 44.009480 ], [ -91.463515, 44.009041 ], [ -91.457378, 44.006301 ], [ -91.440536, 44.001501 ], [ -91.437380, 43.999962 ], [ -91.432522, 43.996827 ], [ -91.429878, 43.993888 ], [ -91.426720, 43.988500 ], [ -91.425681, 43.985113 ], [ -91.424134, 43.982631 ], [ -91.412491, 43.973411 ], [ -91.410555, 43.970892 ], [ -91.407395, 43.965148 ], [ -91.406011, 43.963929 ], [ -91.395086, 43.959409 ], [ -91.385785, 43.954239 ], [ -91.375142, 43.944289 ], [ -91.366642, 43.937463 ], [ -91.364736, 43.934884 ], [ -91.363242, 43.926563 ], [ -91.357426, 43.917231 ], [ -91.356741, 43.916564 ], [ -91.351688, 43.914545 ], [ -91.347741, 43.911964 ], [ -91.346271, 43.910074 ], [ -91.342335, 43.902697 ], [ -91.338141, 43.897664 ], [ -91.328143, 43.893435 ], [ -91.320605, 43.888491 ], [ -91.315310, 43.881808 ], [ -91.313037, 43.875757 ], [ -91.310991, 43.867381 ], [ -91.301302, 43.859515 ], [ -91.298815, 43.856555 ], [ -91.296739, 43.855165 ], [ -91.291002, 43.852733 ], [ -91.284138, 43.847065 ], [ -91.281968, 43.842738 ], [ -91.277695, 43.837741 ], [ -91.275737, 43.824866 ], [ -91.273037, 43.818566 ], [ -91.272037, 43.813766 ], [ -91.267436, 43.804166 ], [ -91.264436, 43.800366 ], [ -91.262436, 43.792166 ], [ -91.244135, 43.774667 ], [ -91.243955, 43.773046 ], [ -91.255431, 43.744876 ], [ -91.254903, 43.733533 ], [ -91.255932, 43.729849 ], [ -91.258756, 43.723426 ], [ -91.261316, 43.719490 ], [ -91.266538, 43.713947 ], [ -91.268455, 43.709824 ], [ -91.267792, 43.695652 ], [ -91.272741, 43.676609 ], [ -91.273252, 43.666623 ], [ -91.271749, 43.654929 ], [ -91.270767, 43.653080 ], [ -91.265051, 43.649141 ], [ -91.263856, 43.647662 ], [ -91.262397, 43.641760 ], [ -91.263178, 43.638203 ], [ -91.268457, 43.627352 ], [ -91.268748, 43.615348 ], [ -91.265091, 43.609977 ], [ -91.261631, 43.606175 ], [ -91.258267, 43.603484 ], [ -91.252926, 43.600363 ], [ -91.239109, 43.589760 ], [ -91.234499, 43.585529 ], [ -91.232707, 43.583533 ], [ -91.231865, 43.581822 ], [ -91.231490, 43.575595 ], [ -91.232812, 43.564842 ], [ -91.234432, 43.561781 ], [ -91.240649, 43.554995 ], [ -91.243214, 43.550722 ], [ -91.243820, 43.549130 ], [ -91.244093, 43.545620 ], [ -91.243183, 43.540309 ], [ -91.236725, 43.532930 ], [ -91.232941, 43.523967 ], [ -91.230027, 43.521595 ], [ -91.222613, 43.517892 ], [ -91.218292, 43.514434 ], [ -91.217353, 43.512474 ], [ -91.217876, 43.508104 ], [ -91.217706, 43.500550 ], [ -91.246715, 43.500488 ], [ -91.261781, 43.500993 ], [ -91.369325, 43.500827 ], [ -91.371608, 43.500945 ] ] ] } }];
    this.minnesota = L.geoJson(minnesota_bounds, {
      style: {
        color: '#52A4FF',
        fillColor: '#52A4FF',
        fillOpacity: 0.16
      }
    })
  };

  return App;
}());
my_app = new App();

//Funciton to center the map to the initial load position
function goToCenter () {
  my_app.map.setView([46.22545288226939,-94.010009765625], 7);
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

//Code that adds the legend to the map and fills it with the correct information
var legend = L.control({position: 'bottomright'});
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'info legend');
  div.innerHTML += '<img src="images/radar.svg" height="18" width="18" style="margin-right:6px">Precipitation Intensity:<br>';
  div.innerHTML += '<i style="background:#D1FFFF"></i><i style="background:#97E8FF"></i><i style="background:#6EB7FF"></i><i style="background:#66A2DE"></i><br>';
  div.innerHTML += 'None<i class="icon ion-arrow-right-c" style="width:5px;float:none;margin-left:8px;margin-right:8px"></i>Light<i class="icon ion-arrow-right-c" style="width:5px;float:none;margin-left:8px;margin-right:8px"></i>Steady<i class="icon ion-arrow-right-c" style="width:5px;float:none;margin-left:8px;margin-right:8px"></i>Severe<br><br>';
  div.innerHTML += '<img src="images/radar.svg" height="18" width="18" style="margin-right:6px">Surface Status:<br>';
  div.innerHTML += '<i style="background:#FFEDC2"></i><i style="background:#FFC0A2"></i><i style="background:#FF7E83"></i><i style="background:#E8666B"></i><br>';
  div.innerHTML += 'Dry<i class="icon ion-arrow-right-c" style="width:5px;float:none;margin-left:12px;margin-right:15px"></i>Damp<i class="icon ion-arrow-right-c" style="width:5px;float:none;margin-left:12px;margin-right:15px"></i>Wet<i class="icon ion-arrow-right-c" style="width:5px;float:none;margin-left:12px;margin-right:15px"></i>Icy<br><br>';
  div.innerHTML += '<img src="../img/snowplow.png" height="18" width="18" style="margin-right:10px">Road Condition Markers:<br>';
  div.innerHTML += '<div class="extra-marker-circle-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-checkmark icon-white" style="float:none"></i><br><br>Dry</div>';
  div.innerHTML += '<div class="extra-marker-circle-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-waterdrop icon-white" style="float:none"></i><br><br>Wet</div>';
  div.innerHTML += '<div class="extra-marker-circle-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-ios-snowy icon-white" style="float:none"></i><br><br>Snow</div>';
  div.innerHTML += '<div class="extra-marker-circle-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-alert-circled icon-white" style="float:none"></i><br><br>Icy</div><br><br><br><br>';
  div.innerHTML += '<img src="../img/snowplow.png" height="18" width="18" style="margin-right:10px">Road Temperature Markers:<br>';
  div.innerHTML += '<div class="extra-marker-square-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-ios-sunny icon-white" style="float:none"></i><br><br><p style="margin:0px;width:50px;text-align:left">60-80&deg;F</p></div>';
  div.innerHTML += '<div class="extra-marker-square-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-ios-partlysunny icon-white" style="float:none"></i><br><br><p style="margin:0px;width:50px;text-align:left">32-60&deg;F</p></div>';
  div.innerHTML += '<div class="extra-marker-square-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-cloud icon-white" style="float:none"></i><br><br><p style="margin:0px;width:50px;text-align:left">0-32&deg;F</p></div>';
  div.innerHTML += '<div class="extra-marker-square-black extra-marker" style="position:static;float:left;margin-right:15px"><i class="icon ion-ios-snowy icon-white" style="float:none"></i><br><br>&lt;0&deg;F</p></div><br><br><br><br>';
  div.style.visibility = "visible";
  return div;
}
legend.addTo(my_app.map);

/* Attempting to use leaflet-timedimension controls to build
 * my own custom controls... Do not want the built in options
 * that leaflet-timedimension has, but do want the styling of
 * the control */
 /*
 * L.Control.TimeDimension: Leaflet control to manage a timeDimension
 */
L.UI = L.ui = L.UI || {};
L.UI.Knob = L.Draggable.extend({
    options: {
        className: 'knob',
        step: 1,
        rangeMin: 0,
        rangeMax: 10
            //minValue : null,
            //maxValue : null
    },
    initialize: function(slider, options) {
        L.setOptions(this, options);
        this._element = L.DomUtil.create('div', this.options.className || 'knob', slider);
        L.Draggable.prototype.initialize.call(this, this._element, this._element);
        this._container = slider;
        this.on('predrag', function() {
            this._newPos.y = 0;
            this._newPos.x = this._adjustX(this._newPos.x);
        }, this);
        this.on('dragstart', function() {
            L.DomUtil.addClass(slider, 'dragging');
        });
        this.on('dragend', function() {
            L.DomUtil.removeClass(slider, 'dragging');
        });
        L.DomEvent.on(this._element, 'dblclick', function(e) {
            this.fire('dblclick', e);
        }, this);
        L.DomEvent.disableClickPropagation(this._element);
        this.enable();
    },

    _getProjectionCoef: function() {
        return (this.options.rangeMax - this.options.rangeMin) / (this._container.offsetWidth || this._container.style.width);
    },
    _update: function() {
        this.setPosition(L.DomUtil.getPosition(this._element).x);
    },
    _adjustX: function(x) {
        var value = this._toValue(x) || this.getMinValue();
        return this._toX(this._adjustValue(value));
    },

    _adjustValue: function(value) {
        value = Math.max(this.getMinValue(), Math.min(this.getMaxValue(), value)); //clamp value
        value = value - this.options.rangeMin; //offsets to zero

        //snap the value to the closet step
        value = Math.round(value / this.options.step) * this.options.step;
        value = value + this.options.rangeMin; //restore offset
        value = Math.round(value * 100) / 100; // *100/100 to avoid floating point precision problems

        return value;
    },

    _toX: function(value) {
        var x = (value - this.options.rangeMin) / this._getProjectionCoef();
        //
        return x;
    },

    _toValue: function(x) {
        var v = x * this._getProjectionCoef() + this.options.rangeMin;
        //
        return v;
    },

    getMinValue: function() {
        return this.options.minValue || this.options.rangeMin;
    },
    getMaxValue: function() {
        return this.options.maxValue || this.options.rangeMax;
    },

    setStep: function(step) {
        this.options.step = step;
        this._update();
    },

    setPosition: function(x) {
        L.DomUtil.setPosition(this._element,
            L.point(this._adjustX(x), 0));
        this.fire('positionchanged');
    },
    getPosition: function() {
        return L.DomUtil.getPosition(this._element).x;
    },

    setValue: function(v) {
        //
        this.setPosition(this._toX(v));
    },

    getValue: function() {
        return this._adjustValue(this._toValue(this.getPosition()));
    }
});

var play_interrupt_flag = false;
L.Control.TimeDimensionCustom = L.Control.extend({
  options: {
    styleNS: 'leaflet-control-timecontrol',
    position: 'bottomleft',
    title: 'Time Control',
  },

  //When added to map create buttons to control time and put them into leaflet-timedimension css containers
  onAdd: function(map) {
    var container;
    this._map = map;
    
    container = L.DomUtil.create('div', 'leaflet-bar leaflet-bar-horizontal leaflet-bar-timecontrol');
    this._buttonBackward = this._createBackButton('Backward', container);
    this._buttonPlayPause = this._createPlayButton('Play', container);
    this._buttonForward = this._createForwardButton('Forward', container);    
    this._displayDate = this._createDisplayDate(this.options.styleNS + ' timecontrol-date', container);
    this._sliderTime = this._createSliderTime(this.options.styleNS + ' timecontrol-slider timecontrol-dateslider', container);
    this._buttonSpeed = this._createSpeedButton('Speed', container);
    this._dropDownMetric = this._createDropDown('Metric', document.getElementsByClassName('leaflet-control-layers-list')[0]);
    L.DomEvent.disableClickPropagation(container);

    return container;
  },

  addTo: function() {
    L.Control.prototype.addTo.apply(this, arguments);
    return this;
  },

  //Creates play button
  _createPlayButton: function(title, container) {
    var link = L.DomUtil.create('a', this.options.styleNS + ' timecontrol-' + title.toLowerCase() + ' ion-play', container);
    link.title = title;

    L.DomEvent
      .addListener(link, 'click', L.DomEvent.stopPropagation)
      .addListener(link, 'click', L.DomEvent.preventDefault)
      .addListener(link, 'click', this["_buttonPlayClicked"], this);

    return link;
  },

  _createBackButton: function(title, container) {
    var link = L.DomUtil.create('a', this.options.styleNS + ' timecontrol-' + title.toLowerCase() + ' ion-skip-backward', container);
    link.title = title;

    L.DomEvent
      .addListener(link, 'click', L.DomEvent.stopPropagation)
      .addListener(link, 'click', L.DomEvent.preventDefault)
      .addListener(link, 'click', this["_buttonBackwardClicked"], this);

    return link;
  },

  _createForwardButton: function(title, container) {
    var link = L.DomUtil.create('a', this.options.styleNS + ' timecontrol-' + title.toLowerCase() + ' ion-skip-forward', container);
    link.title = title;

    L.DomEvent
      .addListener(link, 'click', L.DomEvent.stopPropagation)
      .addListener(link, 'click', L.DomEvent.preventDefault)
      .addListener(link, 'click', this['_buttonForwardClicked'], this);

    return link;
  },

  //Creates date-time slot
  _createDisplayDate: function(className, container) {
    var link = L.DomUtil.create('a', className + ' time', container);
    link.title = 'Time';
    link.id = 'timecontrol-timestamp-text';

    return link;
  },

  //Creates slider for changing time
  _createSliderTime: function(className, container) {
    var sliderContainer,
      sliderbar,
      max,
      knob, limits;
    sliderContainer = L.DomUtil.create('div', className, container);

    /* Find all the available times and be able to set each slider interval to one
     * of the possible animation times */
    var availableTimes = [];
    var start_time = moment('2014-02-19 00:00');
    var end_time = moment('2014-02-23 00:00');
    var tempMoment = new moment(start_time);
    for (var i = 0; i < (moment.duration(end_time.diff(start_time)).asMinutes() / 10); i++){
      availableTimes.push(tempMoment);
      tempMoment = new moment(tempMoment).add(10, 'minutes');    }
    availableTimes.push(tempMoment);

    sliderbar = L.DomUtil.create('div', 'slider', sliderContainer);
    max = availableTimes.length - 1;
    this._displayDate.innerHTML = moment(availableTimes[0]).format('h:mm a MMM Do, YYYY');

    //Create the magic knob
    knob = new L.UI.Knob(sliderbar, {
      className: 'knob main',
      rangeMin: 0,
      rangeMax: max,
      curPosition: 0
    });
    //Control what happens when knob is dropped
    knob.on('dragend', function(e) {
      var x = e.target.getValue();
      //Stop from dragging right onto end where it loops because it is confusing
      if (x > 575) x = 575;
      var timestamp = availableTimes[x]
      //Enable the other timecontrol options... Resume play if it was already active
      if (play_interrupt_flag) {
        this._buttonPlayPause.className = this._buttonPlayPause.className.substring(0, this._buttonPlayPause.className.lastIndexOf(' '));
        this._buttonPlayClicked();
        this._buttonPlayPause.className += ' disabled';
        play_interrupt_flag = false;
      }
      L.DomEvent
        .addListener(this._buttonBackward, 'click', this['_buttonBackwardClicked'], this)
        .addListener(this._buttonForward, 'click', this['_buttonForwardClicked'], this);
      this._buttonBackward.className = this._buttonBackward.className.substring(0, this._buttonBackward.className.lastIndexOf(' '));
      this._buttonForward.className = this._buttonForward.className.substring(0, this._buttonForward.className.lastIndexOf(' '));   
      this._buttonPlayPause.className = this._buttonPlayPause.className.substring(0, this._buttonPlayPause.className.lastIndexOf(' '));
      
      //Handle the change in slider value
      this._sliderTimeValueChanged(timestamp, x);
    }, this);
    //Control what happens as knob is held and moved
    knob.on('drag', function(e) {
      //Stop from showing last timestamp (loop time) to not confuse users as to why
      //they cant drop the cursor there.
      x = e.target.getValue();
      if (x > 575) x = 575;
      var time = availableTimes[x];

      //Continuously refresh the view to see what is at the time held
      this._knobHeld(time);
      this._displayDate.innerHTML = time.format('h:mm a MMM Do, YYYY');
    }, this);
    //Disable the other controls on dragstart
    knob.on('dragstart', function(e) {
      //If playing... pause first (will restart playing on dragend)
      if (isRunning) {
        this._buttonPlayClicked();
        play_interrupt_flag = true;
      }
      L.DomEvent
        .removeListener(this._buttonBackward, 'click', this['_buttonBackwardClicked'])
        .removeListener(this._buttonForward, 'click', this['_buttonForwardClicked']);
        this._buttonBackward.className = this._buttonBackward.className+=' disabled';
        this._buttonForward.className = this._buttonForward.className+=' disabled';
        this._buttonPlayPause.className = this._buttonPlayPause.className+=' disabled';
    }, this);
    //Control what happens when slider is clicked w/o knob (move to that time)
    L.DomEvent.on(sliderbar, 'click', function(e) {
      if (e.target === knob._element) {
          return; //prevent value changes on drag release
        }
      //Stop from clicking right onto end where it loops because it is confusing
      var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
        x = Math.floor(L.DomEvent.getMousePosition(first, sliderbar).x);
      if (x > 575) x = 575;
      knob.curPosition = x;
      knob.setPosition(x);
      this._sliderTimeValueChanged(availableTimes[x], x);
    }, this);
    knob.setPosition(0);

    return knob;
  },

  //Buton that creates the speed control button
  _createSpeedButton: function (title, container) {
    var link = L.DomUtil.create('a', this.options.styleNS + ' timecontrol-' + title.toLowerCase() + ' ion-ios-speedometer-outline', container);
    link.title = 'Speed Control';

    L.DomEvent
      .addListener(link, 'click', L.DomEvent.stopPropagation)
      .addListener(link, 'click', L.DomEvent.preventDefault)
      .addListener(link, 'click', this['_buttonSpeedClicked'], this);

    return link;    
  },

  //Drop down to switch between canvas overlay style
  _createDropDown: function (title, container) {
    var link = L.DomUtil.create('div', this.options.styleNS + ' timecontrol-' + title.toLowerCase(), container);
    link.innerHTML = '<select><option disabled>Choose Overlay</option><option>No Overlay</option><option selected>Precipitation</option><option>Surface Status</option></select>';
    link.firstChild.onmousedown = link.firstChild.ondblclick = link.firstChild.onclick = L.DomEvent.stopPropagation;

    L.DomEvent
      .addListener(link.firstChild, 'change', this['_dropDownChanged'], this);

    return link;
  },

  //Function that handles Play/Pause button
  _buttonPlayClicked: function() {
    isRunning = !isRunning;
    var btn = this._buttonPlayPause;

    if (isRunning) {
      play_interrupt_flag = true;
      window.requestAnimationFrame(my_app.update);
      btn.className = btn.className.substring(0, btn.className.lastIndexOf(" ")) + ' ion-pause';
      btn.title = 'Pause';
      //Only do this if not already disabled
      L.DomEvent
        .removeListener(this._buttonBackward, 'click', this['_buttonBackwardClicked'])
        .removeListener(this._buttonForward, 'click', this['_buttonForwardClicked']);
        this._buttonBackward.className = this._buttonBackward.className+=' disabled';
        this._buttonForward.className = this._buttonForward.className+=' disabled';
    }
    else {
      play_interrupt_flag = false;
      btn.className = btn.className.substring(0, btn.className.lastIndexOf(" ")) + ' ion-play';
      btn.title = 'Play';
      L.DomEvent
        .addListener(this._buttonBackward, 'click', this['_buttonBackwardClicked'], this)
        .addListener(this._buttonForward, 'click', this['_buttonForwardClicked'], this);
      this._buttonBackward.className = this._buttonBackward.className.substring(0, this._buttonBackward.className.lastIndexOf(' '));
      this._buttonForward.className = this._buttonForward.className.substring(0, this._buttonForward.className.lastIndexOf(' '));
    }
  },

  //Function that handles Backwards button
  _buttonBackwardClicked: function () {
    //if not at start
    var start_time = moment('2014-02-19 00:00');
    if(!my_app.timestamp.isSame(start_time)){
      /* if on minute % 10 then subtract 10
       * else subtract 5 */
      var subTime = (my_app.timestamp.minute() % 10 == 0) ? 10 : 5;
      this._sliderTime.options.curPosition-=2; //2 because updateUI adds 1 by default
      my_app.timestamp.subtract(subTime, 'minutes');
      /* Refresh only calls removeOld... Therefor it only removes markers from the past
       * But when we move back there are markers from the future, so lets just remove
       * them now */
      my_app.road_condition.clearLayers();
      my_app.road_temperature.clearLayers();
      my_app.condMarkers = {};
      my_app.tempMarkers = {};
      
      my_app.refresh();         
    }
  },

  //Function that handles Foward button
  _buttonForwardClicked: function () {
    //if not at end
    var end_time = moment('2014-02-22 23:50');
    if(!my_app.timestamp.isSame(end_time)){
      /* if on minute % 10 then add 10
       * else add 5 */
      var addTime = (my_app.timestamp.minute() % 10 == 0) ? 10 : 5;
      my_app.timestamp.add(addTime, 'minutes');
      my_app.refresh();
    }
  },

  //Function that handles when time slider value is changed
  _sliderTimeValueChanged: function(newTime, newKnobPos) {
    //Update the timestamp
    my_app.timestamp = new moment(newTime);

    //Remove all interesting markers from the map
    my_app.road_condition.clearLayers();
    my_app.road_temperature.clearLayers();
    my_app.condMarkers = {};
    my_app.tempMarkers = {};

    //Update knob position and value
    this._sliderTime.options.curPosition = newKnobPos;
    this._sliderTime.setPosition(newKnobPos);

    my_app.refresh();
  },

  //Function that handles when the knob is held
  _knobHeld: function(time) {
    //Update the timestamp
    my_app.timestamp = new moment(time);

    //Remove all interesting markers from the map
    my_app.road_condition.clearLayers();
    my_app.road_temperature.clearLayers();
    my_app.condMarkers = {};
    my_app.tempMarkers = {};

    my_app.refresh();
  },

  //Function that handles speed button
  _buttonSpeedClicked: function () {
    var btName = this._buttonSpeed.className;
    /* if the speed is slow (timecrement of 5) then go faster (timeincrement of 10)
     * otherwise the speed is fast so go slow... Right now the dark icon means
     * speed is fast, and the white icon means speed is slow */
    if (my_app.timeIncrement === 5) {
      if (my_app.timestamp.minute() % 10 != 0) {
        my_app.incrementTime();
      }
      my_app.timeIncrement += 5;
      this._buttonSpeed.className = btName.substring(0, btName.lastIndexOf(" ")) + ' ion-ios-speedometer';     
    }
    else {
      my_app.timeIncrement -= 5;
      this._buttonSpeed.className = btName.substring(0, btName.lastIndexOf(" ")) + ' ion-ios-speedometer-outline';  
    }
  },

  //Function that handles when the value of dropdown is changed
  _dropDownChanged: function () {
    var myInput = this._dropDownMetric.firstChild;
    weatherDataChosen = myInput.value;
      //Only attempt to draw the webGL scene if the canvas exists
      if (document.getElementById("webglcanvas") !== null){ 
        drawScene(true);
      }  }
});
var myTimeDimensionControl = new L.Control.TimeDimensionCustom();
my_app.map.addControl(myTimeDimensionControl);
