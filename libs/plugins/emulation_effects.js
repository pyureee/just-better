const INSTANT_START_PACKETS = ["C_START_COMBO_INSTANT_SKILL", "C_START_INSTANCE_SKILL"];
const TARGET_RELATIONS = [3, 5, 8];

const hooks = require("../enums/hooks"),
  classes = require("../enums/classes");
module.exports = function (mod, mods) {
  let dashSuppressionDeadline = 0,
    moveSuppressionDeadline = 0,
    decoyMove = null;
  const clearDecoyMove = () => {
    if (!decoyMove) return;
    mod.clearTimeout(decoyMove.timer);
    if (decoyMove.deadline === moveSuppressionDeadline) moveSuppressionDeadline = 0;
    decoyMove = null;
  };
  mods.command.add("dash", dash2 => {
    if (!dash2) return mods.command.message("Set the amount of delay your dashes have (default 25ms)");
    dash2 = +dash2;
    if (isNaN(dash2)) return mods.command.message("Dash delay needs to be a number");
    const dash3 = mods.settings.dash;
    mods.settings.dash = dash2;
    mods.command.message("Dash delay has been set to " + mods.settings.dash + "ms from " + dash3 + "ms");
  });
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_ALL, event => {
    if (!mods.player.isMe(event.gameId)) return;
    if (decoyMove && event.id !== decoyMove.id) clearDecoyMove();
    if (!mods.utils.isEnabled(event.skill.id)) return;
    if (INSTANT_START_PACKETS.includes(mods.last.startSkill._name) && event.stage === 0) {
      const startSkill2 = mods.last.startSkill;
      (startSkill2?.targets?.length || startSkill2?.endpoints?.length) && mod.setTimeout(() => {
        if (!mods.action.inAction) return;
        mod.send(...mods.packet.get_all("S_INSTANCE_ARROW"), {
          ...mods.last.startSkill,
          ...event,
          actionId: event.id
        });
      }, 3);
    }
    const skillType = mods.skills.getType(event.skill.id);
    switch (skillType) {
      case "dash":
        {
          if (event.stage !== 0) return;
          const packetResult = mods.last.packet("C_START_TARGETED_SKILL"),
            target2 = packetResult?.targets?.[0]?.gameId;
          mod.setTimeout(() => {
            if (mods.action.stage.id !== event.id) return;
            if (!mods.action.inAction) return;
            dashSuppressionDeadline = Date.now() + mods.utils.getPacketBuffer();
            mod.send(...mods.packet.get_all("S_INSTANT_DASH"), {
              gameId: event.gameId,
              target: target2,
              loc: packetResult.dest,
              w: packetResult.w
            });
          }, mods.settings.dash);
          break;
        }
      case "catchBack":
        {
          if (event.stage !== 0) return;
          if (mods.player.job === classes.REAPER) return;
          if (!mods.utils.canBackstabInArea()) return;
          const packetResult2 = mods.last.packet("C_START_TARGETED_SKILL"),
            gameId2 = packetResult2?.targets?.[0]?.gameId || 0x0n;
          if (!mods.utils.canBackstabEntity(gameId2)) return;
          const isDecoy = mods.player.job === classes.NINJA && Math.floor(event.skill.id / 10000) === 7;
          const attempt = isDecoy ? {id: event.id, skillId: event.skill.id, timer: null, sent: false} : null;
          if (attempt) { clearDecoyMove(); decoyMove = attempt; }
          const delayMs = {
            [classes.VALKYRIE]: 185
          }[mods.player.job] || 25;
          const moveTimer = mod.setTimeout(() => {
            if (attempt && decoyMove !== attempt) return;
            if (attempt) attempt.timer = null;
            const endedNaturally = attempt && mods.action.end?.id === event.id && mods.action.end.type === 0;
            if (mods.action.stage?.id !== event.id || (!mods.action.inAction && !endedNaturally) ||
                mods.action.inSpecialAction || mods.player.alive === false ||
                !mods.utils.isEnabled(event.skill.id) || !mods.utils.canCastSkill() ||
                !mods.utils.canBackstabEntity(gameId2)) {
              if (attempt) clearDecoyMove();
              return;
            }
            const locationForThisEntity = mods.entity.getLocationForThisEntity(gameId2),
              bossRadius = mods.utils.getBossRadius(gameId2);
            if (!locationForThisEntity || !Number.isFinite(locationForThisEntity.w)) {
              if (attempt) clearDecoyMove();
              return;
            }
            const loc2 = mods.utils.applyDistance(locationForThisEntity, locationForThisEntity.w + Math.PI, bossRadius);

            moveSuppressionDeadline = Date.now() + mods.utils.getPacketBuffer();
            if (attempt) Object.assign(attempt, {sent: true, loc: loc2.clone(),
              w: locationForThisEntity.w, deadline: moveSuppressionDeadline});
            mod.send(...mods.packet.get_all("S_INSTANT_MOVE"), {
              gameId: event.gameId,
              loc: loc2,
              w: locationForThisEntity.w
            });
          }, delayMs);
          if (attempt) attempt.timer = moveTimer;
          break;
        }
      case "shortTel":
        {
          if (event.stage !== 1 || !mods.settings.emulateJaunt) return;
          for (const playersKey in mods.entity.players) {
            const playersEntry = mods.entity.players[playersKey];
            if (!TARGET_RELATIONS.includes(playersEntry.relation)) continue;
            const dist2DResult3 = mods.player.loc.dist2D(playersEntry.pos);
            if (dist2DResult3 >= 55) {
              mods.log.debug("JAUNT", "Allowing jaunt through due to dist", dist2DResult3);
              continue;
            }
            if (dist2DResult3 <= 5) {
              mods.log.debug("JAUNT", "Not emulating jaunt due to dist", dist2DResult3);
              return;
            }
            const angleToResultPlusPIModuloPI = (mods.player.loc.angleTo(playersEntry.pos) + Math.PI) % Math.PI,
              wPlusPIModuloPI = (event.w + Math.PI) % Math.PI,
              absResult = Math.abs(angleToResultPlusPIModuloPI - wPlusPIModuloPI);
            if (absResult <= 2) {
              mods.log.debug("JAUNT", "Not emulating jaunt due to arc", absResult, angleToResultPlusPIModuloPI, wPlusPIModuloPI);
              return;
            }
          }
          const event2 = mods.last.packetForSkill(event.skill.id),
            dist2DResult = event2.loc.dist2D(event2.dest);
          event.dest = mods.utils.applyDistance(event.loc, event.w, 334);
          const dist2DResult2 = event.loc.dist2D(event.dest);
          dist2DResult < dist2DResult2 && (event.dest = event2.dest);
          event.dest.z = event2.dest.z;
          mod.setTimeout(() => {
            if (mods.action.stage.id !== event.id) return;
            if (!mods.action.inAction) return;
            moveSuppressionDeadline = Date.now() + mods.utils.getPacketBuffer();
            mod.send(...mods.packet.get_all("S_INSTANT_MOVE"), {
              gameId: event.gameId,
              loc: event.dest,
              w: event.w
            });
          }, 25);
          break;
        }
      case "positionswap":
        {
          if (event.stage !== 0) return;
          break;
        }
    }
  });
  mod.hook(...mods.packet.get_all("S_INSTANT_MOVE"), hooks.MODIFY_REAL, event3 => {
    if (!mods.player.isMe(event3.gameId)) return;
    if (decoyMove) {
      if (!decoyMove.sent || Date.now() > decoyMove.deadline) {

        clearDecoyMove();
        return;
      }
      const angle = Number.isFinite(event3.w) ?
        Math.atan2(Math.sin(event3.w - decoyMove.w), Math.cos(event3.w - decoyMove.w)) : Infinity;
      if (event3.loc.dist2D(decoyMove.loc) < 35 && Math.abs(angle) < 0.001) return false;

      clearDecoyMove();
      return;
    }
    if (Date.now() > moveSuppressionDeadline) return;
    return false;
  });
  mod.hook(...mods.packet.get_all("S_INSTANT_DASH"), hooks.MODIFY_REAL, event4 => {
    if (!mods.player.isMe(event4.gameId)) return;
    if (Date.now() > dashSuppressionDeadline) return;
    return false;
  });
  mod.hook(...mods.packet.get_all("S_INSTANCE_ARROW"), hooks.MODIFY_REAL, event5 => {
    if (!mods.player.isMe(event5.gameId)) return;
    if (!mods.utils.isEnabled(event5.skill.id)) return;
    return false;
  });
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, clearDecoyMove);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), hooks.READ_ALL, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) clearDecoyMove();
  });
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'), hooks.READ_REAL, event => {
    if (decoyMove && event.skill.id === decoyMove.skillId) clearDecoyMove();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'), hooks.READ_DESTINATION_FAKE, event => {
    if (decoyMove && mods.player.isMe(event.gameId) && event.id === decoyMove.id && event.type !== 0)
      clearDecoyMove();
  });
  this.destructor = clearDecoyMove;
};
