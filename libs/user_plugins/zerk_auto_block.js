const HOOKS = require("../enums/hooks"),
  classes = require("../enums/classes");
module.exports = function (mod, mods) {
  (!mods.settings.info.zerk_auto_block || !mods.settings.info.zerk_auto_block.skills) && (mods.settings.info.zerk_auto_block = {
    enabled: true,
    skills: {
      "1-0": true,
      4: true,
      6: true,
      "15-10": true,
      "15-11": true,
      "15-12": true,
      "15-13": true,
      "15-14": true,
      18: true,
      "24-0": true,
      "24-10": true,
      "24-11": true,
      "24-12": true,
      "24-13": true,
      26: true,
      "31-1": true,
      37: true
    }
  });
  mods.settings.info.zerk_auto_block.skills[37] === undefined && (mods.settings.info.zerk_auto_block.skills[37] = true);
  if (mods.settings.info.zerk_auto_block.enabled === undefined) mods.settings.info.zerk_auto_block.enabled = true;
  let blockTimer = null;
  let pendingBlock = null;
  const cancelAutoBlock = () => {
    mod.clearTimeout(blockTimer);
    blockTimer = null;
    pendingBlock = null;
  };

  for (const name of ["C_PRESS_SKILL", "C_START_SKILL", "C_START_TARGETED_SKILL",
    "C_START_COMBO_INSTANT_SKILL", "C_START_INSTANCE_SKILL",
    "C_START_INSTANCE_SKILL_EX", "C_NOTIMELINE_SKILL"])
    mod.hook(...mods.packet.get_all(name), HOOKS.READ_REAL, cancelAutoBlock);
  const scheduleAutoBlock = event2 => {
    if (!mods.player.isMe(event2.gameId)) return;
    if (pendingBlock && pendingBlock.id !== event2.id) cancelAutoBlock();
    if (event2.stage) return;
    cancelAutoBlock();
    if (mods.player.job !== classes.BERSERKER) return;
    if (!mods.settings.info.zerk_auto_block.enabled) return;
    if (!mods.utils.isEnabled(event2.skill.id)) return;
    const skillInfo = mods.utils.getSkillInfo(event2.skill.id),
      skills2 = mods.settings.info.zerk_auto_block.skills;
    if (!(skills2[skillInfo.skill + "-" + skillInfo.sub] ?? skills2[skillInfo.skill])) return;
    const skillData = mods.skills._getInfo(event2.skill.id),
      {
        rearStartTime = -1
      } = skillData?.cancels || {};

    if (rearStartTime === -1 || skillData?.type === "movingCharge") return;
    if (!(mods.action.speed?.real > 0)) return;
    const rearStartTimePerRealAdjusted = rearStartTime / mods.action.speed.real + 10,
      lastHitPerRealAdjusted = (skillData?.lastHit || 0) / mods.action.speed.real + 10;
    const scheduledBlock = { id: event2.id };
    pendingBlock = scheduledBlock;
    blockTimer = mod.setTimeout(() => {
      if (pendingBlock !== scheduledBlock) return;
      blockTimer = mod.setTimeout(() => {
        if (pendingBlock !== scheduledBlock) return;
        cancelAutoBlock();
        if (mods.player.job !== classes.BERSERKER || mods.player.alive === false) return;
        if (!mods.settings.info.zerk_auto_block.enabled || !mods.utils.isEnabled(event2.skill.id)) return;
        if (!(skills2[skillInfo.skill + "-" + skillInfo.sub] ?? skills2[skillInfo.skill])) return;
        if (!mods.action.inAction) return;
        if (mods.effects.getAbnormality(401701)) return;
        if (event2.id !== mods.action.stage?.id) return;
        if (skillInfo.skill === 15 && !mods.cooldown.isOnCooldown(18)) return;
        if (skillInfo.skill === 37 && mods.effects.getAbnormality(401705)) return;
        const skillPacket = {
          skill: 20230,
          press: true,
          loc: mods.position.loc,
          w: mods.position.w
        };
        mod.send(...mods.packet.get_all("C_PRESS_SKILL"), skillPacket);
        mod.send(...mods.packet.get_all("C_PRESS_SKILL"), {
          ...skillPacket,
          press: false
        });
      }, mods.ping.jitter);
    }, Math.max(rearStartTimePerRealAdjusted, lastHitPerRealAdjusted));
  };
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), HOOKS.READ_DESTINATION_FAKE, scheduleAutoBlock);
  mod.hook(...mods.packet.get_all("S_ACTION_END"), HOOKS.READ_DESTINATION_ALL, event => {
    if (mods.player.isMe(event.gameId) && pendingBlock?.id === event.id) cancelAutoBlock();
  });
  for (const name of ["S_LOGIN", "S_LOAD_TOPO", "S_RETURN_TO_LOBBY"])
    mod.hook(name, "raw", { filter: { fake: null } }, cancelAutoBlock);
  mod.hook(...mods.packet.get_all("S_CREATURE_LIFE"), HOOKS.READ_DESTINATION_ALL, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) cancelAutoBlock();
  });
  this.destructor = () => {cancelAutoBlock();mods.command.remove("zerk ab");mods.command.remove("zerkblock");};
  mods.command.add("zerk ab", () => {
    cancelAutoBlock();
    const config=mods.settings.info.zerk_auto_block;config.enabled=!config.enabled;
    mods.settings.save?.();
    mods.command.message("Zerk Auto Block: " + (config.enabled ? "ON" : "OFF"));
  });
  mods.command.add("zerkblock", skillKey => {
    cancelAutoBlock();
    if (!skillKey) {
      mods.settings.info.zerk_auto_block.enabled = !mods.settings.info.zerk_auto_block.enabled;
      mods.settings.save?.();
      mods.command.message("Auto block has been turned " + (mods.settings.info.zerk_auto_block.enabled ? "on" : "off"));
      return;
    }
    if (mods.settings.info.zerk_auto_block.skills[skillKey] === undefined) {
      mods.command.message("Unknown skill: " + skillKey);
      return;
    }
    mods.settings.info.zerk_auto_block.skills[skillKey] = !mods.settings.info.zerk_auto_block.skills[skillKey];
    mods.settings.save?.();
    mods.command.message("Auto blocking for " + skillKey + " has been turned " + (mods.settings.info.zerk_auto_block.skills[skillKey] ? "on" : "off"));
  });
};
