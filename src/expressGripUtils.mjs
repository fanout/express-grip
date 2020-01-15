import { Channel } from '@fanoutio/grip';
import isString from './utils/isString.mjs';

export function setHoldLongpoll(response, channels, timeout) {
    response.locals.gripHold = 'response';
    response.locals.gripChannels = convertChannels(channels);
    response.locals.gripTimeout = timeout;
}

export function setHoldStream(response, channels) {
    response.locals.gripHold = 'stream';
    response.locals.gripChannels = convertChannels(channels);
}

export function isGripProxied(response) {
    return response.locals?.gripProxied ?? false;
}

export function getWsContext(response) {
    if ('gripWsContext' in response.locals &&
        response.locals.gripWsContext != null) {
        return response.locals.gripWsContext;
    }
    return null;
}

export function verifyIsWebSocket(response, next) {
    if (!getWsContext(response)) {
        response.statusCode = 400;
        response.send('Non-WebSocket requests not allowed.\n');
        next();
        return false;
    }
    return true;
}

function convertChannels(channels) {
    if(!Array.isArray(channels)) {
        channels = [channels];
    }
    return channels.map(channel => isString(channel) ? new Channel(channel) : channel);
}

