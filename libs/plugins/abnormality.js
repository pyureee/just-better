const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  let beginDeadlines = {},
    endDeadlines = {},
    abnormalityTimers = {},
    pendingBeginsBySkill = {},
    pendingEndsBySkill = {};
  "TRUE" !== "TRUE" && mods.command.add("abnormality", abnormalityId => {
    console.log(mods.datacenter.getAbnormalityData(abnormalityId));
  });
  const startAbnormality = (abnormalityId2, skillId, durationOverride = null) => {
      pendingBeginsBySkill[skillId] && (pendingBeginsBySkill[skillId] = pendingBeginsBySkill[skillId].filter(pendingBeginsBySkillEntryItem => pendingBeginsBySkillEntryItem !== abnormalityId2));
      const abnormalityData = mods.datacenter.getAbnormalityData(abnormalityId2);
      if (!abnormalityData) {
        mods.log.error("startAbnormality", "didn't find abnormData:", abnormalityId2);
        return;
      }
      const abnormality = mods.effects.getAbnormality(abnormalityId2),
        abnormalityPacket = {
          target: mods.player.gameId,
          source: 0x0n,
          id: abnormalityId2,
          duration: +(durationOverride || abnormalityData.time || 0),
          stacks: abnormality?.stacks || 1
        };
      mod.send(...mods.packet.get_all("S_ABNORMALITY_" + (abnormality ? "REFRESH" : "BEGIN")), abnormalityPacket);
      beginDeadlines[abnormalityId2] = Date.now() + mods.utils.getPacketBuffer();
      mod.clearTimeout(abnormalityTimers[abnormalityId2]);
      if (abnormalityPacket.duration <= 2147483647) abnormalityTimers[abnormalityId2] = mod.setTimeout(endAbnormality, abnormalityPacket.duration, abnormalityId2);
    },
    endAbnormality = abnormalityId3 => {
      mod.send(...mods.packet.get_all("S_ABNORMALITY_END"), {
        target: mods.player.gameId,
        id: abnormalityId3
      });
      endDeadlines[abnormalityId3] = Date.now() + mods.utils.getPacketBuffer();
    },
    scheduleReconciliation = (abnormalityId4, wasRemoved) => {
      const serverAbnormality = mods.effects.getServerAbnormality(abnormalityId4),
        abnormality2 = mods.effects.getAbnormality(abnormalityId4);
      mod.setTimeout(() => {
        const serverAbnormality2 = mods.effects.getServerAbnormality(abnormalityId4),
          abnormality3 = mods.effects.getAbnormality(abnormalityId4),
          isServerAbnormality = !serverAbnormality && serverAbnormality2 || serverAbnormality && serverAbnormality2 && serverAbnormality2.time > serverAbnormality.time,
          serverAbnormality3 = serverAbnormality && !serverAbnormality2,
          isServerAbnormality2 = !serverAbnormality && !serverAbnormality2;
        if (!wasRemoved && isServerAbnormality) return;
        if (wasRemoved && serverAbnormality3) return;
        if (wasRemoved && isServerAbnormality2) return;
        const abnormality22 = abnormality2 && !abnormality3;
        if (!wasRemoved && abnormality22) return;
        if (!wasRemoved) {
          mods.log.debug("revertingAbnormality", "ending " + abnormalityId4);
          mod.clearTimeout(abnormalityTimers[abnormalityId4]);
          abnormalityTimers[abnormalityId4] = undefined;
          beginDeadlines[abnormalityId4] = undefined;
          mod.send(...mods.packet.get_all("S_ABNORMALITY_END"), {
            target: mods.player.gameId,
            id: abnormalityId4
          });
          return;
        }
        if (!abnormality2) {
          mods.log.debug("revertingAbnormality", "Uncertain state reached for " + abnormalityId4, abnormality2, abnormality3, serverAbnormality, serverAbnormality2, wasRemoved);
          return;
        }
        const serverAbnormality22 = serverAbnormality2 && serverAbnormality2.time > abnormality2.time ? serverAbnormality2 : abnormality2,
          duration2 = Math.max(serverAbnormality22.duration - (Date.now() - serverAbnormality22.time), 0);
        if (duration2 === 0) {
          mods.log.debug("revertingAbnormality", "no point in reverting " + abnormalityId4 + " as there is no duration left.");
          return;
        }
        mods.log.debug("revertingAbnormality", "restarting " + abnormalityId4 + " with the following duration left: " + duration2);
        mod.clearTimeout(abnormalityTimers[abnormalityId4]);
        abnormalityTimers[abnormalityId4] = undefined;
        endDeadlines[abnormalityId4] = undefined;
        mod.send(...mods.packet.get_all("S_ABNORMALITY_BEGIN"), {
          target: mods.player.gameId,
          source: 0x0n,
          id: abnormalityId4,
          duration: duration2,
          stacks: serverAbnormality22.stacks
        });
      }, mods.utils.getPacketBuffer(100));
    };
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_FAKE, event => {
    if (!mods.player.isMe(event.gameId)) return;
    if (!mods.utils.isEnabled(event.skill.id)) return;
    if (event.stage !== 0) return;
    const speed2 = mods.action.speed;
    pendingEndsBySkill[event.skill.id] = [];
    const abnormalitiesToEndOnActionStage = mods.skills.getAbnormalitiesToEndOnActionStage(event.skill.id);
    for (const {
      id: id2,
      delay: delay2,
      fixed: fixed2,
      forced: forced2
    } of abnormalitiesToEndOnActionStage) {
      mod.clearTimeout(abnormalityTimers[id2]);
      if (!mods.effects.getAbnormality(id2)) continue;
      pendingEndsBySkill[event.skill.id].push(id2);
      const delayMs = delay2 / (fixed2 ? speed2.fixed : speed2.not_fixed);
      delayMs <= 2147483647 && (delayMs === 0 ? (!forced2 && scheduleReconciliation(id2, true), endAbnormality(id2)) : abnormalityTimers[id2] = mod.setTimeout(abnormalityId5 => {
        !forced2 && scheduleReconciliation(abnormalityId5, true);
        endAbnormality(abnormalityId5);
      }, delayMs, id2));
    }
    pendingBeginsBySkill[event.skill.id] = [];
    const abnormalitiesToStartOnActionStage = mods.skills.getAbnormalitiesToStartOnActionStage(event.skill.id);
    for (const {
      id: id3,
      delay: delay3,
      fixed: fixed3,
      duration: duration3,
      forced: forced3
    } of abnormalitiesToStartOnActionStage) {
      const delayMs2 = delay3 / (fixed3 ? speed2.fixed : speed2.not_fixed);
      pendingBeginsBySkill[event.skill.id].push(id3);
      mod.clearTimeout(abnormalityTimers[id3]);
      delayMs2 <= 2147483647 && (abnormalityTimers[id3] = mod.setTimeout((abnormalityId6, skillId2, duration4) => {
        !forced3 && scheduleReconciliation(abnormalityId6, false);
        startAbnormality(abnormalityId6, skillId2, duration4);
      }, delayMs2, id3, event.skill.id, duration3));
    }
  });
  mod.hook(...mods.packet.get_all("S_ACTION_END"), hooks.READ_DESTINATION_FAKE, event2 => {
    if (!mods.player.isMe(event2.gameId)) return;
    if (!mods.utils.isEnabled(event2.skill.id)) return;
    for (const pendingEndsBySkillEntryEntry of pendingEndsBySkill[event2.skill.id] || []) {
      mod.clearTimeout(abnormalityTimers[pendingEndsBySkillEntryEntry]);
    }
    for (const pendingBeginsBySkillEntryEntry of pendingBeginsBySkill[event2.skill.id] || []) {
      mod.clearTimeout(abnormalityTimers[pendingBeginsBySkillEntryEntry]);
    }
    const speed3 = mods.action.speed,
      abnormalitiesToEndOnActionEnd = mods.skills.getAbnormalitiesToEndOnActionEnd(event2.skill.id);
    for (const {
      id: id4,
      delay: delay4,
      fixed: fixed4,
      noTimer: noTimer2,
      forced: forced4
    } of abnormalitiesToEndOnActionEnd) {
      mod.clearTimeout(abnormalityTimers[id4]);
      if (!mods.effects.getAbnormality(id4)) continue;
      const delayMs3 = delay4 / (fixed4 ? speed3.fixed : speed3.not_fixed);
      if (delayMs3 > 2147483647) continue;
      const endActionAbnormality = abnormalityId7 => {
        !forced4 && scheduleReconciliation(abnormalityId7, true);
        endAbnormality(abnormalityId7);
      };
      if (noTimer2) mod.setTimeout(endActionAbnormality, delayMs3, id4);else abnormalityTimers[id4] = mod.setTimeout(endActionAbnormality, delayMs3, id4);
    }
  });
  const filterAbnormality = isEnding => event3 => {
    if (!mods.player.isMe(event3.target)) return;
    if (!mods.utils.isEnabled()) return;
    const abnormality4 = mods.effects.getAbnormality(event3.id);
    event3.duration = Number(event3.duration);
    const abnormality42 = abnormality4 && (abnormality4.stacks !== event3.stacks || event3.duration !== abnormality4.duration),
      timestamp = Date.now(),
      beginDeadlinesEntry = beginDeadlines[event3.id];
    if (!abnormality42 && beginDeadlinesEntry && beginDeadlinesEntry > timestamp) {
      mods.log.debug("abnormalityBeginRefreshHandler", "Blocking");
      return false;
    }
    mod.clearTimeout(abnormalityTimers[event3.id]);
    event3.duration -= mods.ping.ping + mods.ping.jitter;
    if (event3.duration <= 2147483647) abnormalityTimers[event3.id] = mod.setTimeout(endAbnormality, event3.duration, event3.id);
    if (abnormality4 && !isEnding) {
      mod.send(...mods.packet.get_all("S_ABNORMALITY_REFRESH"), event3);
      return false;
    }
    if (isEnding && !abnormality4) {
      mod.send(...mods.packet.get_all("S_ABNORMALITY_BEGIN"), event3);
      return false;
    }
    return true;
  };
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_BEGIN"), hooks.MODIFY_REAL, filterAbnormality());
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_REFRESH"), hooks.MODIFY_REAL, filterAbnormality(true));
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_END"), hooks.MODIFY_REAL, event4 => {
    if (!mods.player.isMe(event4.target)) return;
    if (!mods.utils.isEnabled()) return;
    const timestamp2 = Date.now();
    let endDeadlinesEntry = endDeadlines[event4.id];
    if (endDeadlinesEntry && endDeadlinesEntry > timestamp2) {
      mods.log.debug("abnormEndHandler", "Not ending due to recently ended", timestamp2, endDeadlinesEntry);
      return false;
    }
    endDeadlinesEntry = beginDeadlines[event4.id];
    if (endDeadlinesEntry && endDeadlinesEntry > timestamp2) {
      mods.log.debug("abnormEndHandler", "Not ending due to recently emulated", timestamp2, endDeadlinesEntry);
      return false;
    }
    mod.clearTimeout(abnormalityTimers[event4.id]);
  });
};
