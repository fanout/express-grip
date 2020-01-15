const express = require('express');
const { WebSocketMessageFormat } = require('@fanoutio/grip/commonjs');
const buildExpressGrip = require('../../commonjs');
const { verifyIsWebSocket, getWsContext, } = buildExpressGrip;

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

app.all('/websocket', function(req, res, next) {
    // Reject non-WebSocket requests
    if (!verifyIsWebSocket(res, next)) {
        return;
    }

    // If this is a new connection, accept it and subscribe it to a channel
    const ws = getWsContext(res);
    if (ws.isOpening()) {
        ws.accept();
        ws.subscribe(channel);
    }

    while (ws.canRecv()) {
        // Note that recv() will always return a String while recvRaw() can be
        // used to get either a String or Buffer depending on whether the
        // message is TEXT or BINARY respectively
        const message = ws.recv();

        // If return value is undefined then connection is closed
        if (message == null) {
            ws.close();
            break;
        }

        // Echo the message
        ws.send(message);
    }

    // next() must be called for the post-handler middleware to execute
    next();
});

app.post('/broadcast', express.text({ type: '*/*' }), (req, res, next) => {
    const { body: data, } = req;

    // Publish data to all clients that are connected to the echo endpoint
    expressGrip.publish(channel, new WebSocketMessageFormat(data));
    res.send('Ok\n');

    // next() must be called for the post-handler middleware to execute
    next();
});

// Add the post-handler middleware to the back of the stack
app.use(expressGrip.postGrip);

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
