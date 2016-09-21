/* Heatmap Chart -- A heatmap with speed on the y-axis and distance from rse om
 * the x-axis. The color of the box should be the percentage of dropped messages */
var margin = { top: 50, right: 0, bottom: 0, left:50},
    width = document.getElementById('heatmapDiv').offsetWidth - margin.left - margin.right,
    gridSize = Math.floor(width / 11),
    height = gridSize * 6 + margin.top
    legendElementWidth = (width - width*.2) / 9,
    numCommaFormat = d3v4.format(","),
    numShortFormat = d3v4.format(".3s")
    colors = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b']; //From colorbrewer2

//Add the svg for the legend to the div
var legendSvg = d3v4.select("#heatmapDiv")
  .classed("svg-container", true) //container class to make it responsive
  .append("svg")
  //responsive SVG needs these 2 attributes and no width and height attr
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("viewBox", "0 0 "+(width+margin.left+15)+" "+(gridSize+margin.top+15))
  //class to make it responsive
  .classed("svg-content-responsive", true)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top/2 + ')');

//Add the svg for the chart to the div
var chartSvg = d3v4.select('#heatmapDiv')
  .classed("svg-container", true) //container class to make it responsive
  .append("svg")
  //responsive SVG needs these 2 attributes and no width and height attr
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("viewBox", "0 0 "+(width+margin.left+15)+" "+(height+15))
  //class to make it responsive
  .classed("svg-content-responsive", true)
  .append('g')
    .attr('transform', 'translate(0' + margin.left + ',' + margin.top + ')');

//Distance labels along the x-axis
var distance = ['0 m', '50 m', '100 m', '150 m', '200 m', '250 m', '300 m', '350 m', '400 m', '450 m', '500 m'];
var distanceLabels = chartSvg.selectAll('.distanceLabel')
  .data(distance)
  .enter().append('text')
    .text(function (d) { return d; })
    .attr('x', function (d, i) { return i * gridSize; })
    .attr('y', 0)
    .style('text-anchor', 'middle')
    .attr('transform', 'translate(' + gridSize / 2 + ', -6)')
    .attr('class', function (d, i) { return 'distanceLabel'+i+' axisText axis'; })

//Speed labels along the y-axis
var speed = ['0 mph', '10 mph', '20 mph', '30 mph', '40 mph', '>50 mph'];
var speedLabels = chartSvg.selectAll('.speedLabels')
  .data(speed)
  .enter().append('text')
    .text(function (d) { return d; })
    .attr('x', 0)
    .attr('y', function (d, i) { return i * gridSize; })
    .style('text-anchor', 'end')
    .attr('transform', 'translate(1,' + gridSize / 1.75 + ')')
    .attr('class', function (d, i) { return 'speedLabel'+i+' axisText axis'; })

//Add border around chart svg
var borderPath = chartSvg.append("rect")
  .attr("x", -48)
  .attr("y", -47)
  .attr("height", height)
  .attr("width", width + margin.right + margin.left)
  .style("stroke", "#999")
  .style("fill", "none")
  .style("stroke-width", 3);

//Custom tooltip library
var tip = d3v4.tip()
  .attr('class', 'd3-tip')
  .offset([-10, 0])
  .html(function (d) {
    var string = '#Messages Sent: ' + numCommaFormat(d.p1Count);
    string += '<br>#Messages Received: ' + numCommaFormat(d.rseCount);
    string += '<br>%Messages Received: ' + (d.rseCount / d.p1Count).toFixed(2)*100 + '%';
    return string;
  });
chartSvg.call(tip);

//Load the data and populate the heatmap
d3v4.csv('data/heat.csv', function (heatCsv) {
  var data = [];
  //Get the data for p1 with speeds 0-45
  for (var i = 0; i < 55; i++) {
    data.push({
      distance: heatCsv[i].distance,
      speed: heatCsv[i].speed,
      p1Count: parseInt(heatCsv[i].count),
    });
  }
  //Next need to get the data for p1 with speeds >50mph.
  //Push temp counts onto data and create a map to go from distance to index
  var indexMap = {};
  for (var i = 0; i < distance.length; i++) {
    data.push({
      distance: distance[i].substring(0,distance[i].indexOf(' ')), 
      speed: '50', 
      p1Count:0
    });
    indexMap[distance[i]] = data.length-1;
  }
  //Loop over the p1 data >50mph and use the map to find the index and update the temp count
  var mycounter = 0;
  for (var i = 55; i < 93; i++){
    data[indexMap[heatCsv[i].distance+' m']].p1Count += parseInt(heatCsv[i].count);
  }

  //Now we have to get the data for rse with speeds 0-20. Put this into a tempdata
  var temp_data = []
  for (var i = 93; i < heatCsv.length; i++) {
    temp_data.push({
      distance: heatCsv[i].distance,
      speed: heatCsv[i].speed,
      count: parseInt(heatCsv[i].count),
    });
  }

  //Update the data array with the RSE tempdata for speeds 0-20
  var j;
  for (j = 0; j < temp_data.length; j++) {
    data[j].rseCount =  temp_data[j].count;
    data[j].difference = data[j].rseCount / data[j].p1Count;
  }

  //Since the RSE has no messages above 20mph update the rest of the data array to reflect his
  for (j; j < data.length; j++) {
    data[j].rseCount = 0;
    data[j].difference = 0;
  }
  /* There are some instances where the number of messages received is higher than the number
   * of messages sent, so set that number to 1 so it can still receive a color and not give an error */
  for (var i = 0; i < data.length; i++) {
    if (data[i].difference > 1) data[i].difference = 1;
  }

  //Create the color scale. Color is based on % of messages received
  var colorScale = d3v4.scaleQuantile()
    .domain([0, d3v4.max(data, function (d) { return d.difference; })])
    .range(colors);

  //Create the size scale. Size is based on total number of messages sent
  var sizeScale = d3v4.scaleLinear()
    .domain([d3v4.min(data, function (d) { return d.p1Count; }), d3v4.max(data, function (d) { return d.p1Count})])
    .range([0.15,0.9]);

  //Create the circles for each speed/distance bin
  var circles = chartSvg.selectAll('.meter')
    .data(data, function (d) { return d.speed; })
  circles.enter().append('circle')
    .attr("cx", function(d) { return (d.distance/50) * gridSize; })
    .attr("cy", function(d) { return (d.speed/10) * gridSize; })
    .attr("class", "distance bordered")
    .attr("r", function (d) { return sizeScale(d.p1Count) * gridSize / 2; })
    .attr("transform", function (d) {
      var xy = gridSize/2;
      return 'translate('+xy+','+xy+')';
    })
    .style("fill", function (d) { return (d.difference === 1 ? 'red' : colorScale(d.difference)); })
    .on('mouseover', tip.show)
    .on('mouseout', tip.hide);
  circles.exit().remove();

  //Create the legend for chart color
  legendSvg.append("text")
    .attr("class", "legendText")
    .text("Percentage of Messages Received")
    .attr("x", 0)
    .attr("y", -3);
  var legend = legendSvg.selectAll('.legend')
    .data([0].concat(colorScale.quantiles()), function (d) { return d; });
  legend.enter().append("rect")
    .attr("x", function(d, i) { return legendElementWidth * i; }) //One block per color
    .attr("y", sizeScale(sizeScale.domain()[1]) * gridSize / 2 - gridSize/1.75/2) //Start slightly above the center of large circle
    .attr("width", legendElementWidth) //Predetermined Width
    .attr("height", gridSize/1.75) //Scale height with gridSize
    .style("fill", function(d, i) { return colors[i]; }); 
  legend.enter().append("text")
    .attr("class", "axisText")
    .text(function(d, i) { return Math.round((d)*100) + " - " + Math.round((d+.11)*100) + "%"; }) //Percent range
    .attr("x", function(d, i) { return (legendElementWidth * i); })
    .attr("y", gridSize+5);
  legend.exit().remove();

  //Create the legend for chart size
  legendSvg.append("text")
    .attr("class", "legendText")
    .text("Total Messages Sent")
    .attr("x", legendElementWidth * 9) //There were 8 colors so start this at 9
    .attr("y", -3)
  legendSvg.append("circle")
    .attr("cx", legendElementWidth * 9 + legendElementWidth/3) //Add slight offset so not touching color legend
    .attr("cy", sizeScale(sizeScale.domain()[1]) * gridSize / 2) //Center the small circle at same spot as large circle
    .attr("r", sizeScale(sizeScale.domain()[0]) * gridSize / 2)
    .attr("class", "distance bordered")
    .style("fill", "rgb(247, 251, 255)") //Fill with same color as lightest gradient
  legendSvg.append("text")
    .attr("class", "axisText")
    .text("200")
    .attr("x", legendElementWidth * 9 + legendElementWidth/3 - sizeScale(sizeScale.domain()[0]) * gridSize / 1.5) //Place text starting just to the left of the circle
    .attr("y", gridSize+5)
  legendSvg.append("circle")
    .attr("cx", legendElementWidth * 10 + legendElementWidth/4)
    .attr("cy", sizeScale(sizeScale.domain()[1]) * gridSize / 2)
    .attr("r", sizeScale(sizeScale.domain()[1]) * gridSize / 2)
    .attr("class", "distance bordered")
    .style("fill", "rgb(247, 251, 255)")
  legendSvg.append("text")
    .attr("class", "axisText")
    .text("1,200,000")
    .attr("x", legendElementWidth * 10 + legendElementWidth/4 - sizeScale(sizeScale.domain()[1]) * gridSize / 3) //Place text starting just to the left of the circle
    .attr("y", gridSize+5)
});