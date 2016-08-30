d3.csv('csv/sampled/bsm_posaccurbyte1.csv', function (posAccByte1) {
  var items = [];
  posAccByte1.forEach(function (d) {
    var temp = {}
    var format = d3.time.format("%Y-%m-%d");
    var originTime = format.parse('2004-01-01');
    var addSecsStart = parseInt((d.StartTime / 1000000) - 35);
    var addSecsEnd = parseInt((d.Endtime / 1000000) - 35);
    var summedTimeStart = d3.time.second.offset(originTime, addSecsStart);
    var summedTimeEnd = d3.time.second.offset(originTime, addSecsEnd);

    temp.StartTime = summedTimeStart;
    temp.EndTime = summedTimeEnd;

    temp.Value = (d.Value*.05).toFixed(2);   
    items.push(temp);
  });
  items.sort(function(a, b) { return a.StartTime - b.StartTime; }); 

  //Event 1
  var pAB1 = barChart(items, 'posAccByteField1', 'PosAccurByte1Events', {
    eventFlag: true,
    yLabel: 'm',
    yDomain: [0, 12.7],
      
      
 });
  
        var thisdiv = d3.select("#PosAccurByte1Events");
        addentries(posAccByte1, thisdiv);               
                     
                    
  pAB1.draw();   
    
    
      
    
    
});

d3.csv('csv/sampled/bsm_posaccurbyte2.csv', function (posAccByte2) {
  var items = [];
  posAccByte2.forEach(function (d) {
    var temp = {}
    var format = d3.time.format("%Y-%m-%d");
    var originTime = format.parse('2004-01-01');
    var addSecsStart = parseInt((d.StartTime / 1000000) - 35);
    var addSecsEnd = parseInt((d.Endtime / 1000000) - 35);
    var summedTimeStart = d3.time.second.offset(originTime, addSecsStart);
    var summedTimeEnd = d3.time.second.offset(originTime, addSecsEnd);

    temp.StartTime = summedTimeStart;
    temp.EndTime = summedTimeEnd;

    temp.Value = (d.Value*.05).toFixed(2);   
    items.push(temp);
  });
  items.sort(function(a, b) { return a.StartTime - b.StartTime; }); 
  
  //Event 2
  var pAB2 = barChart(items, 'posAccByteField2', 'PosAccurByte1Events', {
    yLabel: 'm',
    yDomain: [0, 12.7],
  });
  pAB2.draw(); 
    
    
});

d3.csv('csv/sampled/bsm_posaccurbyte3.csv', function (posAccByte3) {
  var items = [];
  posAccByte3.forEach(function (d) {
    var temp = {}
    var format = d3.time.format("%Y-%m-%d");
    var originTime = format.parse('2004-01-01');
    var addSecsStart = parseInt((d.StartTime / 1000000) - 35);
    var addSecsEnd = parseInt((d.Endtime / 1000000) - 35);
    var summedTimeStart = d3.time.second.offset(originTime, addSecsStart);
    var summedTimeEnd = d3.time.second.offset(originTime, addSecsEnd);

    temp.StartTime = summedTimeStart;
    temp.EndTime = summedTimeEnd;

    temp.Value = (d.Value*.05).toFixed(2);   
    items.push(temp);
  });
  items.sort(function(a, b) { return a.StartTime - b.StartTime; }); 
  
  //Event 3
  var pAB3 = barChart(items, 'posAccByteField3', 'PosAccurByte1Events', {
    yLabel: 'm',
    yDomain: [0, 12.7],
  });
  pAB3.draw();    
});

d3.csv('csv/sampled/bsm_posaccurbyte4.csv', function (posAccByte4) {
  var items = [];
  posAccByte4.forEach(function (d) {
    var temp = {}
    var format = d3.time.format("%Y-%m-%d");
    var originTime = format.parse('2004-01-01');
    var addSecsStart = parseInt((d.StartTime / 1000000) - 35);
    var addSecsEnd = parseInt((d.Endtime / 1000000) - 35);
    var summedTimeStart = d3.time.second.offset(originTime, addSecsStart);
    var summedTimeEnd = d3.time.second.offset(originTime, addSecsEnd);

    temp.StartTime = summedTimeStart;
    temp.EndTime = summedTimeEnd;

    temp.Value = (d.Value*.05).toFixed(2);   
    items.push(temp);
  });
  items.sort(function(a, b) { return a.StartTime - b.StartTime; }); 
  
  //Event 4
  var pAB4 = barChart(items, 'posAccByteField4', 'PosAccurByte1Events', {
    yLabel: 'm',
    yDomain: [0, 12.7],
  });
  pAB4.draw();    
});