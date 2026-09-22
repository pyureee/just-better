const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  let recallHooks = [],
    recalling = false,
    deferredSkillPacket = null;
  const finishRecall = () => {
      recalling = false;
      deferredSkillPacket && mod.send(...mods.packet.get_all(deferredSkillPacket._name), deferredSkillPacket);
    },
    supportsRecall = () => {
      return mods.player.job === 9 && mods.skills.isSupported(210300);
    },
    isRecallSkill = skillId => {
      return skillId - mods.player.templateId * 100 === 8;
    },
    handleRecallStart = event => {
      if (!mods.player.isMe(event.gameId)) return;
      if (!isRecallSkill(event.skill.id)) return;
      if (!mods.utils.isEnabled()) return;
      event.skill = 210300;
      deferredSkillPacket = null;
      recalling = true;
      return true;
    },
    handleRecallEnd = event2 => {
      if (!mods.player.isMe(event2.gameId)) return;
      if (!isRecallSkill(event2.skill.id)) return;
      if (!mods.utils.isEnabled()) return;
      event2.skill = 210300;
      finishRecall();
      return true;
    },
    blockDuringRecall = () => {
      if (recalling && mods.utils.isEnabled()) {
        mods.log.debug("RECALL", "blocking packet due to being in recall");
        mod.send(...mods.packet.get_all("S_CANNOT_START_SKILL"), {
          skill: mods.last.startSkill.skill.id
        });
        return false;
      }
    },
    deferSkillDuringRecall = () => {
      if (blockDuringRecall() === false) {
        deferredSkillPacket = mods.last.startSkill;
        return false;
      }
    },
    handleDeath = event3 => {
      if (!mods.player.isMe(event3.gameId)) return;
      if (event3.alive) return;
      recalling = false;
    },
    registerRecallHooks = () => {
      recallHooks.push(mod.hook(...mods.packet.get_all("S_CREATURE_LIFE"), hooks.READ_DESTINATION_ALL, handleDeath));
      recallHooks.push(mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.MODIFY_INTERNAL_REAL, handleRecallStart));
      recallHooks.push(mod.hook(...mods.packet.get_all("S_ACTION_END"), hooks.MODIFY_INTERNAL_REAL, handleRecallEnd));
      recallHooks.push(mod.hook("C_START_SKILL", "event", hooks.MODIFY_INTERNAL_REAL, blockDuringRecall));
      recallHooks.push(mod.hook("C_START_TARGETED_SKILL", "event", hooks.MODIFY_INTERNAL_REAL, blockDuringRecall));
      recallHooks.push(mod.hook("C_START_COMBO_INSTANT_SKILL", "event", hooks.MODIFY_INTERNAL_REAL, blockDuringRecall));
      recallHooks.push(mod.hook("C_START_INSTANCE_SKILL", "event", hooks.MODIFY_INTERNAL_REAL, blockDuringRecall));
      recallHooks.push(mod.hook("C_START_INSTANCE_SKILL_EX", "event", hooks.MODIFY_INTERNAL_REAL, deferSkillDuringRecall));
      recallHooks.push(mod.hook("C_PRESS_SKILL", "event", hooks.MODIFY_INTERNAL_REAL, blockDuringRecall));
    };
  this.loaded = () => {
    if (supportsRecall()) registerRecallHooks();else {
      for (const hook2 of recallHooks) mod.unhook(hook2);
      recallHooks = [];
    }
  };
  mod.hook("S_LOGIN", "event", hooks.READ_DESTINATION_ALL, this.loaded);
};
