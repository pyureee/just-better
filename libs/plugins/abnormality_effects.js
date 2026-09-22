const classes = require("../enums/classes"),
  hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  let pendingSpeedChanges = [];
  const createSpeedAdjustment = isApplying => (abnormalityData, effectData) => {
      let value2 = null;
      switch (effectData.method) {
        case 2:
          value2 = +effectData.value;
          break;
        case 3:
          value2 = Math.round((+effectData.value - 1) * mods.player.attackSpeed);
          break;
      }
      if (value2 === null || isNaN(value2)) return;
      let timer = null;
      const speedAdjustment = {
        value: value2 * (isApplying ? 1 : -1),
        abnormality: abnormalityData.id,
        callback: (restoreSpeed = true) => {
          mod.clearTimeout(timer);
          pendingSpeedChanges.splice(pendingSpeedChanges.indexOf(speedAdjustment), 1);
          restoreSpeed && mod.send(...mods.packet.get_all("S_PLAYER_STAT_UPDATE"), {
            ...mods.player.previous_sPlayerStatUpdate,
            attackSpeedBonus: mods.player.attackSpeedBonus - speedAdjustment.value
          });
        }
      };
      pendingSpeedChanges.push(speedAdjustment);
      timer = mod.setTimeout(speedAdjustment.callback, mods.ping.ping);
      mod.send(...mods.packet.get_all("S_PLAYER_STAT_UPDATE"), {
        ...mods.player.previous_sPlayerStatUpdate,
        attackSpeedBonus: mods.player.attackSpeedBonus + speedAdjustment.value
      });
    },
    createServerReconciliation = isEnding => event => {
      if (!mods.player.isMe(event.target)) return;
      for (const pendingSpeedChangeEntry of pendingSpeedChanges) {
        pendingSpeedChangeEntry.abnormality === event.id && pendingSpeedChangeEntry.callback(false);
      }
    };
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_BEGIN"), hooks.READ_REAL, createServerReconciliation(false));
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_END"), hooks.READ_REAL, createServerReconciliation(true));
  const createCategoryUpdate = enabled2 => abnormalityData2 => {
      for (const category2 of abnormalityData2.bySkillCategory) {
        if (!category2) continue;
        mod.send(...mods.packet.get_all("S_SKILL_CATEGORY"), {
          category: category2,
          enabled: enabled2
        });
      }
    },
    state = {
      24: createSpeedAdjustment(true),
      209: {
        3: createCategoryUpdate(true)
      },
      210: {
        0: createCategoryUpdate(false)
      }
    },
    state2 = {
      24: createSpeedAdjustment(false),
      210: {
        0: createCategoryUpdate(true)
      }
    },
    createAbnormalityHandler = effectHandlers => event2 => {
      if (!mods.player.isMe(event2.target)) return;
      if (!mods.utils.isEnabled()) return;
      const abnormalityData3 = mods.datacenter.getAbnormalityData(event2.id);
      if (!abnormalityData3) return;
      let undefined2 = undefined;
      for (const abnormalityEffectEntry of abnormalityData3?.AbnormalityEffect || []) {
        if (mods.player.job !== classes.WARRIOR && abnormalityEffectEntry.type === 210) continue;
        const effectHandlersEntry = effectHandlers[abnormalityEffectEntry.type];
        if (!effectHandlersEntry) continue;
        if (typeof effectHandlersEntry !== "object") {
          const effectHandlersEntryResult = effectHandlersEntry(abnormalityData3, abnormalityEffectEntry);
          if (effectHandlersEntryResult !== undefined) undefined2 = effectHandlersEntryResult;
          continue;
        }
        const effectHandlersEntryEntry = effectHandlersEntry[abnormalityEffectEntry.method];
        if (!effectHandlersEntryEntry) continue;
        const effectHandlersEntryEntryResult = effectHandlersEntryEntry(abnormalityData3, abnormalityEffectEntry);
        if (effectHandlersEntryEntryResult !== undefined) undefined2 = effectHandlersEntryEntryResult;
      }
      return undefined2;
    };
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_BEGIN"), hooks.READ_DESTINATION_FAKE, createAbnormalityHandler(state));
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_END"), hooks.READ_DESTINATION_FAKE, createAbnormalityHandler(state2));
  mod.hook(...mods.packet.get_all("S_PLAYER_STAT_UPDATE"), {
    order: -1050
  }, event3 => {
    pendingSpeedChanges.length && mods.log.debug("STAT-UPDATE", "<-R attackSpeed:" + event3.attackSpeed + " attackSpeedBonus:" + event3.attackSpeedBonus);
    for (const {
      value: value3
    } of pendingSpeedChanges) {
      event3.attackSpeedBonus += value3;
    }
    return pendingSpeedChanges.length ? true : undefined;
  });
};
