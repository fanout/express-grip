/*
 * express-grip - GRIP library for Express
 * (C) 2015 Fanout, Inc.
 * gripmiddleware.js
 * File contains: the Express GRIP middleware functionality
 * File authors:
 * Konstantin Bokarius <kon@fanout.io>
 * Licensed under the MIT License, see file COPYING for details.
 */

var grip = require('grip');
var expressGrip = require('express-grip');

function preHandlerGripMiddleware(req, res, next) {
    res.gripOriginalEnd = res.end.bind(res);
    res.end = function(chunk, encoding) {
        this.locals.gripEndParams = [ chunk, encoding ];
    };
    res.locals.gripProxied = false;
    res.locals.gripWsContext = undefined;
    var gripSigned = false;
    var gripProxies = expressGrip.gripProxies;
    var gripSigHeader = req.get('grip-sig');
    if (gripSigHeader !== undefined && gripProxies !== undefined) {
        gripProxies.forEach(function(entry) {
            if (grip.validateSig(gripSigHeader, entry.key)) {
                gripSigned = true;
            }
        });
    }
    var contentType = req.get('content-type');
    if (contentType !== undefined) {
        var at = contentType.indexOf(';');
        if (at >= 0) {
            contentType = contentType.substring(0, at);
        }
    }
    var acceptTypes = req.get('accept');
    if (acceptTypes !== undefined) {
        tmp = acceptTypes.split(',');
        acceptTypes = [];
        tmp.forEach(function(s) {
            acceptTypes.push(s.trim());
        });
    }    
    var wsContext = undefined;
    var appWsEventsText = 'application/websocket-events';
    if (req.method == 'POST' && (contentType == appWsEventsText ||
            (acceptTypes !== undefined &&
            acceptTypes.indexOf(appWsEventsText) >= 0))) {
        console.log('here123');
        var cid = req.get('connection-id');
        meta = {};
        for (var key in req.headers) {
            if (req.headers.hasOwnProperty(key)) {
                if (key.toLowerCase().indexOf('http-meta-') == 0) {
                    meta[convertHeaderName(key.substring(10))] = req.headers[key];
                }
            }
        }
        var body = '';
        req.on('data', function (chunk) {
            body += chunk;
        });
        req.on('end', function() {
            var events = undefined;
            try {
                events = grip.decodeWebSocketEvents(body);
            }
            catch (err) {
                res.statusCode = 400;
                res.send("Error parsing WebSocket events.\n");
                res.end();
                return;
            }
            wsContext = new grip.WebSocketContext(cid, meta, events,
                    expressGrip.prefix);
            res.locals.gripProxied = gripSigned;
            res.locals.gripWsContext = wsContext;
            next();
        });
    } else {
        next();
    }
}

function postHandlerGripMiddleware(req, res, next) {


    if (res.locals.gripEndParams) {
        res.gripOriginalEnd(res.locals.gripEndParams[0],
                res.locals.gripEndParams[1]);
    }
}

function convertHeaderName(name) {
    return name.replace('_', '-').toLowerCase();    
}

exports.preHandlerGripMiddleware = preHandlerGripMiddleware;
exports.postHandlerGripMiddleware = postHandlerGripMiddleware;
