/*
 * express-grip - GRIP library for Express
 * (C) 2015 Fanout, Inc.
 * express_grip.js
 * File contains: the Express GRIP functionality
 * File authors:
 * Konstantin Bokarius <kon@fanout.io>
 * Licensed under the MIT License, see file COPYING for details.
 */

var base = require('./base')
var gripMiddleware = require('./gripmiddleware');

exports.configure = base.configure;
exports.publish = base.publish;
exports.setHoldLongpoll = base.setHoldLongpoll;
exports.setHoldStream = base.setHoldStream;
exports.isGripProxied = base.isGripProxied;
exports.getWsContext = base.getWsContext;
exports.verifyIsWebSocket = base.verifyIsWebSocket;
exports.prefix = base.prefix;
exports.isProxyRequired = base.isGripProxyRequired;
exports.gripProxies = base.gripProxies;
exports.pubServers = base.pubServers;
exports.preHandlerGripMiddleware = gripMiddleware.preHandlerGripMiddleware;
exports.postHandlerGripMiddleware = gripMiddleware.postHandlerGripMiddleware;
