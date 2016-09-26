var gl;
/*
 * Get the base transform matrix that will be scaled/translated
 * according to the current state of the map to move the
 * points where they need to be on the map */
function getTransformMatrix() {
  return [
    2 / gl.viewportWidth, 0, 0, 0,
    0, -2 / gl.viewportHeight, 0, 0,
    0, 0, 0, 0,
    -1, 1, 0, 1
  ];
};

/* Convert from latitude/longitude to pixel coordinates
 * using the Mercator projection.
 */
function latlonToPoint(latlon) {
  var sinLatitude = Math.sin(latlon.lat * Math.PI / 180.0);
  return {
    x: ((latlon.lon + 180) / 360) * 256,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (Math.PI * 4)) * 256
  };
};

//Initialize the GL Canvas
function initGL(canvas) {
  try {
    gl = canvas.getContext("web-gl") || canvas.getContext("experimental-webgl");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;

    //If the window resizes, set the viewport variables
    window.onresize = function () {
      gl.viewportWidth = canvas.width;
      gl.viewportHeight = canvas.height;
    };
  } catch (e) { //In case there are any other errors replace the map with video
    noWebGLErrorCatcher();
  }
}

//Fetch shader information from index
function getShader(gl, id) {
  var shaderScript = document.getElementById(id);
  if (!shaderScript) {
    return null;
  }

  //Collect every row from the shader text
  var str = "";
  var k = shaderScript.firstChild;
  while (k) {
    if (k.nodeType == 3) {
        str += k.textContent;
    }
    k = k.nextSibling;
  }

  //Create the correct shader type based on script type tag
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, str);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

//Initialze the shaders and program
var shaderProgram;
function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs");
  var vertexShader = getShader(gl, "shader-vs");

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(gl.getProgramInfoLog(shaderProgram));
  }

  gl.useProgram(shaderProgram);

  //Get the location of the attributes
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  //Get the location and initial value of matrix to transform lat/lon to clipspace
  shaderProgram.transformToClipSpace = gl.getUniformLocation(shaderProgram, "uTransformToClipSpace");
  var transformMatrix = getTransformMatrix();
  gl.uniformMatrix4fv(shaderProgram.transformToClipSpace, false, new Float32Array(transformMatrix));

  //Get the location of all our station value uniform matrices
  shaderProgram.stationValue1 = gl.getUniformLocation(shaderProgram, "uStationValue1");
  shaderProgram.stationValue2 = gl.getUniformLocation(shaderProgram, "uStationValue2");
  shaderProgram.stationValue3 = gl.getUniformLocation(shaderProgram, "uStationValue3");
  shaderProgram.stationValue4 = gl.getUniformLocation(shaderProgram, "uStationValue4");
  shaderProgram.stationValue5 = gl.getUniformLocation(shaderProgram, "uStationValue5");

  //Get the location of the metric uniform
  shaderProgram.metric = gl.getUniformLocation(shaderProgram, 'uMetric');
}

//Initialize the buffers
var tempLength;
function initBuffers() {
  var piVertexPositionBuffer = gl.createBuffer();
  var vertices = [];
  var id_to_index = [];
  gl.bindBuffer(gl.ARRAY_BUFFER, piVertexPositionBuffer);

  /* Everything that used to be done here can be found in the function
   * generateVertex() found in js/vertex_generation_script.js
   * just know that on page load we read an array of the following form
   *
   * Create the variable that will go into the buffer in the form
   * [x1, y1, index of closest station,
   *  x2, y2, index of closest station,
   *  x3, y3, index of closest station,
   *  (next triangle)...] 
   * vertices is an array of [x,y] coordinates with length = # points
   * triangles is the Delaunay "construct" such that each value is an index from 
   * vertices and each 3 value are the vertices of a triangle (t[i], t[i+1], t[i+2])
   * temp_pos_data gives the index of the closest station. The index is used
   * to access the correct uStationValue. 
   *
   * Since we already have this variable all we have to do is load it into the
   * buffer */
  var my_vertex_data = my_app.generatedVertices;
  tempLength = my_vertex_data.length/3;

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(my_vertex_data), gl.STATIC_DRAW);
  //The attribute vertexPosition is set and filled with what is in the buffer with 3 components each
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  //Load the buffers with all empty data (for the none overlay option)
  var my_data = [];
  for (var i = 0; i < Object.keys(my_app.stations).length; i++){
    my_data[i] = 0.0;
  }
  //Fill up our 5 uniform matrices in the same order 
  var value1 = my_data.slice(0,16);
  gl.uniformMatrix4fv(shaderProgram.stationValue1, false, new Float32Array(value1));
  var value2 = my_data.slice(16,32);
  gl.uniformMatrix4fv(shaderProgram.stationValue2, false, new Float32Array(value2));
  var value3 = my_data.slice(32,48);
  gl.uniformMatrix4fv(shaderProgram.stationValue3, false, new Float32Array(value3));
  var value4 = my_data.slice(48,64);
  gl.uniformMatrix4fv(shaderProgram.stationValue4, false, new Float32Array(value4));
  var value5 = my_data.slice(64,80);
  gl.uniformMatrix4fv(shaderProgram.stationValue5, false, new Float32Array(value5));

  //Set the metric uniform to none (0)
  gl.uniform1f(shaderProgram.metric, 0.0);
}

//Load the buffers with information
function loadUniforms() {
  var my_data = [];
  var i = 0;
  var chosenMetric;
  var chosenMetricValue;
  if (weatherDataChosen === 'No Overlay'){
    chosenMetricValue = 0.0;
    //Load the buffers with all empty data (for the none overlay option)
    var my_data = [];
    for (var i = 0; i < Object.keys(my_app.stations).length; i++){
      my_data[i] = 0.0;
    }
    //Fill up our 5 uniform matrices in the same order 
    var value1 = my_data.slice(0,16);
    gl.uniformMatrix4fv(shaderProgram.stationValue1, false, new Float32Array(value1));
    var value2 = my_data.slice(16,32);
    gl.uniformMatrix4fv(shaderProgram.stationValue2, false, new Float32Array(value2));
    var value3 = my_data.slice(32,48);
    gl.uniformMatrix4fv(shaderProgram.stationValue3, false, new Float32Array(value3));
    var value4 = my_data.slice(48,64);
    gl.uniformMatrix4fv(shaderProgram.stationValue4, false, new Float32Array(value4));
    var value5 = my_data.slice(64,80);
    gl.uniformMatrix4fv(shaderProgram.stationValue5, false, new Float32Array(value5));    
  }
  else{
    chosenMetric = (weatherDataChosen === 'Precipitation') ? 'precipIntensity' : 'essSurfaceStatus';
    chosenMetricValue = (weatherDataChosen === 'Precipitation') ? 1.0 : 2.0;
    //For every station load the data at the current timestamp
    var tstamp = (my_app.timestamp.minute() % 10 === 0) ? my_app.timestamp : new moment(my_app.timestamp).subtract(5, "minutes");
    tstamp = tstamp.format('YYYY-MM-DD HH:mm:ss').toString();
    Object.keys(my_app.stations).forEach(function (stationID) {
      var station = my_app.stations[stationID];
      //Get the reading information
      if (station.data[tstamp] !== undefined && station.data[tstamp][chosenMetric] !== undefined) {
        my_data[i] = station.data[tstamp][chosenMetric].obs;
      }
      //If no reading set to zero
      else {
        my_data[i] = 0.0;
      }
      i++;
    });
    //Fill up our 5 uniform matrices in the same order 
    var value1 = my_data.slice(0,16);
    gl.uniformMatrix4fv(shaderProgram.stationValue1, false, new Float32Array(value1));
    var value2 = my_data.slice(16,32);
    gl.uniformMatrix4fv(shaderProgram.stationValue2, false, new Float32Array(value2));
    var value3 = my_data.slice(32,48);
    gl.uniformMatrix4fv(shaderProgram.stationValue3, false, new Float32Array(value3));
    var value4 = my_data.slice(48,64);
    gl.uniformMatrix4fv(shaderProgram.stationValue4, false, new Float32Array(value4));
    var value5 = my_data.slice(64,80);
    gl.uniformMatrix4fv(shaderProgram.stationValue5, false, new Float32Array(value5));
  }

  //Set the metric uniform 0=None, 1=PrecipInten, 2=SurfaceStatus
  gl.uniform1f(shaderProgram.metric, chosenMetricValue);
}


//Animate the overlay
function drawScene(loadBool) {
  if(gl === undefined) webGLStart();
  //Prep
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  //Scale the transform matrix according to the zoom
  var curTransformMatrix = getTransformMatrix();
  var scale = Math.pow(2, my_app.map.getZoom());
  for (var i = 0; i < 8; i++) {
    curTransformMatrix[i] *= scale;
  }

  //Translate the transform matrix according to the map bounds
  var bounds = my_app.map.getBounds();
  var topLeft = new L.LatLng(bounds.getNorth(), bounds.getWest());
  var offset = latlonToPoint({ lat: topLeft.lat, lon: topLeft.lng });
  for (var i = 0; i < 4; i++) {
    curTransformMatrix[i+12] += (curTransformMatrix[i] * -offset.x) +
      (curTransformMatrix[i+4] * -offset.y);
  }
  gl.uniformMatrix4fv(shaderProgram.transformToClipSpace, false, new Float32Array(curTransformMatrix));

  //Only reload the buffers if the viz time has incremented (aka new data available)
  if (loadBool) loadUniforms();

  //Draw triangles using the data in the buffer
  gl.drawArrays(gl.TRIANGLES, 0, tempLength);
}

//Function to run to start the webGL canvas
function webGLStart() {
  var canvas = document.getElementById("webglcanvas");
  initGL(canvas);
  initShaders();
  initBuffers();

  gl.clearColor(0.0, 0.0, 0.0, 0.0);

  drawScene(true);
}

function noWebGLErrorCatcher () {
  //Create the necessary elements to repalce the webGL map
  var alert_body = document.createElement("div");
  alert_body.className = "usa-alert-body";  

  var alert_heading = document.createElement("h3");      
  alert_heading.className = "usa-alert-heading";
  alert_heading.innerHTML = "WebGL Could Not Be Initialized";

  var alert_text = document.createElement("p");
  alert_text.className = "usa-alert-text";
  alert_text.innerHTML = "Sorry!  Visualization Element3: requires WebGL.  The browser was unable to initalize WebGL, so you have been redirected here.  Below you will find a video that walks through what Element 3 has to offer."

  var error_div = document.createElement("div");
  error_div.className = "usa-alert usa-alert-error";

  //Nest the elements accordingly 
  alert_body.appendChild(alert_heading);
  alert_body.appendChild(alert_text)
  error_div.appendChild(alert_body);

  //Get the map element and replace it with our new error element
  var mapElement = document.getElementById("map");    
  mapElement.parentNode.replaceChild(error_div, mapElement);

  //Embed the video after the alert
  var video = document.createElement("div");
  video.className = "vid-embed";
  video.innerHTML = '<iframe src="https://player.vimeo.com/video/184229812" width="100%" height="498" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>'
  error_div.parentNode.insertBefore(video, error_div.nextSibling);

  //Throw error to stop the scripts from trying to finish execution
  throw new Error("WebGL is not enabled");
}