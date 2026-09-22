const HOOKS = require("../enums/hooks"),
  classes = require("../enums/classes");
module.exports = function (mod, mods) {
  (!mods.settings.info.lancer_auto_block || !mods.settings.info.lancer_auto_block.skills) && (mods.settings.info.lancer_auto_block = {
    enabled: true,
    skills: {
      "18-1": {
        needsCooldown: [3, 13, 21]
      },
      "13": {
        needsCooldown: [21, 25]
      },
      "21": {
        needsCooldown: [13, 25]
      },
      "4": true,
      "12": true,
      "3": true,
      "25": {
        needsCooldown: [28]
      },
      "28": true,
      "10": {
        needsCooldown: [13, 21]
      },
      "7": true,
      "17": true,
      "30": true,
      "9": true,
      "23": true,
      "24": true,
      "27": true,
      "1": true,
      "8": {
        needsCooldown: [13]
      }
    }
  });
  let lancerHooks = [];
  const timers = new Set();
  const pendingBlockActions = new Set();
  const requests = new WeakMap();
  let tap = null, issuingTap = null;
  const sendTap = (record, press) => {
    issuingTap=record;
    try {mod.send(...mods.packet.get_all('C_PRESS_SKILL'), {...record.packet,press});}
    finally {issuingTap=null;}
  };
  const coordination = {
    captureBlockRequest(event) {
      if(issuingTap && Math.floor(event.skill.id/10000)===2) requests.set(event,issuingTap);
    },
    isStaleBlockRequest(event) {
      const record=requests.get(event);
      if(!record)return false;
      if(record.cancelled || mods.player.alive===false || mods.player.job!==classes.LANCER)return true;
      return event.press ? tap!==record || !mods.settings.info.lancer_auto_block.enabled :
        mods.action.stage?.id!==record.actionId || !mods.action.inAction;
    },
    isBlockPendingFor(actionId) {
      return pendingBlockActions.has(actionId);
    }
  };
  mods.lancerAutoBlock = coordination;
  const later = (callback, delay) => {
    let timer = null;
    timer = mod.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, Math.max(0, delay || 0));
    timers.add(timer);
    return timer;
  };
  const clearLancerHooks = () => {
    for (const hook of lancerHooks) mod.unhook(hook);
    lancerHooks = [];
  };
  const cancelBlocks = () => {
    for (const timer of timers) mod.clearTimeout(timer);
    timers.clear();
    pendingBlockActions.clear();
    if(tap && tap.actionId===undefined){tap.cancelled=true;tap=null;}
  };
  const scheduleAutoBlock = event => {
    if (!mods.player.isMe(event.gameId)) return;
    if(tap && event.stage===0) {
      const record=tap;
      if(Math.floor(event.skill.id/10000)===2 && record.actionId===undefined) {
        record.actionId=event.id;


        mod.setTimeout(()=>{
          if(!record.cancelled && mods.action.inAction && mods.action.stage?.id===record.actionId)
            sendTap(record,false);
          if(tap===record)tap=null;
        },1);
        return;
      }
      if(event.id!==record.sourceId && event.id!==record.actionId){record.cancelled=true;tap=null;}
    }
    if (pendingBlockActions.size && !pendingBlockActions.has(event.id)) cancelBlocks();
    if (event.stage) return;
    if (mods.player.job !== classes.LANCER || mods.player.alive === false) return;
    if (!mods.settings.info.lancer_auto_block.enabled) return;
    if (pendingBlockActions.has(event.id)) return;



    if (mods.lancerEntrySkill?.shouldSuppressAutoBlock?.(event)) return;
    if (!mods.utils.isEnabled(event.skill.id)) return;
    const skillInfo = mods.utils.getSkillInfo(event.skill.id),
      skills2 = mods.settings.info.lancer_auto_block.skills,
      skills2Entry = skills2[skillInfo.skill + "-" + skillInfo.sub] || skills2[skillInfo.skill];
    if (!skills2Entry) return;
    if (skills2Entry?.needsCooldown) {
      const everyResult = skills2Entry.needsCooldown.every(skillBase => {
        return mods.cooldown.isOnCooldownBase(skillBase);
      });
      if (!everyResult) return;
    }
    const skillData = mods.skills._getInfo(event.skill.id),
      {
        rearStartTime = -1
      } = skillData?.cancels || {};
    if (rearStartTime === -1) return;
    if (!Number.isFinite(mods.action.speed?.real) || mods.action.speed.real <= 0) return;
    const rearStartTimePerRealAdjusted = rearStartTime / mods.action.speed.real + 10,
      lastHitPerRealAdjusted = (skillData?.lastHit || 0) / mods.action.speed.real + 10;
    pendingBlockActions.add(event.id);
    later(() => {
      const sendWhenSafe = () => {
        const readyAt = mods.lancerDamageTickLock?.readyAtFor?.(event) || 0;
        if (readyAt > Date.now()) return later(sendWhenSafe, readyAt - Date.now());
        pendingBlockActions.delete(event.id);
        if (mods.player.job !== classes.LANCER || mods.player.alive === false) return;
        if (!mods.settings.info.lancer_auto_block.enabled) return;
        if (!mods.utils.isEnabled(event.skill.id) || !mods.action.inAction) return;
        if (event.id !== mods.action.stage?.id) return;
        const currentSkills = mods.settings.info.lancer_auto_block.skills;
        if (!(currentSkills[skillInfo.skill + "-" + skillInfo.sub] || currentSkills[skillInfo.skill])) return;
        const skillPacket = {
          skill: 20200,
          press: true,
          loc: mods.position.loc,
          w: mods.position.w
        };
        if(tap){tap.cancelled=true;tap=null;}
        const record={packet:skillPacket,sourceId:event.id,actionId:undefined,cancelled:false};
        tap=record;
        sendTap(record,true);
        mods.lancerEntrySkill?.onAutoBlock?.(event.id);
      };
      later(sendWhenSafe, mods.ping.jitter);
    }, Math.max(rearStartTimePerRealAdjusted, lastHitPerRealAdjusted));
  };

  for(const name of ['C_START_SKILL','C_PRESS_SKILL','C_START_TARGETED_SKILL',
    'C_START_COMBO_INSTANT_SKILL','C_START_INSTANCE_SKILL','C_START_INSTANCE_SKILL_EX','C_CANCEL_SKILL'])
    mod.hook(...mods.packet.get_all(name),{order:-25,filter:{fake:false}},event=>{
      const manualHold=name==='C_PRESS_SKILL' && event.press && Math.floor(event.skill.id/10000)===2;
      if(tap && (tap.actionId===undefined || manualHold)){tap.cancelled=true;tap=null;}
    });
  this.loaded = () => {
    cancelBlocks();
    clearLancerHooks();
    if (mods.player.job === classes.LANCER)
      lancerHooks.push(mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), HOOKS.READ_DESTINATION_FAKE, scheduleAutoBlock));
  };
  mod.hook("S_LOGIN", "event", HOOKS.READ_DESTINATION_ALL, this.loaded);
  this.loaded();
  for (const name of ["S_LOAD_TOPO", "S_RETURN_TO_LOBBY"])
    mod.hook(name, "raw", { filter: { fake: null } }, cancelBlocks);
  mod.hook(...mods.packet.get_all("S_ACTION_END"), HOOKS.READ_DESTINATION_ALL, event => {
    if (mods.player.isMe(event.gameId) && pendingBlockActions.has(event.id)) cancelBlocks();
  });
  mod.hook(...mods.packet.get_all("S_CREATURE_LIFE"), HOOKS.READ_DESTINATION_ALL, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) cancelBlocks();
  });
  mods.command.add("lancerblock", skillKey => {
    if (!skillKey) {
      mods.settings.info.lancer_auto_block.enabled = !mods.settings.info.lancer_auto_block.enabled;
      if (!mods.settings.info.lancer_auto_block.enabled) cancelBlocks();
      mods.command.message("Auto block has been turned " + (mods.settings.info.lancer_auto_block.enabled ? "on" : "off"));
      return;
    }
    if (mods.settings.info.lancer_auto_block.skills[skillKey] === undefined) {
      mods.command.message("Unknown skill: " + skillKey);
      return;
    }
    mods.settings.info.lancer_auto_block.skills[skillKey] = !mods.settings.info.lancer_auto_block.skills[skillKey];
    mods.command.message("Auto blocking for " + skillKey + " has been turned " + (mods.settings.info.lancer_auto_block.skills[skillKey] ? "on" : "off"));
  });
  this.destructor = () => {
    clearLancerHooks();
    cancelBlocks();
    if (mods.lancerAutoBlock === coordination) delete mods.lancerAutoBlock;
    mods.command.remove("lancerblock");
  };
};
