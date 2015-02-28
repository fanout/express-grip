express-grip
================

Author: Konstantin Bokarius <kon@fanout.io>

An Express GRIP library.

License
-------

express-grip is offered under the MIT license. See the LICENSE file.

Installation
------------

This library is compatible with both Express 3 and 4.

```sh
npm install express-grip
```

Usage
-----

This library comes with two middleware classes which you must use. Express-grip performs its magic and provides conveniences through the use of both pre-route and post-route middleware. _Therefore, even if a particular route does not use express-grip features, it's necessary to call next() at the end of your route handler to ensure that the post-route middleware executes_. The middleware will parse the Grip-Sig header in any requests to detect if they came from a GRIP proxy, and it will apply any hold instructions when responding. Additionally, the middleware handles WebSocket-Over-HTTP processing so that WebSockets managed by the GRIP proxy can be controlled via HTTP responses from the Express application.

Configure express-grip by providing a configuration object of your choice to the configure() method. The various express-grip settings are shown below. Note that your configuration object should provide access to the express-grip settings via dot notation. Call the configure() method in your app.js file like so:

```javascript
var expressGrip = require('express-grip');

var myConfigObject = { ... };

expressGrip.configure(myConfigObject);
```

Set gripProxies for GRIP proxy validation and publishing:

```javascript
// Pushpin and/or Fanout.io is used for sending realtime data to clients
var myConfigObject = {
    gripProxies = [
        // Pushpin
        {
            'control_uri' => 'http://localhost:5561',
            'key' => 'changeme'
        },
        // Fanout.io
        {
            'control_uri' => 'https://api.fanout.io/realm/your-realm',
            'control_iss' => 'your-realm',
            'key' => Base64.decode64('your-realm-key')
        }],
    ...
};
```

If it's possible for clients to access the Express app directly, without necessarily going through the GRIP proxy, then you may want to avoid sending GRIP instructions to those clients. An easy way to achieve this is with the gripProxyRequired setting. If set, then any direct requests that trigger a GRIP instruction response will be given a 501 Not Implemented error instead.

```javascript
var myConfigObject = {
    gripIsProxyRequired: true,
    ...
};
```

To prepend a fixed string to all channels used for publishing and subscribing, set gripPrefix in your configuration:

```javascript
var myConfigObject = {
    gripPrefix = '<prefix>',
    ...
};
```

You can also set any other EPCP servers that aren't necessarily proxies with publishServers:

```javascript
var myConfigObject = {
    gripPubServers = [
        {
            'uri' => 'http://example.com/base-uri',
            'iss' => 'your-iss', 
            'key' => 'your-key'
        }],
    ...
};
```

Express 4 example route:

```javascript
var express = require('express');
var router = express.Router();
var grip = require('grip');
var expressGrip = require('express-grip');

// Add the pre-handler middleware to the front of the stack
router.use(expressGrip.preHandlerGripMiddleware);

router.get('/', function(req, res, next) {
    try {
        // If the request didn't come through a GRIP proxy, throw 501
        if (!res.locals.gripProxied) {
            res.sendStatus(501);
            return;
        }
     
        // Subscribe every incoming request to a channel in stream mode
        expressGrip.setHoldStream(res, '<channel>');
        res.send("[stream open]\n");

        // Alternatively subscribe and long-poll
        //expressGrip.setHoldLongpoll(res, '<channel>', <timeout>);
        //res.end();
    } finally {
        // next() must be called for the post-handler middleware to execute
        next();
    }
});

router.post('/', function(req, res, next) {
    data = req.body;

    // Publish stream data to subscribers
    expressGrip.publish('<channel>', new grip.HttpStreamFormat(data + "\n"));

    // Alternatively publish response data to long-poll clients
    //expressGrip.publish('<channel>', new grip.HttpResponseFormat(null, null, null, data));

    res.send("Ok\n");
    next();
});

// Add the post-handler middleware to the back of the stack
router.use(expressGrip.postHandlerGripMiddleware);

module.exports = router;
```

Express 4 stateless WebSocket echo service example with broadcast endpoint:

```javascript
var express = require('express');
var router = express.Router();
var grip = require('grip');
var expressGrip = require('express-grip');

// Add the pre-handler middleware to the front of the stack
router.use(expressGrip.preHandlerGripMiddleware);

router.post('/websocket', function(req, res, next) {
    // Reject non-WebSocket requests
    if (!expressGrip.verifyIsWebSocket(res, next)) {
        return;
    }

    // If this is a new connection, accept it and subscribe it to a channel
    ws = expressGrip.getWsContext(res);
    if (ws.isOpening()) {
        ws.accept();
        ws.subscribe('<channel>');
    }

    while (ws.canRecv()) {
        message = ws.recv();

        // If return value is undefined then connection is closed
        if (message === undefined) {
            ws.close();
            break;
        }

        // Echo the message
        ws.send(message);
    }

    // next() must be called for the post-handler middleware to execute
    next();
});

router.post('/broadcast', function(req, res, next) {
    // Publish data to all clients that are connected to the echo endpoint
    data = req.body;
    expressGrip.publish('<channel>', new grip.WebSocketMessageFormat(data));
    res.send("Ok\n");

    // next() must be called for the post-handler middleware to execute
    next();
});

// Add the post-handler middleware to the back of the stack
router.use(expressGrip.postHandlerGripMiddleware);

module.exports = router;
```
