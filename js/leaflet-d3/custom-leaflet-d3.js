/*! leaflet-d3.js Version: 0.3.8 */
(function(){
	"use strict";

	// L is defined by the Leaflet library, see git://github.com/Leaflet/Leaflet.git for documentation
	L.HexbinLayer = L.Class.extend({
		includes: [L.Mixin.Events],

		options : {
			radius : 10,
			opacity: 0.5,
			duration: 200,
			lng: function(d){
				return d[0];
			},
			lat: function(d){
				return d[1];
			},
			colorRange: ['#f7fbff', '#08306b'],

			onmouseover: undefined,
			onmouseout: undefined,
			click: undefined
		},

		initialize : function(options) {
			L.setOptions(this, options);

			this._hexLayout = d3.hexbin()
				.radius(this.options.radius)
				.x(function(d){ return d.point[0]; })
				.y(function(d){ return d.point[1]; });
			this._data = [];
			//Custom colorScale
			this._colorScale = d3.scale.linear()
				.range(this.options.colorRange)
				.domain([0,1]);
			//Custom sizeScale
			this._sizeScale = d3.scale.log()
				.range([2, 11])
				.clamp(true);
		},

		onAdd : function(map) {
			this._map = map;

			// Create a container for svg.
			this._container = this._initContainer();

			// Set up events
			map.on({'moveend': this._redraw}, this);

			// Initial draw
			this._redraw();

			//Hide load
      var loadEles = document.getElementsByClassName('loading');
      if(loadEles[0].style.visibility === ''){
        loadEles[0].style.visibility = 'hidden';
        loadEles[0].style.opacity = '0';
        loadEles[1].style.visibility = 'hidden';
        loadEles[1].style.opacity = '0';
      }
		},

		onRemove : function(map) {
			this._destroyContainer();

			// Remove events
			map.off({'moveend': this._redraw}, this);

			this._container = null;
			this._map = null;
		},

		addTo : function(map) {
			map.addLayer(this);
			return this;
		},

		_initContainer : function() {
			var container = null;

			// If the container is null or the overlay pane is empty, create the svg element for drawing
			if (null == this._container) {
				var overlayPane = this._map.getPanes().overlayPane;
				container = d3.select(overlayPane).append('svg')
					.attr('class', 'leaflet-layer leaflet-zoom-hide');
			}

			return container;
		},

		_destroyContainer: function(){
			// Remove the svg element
			if(null != this._container){
				this._container.remove();
			}
		},

		// (Re)draws the hexbin group
		_redraw : function(){
			var that = this;

			if (!that._map) {
				return;
			}

			var zoom = this._map.getZoom();
			var check = document.getElementById('mine')
			if (check !== null && check.className.animVal.indexOf(zoom) == -1){
				check.remove()
			}

			var data = []
			/* setTimeout function that chunks the data loop to keep the browser responsive.
	     * returns a promise when it is finished so the rest of the redraw function
	     * can use the data array */
	    function processArray(mythis) {
	      var d = jQuery.Deferred();
	      var array = mythis._data.features;
	      var chunk = 25000;
	      var index = 0;

	      //Process the current chunk of data
	      var doChunk = function() {
	        var cnt = chunk;
	        while (cnt-- && index < array.length) {
	          var coords = mythis._project(array[index].geometry.coordinates)
	          data.push({ o: d, point: coords, properties: array[index].properties});
	          ++index;
	        }
	        if (index < array.length) {
	          //set Timeout for async iteration
	          setTimeout(doChunk, 0);
	        }
	        else {
	          //Resolve the promise so the next part of genHexagons can continute
	          d.resolve(mythis);
	        }
	      }
	      doChunk();
	      return d.promise();
	    }
	    //Call our data chunk processing function and once its finished finish redraw
	    processArray(this).then(function (mythis) {
				var zoom = mythis._map.getZoom();

				// Determine the bounds from the data and scale the overlay
				var padding = mythis.options.radius * 2;
				var bounds = mythis._getBounds(data);
				var width = (bounds.max[0] - bounds.min[0]) + (2 * padding),
					height = (bounds.max[1] - bounds.min[1]) + (2 * padding),
					marginTop = bounds.min[1] - padding,
					marginLeft = bounds.min[0] - padding;

				mythis._hexLayout.size([ width, height ]);
				mythis._container
					.attr('width', width).attr('height', height)
					.style('margin-left', marginLeft + 'px')
					.style('margin-top', marginTop + 'px');

				// Select the hex group for the current zoom level. This has 
				// the effect of recreating the group if the zoom level has changed
				var join = mythis._container.selectAll('g.hexbin')
					.data([zoom], function(d){ return d; });

				// enter
				join.enter().append('g')
					.attr('class', function(d) { return 'hexbin zoom-' + d; })
					.attr('id', 'mine');

				// enter + update
				join.attr('transform', 'translate(' + -marginLeft + ',' + -marginTop + ')');

				// exit
				join.exit().remove();

				// add the hexagons to the select
				mythis._createHexagons(join, data);	    	
	    });
		},

		_createHexagons : function(g, data) {
			var that = this;

			var counts = [];
			/* Loop over the data and add count of each group and total count of messages
			 * Also create an array of all the counts used to set the size of each hexagon */
			var bins = that._hexLayout(data);
			for (var i = 0; i < bins.length; i++) {
				bins[i].oneCount = 0, bins[i].zeroCount = 0, bins[i].totCount = 0;
				for (var j = 0; j < bins[i].length; j++) {
					if (bins[i][j].properties.group ==1) bins[i].oneCount += bins[i][j].properties.count;
					else bins[i].zeroCount += bins[i][j].properties.count;
				}
				bins[i].totCount = bins[i].oneCount + bins[i].zeroCount
				counts.push(bins[i].totCount);
			}

			//Set the domain of our custom sizeScale using the max and min of message count in each hexagon bin
			that._sizeScale.domain([Math.min.apply(null, counts), Math.max.apply(null, counts)])

			// Join - Join the Hexagons to the data
			var join = g.selectAll('path.hexbin-hexagon')
				.data(bins, function(d){ return d.i + ':' + d.j; });

			// Enter - establish the path, the fill, and the initial opacity
			/* Use a setTimeout loop to append each hexagon to the map.  This will keep the browser
			 * responsive as there are a large number of hexagons being drawn */
			join.enter().append('path').each(function (d, i) {
				var temp = this;
				setTimeout(function () {
					var p = d3.select(temp).attr('class', 'hexbin-hexagon')
						.attr('d', function(d){ 
							return 'M' + d.x + ',' + d.y + that._hexLayout.hexagon(that._sizeScale(d.totCount)); })
						.attr('fill', function(d){ 
		          var color;
		          if (d.oneCount !== 0) {
		            color = (d.zeroCount / d.oneCount);
		            if (color > 1) return 'red';
		          }
		          else {
		            color = 0;
		          }
							return that._colorScale(color); })
						.attr('stroke', 'black')
						.style('cursor', 'pointer')
						.on('mouseover', function(d, i) {
							if(null != that.options.onmouseover) {
								that.options.onmouseover(d, this, that);
							}
						})
						.on('mouseout', function(d, i) {
							if(null != that.options.onmouseout) {
								that.options.onmouseout(d, this, that);
							}
						})
						.on('click', function(d, i) {
							if(null != that.options.onclick) {
								that.options.onclick(d, this, that);
							}
						})
				}, 0);
			});
		},

		_project : function(coord) {
			var point = this._map.latLngToLayerPoint([ coord[1], coord[0] ]);
			return [ point.x, point.y ];
		},

		_getBounds: function(data){
			var that = this;

			if(null == data || data.length < 1){
				return { min: [0,0], max: [0,0]};
			}

			// bounds is [[min long, min lat], [max long, max lat]]
			var bounds = [[999, 999], [-999, -999]];

			data.forEach(function(element){
				var x = element.point[0];
				var y = element.point[1];

				bounds[0][0] = Math.min(bounds[0][0], x);
				bounds[0][1] = Math.min(bounds[0][1], y);
				bounds[1][0] = Math.max(bounds[1][0], x);
				bounds[1][1] = Math.max(bounds[1][1], y);
			});

			return { min: bounds[0], max: bounds[1] };
		},

		_linearlySpace: function(from, to, length){
			var arr = new Array(length);
			var step = (to - from) / Math.max(length - 1, 1);

			for (var i = 0; i < length; ++i) {
				arr[i] = from + (i * step);
			}

			return arr;
		},

		/* 
		 * Setter for the data
		 */
		data : function(data) {
			this._data = (null != data)? data : [];
			this._redraw();
			return this;
		},

		/*
		 * Getter/setter for the colorScale
		 */
		colorScale: function(colorScale) {
			if(undefined === colorScale){
				return this._colorScale;
			}

			this._colorScale = colorScale;
			this._redraw();
			return this;
		},

		/*
		 * Getter/setter for the mouseover function
		 */
		onmouseover: function(mouseoverFn) {
			this.options.onmouseover = mouseoverFn;
			this._redraw();
			return this;
		},

		/*
		 * Getter/setter for the mouseout function
		 */
		onmouseout: function(mouseoutFn) {
			this.options.onmouseout = mouseoutFn;
			this._redraw();
			return this;
		},

		/*
		 * Getter/setter for the click function
		 */
		onclick: function(clickFn) {
			this.options.onclick = clickFn;
			this._redraw();
			return this;
		}

	});

	L.hexbinLayer = function(options) {
		return new L.HexbinLayer(options);
	};

})();
