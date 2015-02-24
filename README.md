express-grip
================

Author: Konstantin Bokarius <kon@fanout.io>

An Express GRIP library.

License
-------

express-grip is offered under the MIT license. See the LICENSE file.

Installation
------------

```sh
```

```javascript
```

Usage
-----

Set grip_proxies in your application configuration:

```
# pushpin and/or fanout.io is used for sending realtime data to clients
config.grip_proxies = [
    # pushpin
    {
        'control_uri' => 'http://localhost:5561',
        'key' => 'changeme'
    }
    # fanout.io
    #{
    #    'control_uri' => 'https://api.fanout.io/realm/your-realm',
    #    'control_iss' => 'your-realm',
    #    'key' => Base64.decode64('your-realm-key')
    #}
]
```

If it's possible for clients to access the Rails app directly, without necessarily going through the GRIP proxy, then you may want to avoid sending GRIP instructions to those clients. An easy way to achieve this is with the grip_proxy_required setting. If set, then any direct requests that trigger a GRIP instruction response will be given a 501 Not Implemented error instead.

```
config.grip_proxy_required = true
```

To prepend a fixed string to all channels used for publishing and subscribing, set grip_prefix in your configuration:

```
grip_prefix = '<prefix>'
```

You can also set any other EPCP servers that aren't necessarily proxies with publish_servers:

```
config.publish_servers = [
    {
        'uri' => 'http://example.com/base-uri',
        'iss' => 'your-iss', 
        'key' => 'your-key'
    }
]
```

This library also comes with a Rack middleware class and a Railstie implementation that will automatically add the middleware to the application when express-grip is added to the application's Gemfile. The middleware will parse the Grip-Sig header in any requests in order to detect if they came from a GRIP proxy, and it will apply any hold instructions when responding. Additionally, the middleware handles WebSocket-Over-HTTP processing so that WebSockets managed by the GRIP proxy can be controlled via HTTP responses from the Rails application.

The middleware should be placed as early as possible in the proessing order, so that it can collect all response headers and provide them in a hold instruction if necessary.

Note that in Rails 4 the following should be set for API endpoints in the ApplicationController to avoid CSRF authenticity exceptions:

```javascript
protect_from_forgery except: :<api_endpoint>
```

Example controller:

```javascript
class GripController < ApplicationController
  def get
    # if the request didn't come through a GRIP proxy, throw 501
    if !RailsGrip.is_grip_proxied(request)
      render :text => "Not implemented\n", :status => 501
      return
    end

    # subscribe every incoming request to a channel in stream mode
    RailsGrip.set_hold_stream(request, '<channel>')
    render :text => '[stream open]'
  end

  def post
    # publish data to subscribers
    data = request.body.read
    RailsGrip.publish('<channel>', HttpStreamFormat.new(data + "\n"))
    render :text => "Ok\n"
  end
end
```

Stateless WebSocket echo service with broadcast endpoint:

```javascript
class WebSocketOverHttpGripController < ApplicationController
  def echo
    render nothing: true

    # reject non-websocket requests
    RailsGrip.verify_is_websocket(request)

    # if this is a new connection, accept it and subscribe it to a channel
    if ws.is_opening
      ws.accept
      ws.subscribe('test_channel')
    end

    while ws.can_recv do
      message = ws.recv

      # if return value is nil, then the connection is closed
      if message.nil?
        ws.close
        break
      end

      # echo the message
      ws.send(message)
    end
  end

  def broadcast
    if request.method == 'POST'

      # publish data to all clients that are connected to the echo endpoint
      data = request.body.read
      RailsGrip.publish('<channel>', WebSocketMessageFormat.new(data))

      render :text => "Ok\n"
    else
      render :text => "Method not allowed\n", :status => 405
    end
  end
end
```
