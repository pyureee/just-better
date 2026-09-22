const fs = require("fs"),
  path = require("path"),
  RingBuffer = require("../plugins/emulation").RingBuffer;
class Log {
  addToHistory = (...messageParts) => {
    this._history.push(messageParts);
  };
  prefix = category => {
    const timestamp = Date.now();
    const second = Math.floor(timestamp / 1000);
    if (second !== this._formattedSecond) {
      this._formattedSecond = second;
      this._formattedTime = new Date(timestamp).toLocaleTimeString();
    }
    return "[PR][" + this._formattedTime + "][" + timestamp % 100000 + "][" + category + "]";
  };
  debug = (category, ...messageParts2) => {
    const logPrefix = this.prefix(category);
    this.addToHistory(logPrefix, ...messageParts2);
    if (!this?.mods?.settings?.debug) return;
    console.log(logPrefix, ...messageParts2);
  };
  error = (category2, ...messageParts3) => {
    const logPrefix2 = this.prefix(category2);
    this.addToHistory(logPrefix2, ...messageParts3);
    console.log(logPrefix2, ...messageParts3);
  };
  save = (...messageParts4) => {
    if (!messageParts4.length) messageParts4 = Date.now();else messageParts4 = messageParts4.join(" ");
    try {
      fs.mkdirSync(path.join(__dirname, "../../logs"));
    } catch (error2) {}
    fs.writeFileSync(path.join(__dirname, "../../logs/" + messageParts4 + ".txt"), [...this._history].map(historyItem => historyItem.map(historyItemItem => typeof historyItemItem === "object" ? this.mods.library.jsonStringify(historyItemItem) : historyItemItem).join(" ")).join("\n"));
    this.mods.command.message("Saved log to [PR]/logs/" + messageParts4 + ".txt");
  };
  toggleDebug = () => {
    this.mods.settings.debug = !this.mods.settings.debug;
    this.mods.command.message("Debugging has been turned", this.mods.settings.debug ? "on" : "off");
  };
  destructor = () => {
    this.mods.command.remove("save");
    this.mods.command.remove("debug");
  };
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
    this._history = new RingBuffer(400);
    mods2.command.add("save", this.save);
    mods2.command.add("debug", this.toggleDebug);
  }
}
module.exports = Log;
