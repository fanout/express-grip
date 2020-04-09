/*
 * express-grip - GRIP library for Express
 * (C) 2015, 2019 Fanout, Inc.
 * express_grip.js
 * File contains: the Express GRIP functionality
 * File authors:
 * Konstantin Bokarius <kon@fanout.io>, Katsuyuki Ohmuro <harmony7@pex2.jp>
 * Licensed under the MIT License, see file COPYING for details.
 */

import { jspack } from 'jspack';
/// <reference path="./types/jspack.d.ts" />

import PubControl, { IFormat, IPubControlConfig } from '@fanoutio/pubcontrol';
const { Item } = PubControl;

import {
    Channel,
    createGripChannelHeader,
    createHold,
    decodeWebSocketEvents,
    encodeWebSocketEvents,
    GripPubControl,
    IGripConfig,
    Response,
    validateSig,
    WebSocketContext,
    WebSocketEvent,
} from '@fanoutio/grip';

import IExpressGripConfig from "./IExpressGripConfig";
import IGripExpressResponse from "./IGripExpressResponse";
import IGripExpressRequest from "./IGripExpressRequest";
import { RequestHandler } from "express";

const CONTENT_TYPE_APP_WS_EVENTS = 'application/websocket-events';

export default class ExpressGrip {
    gripProxies?: IGripConfig[];
    pubServers?: IPubControlConfig[];
    prefix: string = '';
    isGripProxyRequired: boolean = false;

    _pubControl?: GripPubControl;
    preGrip: RequestHandler;
    postGrip: RequestHandler;

    constructor(config?: IExpressGripConfig) {

        this.applyConfig(config);

        this.preGrip = this._preGrip.bind(this);
        this.postGrip = this._postGrip.bind(this);

    }

    applyConfig(config: IExpressGripConfig = {}) {

        const { gripProxies, gripPubServers, gripProxyRequired, gripPrefix } = config;

        this.gripProxies = gripProxies;
        this.pubServers = gripPubServers;
        this.isGripProxyRequired = gripProxyRequired ?? false;
        this.prefix = gripPrefix ?? '';

    }

    getPubControl() {
        if (this._pubControl == null) {
            this._pubControl = new GripPubControl();
            if (this.gripProxies != null) {
                this._pubControl.applyGripConfig(this.gripProxies);
            }
            if (this.pubServers != null) {
                this._pubControl.applyConfig(this.pubServers);
            }
        }
        return this._pubControl;
    }

    async publish(channel: string, formats: IFormat | IFormat[], id?: string, prevId?: string) {
        const pubControl = this.getPubControl();
        await pubControl.publish(
            this.prefix + channel,
            new Item(formats, id, prevId)
        );
    }

    // Middleware

    _preGrip(req: IGripExpressRequest, res: IGripExpressResponse, next: Function) {
        res.gripOriginalEnd = res.end.bind(res);
        // @ts-ignore
        res.end = function(chunk: any, encoding?: string) {
            this.locals.gripEndParams = [ chunk, encoding ];
        };
        res.locals.gripProxied = false;
        res.locals.gripSigned = false;
        res.locals.gripWsContext = null;
        res.locals.gripHold = null;
        res.locals.gripTimeout = null;

        const gripSigHeader = req.get('grip-sig');

        let gripProxied = false;
        let gripSigned = false;
        if (gripSigHeader !== undefined && this.gripProxies != null) {
            if (this.gripProxies.every(proxy => proxy.key)) {
                // If all proxies have keys, then only consider the request
                // signed if at least one of them has signed it
                if (this.gripProxies.some(proxy => validateSig(gripSigHeader, proxy.key))) {
                    gripProxied = true;
                    gripSigned = true;
                }
            } else {
                gripProxied = true;
            }
        }
        res.locals.gripProxied = gripProxied;
        res.locals.gripSigned = gripSigned;

        let contentType = req.get('content-type');
        if (contentType != null) {
            const at = contentType.indexOf(';');
            if (at >= 0) {
                contentType = contentType.substring(0, at);
            }
        }

        const acceptTypes = req.get('accept')
            ?.split(',')
            .map(item => item.trim());

        let wsContext = null;
        if( req.method === 'POST' &&
            (
                contentType === CONTENT_TYPE_APP_WS_EVENTS ||
                (
                    acceptTypes != null && acceptTypes.includes(CONTENT_TYPE_APP_WS_EVENTS)
                )
            )
        ) {
            const cid = req.get('connection-id') as string;
            const meta = Object
                .entries(req.headers)
                .reduce((acc, [key, value]) => {
                    const lKey = key.toLowerCase();
                    if (lKey.startsWith('meta-')) {
                        acc[lKey.substring(5)] = value;
                    }
                    return acc;
                }, {});

            req._body = true;
            let bodySegments: any[] = [];
            req.on('data', (chunk) => {
                bodySegments.push(chunk);
            });
            req.on('end', () => {
                const bodyBuffer = Buffer.concat(bodySegments);
                let events = null;
                try {
                    events = decodeWebSocketEvents(bodyBuffer);
                } catch (err) {
                    res.statusCode = 400;
                    res.gripOriginalEnd('Error parsing WebSocket events.\n');
                    return;
                }
                wsContext = new WebSocketContext(cid, meta, events, this.prefix);
                res.locals.gripWsContext = wsContext;
                req.body = bodyBuffer;
                next();
            });
        } else {
            next();
        }
    }

    _postGrip(_req: IGripExpressRequest, res: IGripExpressResponse) {
        if (res.statusCode === 200 && res.locals.gripWsContext != null) {

            const wsContext = res.locals.gripWsContext;

            // Find all keys of wsContext.origMeta that don't have the same key
            // in wsContext.meta
            const metaRemove = Object.keys(wsContext.origMeta)
                .filter(k => Object.keys(wsContext.meta)
                    .every(nk => nk.toLowerCase() !== k)
                );

            // Find all items in wsContext.meta whose keys and values don't match
            // any in wsContext.origMeta
            const metaSet = Object.entries(wsContext.meta)
                .reduce((acc, [nk, nv]) => {
                    const lname = nk.toLowerCase();
                    if (Object.entries(wsContext.origMeta)
                        .every(([k, v]) => lname !== k || nv !== v)
                    ) {
                        acc[lname] = nv;
                    }
                    return acc;
                }, {});

            const events = [];
            if (wsContext.accepted) {
                events.push(new WebSocketEvent('OPEN'));
            }
            for (const event of wsContext.outEvents) {
                events.push(event);
            }
            if (wsContext.closed) {
                const octets = jspack.Pack('>H', [wsContext.outCloseCode]);
                if (octets !== false) {
                    events.push(new WebSocketEvent('CLOSE', new Buffer(octets)));
                }
            }
            res.send(encodeWebSocketEvents(events));
            res.charset = '';
            res.set('Content-Type', 'application/websocket-events');
            if (wsContext.accepted) {
                res.set('Sec-WebSocket-Extensions', 'grip');
            }
            for (const k of metaRemove) {
                res.set('Set-Meta-' + k, '');
            }
            for (const [k, v] of Object.entries(metaSet)) {
                res.set('Set-Meta-' + k, String(v));
            }
        } else if (res.locals.gripHold != null) {
            if (!res.locals.gripProxied && this.isGripProxyRequired) {
                res.statusCode = 501;
                res.gripOriginalEnd('Not implemented.\n');
                return;
            }

            // res.locals.gripChannels should not be undefined at this point because
            // gripHold and it are set together.
            const channels = (res.locals.gripChannels as Channel[]).map(channel => {
                const { prefix = '' } = this;
                return new Channel( prefix + channel.name, channel.prevId );
            });

            if (res.statusCode === 304) {
                // deep copy
                const iheaders = JSON.parse(JSON.stringify(res._headers));
                const origBody = res.locals.gripEndParams[0];
                const iresponse = new Response(res.statusCode, null,
                    iheaders, origBody);
                const timeout = res.locals.gripTimeout;
                res.locals.gripEndParams[0] = createHold(
                    res.locals.gripHold,
                    channels,
                    iresponse,
                    timeout != null ? timeout : undefined
                );
                for (const key of Object.keys(res._headers)) {
                    res.removeHeader(key);
                }
                res.set('Content-Type', 'application/grip-instruct');
            } else {
                res.set('Grip-Hold', res.locals.gripHold);
                res.set('Grip-Channel', createGripChannelHeader(channels));
                if (res.locals.gripTimeout != null) {
                    res.set('Grip-Timeout', String(res.locals.gripTimeout));
                }
            }
        }
        if (res.locals.gripEndParams) {
            res.gripOriginalEnd(
                res.locals.gripEndParams[0],
                res.locals.gripEndParams[1]
            );
        }
    }
}

