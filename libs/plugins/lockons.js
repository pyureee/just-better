const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  let lockedTargets = [],
    lastLockonActionTime = 0;
  mod.hook(...mods.packet.get_all("S_CAN_LOCKON_TARGET"), hooks.MODIFY_REAL, event => {
    if (!mods.utils.isEnabled(event.skill.id)) return;
    return false;
  });
  const getMaxTargets = skillId => {
      const lockonData = mods.skills.getLockonData(skillId);
      if (!lockonData) return 50;
      let targetCount = 0;
      for (const lockonDataEntry of lockonData || []) {
        for (const lockonDataEntryKey in lockonDataEntry) {
          targetCount += lockonDataEntry[lockonDataEntryKey];
        }
      }
      return targetCount + mods.action.effects.lockon;
    },
    acceptLockon = event2 => {
      if (lockedTargets.length >= getMaxTargets(event2.skill.id)) {
        mods.log.debug("LOCKON", "reached max lockon targets");
        return;
      }
      lockedTargets.push(event2.target);
      mod.send(...mods.packet.get_all("S_CAN_LOCKON_TARGET"), {
        ...event2,
        success: true
      });
    };
  mod.hook(...mods.packet.get_all("C_CAN_LOCKON_TARGET"), hooks.MODIFY_ALL, event3 => {
    if (!mods.utils.isEnabled(event3.skill.id)) return;
    mods.action.stage._time > lastLockonActionTime && (lockedTargets = [], lastLockonActionTime = mods.action.stage._time);
    if (lockedTargets.includes(event3.target)) return;
    const toStringResult = event3.target.toString(),
      lockonData2 = mods.skills.getLockonData(event3.skill.id);
    if (!lockonData2) {
      if (mods.entity.players[toStringResult]) {
        mods.log.debug("LOCKON", "Sending hardcoded lockon success");
        acceptLockon(event3);
        return;
      }
    }
    for (const lockonData2Entry of lockonData2 || []) {
      for (const lockonData2EntryKey in lockonData2Entry) {
        switch (lockonData2EntryKey) {
          case "enemyOrPvp":
            {
              if ((mods.entity.mobs[toStringResult] || mods.entity.players[toStringResult]) && mods.utils.canLockonEntity(toStringResult)) {
                acceptLockon(event3);
                return;
              }
              break;
            }
          case "allyExceptMe":
            {
              if (mods.entity.players[toStringResult]) {
                acceptLockon(event3);
                return;
              }
              break;
            }
          case "raidExceptMe":
          case "raid":
            {
              if (mods.player.playersInParty.has(BigInt(event3.target))) {
                acceptLockon(event3);
                return;
              }
              break;
            }
          default:
            {
              mods.log.error("LOCKON", "Failed to identify type for " + lockonData2EntryKey + " - " + event3.skill.id + " - " + mods.player.templateId);
              break;
            }
        }
      }
    }
    mod.send(...mods.packet.get_all("S_CAN_LOCKON_TARGET"), {
      ...event3,
      success: false
    });
  });
};
