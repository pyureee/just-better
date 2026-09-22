const HOOKS = require("../enums/hooks");
module.exports = function (mod, mods) {
  const cooldown2 = 300;
  let interval = null;
  mod.hook(...mods.packet.get_all("S_USER_STATUS"), HOOKS.READ_DESTINATION_REAL, event => {
    mod.clearInterval(interval);
    event.status === 2 && (interval = mod.setInterval(() => {
      for (const entryEntry of mods.player.playersInParty.values()) {
        if (entryEntry.status === 1) return;
      }

      const adjusted = new Set();
      for (const nameEntry of ["skills", "server"]) {
        for (const infoEntryKey in mods.cooldown.info[nameEntry]) {
          const data = mods.cooldown.info[nameEntry][infoEntryKey];
          if (adjusted.has(data)) continue;
          adjusted.add(data);
          data.cooldown -= cooldown2;
        }
      }
    }, cooldown2));
  });
  this.destructor = () => {
    mod.clearInterval(interval);
  };
};
