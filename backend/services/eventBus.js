const EventEmitter = require("events");

// In-process event bus used for real-time SSE fan-out and webhook delivery.
// Single-instance deployment uses this directly. For multi-instance, swap for Redis pub/sub.
class EventBus extends EventEmitter {
  publish(channel, payload) {
    this.emit(`channel:${channel}`, payload);
    this.emit("channel:*", { channel, payload });
  }

  subscribe(channel, handler) {
    this.on(`channel:${channel}`, handler);
    return () => this.off(`channel:${channel}`, handler);
  }
}

module.exports = new EventBus();
