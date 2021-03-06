//     lib/adapters/subDurable.js v0.0.2
//     (c) 2012 Adriano Raiano (adrai); under MIT License

// This adapter acts as durable subscriber for a pub/sub topology with durable messages and queues.

var Adapter;

if (typeof module.exports !== 'undefined') {
  Adapter = module.exports;
}

Adapter.VERSION = '0.0.1';

// Create new instance of the adapter.
Adapter.create = function (hub, callback) {
  new SubDurableAdapter(hub, callback);
};

// ## SubDurableAdapter
//
// - __hub:__ the hub
// - __callback:__ `function(err, adapter){}`
var SubDurableAdapter = function (hub, callback) {
  this.hub = hub;
  this._init(callback);
};


// __init:__ initializes the adapter.
//
// `this._init(callback)`
//
// - __callback:__ `function(err, adapter){}`
SubDurableAdapter.prototype._init = function (callback) {

  var self = this;

  var handle = function (exchange) {
    self._openCallback(exchange);
    callback(null, self);
  };


  var exchange;
  if (!this.hub.options.channel) {
    exchange = this.hub.connection.exchange('amq.fanout', {passive: true}, handle);
  } else {
    exchange = this.hub.connection.exchange(this.hub.options.channel, {type: 'topic', durable: true}, handle);
  }
};

// __openCallback:__ this is the callback for the exchange open.
//
// `this._openCallback(exchange)`
//
// - __exchange:__ the exchange object coming from connection.exchange();
SubDurableAdapter.prototype._openCallback = function (exchange) {

  var self = this;

  var ackSettings = self.hub.options.ack ? {ack: self.hub.options.ack} : {};
  ackSettings.exclusive = true;

  try {
    var q = this.hub.connection.queue(this.hub.options.queueName || '', {
      durable: true,
      autoDelete: false
    }, function (queue) {

      console.log("[" + new Date() + "]: " + "Subscribing to queue: " + self.hub.options.queueName + " on: " + self.hub.connection.options.vhost);
      queue.subscribe(ackSettings, function (msg) {
        self.hub.send(msg.data.toString());
      });

      var routingKeys = self.hub.options.routingKeys || ['#'];
      for (var i in routingKeys) {
        var routingKey = routingKeys[i];
        queue.bind(exchange.name, routingKey);
      }

    });

    this.hub.on('ack', function () {
      q.shift();
    });

  } catch (ex) {
    console.log(ex);
  }
};

