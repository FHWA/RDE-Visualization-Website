d3.csv('csv/culled/ThrottlePositionEvents_04_11_13.csv', function (throttleSolo) {
  items = []
    
	
  throttleSolo.forEach(function (d) {
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
  items.sort(function(a, b) { return a.StartTime - b.StartTime; }); 

  var throttle = barChart(items, 'throttlefield', 'Throttle', {
    margins: {
      top: 5, right: 15, bottom: 45, left: 30,
    },
    eventFlag: true,
    yLabel: '%',
    yDomain:[0, 100],
    leftColumn: false,
  });
    
           var thisdiv = d3.select("#Throttle");
        addentries(throttleSolo, thisdiv);   
  throttle.draw();
});