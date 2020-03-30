import IGripExpressResponse from "./IGripExpressResponse";
import { Channels, convertChannels } from "./utils/channels";

export function setHoldLongpoll(response: IGripExpressResponse, channels: Channels, timeout: number) {
    response.locals.gripHold = 'response';
    response.locals.gripChannels = convertChannels(channels);
    response.locals.gripTimeout = timeout;
}

export function setHoldStream(response: IGripExpressResponse, channels: Channels) {
    response.locals.gripHold = 'stream';
    response.locals.gripChannels = convertChannels(channels);
}

export function isGripProxied(response: IGripExpressResponse) {
    return response.locals.gripProxied ?? false;
}

export function getWsContext(response: IGripExpressResponse) {
    if ('gripWsContext' in response.locals &&
        response.locals.gripWsContext != null) {
        return response.locals.gripWsContext;
    }
    return null;
}

export function verifyIsWebSocket(response: IGripExpressResponse, next: Function) {
    if (!getWsContext(response)) {
        response.statusCode = 400;
        response.send('Non-WebSocket requests not allowed.\n');
        next();
        return false;
    }
    return true;
}
