class Ping {
  get ping() {
    return this.mod.require.ping.ping;
  }
  get jitter() {
    return this.mod.require.ping.jitter;
  }
  get rtt() {
    return this.ping + this.jitter;
  }
  constructor(mod2) {
    this.mod = mod2;
  }
}
module.exports = Ping;
