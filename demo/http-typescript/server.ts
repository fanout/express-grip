import express from 'express';
import { HttpStreamFormat } from '@fanoutio/grip';
import buildExpressGrip from '../..';
const { isGripProxied, setHoldStream } = buildExpressGrip;

const app = express();

// Run this test demo server on this port
const port = 3000;

// URL to Pushpin
const uri = "http://localhost:5561/";

const [
    ,
    ,
    channel,
] = process.argv;

console.log( 'Publish URI', uri );
console.log( 'Channel', channel );

const expressGrip = buildExpressGrip({
    gripProxies: [{
        control_uri: uri,
    }],
});

// Add the pre-handler middleware to the front of the stack
app.use(expressGrip.preGrip);

app.get('/', function(_req, res, next) {

    try {
        // If the request didn't come through a GRIP proxy, throw 501
        // NOTE: in TypeScript, use isGripProxied() as it is a type guard
        // that enables res to be treated as an IGripExpressResponse.
        if (!isGripProxied(res)) {
            res.sendStatus(501);
            return;
        }
        // Subscribe every incoming request to a channel in stream mode
        setHoldStream(res, channel);
        res.send('[stream open]\n');
    } finally {
        // next() must be called for the post-handler middleware to execute
        next();
    }

});

app.post('/', express.text({ type: '*/*' }), async function(req, res, next) {
    const data = req.body;

    // Publish stream data to subscribers
    await expressGrip.publish(channel, new HttpStreamFormat(data + '\n'));

    res.send('Ok\n');
    next();
});

// Add the post-handler middleware to the back of the stack
app.use(expressGrip.postGrip);

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
