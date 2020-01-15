# express-grip

Author: Konstantin Bokarius <kon@fanout.io>, Katsuyuki Ohmuro <harmony7@pex2.jp>

An Express GRIP library.

## Installation

This library is compatible with Express 4.x, and may work with Express 3.x as well.

```sh
npm install @fanoutio/express-grip
```

## Usage

### Architecture

This library provides two middleware classes.

This library is able to perform its magic and provide conveniences through the use of
both pre-route and post-route middleware. Therefore, in order to use this library you
must `use` both of them.

```javascript
import buildExpressGrip from '@fanoutio/express-grip';
const expressGrip = buildExpressGrip({
    /* config */
});

// Add the pre-handler middleware to the front of the stack
router.use( expressGrip.preGrip );

// .. routes

// Add the post-handler middleware to the back of the stack
router.use( expressGrip.postGrip );
```

Therefore, _even if a particular route does not use `express-grip` features, it's necessary
to call next() at the end of each of your route handlers to ensure that the post-route middleware
executes_.

The two middleware classes will work together to will parse the Grip-Sig header in any requests to detect if they came from a
GRIP proxy, and it will apply any hold instructions when responding. Additionally, the
middleware handles WebSocket-Over-HTTP processing so that WebSockets managed by the GRIP
proxy can be controlled via HTTP responses from the Express application.

### Configuration

Configure express-grip by passing options to the buildExpressGrip function.

```javascript
import buildExpressGrip from '@fanoutio/express-grip';

const expressGrip = buildExpressGrip({
    /* ... */
});
```

Set `gripProxies` for GRIP proxy validation and publishing:

```javascript
// Pushpin and/or Fanout.io is used for sending realtime data to clients
const expressGrip = buildExpressGrip({
    gripProxies: [
        // Pushpin
        {
            'control_uri': 'http://localhost:5561',
            'key': 'changeme',
        },
        // Fanout.io
        {
            'control_uri': 'https://api.fanout.io/realm/your-realm',
            'control_iss': 'your-realm',
            'key': Base64.decode64('your-realm-key'),
        },
    ],
});
```

If it's possible for clients to access the Express app directly, without necessarily
going through the GRIP proxy, then you may want to avoid sending GRIP instructions
to those clients. An easy way to achieve this is with the `gripProxyRequired` setting.
If set, then any direct requests that trigger a GRIP instruction response will be
given a 501 Not Implemented error instead.

```javascript
const expressGrip = buildExpressGrip({
    gripProxyRequired: true,
});
```

To prepend a fixed string to all channels used for publishing and subscribing, set
`gripPrefix` in your configuration:

```javascript
const expressGrip = buildExpressGrip({
    gripPrefix: '<prefix>',
});
```

You can also set any other EPCP servers that aren't necessarily proxies with
`publishServers`:

```javascript
const expressGrip = buildExpressGrip({
    gripPubServers: [
        {
            'uri': 'http://example.com/base-uri',
            'iss': 'your-iss', 
            'key': 'your-key'
        },
    ],
});
```

## Sample Usage

```javascript
import express from 'express';
import { HttpStreamFormat } from '@fanoutio/grip';
import buildExpressGrip, { setHoldStream, } from '@fanoutio/express-grip';

const app = express();

// GRIP will publish to local Pushpin
const expressGrip = buildExpressGrip({
    gripProxies: [{
        control_uri: "http://localhost:5561/",
    }],
});

// Add the pre-handler middleware to the front of the stack
app.use(expressGrip.preGrip);

app.get('/', function(req, res, next) {
    try {
        // Subscribe every incoming request to a channel in stream mode
        // 'test' is the channel name
        setHoldStream(res, 'test');
        res.send('[stream open]\n');
    } finally {
        // next() must be called for the post-handler middleware to execute
        next();
    }
});

app.post('/', function(req, res, next) {
    const data = req.body;

    // Publish stream data to subscribers
    // 'test' is the channel name
    expressGrip.publish('test', new HttpStreamFormat(data + '\n'));
    res.send('Ok\n');
    next();
});

// Add the post-handler middleware to the back of the stack
app.use(expressGrip.postGrip);
```

## Consuming this library

### ESM

If you are using Node 12.0 or newer or building a bundle for a browser using a
modern bundler, you can use this package as an ESM module.  Install it as an
npm package:

```bash
npm install @fanoutio/grip
```

Import in your JavaScript:

```javascript
import buildExpressGrip, { setHoldStream } from '@fanoutio/grip';
const expressGrip = buildExpressGrip({ /* config */ });
```

### CommonJS

This package is a hybrid package, and a CommonJS version of the library is
available by specifying a deep path.  You will also need to install the dependency
`@babel/runtime-corejs3` directly:

```bash
npm install @fanoutio/grip @babel/runtime-corejs3
```

Require in your JavaScript:

```javascript
const buildExpressGrip = require('@fanoutio/grip/commonjs');
const { setHoldStream } = buildExpressGrip;

const expressGrip = buildExpressGrip({ /* config */ });
```

## Demos

### HTTP Demo

Express 4 Grip Hold Stream example

pushpin
node demo/http/server.mjs test
curl -i http://localhost:7999/
curl -i -X POST -d 'foo' http://localhost:7999/

### Websocket Demo

Express 4 stateless WebSocket echo service example with broadcast endpoint

wscat
pushpin
node demo/ws/server test
wscat --connect ws://localhost:7999/websocket
curl -i -X POST -d 'foo' http://localhost:7999/broadcast

### Migrating from 1.x 

## License

`express-grip` is offered under the MIT license. See the LICENSE file.
