/* Promisified PapaParse */
var PapaPromise = (function () {
    function PapaPromise() {
    }
    PapaPromise.parse = function (file, options) {
        return new Promise(function (resolve, reject) {
            options.complete = resolve;
            options.error = reject;
            Papa.parse(file, options);
        });
    };
    return PapaPromise;
}());
