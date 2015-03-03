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
    res.locals.gripWsContext = null;
    res.locals.gripHold = null;
    res.locals.gripTimeout = null;
    var gripSigned = false;
    var gripProxies = expressGrip.gripProxies;
    var gripSigHeader = req.get('grip-sig');
    if (gripSigHeader !== undefined && gripProxies != null) {
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
    var wsContext = null;
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
            var events = null;
            try {
                events = grip.decodeWebSocketEvents(body);
            }
            catch (err) {
                res.statusCode = 400;
                res.gripOriginalEnd("Error parsing WebSocket events.\n");
                return;
            }
            wsContext = new WebSocketContext(cid, meta, events,
                    expressGrip.prefix);
            res.locals.gripWsContext = wsContext;
            next();
        });
    } else {
        next();
    }
}

function postHandlerGripMiddleware(req, res, next) {
    if (res.statusCode == 200 && res.locals.gripWsContext != null) {
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
        res.charset = '';
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
    } else if (res.locals.gripHold != null) {
        if (!res.locals.gripProxied && expressGrip.isProxyRequired) {
            res.statusCode = 501;
            res.gripOriginalEnd("Not implemented.\n");
            return;
        }
        var channels = res.locals.gripChannels;
        var prefix = expressGrip.prefix;
        if (prefix) {
            channels.forEach(function(channel) {
                channel.name = prefix + channel.name;
            });
        }
        if (res.statusCode == 304) {
            // deep copy
            var iheaders = JSON.parse(JSON.stringify(res._headers));
            var origBody = res.locals.gripEndParams[0];
            var iresponse = new grip.Response(res.statusCode, null,
                    iheaders, origBody);
            var timeout = res.locals.gripTimeout;
            res.locals.gripEndParams[0] = grip.createHold(res.locals.gripHold,
                    channels, iresponse, timeout);
            for (var key in res._headers) {
                if (res._headers.hasOwnProperty(key)) {
                    res.removeHeader(key);
                }
            }
            res.set('Content-Type', 'application/grip-instruct');
        } else {
            res.set('Grip-Hold', res.locals.gripHold);
            res.set('Grip-Channel', grip.createGripChannelHeader(channels));
            if (res.locals.gripTimeout != null) {
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
    return name.toLowerCase();
}

var extend = function() {
    var args = Array.prototype.slice.call(arguments);

    var obj;
    if (args.length > 1) {
        obj = args.shift();
    } else {
        obj = {};
    }

    while(args.length > 0) {
        var opts = args.shift();
        if(opts != null) {
            for(prop in opts) {
                obj[prop] = opts[prop];
            }
        }
    }

    return obj;
};

var extendClass = function(prototype) {
    var constructor, properties;
    var argc = arguments.length;
    if (argc >= 3) {
        constructor = arguments[1];
        properties = arguments[2];
    } else if (argc == 2) {
        var arg = arguments[1];
        if(isFunction(arg)) {
            constructor = arg;
            properties = null;
        } else {
            constructor = function(){};
            properties = arg;
        }
    } else if (argc == 1) {
        constructor = function(){};
        properties = null;
    }

    if (isFunction(prototype)) {
        prototype = new prototype();
    }

    if(prototype) {
        constructor.prototype = prototype;
    }
    if(properties) {
        extend(constructor.prototype, properties);
    }
    return constructor;
};

var defineClass = function() {
    var args = [null].concat(Array.prototype.slice.call(arguments));
    return extendClass.apply(this, args);
};

var objectToString = Object.prototype.toString;
var functionObjectIdentifier = objectToString.call(function(){});
var isFunction = function(obj) {
    return obj && objectToString.call(obj) === functionObjectIdentifier;
};
var arrayObjectIdentifier = objectToString.call([]);

var isArray = function(obj) {
    return obj && objectToString.call(obj) === arrayObjectIdentifier;
};
var stringObjectIdentifier = objectToString.call('');

var isString = function(obj) {
    return obj && objectToString.call(obj) === stringObjectIdentifier;
};

var WebSocketContext = defineClass(function(id, meta, inEvents, prefix) {
    this.id = id;
    this.inEvents = inEvents;
    this.readIndex = 0;
    this.accepted = false;
    this.closeCode = null;
    this.closed = false;
    this.outCloseCode = null;
    this.outEvents = [];
    this.origMeta = meta;
    this.meta = JSON.parse(JSON.stringify(meta));
    this.prefix = '';   
    if (prefix) {
        this.prefix = prefix;
    }
}, {
    isOpening: function() { return this.inEvents != null &&
            this.inEvents.length > 0 && this.inEvents[0].type == 'OPEN'; },
    accept: function() { this.accepted = true; },
    close: function(code) {
        this.closed = true;
        if (code !== undefined) {
            this.outCloseCode = code;
        } else {
            this.outCloseCode = 0;
        }
    },
    canRecv: function() {
        for (n = this.readIndex; n < this.inEvents.length; n++) {
            if (['TEXT', 'BINARY', 'CLOSE', 'DISCONNECT'].indexOf(
                    this.inEvents[n].type) > -1) {
                return true;
            }
        }
        return false;
    },
    recv: function() {
        var e = null;
        while (e == null && this.readIndex < this.inEvents.length) {
            if (['TEXT', 'BINARY', 'CLOSE', 'DISCONNECT'].indexOf(
                    this.inEvents[this.readIndex].type) > -1) {
                e = this.inEvents[this.readIndex];
            } else if (this.inEvents[this.readIndex].type == 'PING') {
                this.outEvents.push(new grip.WebSocketEvent('PONG'));
            }
            this.readIndex += 1;
        }
        if (e == null) {
            throw new Error('Read from empty buffer.');
        }
        if (e.type == 'TEXT' || e.type == 'BINARY') {
            return e.content;
        } else if (e.type == 'CLOSE') {
            if (e.content && e.content.length == 2) {
                this.closeCode = jspack.Unpack('H', [e.content.charCodeAt(1),
                    e.content.charCodeAt(0)])[0];
            }
            return null;
        } else {
            throw new Error('Client disconnected unexpectedly.');
        }
    },
    send: function(message) {
        this.outEvents.push(new grip.WebSocketEvent('TEXT', 'm:' + message));
    },
    sendControl: function(message) {
        this.outEvents.push(new grip.WebSocketEvent('TEXT', 'c:' + message));
    },
    subscribe: function(channel) {
        this.sendControl(grip.webSocketControlMessage('subscribe',
                {'channel': this.prefix + channel}));
    },
    unsubscribe: function(channel) {
        this.sendControl(grip.webSocketControlMessage('unsubscribe',
                {'channel': this.prefix + channel}));
    },
    detach: function() {
        this.sendControl(grip.webSocketControlMessage('detach'));
    }
});

exports.preHandlerGripMiddleware = preHandlerGripMiddleware;
exports.postHandlerGripMiddleware = postHandlerGripMiddleware;
