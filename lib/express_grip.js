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

// TODO: Figure out how to best configure the proxies.
var gripProxies = null;
var pubServers = null;
var prefix = '';
var isGripProxyRequired = false;
var pubControl = null;

var objectToString = Object.prototype.toString;
var functionObjectIdentifier = objectToString.call(function(){});
function isFunction(obj) {
    return obj && objectToString.call(obj) === functionObjectIdentifier;
}

function configure(config) {
    gripProxies = config.gripProxies;
    pubServers = config.gripPubServers;
    prefix = config.gripPrefix;
    isGripProxyRequired = config.gripIsProxyRequired;
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

function getPubControl() {
    if (pubControl == null) {
        pubControl = new grip.GripPubControl();
        if (gripProxies != null) {
            pubControl.applyGripConfig(gripProxies);
        }
        if (pubServers != null) {
            pubControl.applyConfig(pubServers);
        }
    }

    return pubControl;
}

exports.configure = configure;
exports.publish = publish;
exports.prefix = prefix;
exports.isGripProxyRequired = isGripProxyRequired;
exports.gripProxies = gripProxies;
exports.pubServers = pubServers;
exports.gripMiddleware = gripMiddleware.gripMiddleware;
