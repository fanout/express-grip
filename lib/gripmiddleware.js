/*
 * express-grip - GRIP library for Express
 * (C) 2015 Fanout, Inc.
 * gripmiddleware.js
 * File contains: the Express GRIP middleware functionality
 * File authors:
 * Konstantin Bokarius <kon@fanout.io>
 * Licensed under the MIT License, see file COPYING for details.
 */

var jspack = require('jspack').jspack;
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
    res.locals.gripProxied = gripSigned;
    var contentType = req.get('content-type');
    if (contentType !== undefined) {
        var at = contentType.indexOf(';');
        if (at >= 0) {
            contentType = contentType.substring(0, at);
        }
    }
    var acceptTypes = req.get('accept');
    if (acceptTypes !== undefined) {
        var tmp = acceptTypes.split(',');
        var acceptTypes = [];
        tmp.forEach(function(s) {
            acceptTypes.push(s.trim());
        });
    }    
    var wsContext = undefined;
    var appWsEventsText = 'application/websocket-events';
    if (req.method == 'POST' && (contentType == appWsEventsText ||
            (acceptTypes !== undefined &&
            acceptTypes.indexOf(appWsEventsText) >= 0))) {
        var cid = req.get('connection-id');
        var meta = {};
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
                res.gripOriginalEnd("Error parsing WebSocket events.\n");
                return;
            }
            wsContext = new grip.WebSocketContext(cid, meta, events,
                    expressGrip.prefix);
            res.locals.gripWsContext = wsContext;
            next();
        });
    } else {
        next();
    }
}

function postHandlerGripMiddleware(req, res, next) {
    if (res.statusCode == 200 && res.locals.gripWsContext !== undefined) {
        var wsContext = res.locals.gripWsContext;
        var metaRemove = []
        for (var k in wsContext.origMeta) {
            if (wsContext.origMeta.hasOwnProperty(k)) {  
                var found = false;
                for (var nk in wsContext.meta) {
                    if (wsContext.meta.hasOwnProperty(nk)) {
                        if (nk.toLowerCase() == k) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    metaRemove.push(k);
                }
            }
        }
        var metaSet = {};
        for (var k in wsContext.meta) {
            if (wsContext.meta.hasOwnProperty(k)) {
                var lname = k.toLowerCase();
                var needSet = true;
                for (var ok in wsContext.origMeta) {
                    if (wsContext.origMeta.hasOwnProperty(ok)) {
                        if (lname == ok && wsContext.meta[k] == 
                                wsContext.origMeta[ok]) {
                            needSet = false;
                            break;
                        }
                    }
                }
                if (needSet) {
                    metaSet[lname] = wsContext.meta[k];
                }
            }
        }
        var events = [];
        if (wsContext.accepted) {
            events.push(new grip.WebSocketEvent('OPEN'));
        }
        wsContext.outEvents.forEach(function(event) {
            events.push(event);
        });
        if (wsContext.closed) {
            var octets = jspack.Pack('H', [wsContext.outCloseCode]);
            events.push(new grip.WebSocketEvent('CLOSE', 
                    String.fromCharCode(octets[1]) +
                    String.fromCharCode(octets[0])));
        }
        res.send(grip.encodeWebSocketEvents(events));
        res.set('Content-Type', 'application/websocket-events');
        if (wsContext.accepted) {
            res.set('Sec-WebSocket-Extensions', 'grip');
        }
        metaRemove.forEach(function(k) {
            res.set('Set-Meta-' + k, '');
        });
        for (var k in metaSet) {
            if (metaSet.hasOwnProperty(k)) {
                res.set('Set-Meta-' + k, metaSet[k]);
            }
        }
    } else if (res.locals.gripHold !== undefined) {
        if (!res.locals.gripProxied && expressGrip.isGripProxyRequired) {
            res.statusCode = 501;
            res.gripOriginalEnd("Not implemented.\n");
            return;
        }
        var channels = res.locals.gripChannels;
        var prefix = expressGrip.prefix;
        if (prefix != '') {
            channels.forEach(function(channel) {
                channel.name = prefix + channel.name;
            });
        }
        if (res.statusCode == 304) {
            var iheaders = JSON.parse(JSON.stringify(res._headers));
            var origBody = res.locals.gripEndParams[0];
            var iresponse = new grip.Response(res.statusCode, undefined,
                    iheaders, origBody);
            var timeout = res.locals.gripTimeout;
            res.locals.gripEndParams[0] = grip.createHold(res.locals.gripHold,
                    channels, iresponse, timeout);
            res._headers = { 'Content-Type': 'application/grip-instruct' };
        } else {
            res.set('Grip-Hold', res.locals.gripHold);
            res.set('Grip-Channel', grip.createGripChannelHeader(channels));
            if (res.locals.gripTimeout !== undefined) {
                res.set('Grip-Timeout', res.locals.gripTimeout);
            }
        }
    }
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
