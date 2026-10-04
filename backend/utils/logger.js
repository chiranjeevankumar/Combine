// Tiny structured logger that writes one JSON line per event.
const os = require("os");

const format = (level, msg, meta = {}) => JSON.stringify({
  ts: new Date().toISOString(),
  level,
  msg,
  host: os.hostname(),
  pid: process.pid,
  ...meta,
}) + "\n";

const info = (msg, meta) => process.stdout.write(format("info", msg, meta));
const warn = (msg, meta) => process.stderr.write(format("warn", msg, meta));
const error = (msg, meta) => process.stderr.write(format("error", msg, meta));
const debug = (msg, meta) => {
  if (process.env.LOG_LEVEL === "debug") process.stdout.write(format("debug", msg, meta));
};

module.exports = { info, warn, error, debug };
