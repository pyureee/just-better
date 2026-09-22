const MISSING_MODULE_ERRORS = ["MODULE_NOT_FOUND", "ENOENT"];

const fs = require("fs"),
  nodePath = require("path"),
  TimerQueue = require("./libs/plugins/emulation").TimerQueue;
class ModWrapper {
  constructor(mod2) {
    this._mod = mod2;
    this.command = mod2.command;
    this._timerQueue = new TimerQueue();
    this._intervals = new Set();
    this._hooks = new Set();
    this._destroyed = false;
  }
  get game() {
    return this._mod.game;
  }
  get patch() {
    return this._mod.majorPatchVersion;
  }
  get clientMod() {
    return this._mod.clientMod;
  }
  get require() {
    return this._mod.require;
  }
  get dispatch() {
    return this._mod.dispatch;
  }
  get isMenma() {
    return this._mod.serverList[this._mod.serverId].name.includes("MT");
  }
  queryData = (...queryArgs) => {
    return this._mod.queryData(...queryArgs);
  };
  hook = (...hookArgs) => {
    if (this._destroyed) return;
    const hook2 = this._mod.hook(...hookArgs);
    this._hooks.add(hook2);
    return hook2;
  };
  hookOnce = (...hookArgs2) => {
    const atResult = hookArgs2.at(-1),
      hook3 = this.hook(...hookArgs2.slice(0, -1), (...event) => {
        this.unhook(hook3);
        return atResult(...event);
      });
    return hook3;
  };
  unhook = hook4 => {
    this._hooks.delete(hook4);
    return this._mod.unhook(hook4);
  };
  setTimeout = (callback, delayMs, ...callbackArgs) => {
    return this._timerQueue.set(callback, delayMs, callbackArgs);
  };
  setInterval = (...intervalArgs) => {
    if (this._destroyed) return;
    const interval = this._mod.setInterval(...intervalArgs);
    this._intervals.add(interval);
    return interval;
  };
  clearTimeout = timer => {
    this._timerQueue.cancel(timer);
  };
  clearInterval = interval => {
    this._intervals.delete(interval);
    return this._mod.clearInterval(interval);
  };
  send = (...packetArgs) => {
    if (this._destroyed) return false;
    return this._mod.send(...packetArgs);
  };
  parseSystemMessage = (...messageArgs) => {
    return this._mod.parseSystemMessage(...messageArgs);
  };
  buildSystemMessage = (...messageArgs2) => {
    return this._mod.buildSystemMessage(...messageArgs2);
  };
  destructor = () => {
    if (this._destroyed) return;
    this._destroyed = true;
    this._timerQueue.close();
    for (const interval of this._intervals) this._mod.clearInterval(interval);
    this._intervals.clear();
    for (const hook of this._hooks) this._mod.unhook(hook);
    this._hooks.clear();
  };
}
class PingRemover {
  constructor(mod3) {
    this.mod = mod3;
    this._destroyed = false;
    this._loadRetries = new Map();
    this.mods = {
      plugin: {},
      ...mod3.require.library
    };
    this.wrappers = {
      plugin: {}
    };
    this.loadAllModules();
    this.setupWatcher();
  }
  setupWatcher = () => {
    let renamedFile = null,
      state = {};
    this.watcher = fs.watch(nodePath.join(__dirname, "libs"), {
      recursive: true
    }, (eventType, fileName) => {
      if (this._destroyed || this.start >= Date.now() - 10000) return;
      eventType === "rename" && (renamedFile = fileName);
      if (eventType !== "change") return;
      if (!fileName) return;
      fileName = fileName.replace(__dirname, "");
      let parts = fileName.split("\\");
      parts.length === 1 && renamedFile && (fileName = renamedFile.replace(__dirname, ""), parts = fileName.split("\\"));
      if (parts.length < 2) return;
      if (parts[0] === "enums") return;
      const includesResult = parts[0].includes("plugins"),
        replaceResult = parts[1].replace(".js", ""),
        modulePath = "./libs/" + parts[0] + "/" + replaceResult;
      try {
        delete require.cache[require.resolve(modulePath)];
      } catch (error4) {}
      let moduleClass = null;
      try {
        moduleClass = require(modulePath);
      } catch (error5) {
        if (MISSING_MODULE_ERRORS.includes(error5.code)) {
          console.log("The " + (includesResult ? "plugin" : "class") + " " + replaceResult + " has been removed.");
          return;
        } else throw error5;
      }
      if (moduleClass?.DisableReloading) return;
      const timestamp = Date.now();
      if (timestamp - (state[replaceResult] || 0) <= 1500) return;
      state[replaceResult] = timestamp;
      const joinResult = ["libs", parts[0], parts[1].replace(".js", "")].join("/");
      let includesResult2 = includesResult && this.mods.plugin[replaceResult] || !includesResult && this.mods[replaceResult];
      if (includesResult2) {
        const unloadModuleResult = this.unloadModule(joinResult);
        if (unloadModuleResult) includesResult2 = unloadModuleResult;
      }
      this.loadModule(joinResult, includesResult2);
    });
  };
  loadModule = (modulePath2, previousState = false, retryOnFailure = true) => {
    if (this._destroyed) return;
    clearTimeout(this._loadRetries.get(modulePath2));
    this._loadRetries.delete(modulePath2);
    const parts2 = modulePath2.split("/"),
      includesResult3 = parts2[1].includes("plugins"),
      parts2Entry = parts2[2],
      modWrapper = new ModWrapper(this.mod);
    let moduleClass2 = null;
    try {
      moduleClass2 = require("./" + modulePath2);
    } catch (error6) {
      if (MISSING_MODULE_ERRORS.includes(error6.code)) {
        console.log("The " + (includesResult3 ? "plugin" : "class") + " " + parts2Entry + " has been removed.");
        modWrapper.destructor();
        return;
      }
      throw error6;
    }
    let moduleInstance = null;
    try {
      moduleInstance = new moduleClass2(modWrapper, this.mods);
    } catch (error7) {
      !retryOnFailure && (console.log(error7), console.log(modulePath2), console.log(moduleClass2), console.log("Failed to load " + (includesResult3 ? "plugin" : "class") + " " + parts2Entry));
      if (retryOnFailure) this._loadRetries.set(modulePath2, setTimeout(() => {
        this._loadRetries.delete(modulePath2);
        this.loadModule(modulePath2, previousState, false);
      }, 100));
      modWrapper.destructor();
      return;
    }
    if (includesResult3) {
      this.wrappers.plugin[parts2Entry] = modWrapper;
      this.mods.plugin[parts2Entry] = moduleInstance;
      if (previousState && moduleInstance.loaded) moduleInstance.loaded(previousState);
    } else {
      this.wrappers[parts2Entry] = modWrapper;
      this.mods[parts2Entry] = moduleInstance;
      if (previousState && moduleInstance.loaded) moduleInstance.loaded(previousState);
    }
  };
  unloadModule = modulePath3 => {
    clearTimeout(this._loadRetries.get(modulePath3));
    this._loadRetries.delete(modulePath3);
    const parts3 = modulePath3.split("/"),
      includesResult4 = parts3[1].includes("plugins"),
      parts3Entry = parts3[2];
    console.log("Unloading " + (includesResult4 ? "plugin" : "class") + " " + parts3Entry);
    let savedState = null;
    if (includesResult4 && this.mods.plugin[parts3Entry].destructor) savedState = this.mods.plugin[parts3Entry].destructor();else {
      if (!includesResult4 && this.mods[parts3Entry].destructor) savedState = this.mods[parts3Entry].destructor();
    }
    delete require.cache[require.resolve("./" + modulePath3)];
    includesResult4 ? (this.wrappers.plugin[parts3Entry].destructor(), delete this.wrappers.plugin[parts3Entry], delete this.mods.plugin[parts3Entry]) : (this.wrappers[parts3Entry].destructor(), delete this.wrappers[parts3Entry], delete this.mods[parts3Entry]);
    return savedState;
  };
  loadAllModules = () => {
    this.start = Date.now();
    const moduleDirectories = ["classes", "plugins", "custom_plugins", "user_plugins"];
    for (const moduleDirectoryEntry of moduleDirectories) {
      let fileNames = null;
      try {
        fileNames = fs.readdirSync(nodePath.join(__dirname, "libs/" + moduleDirectoryEntry));
      } catch (error8) {
        if (error8.code === "ENOENT") continue;
        throw error8;
      }
      for (const fileNameEntry of fileNames) {
        if (!fileNameEntry.endsWith(".js")) continue;
        this.loadModule("libs/" + moduleDirectoryEntry + "/" + fileNameEntry.replace(".js", ""));
      }
    }
  };
  destructor = () => {
    if (this._destroyed) return;
    this._destroyed = true;
    this.watcher?.close();
    for (const retry of this._loadRetries.values()) clearTimeout(retry);
    this._loadRetries.clear();
    for (const wrappersKey in this.wrappers) {
      if (wrappersKey === "plugin") continue;
      const wrappersEntry = this.wrappers[wrappersKey];
      wrappersEntry.destructor();
      const modsEntry = this.mods[wrappersKey];
      if (!modsEntry.destructor) continue;
      modsEntry.destructor();
    }
    for (const pluginKey in this.wrappers.plugin) {
      const pluginEntry = this.wrappers.plugin[pluginKey];
      pluginEntry.destructor();
      const pluginEntry2 = this.mods.plugin[pluginKey];
      if (!pluginEntry2.destructor) continue;
      pluginEntry2.destructor();
    }
  };
}
module.exports.NetworkMod = PingRemover;
module.exports.ClientMod = require("./libs/classes/datacenter");
module.exports.RequireInterface = (globalMod, clientMod2, networkMod) => networkMod;
