const DESYNC_EXEMPT_TYPES = [21, 22];

const hooks = require("../enums/hooks"),
  classes = require("../enums/classes");
module.exports = function (mod, mods) {
  let desyncTolerance = -1.5;
  mods.command.add("desync", toleranceInput => {
    toleranceInput = +toleranceInput;
    if (!Number.isFinite(toleranceInput)) return mods.command.message("Need to provide a valid value.");
    mods.command.message("Value set to " + toleranceInput);
    desyncTolerance = toleranceInput * -1;
  });
  const needsPositionCorrection = location => {
      if (!mods.utils.isEnabled(mods?.action?.serverStage?.skill?.id)) return;
      if (mods.skills.getTypeId(mods?.action?.stage?.skill?.id) === 42) return;
      if (!mods.action.serverInAction) return false;
      if (Date.now() - mods.action.serverStage._time > 2500) return false;
      if (!mods.action.serverStage.animSeq.length) return false;
      const dist2DResult = mods.action.stage.loc.dist2D(location),
        serverPosition = getServerPosition(),
        dist2DResult2 = mods.action.serverStage.loc.dist2D(serverPosition);
      if (dist2DResult > dist2DResult2) return true;
    },
    getServerPosition = () => {
      const event = mods.action.serverStage;
      let loc2 = event.loc;
      if (!event.animSeq.length) return loc2.clone();
      const wPlusDirectionModifier = event.w + mods.skills.getDirectionModifier(event.skill.id, event.stage);
      for (const animSeqEntry of event.animSeq) {
        loc2 = mods.utils.applyDistance(loc2, wPlusDirectionModifier, animSeqEntry.distance);
      }
      return loc2;
    },
    correctPosition = event2 => {
      if (!mods.utils.isEnabled(event2.skill.id)) return;
      if (!needsPositionCorrection(event2.loc)) return;
      event2.loc = getServerPosition();
      return true;
    };
  mod.hook(...mods.packet.get_all("C_START_SKILL"), hooks.MODIFY_INTERNAL_REAL, correctPosition);
  mod.hook(...mods.packet.get_all("C_START_TARGETED_SKILL"), hooks.MODIFY_INTERNAL_REAL, correctPosition);
  mod.hook(...mods.packet.get_all("C_START_COMBO_INSTANT_SKILL"), hooks.MODIFY_INTERNAL_REAL, correctPosition);
  mod.hook(...mods.packet.get_all("C_START_INSTANCE_SKILL"), hooks.MODIFY_INTERNAL_REAL, correctPosition);
  mod.hook(...mods.packet.get_all("C_START_INSTANCE_SKILL_EX"), hooks.MODIFY_INTERNAL_REAL, correctPosition);
  mod.hook(...mods.packet.get_all("C_PRESS_SKILL"), hooks.MODIFY_INTERNAL_REAL, correctPosition);
  mod.hook(...mods.packet.get_all("C_PLAYER_LOCATION"), hooks.MODIFY_REAL, event3 => {
    if (!mods.utils.isEnabled()) return;
    if (needsPositionCorrection(event3.loc)) return false;
  });
  mod.hook(...mods.packet.get_all("S_ACTION_END"), hooks.MODIFY_INTERNAL_FAKE, event4 => {
    if (!mods.utils.isEnabled(event4.skill.id) || !mods.player.isMe(event4.gameId)) return;
    if (!needsPositionCorrection(event4.loc)) return;
    if (DESYNC_EXEMPT_TYPES.includes(mods.skills.getTypeId(event4.skill.id))) return;
    mods.log.debug("AD", "sending S_INSTANT_MOVE");
    event4.loc = getServerPosition();
    mod.send(...mods.packet.get_all("S_INSTANT_MOVE"), event4);
    return true;
  });
  mod.hook(...mods.packet.get_all("C_NOTIFY_LOCATION_IN_ACTION"), hooks.MODIFY_REAL, event5 => {
    if (!mods.utils.isEnabled(event5.skill.id)) return;
    if (needsPositionCorrection(event5.loc)) return false;
    if (mods.player.job === classes.SLAYER && mods.utils.getSkillInfo(event5.skill.id).skill === 17) return;
    event5.loc = mods.utils.applyDistance(event5.loc, event5.w, desyncTolerance);
    return true;
  });
};
