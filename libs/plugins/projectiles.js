const PROJECTILE_VARIANTS = [1, 3, 30, 50];
const PROJECTILE_SKILL_BASES = [6, 43];

const hooks = require("../enums/hooks"),
  classes = require("../enums/classes");
module.exports = function (mod, mods) {
  mod.hook(...mods.packet.get_all("C_START_INSTANCE_SKILL"), hooks.MODIFY_INTERNAL_REAL, event2 => {
    if (mods.player.job !== classes.GUNNER) return;
    const skillInfo = mods.utils.getSkillInfo(event2.skill.id);
    if (skillInfo.skill !== 7 || skillInfo.sub !== 3) return;
    mod.send(...mods.packet.get_all("S_CANNOT_START_SKILL"), {
      skill: event2.skill
    });
    return false;
  });
  let faked2 = 0x0n;
  const pendingProjectiles = [];
  let activeProjectiles = [];
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_FAKE, event3 => {
    if (mods.player.job !== classes.GUNNER) return;
    if (!mods.player.isMe(event3.gameId)) return;
    if (!mods.utils.isEnabled()) return;
    const skill2 = mods.utils.getSkillInfo(event3.skill.id),
      skillMatches = skill2.skill === 43 && PROJECTILE_VARIANTS.includes(skill2.sub),
      skillMatches2 = skill2.skill === 6;
    if (!skillMatches && !skillMatches2) return;
    mod.send(...mods.packet.get_all("S_START_USER_PROJECTILE"), {
      gameId: mods.player.gameId,
      templateId: mods.player.templateId,
      id: ++faked2,
      skill: skillMatches ? 430120 : 61120,
      loc: event3.loc,
      dest: mods.last.startSkill.dest,
      speed: 800,
      distance: 475,
      projectileSpeed: 1
    });
    pendingProjectiles.push({
      faked: faked2,
      skill: skill2,
      real: null
    });
  });
  mod.hook(...mods.packet.get_all("C_HIT_USER_PROJECTILE"), hooks.MODIFY_REAL, event4 => {
    const match = pendingProjectiles.find(pendingProjectileItem => pendingProjectileItem.faked === event4.id);
    if (!match) return;
    if(event4.end)match.ended=true;
    if (match.real) {
      if(match.ended)pendingProjectiles.splice(pendingProjectiles.indexOf(match), 1);
      event4.id = match.real;
      return true;
    }
    activeProjectiles.push({
      event: event4,
      owner: match
    });
    return false;
  });
  mod.hook(...mods.packet.get_all("S_START_USER_PROJECTILE"), hooks.MODIFY_REAL, event5 => {
    if (mods.player.job !== classes.GUNNER) return;
    if (!mods.player.isMe(event5.gameId)) return;
    if (!mods.utils.isEnabled(event5.skill.id)) return;
    const skillInfo2 = mods.utils.getSkillInfo(event5.skill.id);
    if (!PROJECTILE_SKILL_BASES.includes(skillInfo2.skill)) return;
    const match2 = pendingProjectiles.find(item => !item.real && item.skill.skill === skillInfo2.skill);
    if (!match2) return;
    match2.real=event5.id;
    const matches = activeProjectiles.filter(item => item.owner===match2);
    if (matches.length) {
      activeProjectiles = activeProjectiles.filter(item => item.owner!==match2);
      for (const {
        event: event6
      } of matches) {
        mod.send(...mods.packet.get_all("C_HIT_USER_PROJECTILE"), {
          ...event6,
          id: event5.id
        });
      }
    }
    if(match2.ended)pendingProjectiles.splice(pendingProjectiles.indexOf(match2),1);
    return false;
  });
  const clear=()=>{pendingProjectiles.length=0;activeProjectiles=[];};
  for(const name of ['S_LOGIN','S_LOAD_TOPO','S_RETURN_TO_LOBBY'])
    mod.hook(name,'raw',{filter:{fake:null}},clear);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'),hooks.READ_REAL,event=>{
    if(mods.player.isMe(event.gameId)&&!event.alive)clear();
  });
};
