/*
 * express-grip - GRIP library for Express
 * (C) 2015 Fanout, Inc.
 * express_grip.js
 * File contains: the Express GRIP functionality
 * File authors:
 * Konstantin Bokarius <kon@fanout.io>
 * Licensed under the MIT License, see file COPYING for details.
 */

var pubcontrol = require('pubcontrol')
var grip = require('grip')
var gripMiddleware = require('./gripmiddleware');

var gripProxies = undefined;
var pubServers = undefined;
var prefix = '';
var isGripProxyRequired = false;
var pubControl = undefined;

var objectToString = Object.prototype.toString;
var functionObjectIdentifier = objectToString.call(function(){});
function isFunction(obj) {
    return obj && objectToString.call(obj) === functionObjectIdentifier;
}
var arrayObjectIdentifier = objectToString.call([]);
function isArray(obj) {
    return obj && objectToString.call(obj) === arrayObjectIdentifier;
}
var stringObjectIdentifier = objectToString.call('');
var isString = function(obj) {
    return obj && objectToString.call(obj) === stringObjectIdentifier;
};

function configure(config) {
    module.exports.gripProxies = gripProxies = config.gripProxies;
    module.exports.gripPubServers = pubServers = config.gripPubServers;
    module.exports.gripPrefix = prefix = config.gripPrefix;
    module.exports.gripIsProxyRequired = isGripProxyRequired =
            config.gripIsProxyRequired;
}

function publish(channel, formats, id, prev_id, cb) {
    if (isFunction(id)) {
        cb = id;
        id = undefined;
        prevId = undefined;
    }
    var pubControl = getPubControl();
    pubControl.publish(prefix + channel, new pubcontrol.Item(
            formats, id, prev_id), cb);
}

function setHoldLongpoll(response, channels, timeout) {
    response.locals.gripHold = 'response';
    response.locals.gripChannels = convertChannels(channels);
    response.locals.gripTimeout = timeout;
}

function setHoldStream(response, channels) {
    response.locals.gripHold = 'stream';
    response.locals.gripChannels = convertChannels(channels);
}

function isGripProxied(response) {
    if (response.locals.gripProxied !== undefined) {
        return response.locals.gripProxied;
    }
    return false;
}

function getWsContext(response) {
    if (response.locals.gripWsContext !== undefined && 
            response.locals.gripWsContext !== undefined) {
        return response.locals.gripWsContext;
    }
    return undefined;
}

function verifyIsWebSocket(response, next) {
    if (!getWsContext(response)) {
        response.statusCode = 400;
        response.send("Non-WebSocket requests not allowed.\n");
        next();
        return false;
    }
    return true;
}

function convertChannels(channels) {
    if(!isArray(channels)) {
        channels = [channels];
    }
    var convertedChannels = [];
    channels.forEach(function(channel) {
        if (isString(channel)) {
            channel = new grip.Channel(channel);
        }
        convertedChannels.push(channel);
    });
    return convertedChannels;
}

function getPubControl() {
    if (pubControl === undefined) {
        pubControl = new grip.GripPubControl();
        if (gripProxies !== undefined) {
            pubControl.applyGripConfig(gripProxies);
        }
        if (pubServers !== undefined) {
            pubControl.applyConfig(pubServers);
        }
    }

    return pubControl;
}

exports.configure = configure;
exports.publish = publish;
exports.setHoldLongpoll = setHoldLongpoll;
exports.setHoldStream = setHoldStream;
exports.isGripProxied = isGripProxied;
exports.getWsContext = getWsContext;
exports.verifyIsWebSocket = verifyIsWebSocket;
exports.prefix = prefix;
exports.isGripProxyRequired = isGripProxyRequired;
exports.gripProxies = gripProxies;
exports.pubServers = pubServers;
exports.preHandlerGripMiddleware = gripMiddleware.preHandlerGripMiddleware;
exports.postHandlerGripMiddleware = gripMiddleware.postHandlerGripMiddleware;
