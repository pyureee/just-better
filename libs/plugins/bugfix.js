const TELEPORT_SKILL_TYPES = ["catchBack", "shortTel"];

const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  let reactionGraceDeadline = 0;
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_ALL, event => {
    if (!mods.player.isMe(event.gameId)) return;
    if (!mods.utils.isEnabled(event.skill.id)) return;
    if (!TELEPORT_SKILL_TYPES.includes(mods.skills.getType(event.skill.id))) return;
    reactionGraceDeadline = Date.now() + mods.utils.getPacketBuffer(100);
  });
  mod.hook(...mods.packet.get_all("S_CANNOT_START_SKILL"), hooks.MODIFY_ALL, (event2, event3) => {
    if (!mods.utils.isEnabled(event2.skill.id)) return;
    if (reactionGraceDeadline > Date.now()) return false;
    if (event3) reactionGraceDeadline = Date.now() + mods.utils.getPacketBuffer();
  });
  mod.hook(...mods.packet.get_all("S_SYSTEM_MESSAGE"), hooks.MODIFY_ALL, event4 => {
    if (!mods.utils.isEnabled()) return;
    const systemMessage = mod.parseSystemMessage(event4.message);
    switch (systemMessage.id) {
      case "SMT_SKILL_FAIL_CATEGORY":
        {
          mods.log.debug("S_SYSTEM_MESSAGE", "failed to start skill");
          if (mods.action.inAction) return false;
          if ((Date.now() - mods?.action?.end?._time || 0) <= mods.utils.getPacketBuffer()) return false;
          break;
        }
      case "SMT_BATTLE_SKILL_FAIL_LOW_STAMINA":
        {
          const stateEntry = {
            9: "SMT_BATTLE_SKILL_FAIL_LOW_ARCANE",
            10: "SMT_BATTLE_SKILL_FAIL_LOW_FURY",
            11: "SMT_BATTLE_SKILL_FAIL_LOW_CHAKRA",
            12: "SMT_BATTLE_SKILL_FAIL_LOW_MOON_LIGHT"
          }[mods.player.job];
          if (!stateEntry) break;
          mods.utils.sendSystemMessage(stateEntry);
          return false;
          break;
        }
    }
  });
};
