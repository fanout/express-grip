import ExpressGrip from './ExpressGrip';
export default function buildExpressGrip(config) {
    return new ExpressGrip(config);
}

export * from './expressGripUtils.mjs';
