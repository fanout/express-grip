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

The two middleware classes will work together to parse the Grip-Sig header in any requests to detect
if they came from a GRIP proxy, and it will apply any hold instructions when responding. Additionally,
the middleware handles WebSocket-Over-HTTP processing so that WebSockets managed by the GRIP
proxy can be controlled via HTTP responses from the Express application.

### Configuration

Configure express-grip by passing options to the `buildExpressGrip` function.

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

### CommonJS

The CommonJS version of this package requires Node v8 or newer.

Require in your JavaScript:

```javascript
const buildExpressGrip = require('@fanoutio/express-grip');
const expressGrip = buildExpressGrip({ /* config */ });
```

If you are building a bundle, you may also import in your JavaScript.

```javascript
import grip from '@fanoutio/express-grip';
const expressGrip = buildExpressGrip({ /* config */ });
```

This package comes with full TypeScript type definitions, so you may use it with
TypeScript as well.

```javascript
import buildExpressGrip, { IGripExpressResponse } from '@fanoutio/express-grip';
const expressGrip = buildExpressGrip({ /* config */ });

// IGripExpressResponse is a type declaration.
```

## Demos

### HTTP Demo

Express 4 Grip Hold Stream example.

1. Clone this repository, then build the commonjs build of this library.
```
npm install
npm run build-commonjs
```

2. You will need to obtain and install Pushpin (https://pushpin.org/). Make sure that the Pushpin `routes` file looks like this:
```
* localhost:3000
```

3. In a Terminal window, start Pushpin.
```
pushpin
```

4. In another Terminal window, start the demo server.
```
cd demo/http
node server.js test
```

5. In another Terminal window, issue an HTTP long poll.
```
curl -i http://localhost:7999/
```

6. Finally, in another Terminal window, post a message.
```
curl -i -X POST -d 'foo' http://localhost:7999/
```

7. In the Terminal window from step 5, you will see the message appear. 

The same example is also provided in Typescript. In place of step 3 above,
use the TypeScript version:

```
cd demo/http-typescript
ts-node server.ts test
```

### Websocket Demo

Express 4 stateless WebSocket echo service example with broadcast endpoint.

1. Clone this repository, then build the commonjs build of this library.
```
npm install
npm run build-commonjs
```

2. You will need to obtain and install Pushpin (https://pushpin.org/). Make sure that the Pushpin `routes` file looks like this:
```
* localhost:3000,over_http
```

3. In a Terminal window, start Pushpin.
```
pushpin
```

4. In another Terminal window, start the demo server.
```
cd demo/ws
node server.js test
```

5. In another Terminal window, open a Websocket connection.
```
wscat --connect ws://localhost:7999/websocket
```

6. Finally, in another Terminal window, post a message.
```
curl -i -X POST -d 'foo' http://localhost:7999/broadcast
```

7. In the Terminal window from step 5, you will see the message appear. 

## License

(C) 2015, 2020 Fanout, Inc.  
Licensed under the MIT License, see file LICENSE for details.
