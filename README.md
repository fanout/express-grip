# express-grip

Author: Konstantin Bokarius <kon@fanout.io>, Katsuyuki Ohmuro <harmony7@pex2.jp>

An Express GRIP library.

## Installation

This library is compatible with Express 4.x, and may work with Express 3.x as well.

```sh
npm install @fanout/express-grip
```

## Usage

### Adding the Middleware

This library provides two middleware classes.

This library is able to perform its magic and provide conveniences through the use of
both pre-route and post-route middleware. Therefore, in order to use this library you
must `use` both of them.

```javascript
import { preGrip, postGrip } from '@fanout/express-grip';

// Add the pre-handler middleware to the front of the stack
router.use( preGrip );

// .. routes

// Add the post-handler middleware to the back of the stack
router.use( postGrip );
```

Therefore, _even if a particular route does not use `express-grip` features, it's necessary
to call next() at the end of each of your route handlers to ensure that the post-route middleware
executes_.

The two middleware classes will work together to will parse the Grip-Sig header in any requests to detect if they came from a
GRIP proxy, and it will apply any hold instructions when responding. Additionally, the
middleware handles WebSocket-Over-HTTP processing so that WebSockets managed by the GRIP
proxy can be controlled via HTTP responses from the Express application.

### Configuration

Configure express-grip with the configure() method.

```javascript
import expressGrip from '@fanoutio/express-grip';

expressGrip.configure({
    /* ... */
});
```

Set `gripProxies` for GRIP proxy validation and publishing:

```javascript
// Pushpin and/or Fanout.io is used for sending realtime data to clients
expressGrip.configure({
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
    /* ... */
});
```

If it's possible for clients to access the Express app directly, without necessarily
going through the GRIP proxy, then you may want to avoid sending GRIP instructions
to those clients. An easy way to achieve this is with the `gripProxyRequired` setting.
If set, then any direct requests that trigger a GRIP instruction response will be
given a 501 Not Implemented error instead.

```javascript
expressGrip.configure({
    gripProxyRequired: true,
    /* ... */
});
```

To prepend a fixed string to all channels used for publishing and subscribing, set
`gripPrefix` in your configuration:

```javascript
expressGrip.configure({
    gripPrefix: '<prefix>',
    /* ... */
});
```

You can also set any other EPCP servers that aren't necessarily proxies with
`publishServers`:

```javascript
expressGrip.configure({
    gripPubServers: [
        {
            'uri': 'http://example.com/base-uri',
            'iss': 'your-iss', 
            'key': 'your-key'
        },
    ],
    ...
});
```

## Examples

Express 4 example route:

```javascript
import express from 'express';
import grip from '@fanoutio/grip';
import expressGrip from '@fanoutio/express-grip';

const router = express.Router();

// Add the pre-handler middleware to the front of the stack
router.use(expressGrip.preGrip);

router.get('/', function(req, res, next) {
    try {
        // If the request didn't come through a GRIP proxy, throw 501
        if (!res.locals.gripProxied) {
            res.sendStatus(501);
            return;
        }
     
        // Subscribe every incoming request to a channel in stream mode
        expressGrip.setHoldStream(res, '<channel>');
        res.send('[stream open]\n');

        // Alternatively subscribe and long-poll
        //expressGrip.setHoldLongpoll(res, '<channel>', <timeout>);
        //res.end();
    } finally {
        // next() must be called for the post-handler middleware to execute
        next();
    }
});

router.post('/', function(req, res, next) {
    const data = req.body;

    // Publish stream data to subscribers
    expressGrip.publish('<channel>', new grip.HttpStreamFormat(data + '\n'));

    // Alternatively publish response data to long-poll clients
    //expressGrip.publish('<channel>',
    //        new grip.HttpResponseFormat(null, null, null, data));

    res.send('Ok\n');
    next();
});

// Add the post-handler middleware to the back of the stack
router.use(expressGrip.postGrip);

module.exports = router;
```

Express 4 stateless WebSocket echo service example with broadcast endpoint:

```javascript
import express from 'express';
import bodyParser from 'body-parser';
import grip from '@fanoutio/grip';
import expressGrip from '@fanoutio/express-grip';

const router = express.Router();

// Add the pre-handler middleware to the front of the stack
router.use(expressGrip.preHandlerGripMiddleware);

router.all('/websocket', function(req, res, next) {
    // Reject non-WebSocket requests
    if (!expressGrip.verifyIsWebSocket(res, next)) {
        return;
    }

    // If this is a new connection, accept it and subscribe it to a channel
    const ws = expressGrip.getWsContext(res);
    if (ws.isOpening()) {
        ws.accept();
        ws.subscribe('<channel>');
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

router.post(
    '/broadcast',
    bodyParser.text({ type: '*/*' }),
    (req, res, next) => {
        const { body: data, } = req;

        // Publish data to all clients that are connected to the echo endpoint
        expressGrip.publish('<channel>', new grip.WebSocketMessageFormat(data));
        res.send('Ok\n');
    
        // next() must be called for the post-handler middleware to execute
        next();
    }
);

// Add the post-handler middleware to the back of the stack
router.use(expressGrip.postHandlerGripMiddleware);

module.exports = router;
```

## License

`express-grip` is offered under the MIT license. See the LICENSE file.
