import { IGripConfig } from "@fanoutio/grip";
import { IPubControlConfig } from "@fanoutio/pubcontrol";

export default interface IExpressGripConfig {
    gripProxies?: IGripConfig[];
    gripPubServers?: IPubControlConfig[];
    gripProxyRequired?: boolean;
    gripPrefix?: string;
}
