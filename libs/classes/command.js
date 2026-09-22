const HIDDEN_COMMAND_NAMES = ["$default", "lancerblock", "zerkblock", "zerk ab", "lancer sb", "lancer entry", "priest entry", "priestentry"];

class Command {
  constructor(mod, mods2) {
    this.mods = mods2;
    this.command = mod.command;
    this.callbacks = {};
    this.command.add("pr", (commandName, ...commandArgs) => {
      if (!commandName) commandName = "$default";
      const nestedName = commandName + " " + commandArgs[0];
      if (this.callbacks[nestedName]) { commandName = nestedName; commandArgs.shift(); }
      const callbacksEntry = this.callbacks[commandName];
      if (!callbacksEntry) {
        this.message("invalid command.", Object.keys(this.callbacks).filter(name => !HIDDEN_COMMAND_NAMES.includes(name)).join("/"));
        return;
      }
      callbacksEntry(...commandArgs);
    });
  }
  add = (commandName2, callback) => {
    if (this.callbacks[commandName2]) this.mods.log.debug("COMMAND", "Command already registered: " + commandName2);
    this.callbacks[commandName2] = callback;
  };
  remove = commandName3 => {
    delete this.callbacks[commandName3];
  };
  message = (...messageParts) => {
    return this.command.message(messageParts.join(" "));
  };
  exec = (...commandArgs2) => {
    return this.command.exec(...commandArgs2);
  };
  destructor = () => {
    this.command.remove("pr");
  };
}
module.exports = Command;
module.exports.DisableReloading = true;
