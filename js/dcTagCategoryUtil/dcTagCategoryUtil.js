/* For the given dataset, pull out all tag names matching the given category from the full tags array */
function getTagsByCategory(tags, datasetID, tagCategory) {
    return _.chain(tags[datasetID])
        .filter(function (d) {
            return d.tagCategory === tagCategory;
        })
        .map('tag')
        .value();
}


/* Set the dimension/group on a chart from a tag category. We have to find
 * all the tags with the specified category for each row of data.
 * Optionally takes a function to map over the tag values.
 * Function is called with the row's tag value.
 *
 * Much code copied from here:
 * http://stackoverflow.com/questions/17524627/is-there-a-way-to-tell-crossfilter-to-treat-elements-of-array-as-separate-record
 */
function setTagCategoryDimGroup(chart, ndx, tags, tagCategory) {
    var dim = ndx.dimension(function (d) {
        return getTagsByCategory(tags, d.datasetID, tagCategory);
    });

    var group = dim.groupAll().reduce(
        function (p, v) {
            var rowTags = getTagsByCategory(tags, v.datasetID, tagCategory);
            rowTags.forEach(function (val, ndx) {
                p[val] = (p[val] || 0) + 1;
            });
            return p;
        },
        function (p, v) {
            var rowTags = getTagsByCategory(tags, v.datasetID, tagCategory);
            rowTags.forEach(function (val, ndx) {
                p[val] = (p[val] || 0) - 1;
            });
            return p;
        },
        function () {
            return {};
        }).value();

    /* Hack to make this work with dc --
     * return the group key-value pairs (minus the all function)
     */
    group.all = function () {
        var returnVal = [];

        _.chain(this)
            .omit('all')
            .mapKeys(function (value, key) {
                returnVal.push({
                    key: key,
                    value: value,
                });
            })
            .value();

        return returnVal;
    };

    /* Hack to make filtering work */
    chart.dimension(dim).group(group)
        .filterHandler(function (dim, filters) {
            if (filters.length === 0) {
                dim.filter(null);
            }
            else {
                dim.filterFunction(function (d) {
                    return _.intersection(d, filters).length > 0;
                });
            }
            return filters;
        });
            
}
