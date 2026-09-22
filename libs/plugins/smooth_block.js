const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  mod.hook(...mods.packet.get_all("S_EACH_SKILL_RESULT"), hooks.MODIFY_ALL, event => {
    if (!mods.settings.smoothBlock) return;
    if (!mods.player.isMe(event.target)) return;
    if (!event.superArmorId) return;
    if (!mods.utils.isEnabled()) return;
    event.superArmorId = 0;
    return true;
  });
};
