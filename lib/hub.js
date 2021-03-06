//     lib/hub.js v0.0.2
//     (c) 2012 Adriano Raiano (adrai); under MIT License

// The RabbitHub is the main module delegating all work to it's _adapters_
//
// __Example:__
//
//      var rabbitHub = require('rabbitmq-nodejs-client');
//
//      var subHub = rabbitHub.create( { task: 'sub', channel: 'myChannel' } );
//      subHub.on('connection', function(hub) {
//
//          hub.on('message', function(msg) {
//              console.log(msg);
//          }.bind(this));
//
//      });
//      subHub.connect();
//
//      var pubHub = rabbitHub.create( { task: 'pub', channel: 'myChannel' } );
//      pubHub.on('connection', function(hub) {
//
//          hub.send('Hello World!');
//
//      });
//      pubHub.connect();

var util = require('util');
var amqp = require('amqp')
  , EventEmitter = require('events').EventEmitter;

var Hub;

if (typeof module.exports !== 'undefined') {
  Hub = module.exports;
}

Hub.VERSION = '0.0.1';

// Create new instance of the hub.
Hub.create = function (options) {
  return new RabbitHub(options);
};

// ## RabbitHub
// This class represents a hub for RabbitMQ.
var RabbitHub = function (options) {

  // Call super class.
  EventEmitter.call(this);

  // Set options and load defaults if needed.
  this.options = options || {};

  this.host = this.options.host || 'localhost';
  this.port = this.options.port || 5672;
  this.protocol = this.options.protocol || 'amqp';
  this.login = this.options.login;
  this.password = this.options.password;
  this.vhost = this.options.vhost;
  this.task = this.options.task;

  if (this.options.url) {
    this.url = this.options.url;
  } else {
    buildUrl();
  }
};

util.inherits(RabbitHub, EventEmitter);

function buildUrl() {
  this.url = this.protocol + '://';
  if (this.login && this.password) {
    this.url += this.login + ':' + this.password + '@';
  }
  this.url += this.host;
  if (this.port) {
    this.url += ':' + this.port;
  }
  if (this.vhost) {
    this.url += this.vhost;
  }
}

// __connect:__ initializes the connection.
//
// `hub.connect()`
RabbitHub.prototype.connect = function () {

  var self = this;

  this.connection = amqp.createConnection({url: this.url, heartbeat: 60});

  this.connection.on('ready', function () {

    var destroyQueue = function (callback) {
      var q = self.connection.queue(self.options.queueName, {durable: true, 'autoDelete': false}, function (queue) {
        queue.destroy();
        if (callback) callback();
      });
    };

    var startAdapter = function () {
      var adapter = require('./adapters/' + self.task);
      adapter.create(self, function (err) {
        if (err) {

        } else {
          self.emit('connection', self);
        }
      });
    };

    if (self.options.clean) {
      destroyQueue(startAdapter);
    } else {
      startAdapter();
    }

  });

  this.connection.on('error', function (e) {
    console.log("[" + new Date() + "] connection error...", e);
  })

};

// __send:__ sends a _msg with opitional _routingKey through the hub.
//
// `hub.send(msg, routingKey)`
//
// - __msg:__ the message
// - __routingKey:__ a routingKey [optional]
RabbitHub.prototype.send = function (msg, routingKey) {

  this.emit('message', msg, routingKey);

};

// __ack:__ acknowledges the last message.
// Works only if options.ack is true!
//
// `hub.ack()`
RabbitHub.prototype.ack = function () {

  this.emit('ack');

};

// __end:__ closes the connection.
//
// `hub.end()`
RabbitHub.prototype.end = function () {

  try {
    this.connection.end();
    this.connection = null;
  } catch (e) {
    console.log("[" + new Date() + "] Error closing connection: " + e);
  }

  this.emit('close');

};