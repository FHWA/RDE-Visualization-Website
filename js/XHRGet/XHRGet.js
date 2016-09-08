/* Promisified HTTP GET request */
var xhrGet = function (url, headers, body, timeout) {
    var xhr = new XMLHttpRequest();
    var promise = new Promise(function (resolve, reject) {
        xhr.onload = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            if (xhr.status === 200) {
                resolve(xhr.responseText);
            }
            else {
                reject(xhr.statusText);
            }
        };
        xhr.onerror = function () {
            reject(xhr.statusText);
        };
    });

    xhr.open('GET', url, true);

    Object.keys(headers || {}).forEach(function (key) {
        xhr.setRequestHeader(key, headers[key]);
    });

    if (timeout) {
        promise.timeout(timeout);
    }

    xhr.send(JSON.stringify(body));
    return promise;
};
