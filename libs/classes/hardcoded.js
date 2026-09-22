const GUNNER_BURST_VARIANTS = [1, 11, 21];
const BOOMERANG_RELEASE_VARIANTS = [50, 51];

const classes = require("../enums/classes");
class Hardcoded {
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
  }
  getAnimationLength = (skillId, stageIndex, actionSpeed) => {
    const skillInfo = this.mods.utils.getSkillInfo(skillId);
    switch (this.mods.player.job) {
      case classes.GUNNER:
        {
          switch (skillInfo.skill) {
            case 21:
              {
                return 1950;
              }
          }
          break;
        }
    }
  };
  getSkillDelayTime = (skillId2, {
    byGrant: byGrant2,
    press: press2
  }) => {
    const skillInfo2 = this.mods.utils.getSkillInfo(skillId2);
    switch (this.mods.player.job) {
      case classes.GUNNER:
        {
          if (skillInfo2.skill === 9) {
            const skillInfo3 = this.mods.utils.getSkillInfo(this.mods.action.stage.skill.id);
            if (skillInfo3.skill === 5 && GUNNER_BURST_VARIANTS.includes(skillInfo3.sub) && this.mods.player.stamina >= 230) return 30 + 90;
          }
          break;
        }
    }
    return 0;
  };
  isSupported = skillId3 => {
    const skillInfo4 = this.mods.utils.getSkillInfo(skillId3);
    switch (this.mods.player.job) {
      case classes.BRAWLER:
        {
          switch (skillInfo4.skill) {
            case 17:
              return false;
          }
          break;
        }
      case classes.REAPER:
        {
          switch (skillInfo4.skill) {
            case 15:
              return false;
          }
          break;
        }
    }
  };
  getRetryCount = skillId4 => {
    const skillInfo5 = this.mods.utils.getSkillInfo(skillId4);
    switch (this.mods.player.job) {
      case classes.LANCER:
        {
          if (skillInfo5.skill === 2) return 0;
          if (skillInfo5.skill === 29) return 0;
          break;
        }
      case classes.BERSERKER:
        {
          if (skillInfo5.skill === 36) return 0;
          break;
        }
      case classes.WARRIOR:
        {
          switch (skillInfo5.skill) {
            case 29:
            case 37:
              {
                if (this.mods.effects.getAbnormality(100201)) return 0;
                break;
              }
            case 40:
              return 20;
          }
          break;
        }
      case classes.NINJA:
        {
          if (skillInfo5.skill === 21 && BOOMERANG_RELEASE_VARIANTS.includes(skillInfo5.sub)) return 0;
          if (skillInfo5.skill === 9 && skillInfo5.sub === 31) return 0;
          break;
        }
      case classes.GUNNER:
        {
          if (skillInfo5.skill === 5 && GUNNER_BURST_VARIANTS.includes(skillInfo5.sub)) return 9;
          break;
        }
      case classes.REAPER:
        {
          if (skillInfo5.skill === 4 && skillInfo5.sub === 61) return 0;
          break;
        }
    }
    if (this.mods.skills.getType(skillId4) === "notimeline") return 0;
    return -1;
  };
  getRetryDelay = skillId5 => {
    const skillInfo6 = this.mods.utils.getSkillInfo(skillId5);
    switch (this.mods.player.job) {
      case classes.GUNNER:
        {
          if (skillInfo6.skill === 5 && GUNNER_BURST_VARIANTS.includes(skillInfo6.sub) && this.mods.player.stamina >= 230) return 5;
          break;
        }
    }
    return 20;
  };
  getAllowThroughFutureRetry = skillId6 => {
    const skillInfo7 = this.mods.utils.getSkillInfo(skillId6);
    switch (this.mods.player.job) {
      case classes.GUNNER:
        {
          if (skillInfo7.skill === 5 && GUNNER_BURST_VARIANTS.includes(skillInfo7.sub) && this.mods.player.stamina >= 230) return true;
          break;
        }
    }
    return false;
  };
  canCast = skillData => {
    return -1;
  };
}
module.exports = Hardcoded;
