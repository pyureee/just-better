const assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..'),{harness}=require('./lancer-harness.cjs');
const Command=require(root+'/libs/classes/command');
const priest=require('./priest-harness.cjs');
let passed=0;async function test(name,fn){await fn();console.log('PASS '+name);passed++;}
function router(h){let route;const messages=[];const command=new Command({command:{add:(name,fn)=>{route=fn;},message:msg=>messages.push(msg),remove:()=>{}}},h.mods);for(const [name,fn] of Object.entries(h.commands))command.add(name,fn);return {run:(...args)=>route(...args),messages};}
(async()=>{
 await test('nested commands are hidden and independent',()=>{const h=harness(2,true);const z=new(require(root+'/libs/user_plugins/zerk_auto_block'))(h.mod,h.mods);const r=router(h);
 assert(h.mods.settings.info.zerk_auto_block.enabled);assert(h.mods.settings.info.lancer_entry_precast.enabled);assert(h.mods.settings.info.lancer_silent_block.enabled);
 const auto=h.mods.settings.info.lancer_auto_block.enabled;
 r.run('lancer','sb');assert.equal(h.mods.settings.info.lancer_silent_block.enabled,false);assert.equal(h.mods.settings.info.lancer_auto_block.enabled,auto);assert(h.mods.settings.info.lancer_entry_precast.enabled);
 r.run('lancer','sb');r.run('lancer','entry');assert.equal(h.mods.settings.info.lancer_entry_precast.enabled,false);assert(h.mods.settings.info.lancer_silent_block.enabled);r.run('lancer','entry');
 r.run('zerk','ab');assert.equal(h.mods.settings.info.zerk_auto_block.enabled,false);r.run('zerk','ab');assert(h.mods.settings.info.zerk_auto_block.enabled);
 r.run('help');const listing=r.messages.at(-1);for(const key of ['zerk','lancer','priestentry'])assert(!listing.includes(key));z.destructor();h.dispose();});
 await test('Priest commands default on and remain independent',()=>{const h=priest.harness();const r=router(h);assert(h.mods.settings.info.priest_entry_precast.enabled);assert(h.mods.settings.info.priest_divine_charge);r.run('priest','entry');assert.equal(h.mods.settings.info.priest_entry_precast.enabled,false);assert(h.mods.settings.info.priest_divine_charge);r.run('dc');assert.equal(h.mods.settings.info.priest_divine_charge,false);r.run('priest','entry');assert(h.mods.settings.info.priest_entry_precast.enabled);assert.equal(h.mods.settings.info.priest_divine_charge,false);h.dispose();});
 await test('disabling Lancer entry cancels queued work',async()=>{const h=harness();h.cd(131100,1000);h.press(131100);h.commands['lancer entry']();await h.advance(1800);assert.equal(h.sent.filter(x=>x.name==='C_START_SKILL').length,0);h.dispose();});
 await test('emulation teardown is idempotent and removes listeners and commands',async()=>{const h=harness();h.press(100300);h.dispose();h.emulation.destructor();const count=h.sent.length;await h.advance(2000);assert.equal(h.sent.length,count);assert.equal(h.mods.action.listenerCount('reaction'),0);assert.equal(h.commands.tracker,undefined);assert.equal(h.commands['lancer sb'],undefined);assert.equal(h.commands['lancer entry'],undefined);assert.equal(h.mods.lancerSilentBlock,undefined);});
 await test('reload installs one set of emulation listeners',()=>{const h=harness();const count=h.mods.action.listenerCount('reaction');h.emulation.destructor();const next=new(require(root+'/libs/plugins/emulation'))(h.mod,h.mods);assert.equal(h.mods.action.listenerCount('reaction'),count);next.destructor();h.dispose();});
 await test('Zerk unload removes both toggle registrations',()=>{const h=harness();const z=new(require(root+'/libs/user_plugins/zerk_auto_block'))(h.mod,h.mods);z.destructor();assert.equal(h.commands['zerk ab'],undefined);assert.equal(h.commands.zerkblock,undefined);h.dispose();});

 for(const mode of ['on','off','unload'])await test('Zerk auto-block scheduled behavior '+mode,async()=>{const h=harness();h.mods.player.job=3;h.mods.skills.info.skillData=require(root+'/skills/female/elin/Berserker.json');const z=new(require(root+'/libs/user_plugins/zerk_auto_block'))(h.mod,h.mods);h.previous(41100);if(mode==='off')h.commands['zerk ab']();if(mode==='unload')z.destructor();await h.advance(1100);const packets=h.sent.filter(x=>x.name==='C_PRESS_SKILL');if(mode==='on'){assert(packets.some(x=>x.event.press===true));assert(packets.some(x=>x.event.press===false));}else assert.equal(packets.length,0);z.destructor();h.dispose();});
 console.log(passed+' cleanup/toggle tests passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
