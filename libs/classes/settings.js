const fs = require("fs"),
  path = require("path");
class Settings {
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
    const info2 = {
      enabled: true,
      block: true,
      jaunt: true,
      debug: false,
      dash: 25,
      delay: 0,
      berserker_ngsp_charge: true,
      advancedChargesRelease: true,
      jitterCompensationCharges: true,
      jitterCompensationChargesMin: 0,
      jitterCompensationChargesMax: 60
    };
    try {
      const parsedData = JSON.parse(fs.readFileSync(path.join(__dirname, "../../config.json"), "utf-8"));
      this.info = Object.assign({}, info2, parsedData);
    } catch (error) {
      this.info = info2;
    }
    this.mods.command.add("$default", this.toggle);
    this.mods.command.add("on", this.on);
    this.mods.command.add("off", this.off);
    this.mods.command.add("block", this.block);
    this.mods.command.add("delay", this.delay);
    this.mods.command.add("jaunt", this.jaunt);
  }
  toggle = () => {
    this.info.enabled = !this.info.enabled;
    this.mods.command.message("PR has been turned", this.info.enabled ? "on" : "off");
  };
  off = () => {
    this.info.enabled = false;
    this.mods.command.message("PR has been turned off");
  };
  on = () => {
    this.info.enabled = true;
    this.mods.command.message("PR has been turned on");
  };
  block = () => {
    this.info.block = !this.info.block;
    this.mods.command.message("Smooth block has been turned", this.info.block ? "on" : "off");
  };
  delay = delay2 => {
    delay2 = +delay2;
    if (isNaN(delay2) || delay2 < 0) return this.mods.command.message("The artificial delay needs to be a number >= 0");
    this.info.delay = delay2;
    this.mods.command.message("Set artificial delay to", delay2);
  };
  jaunt = () => {
    this.info.jaunt = !this.info.jaunt;
    this.mods.command.message("Smooth jaunt has been turned", this.info.jaunt ? "on" : "off");
  };
  get enabled() {
    return this.info.enabled;
  }
  get smoothBlock() {
    return this.info.block;
  }
  get emulateJaunt() {
    return this.info.jaunt;
  }
  get debug() {
    return this.info.debug;
  }
  set debug(debug2) {
    this.info.debug = debug2;
  }
  get dash() {
    return this.info.dash;
  }
  set dash(dash2) {
    this.info.dash = dash2;
  }
  destructor() {
    fs.writeFileSync(path.join(__dirname, "../../config.json"), JSON.stringify(this.info, null, "  "));
  }
}
module.exports = Settings;
