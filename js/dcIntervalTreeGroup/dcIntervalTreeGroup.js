/* Interval tree approach to graphing time intervals */
function intervalTreeGroup(tree, firstDate, lastDate) {
    return {
        all: function () {
            var begin = d3.time.month(firstDate),
                end = d3.time.month(lastDate);

            var i = new Date(begin);
            var ret = [],
                count;
            do {
                next = new Date(i);
                next.setMonth(next.getMonth() + 1);
                count = 0;
                tree.queryInterval(i.getTime(), next.getTime(), function () {
                    ++count;
                });
                ret.push({key: i, value: count});
                i = next;
            } while (i.getTime() <= end.getTime());
            return ret;
        },
    };
}
