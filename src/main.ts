import ExpressGrip from './ExpressGrip';
import IExpressGripConfig from './IExpressGripConfig';
import IGripExpressRequest from './IGripExpressRequest';
import IGripExpressResponse from './IGripExpressResponse';

import {
    setHoldLongpoll,
    setHoldStream,
    isGripProxied,
    getWsContext,
    verifyIsWebSocket,
} from "./expressGripUtils";

export default Object.assign(
    function(config: IExpressGripConfig | undefined) {
        return new ExpressGrip(config);
    },
    {
        setHoldLongpoll,
        setHoldStream,
        isGripProxied,
        getWsContext,
        verifyIsWebSocket,
    }
);

export type {
    IExpressGripConfig,
    IGripExpressRequest,
    IGripExpressResponse,
};
