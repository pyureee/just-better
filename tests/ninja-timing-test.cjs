'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {createRequire}=require('module'),EventEmitter=require('events');
const file=path.resolve(__dirname,'../libs/plugins/emulation.js');
const sandbox={module:{exports:{}},require:createRequire(file),__dirname:path.dirname(file)};
vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.testingFactory = createNinjaShima;',sandbox);
const hooks=[];const mod={hook:(name,version,options,fn)=>hooks.push({name,fn}),clearTimeout:()=>{}};
const mods={settings:{info:{}},player:{job:11,alive:true,isMe:id=>id===1n},utils:{isEnabled:()=>true},action:new EventEmitter(),packet:{get_all:name=>[name,1]},ping:{ping:0}};
const helper=sandbox.module.exports.testingFactory(mod,mods,{});
let checks=0;
for(const id of [190100,190130,220100,220120,220130,220150,220160])for(const real of [1,1.5,2.25,4])for(const stage of [0,1]){
 const duration=500/real;
 assert.equal(helper.animationLength(id,stage,duration,{real}),duration+(Math.floor(id/10000)===19&&stage===0?1/real:0));checks++;
}
const stageHook=hooks.find(h=>h.name==='S_ACTION_STAGE');stageHook.fn({gameId:1n,skill:{id:220130},stage:0,loc:{x:1,y:2,z:3}});
for(const name of ['S_START_USER_PROJECTILE','S_SPAWN_PROJECTILE'])for(const ping of [0,157,300]){
 mods.ping.ping=ping;const event={gameId:1n,skill:{id:220199},speed:2,projectileSpeed:3};hooks.find(h=>h.name===name).fn(event);
 assert.equal(event.speed,2*((1+ping/605)*1.25));assert.equal(event.projectileSpeed,3*((1+ping*3/605)*1.25));checks+=2;
}
helper.dispose();console.log('PASS '+checks+' Ninja timing/projectile checks: no animation reduction; projectile boost and ping compensation retained.');
