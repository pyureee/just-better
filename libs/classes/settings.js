const fs = require("fs"),
  path = require("path");
const CONFIG_PATH = path.join(__dirname, "../../config.json");
const INTERNAL_PATH = path.join(__dirname, "../../internal-settings.json");
const INTERNAL_KEYS = ["flatten_chain", "ninja_shima", "ninja_transition_buffer",
  "ninja_load_reduce", "ninja_retry_policy", "lancer_entry_precast",
  "lancer_silent_block", "priest_entry_precast"];
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
      delay: 0
    };
    let visible = {}, internal = {};
    try { visible = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")); } catch (error) {}
    try { internal = JSON.parse(fs.readFileSync(INTERNAL_PATH, "utf-8")); } catch (error) {}
    this.info = Object.assign({}, info2, internal, visible);
    if (this.info["AHK setup"] === undefined && this.info.lancer_entry_precast?.keyboard)
      this.info["AHK setup"] = this.info.lancer_entry_precast.keyboard;
    this.mods.command.add("$default", this.toggle);
    this.mods.command.add("on", this.on);
    this.mods.command.add("off", this.off);
    this.mods.command.add("block", this.block);
    this.mods.command.add("delay", this.delay);
    this.mods.command.add("jaunt", this.jaunt);
  }
  toggle = () => {
    this.info.enabled = !this.info.enabled;
    this.save();
    this.mods.command.message("PR has been turned", this.info.enabled ? "on" : "off");
  };
  off = () => {
    this.info.enabled = false;
    this.save();
    this.mods.command.message("PR has been turned off");
  };
  on = () => {
    this.info.enabled = true;
    this.save();
    this.mods.command.message("PR has been turned on");
  };
  block = () => {
    this.info.block = !this.info.block;
    this.save();
    this.mods.command.message("Smooth block has been turned", this.info.block ? "on" : "off");
  };
  delay = delay2 => {
    delay2 = +delay2;
    if (!Number.isFinite(delay2) || delay2 < 0) return this.mods.command.message("The artificial delay needs to be a number >= 0");
    this.info.delay = delay2;
    this.save();
    this.mods.command.message("Set artificial delay to", delay2);
  };
  jaunt = () => {
    this.info.jaunt = !this.info.jaunt;
    this.save();
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
  save() {
    const visible = {...this.info}, internal = {};
    for (const key of INTERNAL_KEYS) {
      if (key in visible) internal[key] = visible[key];
      delete visible[key];
    }
    if (internal.lancer_entry_precast?.keyboard) {
      internal.lancer_entry_precast = {...internal.lancer_entry_precast};
      delete internal.lancer_entry_precast.keyboard;
    }
    fs.writeFileSync(INTERNAL_PATH, JSON.stringify(internal, null, "  "));
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(visible, null, "  "));
  }
  destructor() {
    this.save();
  }
}
module.exports = Settings;
