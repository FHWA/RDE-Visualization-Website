d3.csv('element6_data/ThrottlePositionEvents.csv', function(throttleSolo) {
  items = []
  throttleSolo.forEach(function(d) {
    var temp = {}
    var format = d3.time.format("%Y-%m-%d");
    var originTime = format.parse('2004-01-01');
    var addSecsStart = parseInt((d.StartTime / 1000000) - 35);
    var addSecsEnd = parseInt((d.Endtime / 1000000) - 35);
    var summedTimeStart = d3.time.second.offset(originTime, addSecsStart);
    var summedTimeEnd = d3.time.second.offset(originTime, addSecsEnd);

    temp.StartTime = summedTimeStart;
    temp.EndTime = summedTimeEnd;

    temp.Value = +d.Value;
    items.push(temp);
  });
  items.sort(function(a, b) {
    return a.StartTime - b.StartTime;
  });

  var throttle = barChart(items, 'throttlefield', 'Throttle', {
    margins: {
      top: 5,
      right: 15,
      bottom: 45,
      left: 30,
    },
    eventFlag: true,
    yLabel: '%',
    yDomain: [0, 100],
    leftColumn: false,
  });

  var thisdiv = d3.select("#Throttle");
  addentries(throttleSolo, thisdiv);
  throttle.draw();

  var timeBegin = d3.min(items, function(d) {
    return d.StartTime;
  });

  var timeEnd = d3.max(items, function(d) {
    return d.EndTime;
  });

  var duration = timeEnd - timeBegin;

  d3.select("#Throttle .time_span_text").html(function() {
    if (duration > 86400000) {
      return "full time span ≈ " + parseFloat(duration / 86400000).toFixed(1) + " days"
    } else if (duration > 3600000) {
      return "full time span ≈ " + parseFloat(duration / 3600000).toFixed(1) + " hours"
    } else if (duration > 60000) {
      return "full time span ≈ " + parseFloat(duration / 60000).toFixed(1) + " minutes"
    } else {
      return "full time span ≈ " + parseFloat(duration / 1000).toFixed(1) + " seconds"
    }
  });
});