import { Channel } from "@fanoutio/grip";
import isString from "./isString";

export type Channels = Channel | Channel[] | string | string[];

export function convertChannels(channels: Channels): Channel[] {
    const array = !Array.isArray(channels) ? [channels] : channels;
    return array.map(channel => isString(channel) ? new Channel(channel) : channel);
}
