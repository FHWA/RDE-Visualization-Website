/* From http://stackoverflow.com/questions/9461621/how-to-format-a-number-as-2-5k-if-a-thousand-or-more-otherwise-900-in-javascrip */
function nFormatter(num, digits) {
  var si = [
    { value: 1E18, symbol: "E" },
    { value: 1E15, symbol: "P" },
    { value: 1E12, symbol: "T" },
    { value: 1E9,  symbol: "G" },
    { value: 1E6,  symbol: "M" },
    { value: 1E3,  symbol: "k" }
  ], rx = /\.0+$|(\.[0-9]*[1-9])0+$/, i;
  for (i = 0; i < si.length; i++) {
    if (num >= si[i].value) {
      return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
    }
  }
  return num.toFixed(digits).replace(rx, "$1");
}

function numberWithCommas(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

/* Heatmap Chart -- A heatmap with speed on the x-axis and distance from rse om
 * the y-axis. The color of the box should be the percentage of dropped messages */
var margin = { top: 50, right: 0, bottom: 100, left:50},
    width = document.getElementById('heatmapDiv').offsetWidth - margin.left - margin.right,
    height = 550 - margin.top - margin.bottom,
    gridSize = Math.floor(width / 11),
    legendElementWidth = (width - width*.2) / 9,
    buckets = 10,
    colors = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    speed = ['0 mph', '10 mph', '20 mph', '30 mph', '40 mph', '>50 mph'],
    distance = ['0 m', '50 m', '100 m', '150 m', '200 m', '250 m', '300 m', '350 m', '400 m', '450 m', '500 m']
    dataset = 'data/heat.csv';

var svg2 = d3.select("#heatmapDiv")
  .classed("svg-container", true) //container class to make it responsive
  .append("svg")
  //responsive SVG needs these 2 attributes and no width and height attr
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("viewBox", "0 0 1028 150")
  //class to make it responsive
  .classed("svg-content-responsive", true)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

//Create the svg for the heatmap
var svg = d3.select('#heatmapDiv')
  .classed("svg-container", true) //container class to make it responsive
  .append("svg")
  //responsive SVG needs these 2 attributes and no width and height attr
  .attr("preserveAspectRatio", "xMinYMin meet")
  .attr("viewBox", "0 0 1028 550")
  //class to make it responsive
  .classed("svg-content-responsive", true)
  .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

var borderPath = svg.append("rect")
  .attr("x", -48)
  .attr("y", -47)
  .attr("rx", 12)
  .attr("ry", 12)
  .attr("height", 545)
  .attr("width", 975)
  .style("stroke", "#aaa")
  .style("fill", "none")
  .style("stroke-width", 3);

//Distance labels along the x-axis
var distanceLabels = svg.selectAll('.distanceLabel')
  .data(distance)
  .enter().append('text')
    .text(function (d) { return d; })
    .attr('x', function (d, i) { return i * gridSize; })
    .attr('y', 0)
    .style('text-anchor', 'middle')
    .attr('transform', 'translate(' + gridSize / 2 + ', -6)')
    .attr('class', 'distanceLabel mono axis axis')

//Speed labels along the y-axis
var speedLabels = svg.selectAll('.speedLabels')
  .data(speed)
  .enter().append('text')
    .text(function (d) { return d; })
    .attr('x', 0)
    .attr('y', function (d, i) { return i * gridSize; })
    .style('text-anchor', 'end')
    .attr('transform', 'translate(1,' + gridSize / 1.75 + ')')
    .attr('class', 'speedLabel mono axis')

//Custom tooltip library
var tip = d3.tip()
  .attr('class', 'd3-tip')
  .offset([-10, 0])
  .html(function (d) {
    var string = '#Messages Sent: ' + numberWithCommas(d.p1Count);
    string += '<br>#Messages Received: ' + numberWithCommas(d.rseCount);
    string += '<br>%Messages Received: ' + (d.rseCount / d.p1Count).toFixed(2)*100 + '%';
    return string;
  });
svg.call(tip);

//Load the data and populate the heatmap
d3.csv(dataset, function (heatCsv) {
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
  var colorScale = d3.scaleQuantile()
    .domain([0, d3.max(data, function (d) { return d.difference; })])
    .range(colors);

  //Create the size scale. Size is based on total number of messages sent
  var sizeScale = d3.scaleLinear()
    .domain([d3.min(data, function (d) { return d.p1Count; }), d3.max(data, function (d) { return d.p1Count})])
    .range([0.15,0.9]);

  //Create the circles for each speed/distance bin
  var cards = svg.selectAll('.meter')
    .data(data, function (d) { return d.speed; })
  cards.enter().append('circle')
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
  cards.exit().remove();

  //Create the legend
  svg2.append("text")
    .attr("class", "mono2")
    .text("Percentage of Messages Received")
    .attr("x", 0)
    .attr("y", -3);
  var legend = svg2.selectAll('.legend')
    .data([0].concat(colorScale.quantiles()), function (d) { return d; });
  legend.enter().append("rect")
    .attr("x", function(d, i) { return legendElementWidth * i; })
    .attr("y", gridSize/6)
    .attr("width", legendElementWidth)
    .attr("height", gridSize/1.75)
    .style("fill", function(d, i) { return colors[i]; });
  legend.enter().append("text")
    .attr("class", "mono")
    .text(function(d, i) { return Math.round((d)*100) + " - " + Math.round((d+.11)*100) + "%"; })
    .attr("x", function(d, i) { return (legendElementWidth * i)+legendElementWidth/4; })
    .attr("y", 90);
  legend.exit().remove();

  svg2.append("text")
    .attr("class", "mono2")
    .text("Total Messages Sent")
    .attr("x", legendElementWidth * 9 + 25)
    .attr("y", 0)
  svg2.append("circle")
    .attr("cx", legendElementWidth * 9 + 25 + 20)
    .attr("cy", 40)
    .attr("r", 6)
    .attr("class", "distance bordered")
    .style("fill", "rgb(247, 251, 255)")
  svg2.append("text")
    .attr("class", "mono")
    .text("200")
    .attr("x", legendElementWidth * 9 + 25 + 12)
    .attr("y", 90)
  svg2.append("circle")
    .attr("cx", legendElementWidth * 10 + 25 + 20)
    .attr("cy", 40)
    .attr("r", 36)
    .attr("class", "distance bordered")
    .style("fill", "rgb(247, 251, 255)")
  svg2.append("text")
    .attr("class", "mono")
    .text("1,200,000")
    .attr("x", legendElementWidth * 10 + 20)
    .attr("y", 90)
});