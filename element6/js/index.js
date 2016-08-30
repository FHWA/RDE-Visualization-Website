//front and back of stack
d3.selection.prototype.moveToBack = function () {
    return this.each(function () {
        var firstChild = this.parentNode.firstChild;
        if (firstChild) {
            this.parentNode.insertBefore(this, firstChild);
        }
    });
};

d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};


///////
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
    String.prototype.lpad = function (padString, length) {
        var str = this;
        while (str.length < length)
            str = padString + str;
        return str;
    }

    var str = s;
    var zeropadded = str.lpad("0", 8);


    //  console.log(zeropadded)
    return (zeropadded)

    // console.log(n);
    // console.log(s);
    //                //add leading zeros
    //                var addZeros = 8 - (s.length);
    //                //var test= (0).parseInt(addZeros);
    ////                var test = (0.0000000000000003).toFixed(parseInt(addZeros));
    //       var test = (0.0000000000000003).toFixed(parseInt(addZeros));
    //      console.log(test);
    //                var newstring = (String(test).substring(2, addZeros + 2));
    //                return (newstring) + (s.toString());
    //
    //      
    //       console.log(newstring);
    //      console.log(s.toString());

    //      function padDigits(number, digits) {
    //    return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
    //      
    //        var zeropadded = padDigits(8, s); // "0010"

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
    //console.log(originTime);
    var NewGen = (((parseInt(d.GenTime)) / 1000000) - 35);
    //console.log(NewGen);

    var summedTime = d3.time.second.offset(originTime, NewGen);
    //console.log(summedTime);

    d.GenTime = summedTime;
}


var  sizetoggle = function(){ 
    var parentColumn = $(this).parents(".column");
         var parentFileBox = $(this).parents(".filebox");
        parentColumn.toggleClass("expanded");
        $('.column').not(parentColumn).toggleClass("shrunk");
        $('.filebox').not(parentFileBox).toggleClass("shrunk");
        
}

function addentries(items, divid){

        var toprow = items[0];

     var valfields = divid.selectAll(".toptext div");

      //  var valfields = d3.select("#" + divid).selectAll(".toptext div");


        valfields.each(function (d) {

            var thiscat = d3.select(this).attr("name");
            var thisthing = d3.select(this);
            
            
            if(toprow[thiscat]){

            thisthing.append("div")
                //  .style("border", "1px solid green")
                .attr("class", "valtext valentry")
                .append("text")
                .html(function (d) {
                    return '<span class="instruct">sample entry: </span>' + toprow[thiscat]
                });
                
            }
            // .html( "****");  
        });

}//end add entries



//
//function analyze(error, data, tripSum_data, SteerAng, brake1_data, brake2_data, throttle_data, trans_data, lights_data) {
//    if (error) throw error;
//
//    testpaths(data);
//    // bb1(brake1_data);
//    //lights(lights_data);
//   //tripSum(tripSum_data);
//    //steer(SteenAng);
//    throttle(throttle_data);
//   // transstate(trans_data);
//    
//    
//} //end analyze
//
//d3.queue()
//    .defer(d3.csv, "csv/bsm_p1.csv")
//    .defer(d3.csv, "csv/BSM_Trip_Summary_File_04_11_13.csv")
//    .defer(d3.csv, "csv/SteerAngleEventsConversion.csv")
//    //.defer(d3.csv, "csv/BrakeByte1Events_04_11_13.csv")
//    .defer(d3.csv, "csv/BrakeByte2Events_04_11_13.csv")
//    .defer(d3.csv, "csv/ThrottlePositionEvents_04_11_13.csv")
//    .defer(d3.csv, "csv/TransStateEvents_04_11_13.csv")
////    .defer(d3.csv,"csv/ExteriorLightsEvents_04_11_13.csv")
//    .await(analyze);


//fix since brush gets appended late and covers it up
d3.selectAll(".context").select("x.axis").moveToFront();

//attempt at bigger, more useable brush handles
