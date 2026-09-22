const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  let callback = null,
    timer = null,
    lastReactionId = null,
    lastEndId = null;
  mod.hook(...mods.packet.get_all("S_ACTION_END"), hooks.MODIFY_INTERNAL_REAL, event => {
    if (event.id === lastEndId) {
      mods.log.debug("CC-ACTION-END", "Blocking because it's matching ids");
      return false;
    }
    if (event.type === 9 && mods.skills.getTypeId(mods?.action?.stage?.skill?.id) === 27) {
      mods.log.debug("CC-ACTION-END", "Blocking because type 9 and we're in retaliate");
      return false;
    }
    if (event.id === lastReactionId) {
      mod.clearTimeout(timer);
      if (event.type === 5) {
        mods.log.debug("CC-ACTION-END", "Blocking because type 5");
        return false;
      }
    }
  });
  mod.hook(...mods.packet.get_all("S_EACH_SKILL_RESULT"), hooks.MODIFY_ALL, event2 => {
    if (!event2.reaction.enable) return;
    if (mods.player.isMe(event2.source)) return;
    if (!mods.player.isMe(event2.target)) return;
    if (!mods.utils.isEnabled()) return;
    mod.clearTimeout(timer);
    const reduceResult = event2.reaction.animSeq.reduce((totalDuration, animationStep) => totalDuration + animationStep.duration, 0);
    if (reduceResult > 0) {
      if (mods.action.inAction && mods.skills.getTypeId(mods.action.stage.skill.id) === 27) {
        mods.log.debug("CC - SESR", "blocking SESR because in retaliate");
        return false;
      }
      const reaction2 = event2.reaction;
      lastReactionId = reaction2.id;
      timer = mod.setTimeout(() => {
        if (!mods.action.inAction) return mods.log.debug("CC - SESR", "not ending cc because we're not in an action");
        mods.log.debug("CC - SESR", "ending cc before server");
        mod.send(...mods.packet.get_all("S_ACTION_END"), Object.assign({
          type: 0
        }, reaction2, {
          gameId: mods.player.gameId,
          templateId: mods.player.templateId,
          loc: mods.position.loc
        }));
        lastEndId = reaction2.id;
      }, reduceResult - mods.ping.ping);
    }
    if (!mods.action.inAction) return;
    mod.send(...mods.packet.get_all("S_ACTION_END"), Object.assign({
      type: 0
    }, mods.action.stage, {
      loc: mods.position.loc
    }));
  });
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_ALL, event3 => {
    if (!mods.player.isMe(event3.gameId)) return;
    if (event3.skill.type !== 2) return;
    if (event3.animSeq?.[0]?.duration !== 88888888) return;
    if (event3.animSeq?.[0]?.distance !== -1) return;
    if (!mods.utils.isEnabled()) return;
    mod.clearTimeout(timer);
    const abnormalityId = mods.effects.getActiveAbnormalitiesSorted()[0],
      {
        duration: duration2
      } = mods.effects.getAbnormality(abnormalityId);
    lastReactionId = event3.id;
    const finishReaction = timerResult => {
      callback = null;
      mod.send(...mods.packet.get_all("S_ACTION_END"), Object.assign(event3, {
        loc: mods.position.loc
      }));
      lastEndId = event3.id;
      mods.log.debug("CC - 211", "ending stun/sleep before server:", timerResult);
    };
    callback = finishReaction;
    mod.clearTimeout(timer);
    timer = mod.setTimeout(callback, duration2, abnormalityId);
  });
  const handleAbnormalityReaction = event4 => {
    if (!mods.player.isMe(event4.target)) return;
    if (!mods.action.inAction) return;
    if (!mods.utils.isEnabled()) return;
    const abnormalityData = mods.datacenter.getAbnormalityData(event4.id);
    for (const abnormalityEffectEntry of abnormalityData?.AbnormalityEffect || []) {
      switch (abnormalityEffectEntry.type) {
        case 211:
          {
            mod.clearTimeout(timer);
            if (!callback) break;
            timer = mod.setTimeout(callback, Number(event4.duration), event4.id);
            break;
          }
        case 232:
          {
            mods.log.debug("CC - 232", "ending skill because of fear");
            mod.send(...mods.packet.get_all("S_ACTION_END"), Object.assign({
              type: 16
            }, mods.action.stage, {
              loc: mods.position.loc
            }));
            break;
          }
      }
    }
  };
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_BEGIN"), hooks.READ_DESTINATION_ALL, handleAbnormalityReaction);
  mod.hook(...mods.packet.get_all("S_ABNORMALITY_REFRESH"), hooks.READ_DESTINATION_ALL, handleAbnormalityReaction);
};
