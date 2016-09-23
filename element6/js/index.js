//front and back of stack
d3.selection.prototype.moveToBack = function() {
  return this.each(function() {
    var firstChild = this.parentNode.firstChild;
    if (firstChild) {
      this.parentNode.insertBefore(this, firstChild);
    }
  });
};

d3.selection.prototype.moveToFront = function() {
  return this.each(function() {
    this.parentNode.appendChild(this);
  });
};

var barPadding = 25;
//convert number to 8bit with leading zeros
function tobin(n) {
  var s = "";
  for (; n >= 0; n /= 2) {
    var rem = n % 2;
    n -= rem;
    s = rem + s;
    if (n == 0) break
  }

  //add leading zeros
  String.prototype.lpad = function(padString, length) {
    var str = this;
    while (str.length < length)
      str = padString + str;
    return str;
  }

  var str = s;
  var zeropadded = str.lpad("0", 8);

  return (zeropadded)
} //end tobin


function formatStartEndTimes(d) {
  var format = d3.time.format("%Y-%m-%d");
  var originTime = format.parse('2004-01-01');
  var addSecsStart = parseInt((d.StartTime / 1000000) - 35);
  var addSecsEnd = parseInt((d.Endtime / 1000000) - 35);
  var summedTimeStart = d3.time.second.offset(originTime, addSecsStart)
  var summedTimeEnd = d3.time.second.offset(originTime, addSecsEnd)

  d.StartTime = summedTimeStart;
  d.Endtime = summedTimeEnd;
}


function addGenTime(d) {
  var parseOrigin = d3.time.format("%Y-%m-%d").parse;
  var parseGenTime = d3.time.format("%S").parse;
  var originTime = parseOrigin('2004-01-01');
  var NewGen = (((parseInt(d.GenTime)) / 1000000) - 35);
  var summedTime = d3.time.second.offset(originTime, NewGen);

  d.GenTime = summedTime;
}


var sizetoggle = function() {
  var parentColumn = $(this).parents(".column");
  var parentFileBox = $(this).parents(".filebox");
  parentColumn.toggleClass("expanded");
  $('.column').not(parentColumn).toggleClass("shrunk");
  $('.filebox').not(parentFileBox).toggleClass("shrunk");
}

function addentries(items, divid) {
  var toprow = items[0];
  var valfields = divid.selectAll(".toptext div");

  valfields.each(function(d) {
    var thiscat = d3.select(this).attr("name");
    var thisthing = d3.select(this);

    if (toprow[thiscat]) {
      thisthing.append("div")
        .attr("class", "valtext valentry")
        .append("text")
        .html(function(d) {
          return '<span class="instruct">sample entry: </span>' + toprow[thiscat]
        });
    }
  });
} //end add entries