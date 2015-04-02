/*
 * A request is effectively an incoming action from either Matrix or IRC. This
 * is specifically NOT HTTP requests given transactions can have many events
 * in them, and IRC is just a TCP stream.
 *
 * Each request needs to be accounted for, so this file manages the requests
 * over its lifetime, specifically for logging.
 */
"use strict";

var q = require("q");
var logging = require("../logging")
var log = logging.get("req");

 // valid error codes to fail a request
module.exports.ERR_VIRTUAL_USER = "virtual-user";

var outstandingRequests = {
    // request_id : Request
};
// find an outstanding request
module.exports.findRequest = function(requestId) {
    return outstandingRequests[requestId];
};

module.exports.newRequest = function() {
    var requestId = generateRequestId();
    var request = {
        log: logging.newRequestLogger(log, requestId),
        defer: q.defer(),
        start: Date.now(),
        id: requestId
    };
    outstandingRequests[requestId] = request;

    // expose an error handler to prevent defer boilerplate leaking everywhere
    request.errFn = function(err) {
        if (err.stack) {
            request.log.error(err.stack);
        }
        request.defer.reject(err);
    };
    request.sucFn = function() {
        request.defer.resolve();
    };

    request.defer.promise.done(function() {
        request.finished = true;
        var delta = Date.now() - request.start;
        request.log.debug("SUCCESS - %s ms", delta);
        delete outstandingRequests[requestId];
    }, function(err) {
        request.finished = true;
        var delta = Date.now() - request.start;
        delete outstandingRequests[requestId];
        if (err === module.exports.ERR_VIRTUAL_USER) {
            request.log.debug("IGNORED - %s ms (Sender is a virtual user.)",
                delta);
            return;
        }
        request.log.debug("FAILED - %s ms (%s)", delta, JSON.stringify(err));
    });
    // useful for debugging as well in case we miss a resolve/reject somewhere.
    setTimeout(function() {
        if (!request.finished) {
            request.log.error("DELAYED - Taking too long. (>7000ms)");
        }
    }, 7000);
    return request;
};

var generateRequestId = function() {
    return (Math.random()* 1e20).toString(36);
};