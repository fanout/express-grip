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
var pubControl = null;

function publish(channel, formats, id, prev_id) {
    var pubControl = getPubControl();
    pubControl.publish(prefix + channel, new pubcontrol.Item(
            formats, id, prev_id));
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

exports.gripProxies = gripMiddleware.gripProxies;
exports.pubServers = gripMiddleware.pubServers;
exports.gripMiddleware = gripMiddleware.gripMiddleware;
