import { Channel, WebSocketContext } from "@fanoutio/grip";

export default interface IGripExpressResponseLocals {
    gripEndParams: any[];
    gripProxied: boolean;
    gripSigned: boolean;
    gripWsContext: WebSocketContext | null;
    gripHold: string | null;
    gripTimeout: number | null;
    gripChannels?: Channel[];
}
