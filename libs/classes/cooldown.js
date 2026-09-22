const hooks = require("../enums/hooks"),
  EventEmitter = require("events");
class Cooldown extends EventEmitter {
  isOnCooldown = (skillId, skillId2) => {
    const timestamp = Date.now();
    if (this.info.skills[skillId2]?.usedStacks) {
      const {
          time = 0,
          usedStacks = 0,
          nextStackCooldown = 0
        } = this.info.skills[skillId2],
        cooldownData = this.mods.skills.getCooldownData(skillId2),
        usedStacksAdjusted = usedStacks - (time + nextStackCooldown > timestamp ? 0 : 1);
      return cooldownData.maxStack === usedStacksAdjusted;
    }
    const {
        time = 0,
        cooldown = 0
      } = this.info.skills[skillId] || {},
      timePlusCooldown = time + cooldown;
    return timePlusCooldown > timestamp;
  };
  isOnCooldownBase = skillBase => {
    const timestamp2 = Date.now(),
      {
        time = 0,
        cooldown = 0
      } = this.info.skills[skillBase] || {},
      timePlusCooldown2 = time + cooldown;
    return timePlusCooldown2 > timestamp2;
  };
  getData = (skillId3, useServerData = false) => {
    return useServerData ? this.info.server[skillId3] : this.info.skills[skillId3];
  };
  cooltimeSkill = (event, isFake) => {
    const cooldownState = {
        time: Date.now(),
        cooldown: event.cooldown,
        usedStacks: event.usedStacks,
        nextStackCooldown: event.nextStackCooldown
      },
      skillInfo = this.mods.utils.getSkillInfo(event.skill.id);
    this.info.skills[event.skill.id] = cooldownState;
    this.info.skills[skillInfo.skill] = cooldownState;
    !isFake && (this.info.server[event.skill.id] = cooldownState, this.info.server[skillInfo.skill] = cooldownState);
  };
  crestMessage = (event2, isFake2) => {
    if (event2.type !== 6) return;
    this.mods.log.debug("CREST-COOLDOWN", "Removed cd from skill:", event2.skill);
    const cooldownState2 = {
        time: Date.now(),
        cooldown: 0,
        usedStacks: 0,
        nextStackCooldown: 0
      },
      skillInfo2 = this.mods.utils.getSkillInfo(event2.skill);
    this.info.skills[event2.skill] = cooldownState2;
    this.info.skills[skillInfo2.skill] = cooldownState2;
    !isFake2 && (this.info.server[event2.skill] = cooldownState2, this.info.server[skillInfo2.skill] = cooldownState2);
    this.emit("reset", skillInfo2.id, isFake2);
  };
  constructor(mod2, mods2) {
    super();
    this.mod = mod2;
    this.mods = mods2;
    this.info = {
      skills: {},
      server: {}
    };
    mod2.hook(...mods2.packet.get_all("S_DECREASE_COOLTIME_SKILL"), hooks.READ_DESTINATION_ALL_CLASS, this.cooltimeSkill);
    mod2.hook(...mods2.packet.get_all("S_START_COOLTIME_SKILL"), hooks.READ_DESTINATION_ALL_CLASS, this.cooltimeSkill);
    mod2.hook(...mods2.packet.get_all("S_CREST_MESSAGE"), hooks.READ_DESTINATION_ALL_CLASS, this.crestMessage);
  }
}
module.exports = Cooldown;
