const REAPER_HOLD_SKILLS = [1, 3, 4, 9];
const BASE_AND_CHAIN_VARIANTS = [0, 30];

const classes = require("../enums/classes");
module.exports = function (mod, mods) {
  const applyClassOverrides = () => {
    switch (mods.player.job) {
      case classes.MYSTIC:
        {
          if (mod.isMenma) {
            const skillData2 = mods.skills._getInfo(480100);
            skillData2.fixedSpeed = false;
          }
          break;
        }
      case classes.WARRIOR:
        {
          const skillData3 = mods.skills._getInfo(200200),
            delay2 = skillData3.targeting[0];
          !skillData3.abnormalityConsume.stage && (skillData3.abnormalityConsume.stage = []);
          skillData3.abnormalityConsume.stage = skillData3.abnormalityConsume.stage.filter(stageItem => stageItem.id !== 103120);
          skillData3.abnormalityConsume.stage.push({
            id: 103120,
            delay: delay2,
            fixed: false
          });
          skillData3.abnormalityApply = skillData3.abnormalityApply.filter(abnormalityApplyItem => abnormalityApplyItem.id !== 103104);
          skillData3.abnormalityApply.push({
            id: 103104,
            delay: delay2,
            fixed: false
          });
          break;
        }
      case classes.SORCERER:
        {
          if (mod.isMenma) for (const skillId of [61000, 41212, 41211, 41210]) {
            const skillData4 = mods.skills._getInfo(skillId);
            skillData4.abnormalityRedirect = skillData4.abnormalityRedirect.slice(1);
          }
          for (const skillId2 of [360100, 360200, 360300, 360400]) {
            const skillData5 = mods.skills._getInfo(skillId2);
            if (!skillData5?.abnormalityConsume?.stage) continue;
            skillData5.abnormalityConsume.stage = skillData5.abnormalityConsume.stage.filter(stageItem2 => stageItem2.id !== 502050);
          }
          const affectedSkillIds = [502020, 502030, 502040, 502050];
          for (const skillDataKey in mods.skills.info.skillData) {
            const skillInfo = mods.utils.getSkillInfo(+skillDataKey);
            if (skillInfo.skill === 4) {
              const skillData6 = mods.skills._getInfo(skillInfo.id);
              skillData6.abnormalityConsume?.stage && (skillData6.abnormalityConsume.stage = skillData6.abnormalityConsume.stage.filter(stageItem3 => !affectedSkillIds.includes(stageItem3.id)));
            }
          }
          break;
        }
      case classes.REAPER:
        {
          for (const skillDataKey2 in mods.skills.info.skillData) {
            const skillInfo2 = mods.utils.getSkillInfo(+skillDataKey2);
            if (REAPER_HOLD_SKILLS.includes(skillInfo2.skill)) {
              const skillData7 = mods.skills._getInfo(skillInfo2.id);
              skillData7.holdIfNotMoving = true;
            }
          }
          break;
        }
      case classes.SLAYER:
        {
          for (const skillId3 of [270100, 270130, 270131, 270140, 270141, 270142]) {
            const skillData8 = mods.skills._getInfo(skillId3);
            if (!skillData8) continue;
            if (!skillData8?.abnormalityConsume) skillData8.abnormalityConsume = {};
            if (!skillData8?.abnormalityConsume?.end) skillData8.abnormalityConsume.end = [];
            skillData8.abnormalityConsume.end.push({
              id: 301604,
              delay: 990,
              fixed: true,
              noTimer: true
            });
          }
          {
            const skillData9 = mods.skills._getInfo(121101);
            skillData9.chains["27"].push(42);
          }
          break;
        }
      case classes.VALKYRIE:
        {
          for (const skillDataKey3 in mods.skills.info.skillData) {
            const skillInfo3 = mods.utils.getSkillInfo(+skillDataKey3);
            switch (skillInfo3.skill) {
              case 11:
                {
                  if (!BASE_AND_CHAIN_VARIANTS.includes(skillInfo3.sub)) break;
                  const skillData10 = mods.skills._getInfo(skillInfo3.id);
                  if (!skillData10.abnormalityApply) skillData10.abnormalityApply = [];
                  skillData10.abnormalityApply.push({
                    id: 10155052,
                    delay: 430,
                    fixed: false,
                    duration: 5000
                  });
                  break;
                }
              case 10:
              case 12:
                {
                  const skillData11 = mods.skills._getInfo(skillInfo3.id);
                  if (!skillData11.chains) break;
                  if (skillData11.chains[skillInfo3.skill]) delete skillData11.chains[skillInfo3.skill];
                  break;
                }
            }
          }
          break;
        }
      case classes.LANCER:
        {
          for (const skillDataKey4 in mods.skills.info.skillData) {
            const skillInfo4 = mods.utils.getSkillInfo(+skillDataKey4);
            switch (skillInfo4.skill) {
              case 2:
                {
                  const skillData12 = mods.skills._getInfo(skillInfo4.id);
                  skillData12.chains?.["10"] && delete skillData12.chains["10"];
                  break;
                }
              case 13:
                {
                  const skillData13 = mods.skills._getInfo(skillInfo4.id);
                  skillData13.chains["28"] && delete skillData13.chains["28"];
                  break;
                }
            }
          }
          break;
        }
      case classes.ARCHER:
        {
          for (const skillDataKey5 in mods.skills.info.skillData) {
            const skillInfo5 = mods.utils.getSkillInfo(+skillDataKey5);
            switch (skillInfo5.skill) {
              case 9:
              case 10:
              case 11:
              case 15:
              case 23:
              case 25:
                {
                  const skillData14 = mods.skills._getInfo(skillInfo5.id);
                  if (!skillData14.abnormalityConsume) skillData14.abnormalityConsume = {};
                  if (!skillData14.abnormalityConsume.end) skillData14.abnormalityConsume.end = [];
                  for (let id2 = 88614201; id2 <= 88614215; id2++) {
                    skillData14.abnormalityConsume.end.push({
                      id: id2,
                      delay: 0,
                      fixed: true
                    });
                  }
                  break;
                }
            }
          }
          break;
        }
      case classes.BERSERKER:
        {
          for (const skillDataKey6 in mods.skills.info.skillData) {
            const skillInfo6 = mods.utils.getSkillInfo(+skillDataKey6);
            switch (skillInfo6.skill) {
              case 24:
                {
                  if (skillInfo6.sub === 0) {
                    const skillData15 = mods.skills._getInfo(skillInfo6.id);
                    skillData15.chains["15"] && delete skillData15.chains["15"];
                  }
                  break;
                }
            }
          }
          break;
        }
      case classes.PRIEST:
        {
          for (const skillDataKey7 in mods.skills.info.skillData) {
            const skillInfo7 = mods.utils.getSkillInfo(+skillDataKey7);
            switch (skillInfo7.skill) {
              case 28:
                {
                  const skillData16 = mods.skills._getInfo(skillInfo7.id);
                  mod.isMenma && skillData16?.appliedEffects?.passivity?.[28039]?.effectScale && (skillData16.appliedEffects.passivity[28039].effectScale = 2);
                  break;
                }
            }
          }
          break;
        }
      case classes.NINJA:
        {
          for (const skillDataKey8 in mods.skills.info.skillData) {
            const skillInfo8 = mods.utils.getSkillInfo(+skillDataKey8);
            switch (skillInfo8.skill) {
              case 8:
                {
                  const skillData17 = mods.skills._getInfo(skillInfo8.id);
                  !skillData17.chains["1"] && (skillData17.chains["1"] = []);
                  !skillData17.chains["1"].includes(30) && skillData17.chains["1"].push(30);
                  !skillData17.chains["1"].includes(70) && skillData17.chains["1"].push(70);
                  break;
                }
              case 12:
                {
                  const skillData18 = mods.skills._getInfo(skillInfo8.id);
                  !skillData18.chains["8"] && (skillData18.chains["8"] = []);
                  !skillData18.chains["8"].includes(30) && skillData18.chains["8"].push(30);
                  !skillData18.chains["8"].includes(52) && skillData18.chains["8"].push(52);
                  !skillData18.chains["9"] && (skillData18.chains["9"] = []);
                  !skillData18.chains["9"].includes(31) && skillData18.chains["9"].push(31);
                  break;
                }
              case 13:
                {
                  const skillData19 = mods.skills._getInfo(skillInfo8.id);
                  !skillData19.chains["9"] && (skillData19.chains["9"] = []);
                  !skillData19.chains["9"].includes(31) && skillData19.chains["9"].push(31);
                  break;
                }
              case 22:
                {
                  const skillData20 = mods.skills._getInfo(skillInfo8.id);
                  skillData20.chains["22"] && delete skillData20.chains["22"];
                  break;
                }
            }
          }
          break;
        }
    }
  };
  mods.skills.on("loaded", applyClassOverrides);
  this.loaded = applyClassOverrides;
  this.destructor = () => {
    mods.skills.off("loaded", applyClassOverrides);
  };
};
