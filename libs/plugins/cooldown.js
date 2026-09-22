const hooks = require("../enums/hooks"),
  classes = require("../enums/classes");
module.exports = function (mod, mods) {
  let timer = null;
  const pendingResets = new Set();
  const adjustCooldownForLatency = event => {
    if (!mods.utils.isEnabled(event.skill.id)) return;
    const cooldown2 = Math.max(0, mods.ping.ping - mods.ping.jitter - 5);
    event.cooldown -= cooldown2;
    event.nextStackCooldown -= cooldown2;
    if (event.cooldown < 0) event.cooldown = 0;
    if (event.nextStackCooldown < 0) event.nextStackCooldown = 0;
    return true;
  };
  mod.hook(...mods.packet.get_all("S_DECREASE_COOLTIME_SKILL"), hooks.MODIFY_REAL, adjustCooldownForLatency);
  mod.hook(...mods.packet.get_all("S_START_COOLTIME_SKILL"), hooks.MODIFY_REAL, adjustCooldownForLatency);
  mod.hook(...mods.packet.get_all("S_CREST_MESSAGE"), hooks.READ_ALL, event2 => {
    if (event2.type !== 6) return;
    if (!mods.utils.isEnabled()) return;
    mods.cooldown.isOnCooldown(event2.skill) && mod.send(...mods.packet.get_all("S_DECREASE_COOLTIME_SKILL"), {
      skill: event2.skill,
      cooldown: 0
    });
  });
  const getLinkedCooldownSkills = skillId => {
      const skillsToApplyCooldownToFrom = mods.skills.getSkillsToApplyCooldownToFrom(skillId);
      if (!skillsToApplyCooldownToFrom) return [skillId];
      const linkedSkillIds = [];
      for (const skillsToApplyCooldownToFromEntry of skillsToApplyCooldownToFrom) {
        const [parts, parts2] = skillsToApplyCooldownToFromEntry.split("-");
        for (const skillsEntryEntry of mods.last.skillList.skills[skillsToApplyCooldownToFromEntry] || []) {
          const skillInfo = mods.utils.getSkillInfo(0);
          linkedSkillIds.push(skillInfo.calculateNewId(+parts, skillsEntryEntry, +parts2));
        }
      }
      !linkedSkillIds.includes(skillId) && linkedSkillIds.push(skillId);
      return linkedSkillIds;
    },
    isSlayerCooldownException = skillId2 => {
      if (mods.player.job !== classes.SLAYER) return false;
      const skillInfo2 = mods.utils.getSkillInfo(skillId2);
      if (skillInfo2.skill !== 8) return false;
      if (!mods.effects.getAbnormality(300805)) return false;
      return true;
    };
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_FAKE, event3 => {
    if (!mods.player.isMe(event3.gameId)) return;
    if (event3.stage) return;
    if (!mods.utils.isEnabled()) return;
    mod.clearTimeout(timer);
    if (!mods.utils.isEnabled(event3.skill.id)) return;
    if (isSlayerCooldownException(event3.skill.id)) return;
    const cooldownData = mods.skills.getCooldownData(event3.skill.id);
    if (!cooldownData?.cooltime) return;
    const timestampMinusPingMinusStageDelayMs = Date.now() - mods.ping.ping - mods.skills.getActionStageDelay(event3.skill.id),
      delayMs = cooldownData.delay / mods.action.speed.real,
      skillInfo3 = mods.utils.getSkillInfo(event3.skill.id);
    timer = mod.setTimeout(() => {
      if (mods.cooldown.getData(skillInfo3.skill, true)?.time > timestampMinusPingMinusStageDelayMs) return;
      if (!mods.action.inAction) return;
      if (mods.action.stage.id !== event3.id) return;
      if (mods.skills.getType(skillInfo3.id) === "movingDefence") return;
      const linkedCooldownSkills = getLinkedCooldownSkills(skillInfo3.id);
      for (const skill2 of linkedCooldownSkills) {
        mod.send(...mods.packet.get_all("S_START_COOLTIME_SKILL"), {
          skill: skill2,
          cooldown: cooldownData.cooltime
        });
      }
      const pending = { source: mods.cooldown, timer: null, listener: null };
      const finish = () => {
        if (!pendingResets.delete(pending)) return;
        mod.clearTimeout(pending.timer);
        pending.source.off("reset", pending.listener);
        const event4 = mods.cooldown.getData(skillInfo3.skill, true);
        if (event4?.cooldown !== 0 && event4?.time > timestampMinusPingMinusStageDelayMs) return;
        for (const skill3 of linkedCooldownSkills) {
          mod.send(...mods.packet.get_all("S_DECREASE_COOLTIME_SKILL"), {
            skill: skill3,
            cooldown: 0
          });
        }
      };
      pending.listener = skillId => {
        if (linkedCooldownSkills.includes(skillId)) finish();
      };
      pendingResets.add(pending);
      pending.source.on("reset", pending.listener);
      pending.timer = mod.setTimeout(finish, mods.utils.getPacketBuffer());
    }, delayMs);
  });
  this.destructor = () => {
    mod.clearTimeout(timer);
    for (const pending of pendingResets) {
      mod.clearTimeout(pending.timer);
      pending.source.off("reset", pending.listener);
    }
    pendingResets.clear();
  };
};
