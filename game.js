/* PROJECT-VOID — all state is held in memory for this page session. */
'use strict';
const {
  clamp,LEVELS,Player,Level,TimeSystem
}
=VoidCore;
const $=id=>document.getElementById(id);
const pad=(n,w=2)=>String(n).padStart(w,'0');
const ERROR_MESSAGES=['NAVIGATION FAILURE','PRIMARY ROUTE LOST','ENGINE RESPONSE FAILURE','THRUST VECTOR INVALID','ALL ENGINES OFFLINE','ORIENTATION DATA CORRUPTED','STAR MAP UNAVAILABLE','TIME REFERENCE LOST','INTERNAL CLOCK FAILURE','EXTERNAL CLOCK FAILURE','COMMUNICATION ARRAY OFFLINE','SIGNAL NOT FOUND','SIGNAL FOUND','SIGNAL LOST','CRYOGENIC SYSTEM FAILURE','MEMORY INDEX CORRUPTED','MEMORY INDEX RESTORED','MEMORY INDEX CORRUPTED','ARTIFICIAL GRAVITY OFFLINE','ARTIFICIAL GRAVITY RESTORED','STRUCTURAL INTEGRITY UNKNOWN','HULL STATUS UNKNOWN','CREW MANIFEST MISSING','CREW MANIFEST FOUND','CREW MANIFEST EMPTY','BIOMETRIC DATA INVALID','SUBJECT IDENTIFICATION FAILED'];
class AudioSystem {
  constructor(){
    this.enabled=true;
    this.ctx=null;
    this.drone=null;
  }
  start(){
    if(!this.ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      try{
        this.ctx=new AC();
        this.master=this.ctx.createGain();
        this.master.gain.value=this.enabled?.12:0;
        this.master.connect(this.ctx.destination);
        this.drone=this.ctx.createOscillator();
        const gain=this.ctx.createGain();
        gain.gain.value=.055;
        this.drone.type='sine';
        this.drone.frequency.value=48;
        this.drone.connect(gain).connect(this.master);
        this.drone.start();
      }
      catch{
        return;
      }
    }
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{
    });
  }
  toggle(value){
    this.enabled=value;
    if(this.ctx)this.master.gain.setTargetAtTime(value?.12:0,this.ctx.currentTime,.08);
  }
  tone(type='click'){
    if(!this.ctx||!this.enabled)return;
    const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
    const config={
      click:[740,.045,.16],time:[100,.18,.25],static:[41,.14,.25],death:[90,.22,.18],transition:[45,1.1,.3],jump:[240,.06,.045]
    }
    [type];
    o.type=type==='static'?'sawtooth':'sine';
    o.frequency.setValueAtTime(config[0],t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,config[0]*.4),t+config[1]);
    g.gain.setValueAtTime(.001,t);
    g.gain.linearRampToValueAtTime(config[2],t+.012);
    g.gain.exponentialRampToValueAtTime(.001,t+config[1]);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t+config[1]+.03);
  }
  depth(index){
    if(this.drone)this.drone.frequency.setTargetAtTime(index>=3?32:48,this.ctx.currentTime,2);
  }
}
class Particles {
  constructor(){
    this.items=[];
  }
  emit(x,y,n=18){
    for(let i=0;
    i<n;
    i++){
      const angle=Math.random()*Math.PI*2,speed=12+Math.random()*60;
      this.items.push({
        x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.3+Math.random()*.6,max:1
      });
    }
  }
  update(dt){
    this.items=this.items.filter(p=>{
      p.life-=dt;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      return p.life>0;
    });
  }
  draw(ctx){
    ctx.fillStyle='#a4ccd9';
    for(const p of this.items){
      ctx.globalAlpha=p.life;
      ctx.fillRect(p.x,p.y,2,2);
    }
    ctx.globalAlpha=1;
  }
}
class Dialogue {
  constructor(){
    this.queue=[];
    this.current=null;
    this.seen=new Set();
  }
  say(text,duration=3.5,key=text){
    if(this.seen.has(key))return;
    this.seen.add(key);
    this.queue.push({
      text,duration
    });
  }
  update(dt){
    if(this.current){
      this.current.duration-=dt;
      if(this.current.duration<=0)this.current=null;
    }
    if(!this.current&&this.queue.length)this.current=this.queue.shift();
    $('dialogue').textContent=this.current?.text||'';
  }
  clear(){
    this.queue=[];
    this.current=null;
    $('dialogue').textContent='';
  }
}
class TModule {
  constructor(game){
    this.game=game;
    this.active=false;
    this.target=null;
    this.cooldown=0;
    this.lastSignature='';
  }
  reset(){
    this.active=false;
    this.target=null;
    this.lastSignature='';
    $('module').hidden=true;
  }
  toggle(){
    const g=this.game;
    if(g.mode!=='play')return;
    if(this.active){
      this.active=false;
      this.target=null;
    }
    else{
      this.target=g.level.nearest(g.player);
      this.active=!!this.target;
      if(this.active)g.audio.tone('time');
    }
    this.sync();
  }
  change(value){
    const g=this.game;
    if(!this.active||!this.target)return;
    const before=this.target.timeState;
    if(!TimeSystem.set(g.level,this.target,value,g.player)){
      g.dialogue.say('INSUFFICIENT SPACE.\nLEAVE THE PASSAGE FIRST.',2,'space-'+Math.floor(g.level.elapsed/3));
      this.sync();
      return;
    }
    if(before!==value){
      g.audio.tone('time');
      g.particles.emit(this.target.id==='self'?g.player.x:this.target.x,this.target.y-35);
    }
    if(g.level.index===1&&value>=120){
      g.dialogue.clear();
      g.dialogue.say('STRUCTURAL FAILURE.',1);
      g.level.flags.agedBridge=true;
      g.die('bridge');
    }
    if(g.level.index===2&&this.target.id==='room'){
      if(value<=-32)g.dialogue.say('WHO WERE THEY?',3);
      if(value<=-80){
        g.dialogue.say('I KNOW THAT ROOM.',3);
        g.dialogue.say('I HAVE NEVER BEEN THERE.',3);
        g.checkpoint=1050;
      }
    }
    if(g.level.index===3&&this.target.id==='self'&&value===30&&g.player.x>745){
      g.dialogue.say('PLAYER AGE: 30',2.5);
      g.dialogue.say('I AM NOT THIRTY.',3);
      g.dialogue.say('HOW DO I KNOW?',3);
    }
    if(g.level.index===4&&value!==15)g.dialogue.say('NO ARRIVAL AT THIS COORDINATE.',2,'final-'+value);
    this.sync();
  }
  step(direction){
    if(!this.active)return;
    const o=this.target;
    let idx=o.states.findIndex(v=>v>=o.timeState);
    if(idx<0)idx=o.states.length-1;
    this.change(o.states[clamp(idx+direction,0,o.states.length-1)]);
  }
  update(dt){
    const g=this.game;
    this.cooldown-=dt;
    if(this.active&&g.mode==='play'){
      const direction=Number(g.keys.has('ArrowRight'))-Number(g.keys.has('ArrowLeft'));
      if(direction&&this.cooldown<=0){
        if(this.target.id==='bridge'){
          this.change(clamp(this.target.timeState+direction*10,0,120));
          this.cooldown=.13;
        }
        else{
          this.step(direction);
          this.cooldown=.22;
        }
      }
    }
    if(!this.active)this.target=g.level.nearest(g.player);
    this.sync();
  }
  sync(){
    const g=this.game,o=this.target;
    const signature=[g.mode,o?.id,o?Math.round(o.timeState):'',this.active].join('/');
    if(signature===this.lastSignature)return;
    this.lastSignature=signature;
    $('module').hidden=g.mode!=='play'||!o;
    if(!o)return;
    $('module').classList.toggle('active',this.active);
    $('module-state').textContent=this.active?'TEMPORAL LINK':'OBJECT DETECTED';
    $('target-name').textContent=o.name;
    $('age-label').textContent=g.level.index===4?'STATE':'AGE';
    const value=g.level.index===4?({
      7:'CHILD',15:'PRESENT',30:'ADULT',60:'OLD'
    }
    [o.timeState]):`${o.timeState<0?'−':''}${pad(Math.abs(Math.round(o.timeState)),3)} YEARS`;
    $('target-age').textContent=value;
    $('time-controls').hidden=!this.active;
    $('module-help').hidden=!this.active;
    $('module-toggle').textContent=this.active?'[E] RELEASE':'[E] MANIPULATE';
    $('timeline').max=o.states.length-1;
    $('timeline').value=Math.max(0,o.states.findIndex(v=>v>=o.timeState));
    $('time-states').replaceChildren(...o.states.map(value=>{
      const s=document.createElement('span');
      s.textContent=g.level.index===4?({
        7:'CHILD',15:'PRESENT',30:'ADULT',60:'OLD'
      }
      [value]):value;
      return s;
    }));
  }
}
class UI {
  constructor(game){
    this.game=game;
    this.returnMode='menu';
    this.panel='';
    document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>{
      game.audio.start();
      game.audio.tone();
      if(el.dataset.action==='play')game.intro();
      else this.openPanel(el.dataset.action);
    }));
    $('panel-back').onclick=()=>this.back();
    $('pause').onclick=()=>this.pause();
    $('module-toggle').onclick=()=>game.module.toggle();
    $('timeline').oninput=e=>{
      const o=game.module.target;
      if(o)game.module.change(o.states[Number(e.target.value)]);
    };
    $('skip-intro').onclick=()=>game.skipIntro();
  }
  show(mode){
    for(const id of ['menu','panel','terminal','hud','module','touch-controls','failure'])$(id).hidden=true;
    $('app').classList.remove('blackout');
    if(mode==='boot')$('app').classList.add('blackout');
    if(mode==='menu')$('menu').hidden=false;
    if(mode==='panel')$('panel').hidden=false;
    if(mode==='sequence')$('terminal').hidden=false;
    if(mode==='play'||mode==='dead'){
      $('hud').hidden=false;
      $('touch-controls').hidden=!matchMedia('(pointer:coarse)').matches;
      $('failure').hidden=mode!=='dead';
    }
  }
  button(text,fn){
    const b=document.createElement('button');
    b.textContent=text;
    b.onclick=()=>{
      this.game.audio.start();
      this.game.audio.tone();
      fn();
    };
    return b;
  }
  openPanel(name,keepReturn=false){
    const g=this.game;
    if(!keepReturn)this.returnMode=g.mode;
    this.panel=name;
    g.keys.clear();
    g.mode='panel';
    this.show('panel');
    $('dialogue').textContent='';
    $('panel-title').textContent=name.toUpperCase();
    const body=$('panel-body');
    body.replaceChildren();
    if(name==='settings')for(const [key,label] of [['sound','SOUND'],['crt','CRT EFFECT'],['shake','SCREEN SHAKE']])body.append(this.button(`${label}: ${g.settings[key]?'ON':'OFF'}`,()=>{
      g.settings[key]=!g.settings[key];
      g.audio.toggle(g.settings.sound);
      $('crt').hidden=!g.settings.crt;
      this.openPanel('settings',true);
    }));
    if(name==='credits'){
      for(const [role,name] of [['PROJECT-VOID',''],['DESIGN','UNKNOWN'],['PROGRAMMING','UNKNOWN'],['SUBJECT','UNKNOWN']]){
        const div=document.createElement('div');
        div.className='credit';
        const label=document.createElement('small');
        label.textContent=role;
        div.append(label,document.createTextNode(name));
        body.append(div);
      }
    }
    if(name==='archive'){
      for(let i=0;
      i<5;
      i++){
        const entry=g.archive.find(e=>e.level===i);
        const row=document.createElement('div');
        row.className='archive-row';
        row.textContent=`SESSION ${pad(i+1,4)}`;
        const state=document.createElement('span');
        state.textContent=entry?`${LEVELS[i].name} / ${entry.complete?'RESTORED':'ACTIVE'}`:'[ UNAVAILABLE ]';
        row.append(state);
        body.append(row);
      }
      const p=document.createElement('p');
      p.textContent='VOLATILE MEMORY. LOST ON RELOAD.';
      p.style.color='#92999d';
      p.style.fontSize='9px';
      body.append(p);
    }
    if(name==='paused'){
      body.append(this.button('RESUME',()=>this.resume()),this.button('RESTART LEVEL',()=>{
        g.restart();
      }),this.button('SETTINGS',()=>this.openPanel('settings',true)),this.button('ARCHIVE',()=>this.openPanel('archive',true)),this.button('MAIN MENU',()=>{
        g.mode='menu';
        g.dialogue.clear();
        this.show('menu');
      }));
    }
    requestAnimationFrame(()=>body.querySelector('button')?.focus());
  }
  back(){
    this.game.audio.tone();
    if(this.returnMode==='play'||this.returnMode==='dead'){
      if(this.panel!=='paused')this.openPanel('paused',true);
      else this.resume();
    }
    else{
      this.game.mode='menu';
      this.show('menu');
      document.querySelector('[data-action="play"]').focus();
    }
  }
  pause(){
    if(this.game.mode==='play'){
      this.returnMode='play';
      this.openPanel('paused');
    }
    else if(this.game.mode==='panel')this.back();
  }
  resume(){
    this.game.mode='play';
    this.show('play');
    this.game.module.lastSignature='';
    $('world').focus();
  }
}
class Game {
  constructor(){
    this.canvas=$('world');
    this.ctx=this.canvas.getContext('2d');
    this.mode='boot';
    this.settings={
      sound:true,crt:!matchMedia('(prefers-reduced-motion:reduce)').matches,shake:!matchMedia('(prefers-reduced-motion:reduce)').matches
    };
    this.audio=new AudioSystem();
    this.particles=new Particles();
    this.dialogue=new Dialogue();
    this.module=new TModule(this);
    this.ui=new UI(this);
    this.keys=new Set();
    this.archive=[];
    this.deaths=0;
    this.levelDeaths=0;
    this.clock=0;
    this.bootTime=0;
    this.camera=0;
    this.zoom=1;
    this.shake=0;
    this.checkpoint=0;
    this.sequence=null;
    this.skipHeld=0;
    this.focused=true;
    this.resize();
    this.bind();
    this.ui.show('boot');
    $('crt').hidden=!this.settings.crt;
    this.last=performance.now();
    this.accumulator=0;
    requestAnimationFrame(t=>this.frame(t));
  }
  resize(){
    const dpr=Math.min(devicePixelRatio||1,2);
    this.w=innerWidth;
    this.h=innerHeight;
    this.canvas.width=this.w*dpr;
    this.canvas.height=this.h*dpr;
    this.dpr=dpr;
    this.scale=Math.min(this.w/(this.w<600?660:1100),this.h/760);
    this.viewWidth=this.w/this.scale;
    this.offsetY=this.h*(this.w<600?.48:.55)-500*this.scale;
  }
  bind(){
    window.addEventListener('resize',()=>this.resize());
    window.addEventListener('keydown',e=>{
      const code=e.code;
      const playing=this.mode==='play';
      const nativeSlider=e.target.tagName==='INPUT'&&['ArrowLeft','ArrowRight','Home','End'].includes(code);
      if(nativeSlider)return;
      if((playing||this.mode==='sequence')&&['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(code))e.preventDefault();
      if(e.repeat)return;
      this.keys.add(code);
      if(code==='Escape'){
        this.keys.clear();
        this.ui.pause();
        return;
      }
      if(this.mode==='play'){
        this.audio.start();
        if(code==='KeyE')this.module.toggle();
        if(code==='Space'||code==='KeyW'||code==='ArrowUp'){
          this.player.jump();
          this.audio.tone('jump');
        }
      }
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{
      this.keys.clear();
      document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
      if(this.mode==='play')this.ui.pause();
    });
    document.addEventListener('visibilitychange',()=>{
      this.focused=!document.hidden;
      this.keys.clear();
      if(this.audio.ctx){
        if(document.hidden)this.audio.ctx.suspend().catch(()=>{
        });
        else if(this.mode!=='ended')this.audio.ctx.resume().catch(()=>{
        });
      }
    });
    for(const button of document.querySelectorAll('[data-key]')){
      const mapping={
        left:'KeyA',right:'KeyD'
      };
      const release=()=>{
        this.keys.delete(mapping[button.dataset.key]);
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerdown',e=>{
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        this.audio.start();
        if(this.mode!=='play')return;
        button.classList.add('pressed');
        const key=button.dataset.key;
        if(mapping[key])this.keys.add(mapping[key]);
        else if(key==='jump'){
          this.player.jump();
          this.audio.tone('jump');
        }
        else this.module.toggle();
      });
      button.addEventListener('pointerup',release);
      button.addEventListener('pointercancel',release);
      button.addEventListener('lostpointercapture',release);
    }
  }
  boot(dt){
    this.bootTime+=dt;
    if(this.bootTime<3.5)return;
    this.ui.show('menu');
    const title='PROJECT-VOID';
    const count=Math.floor((this.bootTime-3.5)/.16);
    $('boot-title').textContent=title.slice(0,count);
    if(count>=title.length)document.body.classList.add('ready');
    if(this.bootTime>7){
      $('menu-nav').hidden=false;
      this.mode='menu';
    }
  }
  runSequence(frames,done,intro=false){
    this.mode='sequence';
    this.module.reset();
    this.dialogue.clear();
    this.ui.show('sequence');
    this.sequence={
      frames,index:0,left:frames[0].duration,done,intro
    };
    this.skipHeld=0;
    $('skip-intro').hidden=!intro;
    this.paintSequence();
  }
  paintSequence(){
    const f=this.sequence.frames[this.sequence.index];
    $('terminal-text').textContent=f.text||'';
    $('terminal-text').className=f.errors?'errors':f.center?'center':'';
    $('app').classList.toggle('blackout',!f.text);
  }
  updateSequence(dt){
    const seq=this.sequence;
    if(seq.intro&&this.keys.has('Space')){
      this.skipHeld+=dt;
      if(this.skipHeld>1){
        this.skipIntro();
        return;
      }
    }
    else this.skipHeld=0;
    seq.left-=dt;
    if(seq.frames[seq.index].cursor)$('terminal-text').textContent=Math.floor(this.clock*2)%2?'_':'';
    if(seq.left<=0){
      seq.index++;
      if(seq.index>=seq.frames.length){
        this.sequence=null;
        seq.done();
        return;
      }
      seq.left=seq.frames[seq.index].duration;
      this.paintSequence();
    }
  }
  intro(){
    this.audio.start();
    this.deaths=0;
    this.archive=[];
    this.dialogue.seen.clear();
    const f=[{
      text:'',duration:3.5
    },{
      text:'PROJECT-V O I D\n\nVESSEL: UNKNOWN\nSTATUS: ACTIVE',duration:3
    },{
      text:'ESTIMATED TIME UNTIL ARRIVAL:\n\n147 YEARS',duration:3.5
    },{
      text:'DESTINATION:\n\n[DATA CORRUPTED]',duration:2.5
    },{
      text:'WAKE-UP SEQUENCE\n\n…',duration:2.5
    },{
      text:'WHY DID YOU WAKE UP?',duration:3
    },{
      text:'_',duration:5,cursor:true
    },{
      text:'ERROR\nERROR\nERROR',duration:.8
    }];
    for(let i=0;
    i<81;
    i++)f.push({
      text:Array.from({
        length:Math.min(i+1,23)
      },(_,j)=>'ERROR — '+ERROR_MESSAGES[(i-Math.min(i,22)+j)%ERROR_MESSAGES.length]).join('\n'),duration:.046,errors:true
    });
    f.push({
      text:'TIME SYSTEM:\nCRITICAL\n\nCURRENT DATE: UNKNOWN\nCURRENT YEAR: UNKNOWN\nCURRENT MOMENT: UNKNOWN',duration:4
    },{
      text:'THERE IS NO CURRENT MOMENT.',duration:4
    },{
      text:'',duration:1.5
    });
    this.runSequence(f,()=>this.enterLevel(0),true);
  }
  skipIntro(){
    if(this.sequence?.intro){
      this.keys.clear();
      this.enterLevel(0);
    }
  }
  enterLevel(index){
    this.audio.tone('transition');
    this.levelDeaths=0;
    this.checkpoint=0;
    this.runSequence([{
      text:'',duration:.5
    },{
      text:`LEVEL ${pad(index+1)}\n\n${LEVELS[index].name}`,duration:2,center:true
    }],()=>this.loadLevel(index));
  }
  loadLevel(index,checkpoint=0){
    this.level=new Level(index);
    this.player=new Player(...this.level.spawn);
    if(index===4)this.player.setAge(30,[]);
    if(checkpoint){
      this.player.x=checkpoint;
      if(index===2){
        this.level.flags.memorySeen=true;
        this.level.objects[0].timeState=-80;
      }
    }
    this.camera=clamp(this.player.x-this.viewWidth*.3,0,Math.max(0,this.level.width-this.viewWidth));
    this.module.reset();
    this.particles.items=[];
    this.mode='play';
    this.ui.show('play');
    $('level-number').textContent=`LEVEL ${pad(index+1)} / 05`;
    $('level-name').textContent=this.level.name;
    $('attempt').textContent=`SESSION ${pad(this.deaths+1,4)}`;
    this.audio.depth(index);
    if(!this.archive.some(e=>e.level===index))this.archive.push({
      level:index,complete:false
    });
    if(index===0)this.dialogue.say('WHY DID I WAKE UP?',3);
    if(index===1&&this.levelDeaths>0&&this.deathReason==='bridge')this.dialogue.say('I MADE IT OLDER.\nWHY?',3,'bridge-retry-'+this.levelDeaths);
    if(index===3){
      this.dialogue.say('TARGET: PLAYER\nAGE: UNKNOWN',3);
      this.dialogue.say('WHY CAN’T I CHANGE MYSELF?',3);
    }
    if(index===4)this.dialogue.say('TIME IS NOT A LINE.',4);
  }
  restart(){
    const i=this.level.index;
    this.dialogue.clear();
    this.loadLevel(i,this.checkpoint);
  }
  die(reason='fall'){
    if(this.mode!=='play')return;
    this.deaths++;
    this.levelDeaths++;
    this.deathReason=reason;
    this.mode='dead';
    this.deathTimer=.4;
    this.shake=.2;
    this.audio.tone('death');
    this.module.reset();
    this.ui.show('dead');
    this.dialogue.clear();
    const line=this.levelDeaths>=7?'YOU HAVE DONE THIS BEFORE.':this.levelDeaths>=4?'I REMEMBER THIS.':this.deaths>=2?'YOU KEEP DOING THAT.':'TEMPORAL FAILURE.';
    this.dialogue.say(line,3,'death-'+this.deaths);
  }
  complete(){
    const l=this.level;
    this.archive.find(e=>e.level===l.index).complete=true;
    this.audio.tone('transition');
    if(l.index===4){
      this.ending();
      return;
    }
    const words=[['I REMEMBER A TREE.','WHO SAID THAT?'],['HOW OLD IS A THING\nTHAT CAN BE REBUILT?','HOW OLD AM I?'],['MEMORY IS NOT PROOF.'],['SUBJECT:\nUNKNOWN']][l.index];
    this.runSequence([{
      text:'LEVEL COMPLETE',duration:1.5,center:true
    },{
      text:'',duration:.7
    },...words.map(text=>({
      text,duration:3.3,center:true
    }))],()=>this.enterLevel(l.index+1));
  }
  ending(){
    const words=['I THOUGHT I WAS TRAVELLING\nTHROUGH SPACE.','I WAS WRONG.','SPACE WAS TRAVELLING\nTHROUGH ME.','PROJECT-VOID','ARRIVAL:\n\nNOW','WELCOME BACK.'];
    this.runSequence([...words.flatMap(text=>[{
      text:'',duration:1
    },{
      text,duration:4,center:true
    }]),{
      text:'',duration:5
    },{
      text:'SESSION COMPLETE',duration:2,center:true
    },{
      text:'SESSION COMPLETE\n\nYOU MAY CLOSE THIS WINDOW.',duration:2,center:true
    }],()=>{
      this.mode='ended';
      if(this.audio.ctx)this.audio.ctx.suspend().catch(()=>{
      });
    });
  }
  triggers(dt){
    const l=this.level,p=this.player;
    l.elapsed+=dt;
    if(l.index===0){
      if(p.x>1280&&!l.flags.doorLost){
        l.flags.doorLost=true;
        this.audio.tone('static');
        this.shake=.16;
        this.dialogue.say('ERROR\nOBJECT TEMPORAL STATE INVALID',4);
      }
    }
    if(l.index===1){
      const bridge=l.objects[0];
      if(p.x>470&&p.x<1320){
        l.flags.crossing=true;
        bridge.timeState=Math.min(120,bridge.timeState+30*dt);
        if(!l.flags.warned){
          l.flags.warned=true;
          this.dialogue.say('TEMPORAL DRIFT DETECTED.\nKEEP THE BRIDGE IN THE PAST.',4);
        }
      }
    }
    if(l.index===2){
      if(p.x>380)this.dialogue.say('OBJECT DETECTED\nROOM AGE: −32 YEARS',3);
      if(p.x>1150&&!l.flags.floorLost){
        l.flags.floorLost=true;
        l.flags.trapTimer=.7;
        this.audio.tone('static');
        this.dialogue.clear();
        this.dialogue.say('ERROR — FLOOR STATE LOST.\nTHE DOOR IS NOT THE TARGET.',3,'floor-trap');
      }
      if(l.flags.trapTimer>0)l.flags.trapTimer-=dt;
    }
    if(l.index===3&&p.x>1320&&!l.flags.mirrorSeen){
      l.flags.mirrorSeen=true;
      this.dialogue.say('PLAYER: '+p.age+' YEARS',2.5);
      this.dialogue.say('ERROR\nREFLECTION DOES NOT MATCH SUBJECT.',4);
      this.dialogue.say('SUBJECT: UNKNOWN',3);
    }
    if(p.x>l.exit-24&&Math.abs(p.y+p.h-l.exitY)<30){
      if(l.canExit())this.complete();
      else if(l.index===2&&!l.flags.memorySeen)this.dialogue.say('MEMORY INDEX INCOMPLETE.\nRETURN TO THE ROOM.',3);
      else if(l.index===4)this.dialogue.say('T-MODULE\nTARGET: PLAYER',3);
    }
  }
  update(dt){
    this.clock+=dt;
    this.shake=Math.max(0,this.shake-dt);
    if(this.mode==='boot'){
      this.boot(dt);
      return;
    }
    if(this.mode==='sequence'){
      this.updateSequence(dt);
      return;
    }
    if(this.mode==='menu'){
      if(this.settings.crt&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
        const flicker=this.clock%5;
        $('void-title').textContent=flicker<.045?['V0ID','VO_D','V O I D'][Math.floor(this.clock/5)%3]:'VOID';
      }
      return;
    }
    if(this.mode==='dead'){
      this.deathTimer-=dt;
      if(this.deathTimer<=0){
        const index=this.level.index;
        this.loadLevel(index,this.checkpoint);
      }
      return;
    }
    if(this.mode!=='play')return;
    this.module.update(dt);
    if(this.mode!=='play')return;
    const input={
      left:this.keys.has('KeyA')||(!this.module.active&&this.keys.has('ArrowLeft')),right:this.keys.has('KeyD')||(!this.module.active&&this.keys.has('ArrowRight'))
    };
    let solids=this.level.solids();
    if(this.level.flags.trapTimer>0&&this.level.objects.find(o=>o.id==='floor')?.timeState>=0)solids.push({
      x:1200,y:500,w:300,h:25
    });
    this.player.update(dt,input,solids);
    this.player.x=clamp(this.player.x,0,this.level.width-this.player.w);
    this.triggers(dt);
    if(this.mode!=='play')return;
    if(this.player.y>730){
      this.die();
      return;
    }
    const desired=clamp(this.player.x-this.viewWidth*.35,0,Math.max(0,this.level.width-this.viewWidth));
    this.camera+=(desired-this.camera)*Math.min(1,dt*6);
    this.zoom+=((this.module.active?1.025:1)-this.zoom)*dt*5;
    this.particles.update(dt);
    this.dialogue.update(dt);
  }
  frame(t){
    const dt=Math.min((t-this.last)/1000,.05);
    this.last=t;
    if(this.focused){
      this.accumulator+=dt;
      let loops=0;
      while(this.accumulator>=1/120&&loops++<8){
        this.update(1/120);
        this.accumulator-=1/120;
      }
    }
    this.draw();
    requestAnimationFrame(time=>this.frame(time));
  }
  line(x1,y1,x2,y2,color='#778186',width=1){
    const c=this.ctx;
    c.strokeStyle=color;
    c.lineWidth=width;
    c.beginPath();
    c.moveTo(x1,y1);
    c.lineTo(x2,y2);
    c.stroke();
  }
  label(text,x,y,color='#778186',size=10){
    const c=this.ctx;
    c.fillStyle=color;
    c.font=`${size}px "Courier New", monospace`;
    c.fillText(text,x,y);
  }
  person(x,y,age=15,color='#e1e5e7',walking=0,mirror=false){
    const c=this.ctx;
    const s=age===7?.6:1;
    const h=age===7?21:age===60?32:35;
    c.save();
    c.translate(x,y+h);
    c.scale(s,s);
    c.fillStyle=color;
    c.strokeStyle=color;
    c.lineWidth=2;
    const lean=age===60?3:0;
    c.fillRect(6+lean,-35,8,8);
    c.fillRect(8,-24,4,12);
    this.line(8,-22,3,-13,color,2);
    this.line(12,-22,17,-13+lean,color,2);
    const walk=walking?Math.sin(walking)*5:0;
    this.line(9,-12,7+walk,0,color,2);
    this.line(11,-12,14-walk,0,color,2);
    if(mirror)this.line(18,-17,21,0,color,1);
    c.restore();
  }
  drawTree(o){
    const c=this.ctx;
    const age=o.timeState;
    const color=this.module.active&&this.module.target===o?'#9dc6d5':'#a6adb0';
    if(age===2){
      this.line(o.x,500,o.x,487,color,2);
      this.line(o.x,494,o.x+9,487,color);
      return;
    }
    if(age>=200){
      c.fillStyle=color;
      c.fillRect(o.x-12,489,24,11);
      return;
    }
    const scale=age===10?.22:age===40?.65:1;
    c.save();
    c.translate(o.x,500);
    c.scale(scale,scale);
    const branch=(x,y,len,angle,depth)=>{
      const nx=x+Math.cos(angle)*len,ny=y+Math.sin(angle)*len;
      this.line(x,y,nx,ny,color,Math.max(1,depth*1.5));
      if(depth>0){
        branch(nx,ny,len*.72,angle-.42,depth-1);
        if(age<150||depth%2)branch(nx,ny,len*.66,angle+.5,depth-1);
      }
    };
    branch(0,0,104,-Math.PI/2,5);
    c.restore();
  }
  drawDoor(x,y,open=false,alpha=1){
    const c=this.ctx;
    c.save();
    c.globalAlpha=alpha;
    c.strokeStyle=open?'#b8d3dc':'#899399';
    c.lineWidth=1.5;
    c.strokeRect(x-18,y-66,36,66);
    c.strokeStyle='#333c41';
    c.strokeRect(x-24,y-72,48,72);
    if(open){
      c.fillStyle='#c7dce316';
      c.fillRect(x-16,y-64,32,63);
      this.line(x-15,y-63,x+8,y-54,'#d4e1e7');
      this.line(x+8,y-54,x+8,y-6,'#d4e1e7');
      this.line(x+8,y-6,x-15,y,'#d4e1e7');
    }
    else{
      c.fillStyle='#a5b5bd';
      c.fillRect(x+10,y-31,2,3);
    }
    this.label('EXIT',x-12,y-86,'#8e9ba2',9);
    c.restore();
  }
  drawMenu(){
    const c=this.ctx;
    if(this.bootTime<5.6)return;
    const x=this.w*.74,y=this.h*.57,size=Math.min(this.w*.105,this.h*.18);
    c.save();
    c.globalAlpha=clamp((this.bootTime-5.6)/3,0,1);
    c.strokeStyle='#202629';
    c.lineWidth=1;
    c.strokeRect(x-size*.42,y-size,size*.84,size*1.72);
    c.strokeStyle='#353e43';
    c.strokeRect(x-size*.34,y-size*.92,size*.68,size*1.64);
    this.line(x-size*.34,y-size*.92,x+size*.08,y-size*.77,'#58666e');
    this.line(x+size*.08,y-size*.77,x+size*.08,y+size*.58,'#58666e');
    this.line(x+size*.08,y+size*.58,x-size*.34,y+size*.72,'#58666e');
    this.line(this.w*.53,y+size*.72,this.w*.93,y+size*.72,'#1c2327');
    this.label('NO SIGNAL',x-size*.36,y+size*1.07,'#6d777d',8);
    c.restore();
  }
  draw(){
    const c=this.ctx;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.fillStyle='#000';
    c.fillRect(0,0,this.w,this.h);
    if(this.mode==='boot'||this.mode==='menu'){
      this.drawMenu();
      return;
    }
    if(!this.level||!['play','dead','panel'].includes(this.mode))return;
    if(this.mode==='panel'&&this.ui.returnMode==='menu')return;
    c.save();
    const shake=this.settings.shake&&this.shake>0?Math.sin(this.clock*130)*3:0;
    c.translate(this.w/2,this.h*.5);
    c.scale(this.zoom,this.zoom);
    c.translate(-this.w/2,-this.h*.5);
    c.translate(shake,this.offsetY);
    c.scale(this.scale,this.scale);
    c.translate(-this.camera,0);
    const l=this.level;
    if(l.index!==4){
      this.line(0,165,l.width,165,'#171b1e');
      this.line(0,170,l.width,170,'#0c1012');
      for(let x=80;
      x<l.width;
      x+=220){
        this.line(x,165,x,178,'#323b40');
        this.label(pad(x/220|0,3),x+6,187,'#414c52',8);
      }
      this.label(`SECTOR ${pad(l.index+1)} / ${l.name}`,70,233,'#536068',10);
      for(const r of l.solids()){
        if(r.tag==='tree'||r.tag==='crate')continue;
        if(r.tag==='bridge'){
          c.fillStyle='#454e53';
          c.fillRect(r.x,r.y,r.w,5);
          for(let x=r.x;
          x<r.x+r.w;
          x+=30){
            this.line(x,r.y+6,x+20,r.y+14,'#30383d');
          }
          continue;
        }
        c.fillStyle='#121619';
        c.fillRect(r.x,r.y,r.w,r.h);
        c.fillStyle='#b7c0c5';
        c.fillRect(r.x,r.y,r.w,2);
        if(r.tag==='passage'){
          c.fillStyle='#8d969a';
          c.fillRect(r.x,r.y+r.h-2,r.w,2);
        }
        for(let x=r.x+14;
        x<r.x+r.w;
        x+=42)this.line(x,r.y+15,x+11,r.y+15,'#2d353a');
      }
    }
    if(l.index===0){
      this.drawTree(l.objects[0]);
      this.label('BIOLOGICAL SPECIMEN / 001',540,548,'#636e74',8);
      if(!l.flags.doorLost||l.canExit())this.drawDoor(l.exit,l.exitY,l.canExit());
      else{
        c.setLineDash([2,7]);
        c.strokeStyle='#566875';
        c.strokeRect(l.exit-18,l.exitY-66,36,66);
        c.setLineDash([]);
        this.label('TEMPORAL ECHO',l.exit-48,l.exitY-84,'#8cabb8',8);
      }
    }
    if(l.index===1){
      const b=l.objects[0];
      if(b.timeState>=65){
        for(let i=0;
        i<10;
        i++){
          const x=450+i*87;
          this.line(x,500+i%3*8,x+35,505+i%3*12,'#4b555a',3);
        }
      }
      this.line(450,535,450,650,'#313c43');
      this.line(1320,535,1320,650,'#313c43');
      this.label('STRUCTURE AGE: '+pad(Math.round(b.timeState),3),450,458,'#8e9da5',9);
      if(l.flags.crossing)this.label('TEMPORAL DRIFT +30 / SEC',700,550,'#8ca8b4',9);
      this.drawDoor(l.exit,l.exitY,true);
    }
    if(l.index===2){
      const age=l.objects[0].timeState;
      if(age<0){
        c.globalAlpha=.4;
        this.line(410,500,410,297,'#75878f');
        this.line(410,297,930,297,'#75878f');
        this.line(930,297,930,500,'#75878f');
        c.strokeStyle='#88989f';
        c.strokeRect(454,338,68,69);
        this.line(488,338,488,407,'#88989f');
        this.line(454,373,522,373,'#88989f');
        this.line(548,459,692,459,'#88989f',3);
        this.line(560,459,560,500,'#88989f');
        this.line(680,459,680,500,'#88989f');
        c.strokeRect(759,463,72,37);
        c.globalAlpha=1;
      }
      const n=l.memoryCount();
      for(let i=0;
      i<n;
      i++)this.person(590+i*76,i===2?479:465,i===2?7:30,'#667b84');
      this.drawDoor(l.exit,l.exitY,l.canExit());
      if(l.flags.floorLost&&l.objects[1].timeState>=0){
        c.setLineDash([3,8]);
        this.line(1200,500,1500,500,'#658896');
        c.setLineDash([]);
        this.label('FLOOR / NO CURRENT STATE',1210,542,'#8ca8b4',9);
      }
    }
    if(l.index===3){
      if(l.objects[0].timeState<90){
        c.strokeStyle='#a4adb2';
        c.strokeRect(290,400,64,100);
        this.line(295,405,349,495,'#5f7079');
        this.line(349,405,295,495,'#5f7079');
      }
      else{
        this.line(294,498,350,492,'#6a767e',3);
      }
      this.label('CLEARANCE: 024',534,221,'#87969d',9);
      this.label('SUBJECT CALIBRATION',790,543,'#687980',9);
      c.strokeStyle='#6b7f8a';
      c.strokeRect(1390,273,54,77);
      this.person(1407,318,60,'#8fa9b6',0,true);
      this.drawDoor(l.exit,l.exitY,true);
    }
    if(l.index===4){
      const reveal=clamp((l.elapsed-3)/2,0,1);
      if(reveal>0){
        const size=clamp((this.player.x-250)/750,0,1);
        if(size<.08){
          c.fillStyle='#edf5f8';
          c.globalAlpha=reveal;
          c.fillRect(l.exit-1,459,3,3);
          c.globalAlpha=1;
        }
        else{
          c.save();
          c.translate(l.exit,500);
          c.scale(Math.max(.08,size),Math.max(.08,size));
          this.drawDoor(0,0,l.canExit(),reveal);
          c.restore();
        }
      }
    }
    if(this.mode!=='dead')this.person(this.player.x,this.player.y,this.player.age,'#e2e7ea',this.player.grounded&&Math.abs(this.player.vx)>0?this.player.walk:0);
    if(this.module.target&&this.mode==='play'){
      const o=this.module.target,x=o.id==='self'?this.player.x+10:o.id==='bridge'?clamp(this.player.x+30,450,1300):o.x,y=o.id==='self'?this.player.y-25:o.y-95;
      this.label(this.module.active?'[ TEMPORAL LINK ]':'[ E ]',x-25,y,'#a4ccd9',9);
      if(this.module.active){
        c.strokeStyle='#a4ccd955';
        c.setLineDash([2,6]);
        c.strokeRect(this.player.x-8,this.player.y-8,this.player.w+16,this.player.h+16);
        c.setLineDash([]);
      }
    }
    this.particles.draw(c);
    c.restore();
    if(this.module.active&&this.mode==='play'){
      c.fillStyle='#83bdd208';
      c.fillRect(0,0,this.w,this.h);
    }
  }
}
const game=new Game();
