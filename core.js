/* VOID — deterministic simulation, shared by browser and tests. */
(function (root) {
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const rect=(x,y,w,h,tag='hull')=>({
    x,y,w,h,tag
  });
  const target=(id,name,x,y,states,timeState,range=160)=>({
    id,name,x,y,states,timeState,range
  });
  const LEVELS=[  {
    name:'GROWTH',width:1640,spawn:[100,465],exit:1510,exitY:500,platforms:[rect(0,500,1640,120)],objects:[target('tree','TREE',650,500,[2,10,40,84,150,200],84,190),target('door','EXIT',1510,500,[0,10,40,100],0,190)],thought:'TIME CHANGES OBJECTS.'
  },  {
    name:'DECADAY',width:1740,spawn:[100,465],exit:1600,exitY:500,platforms:[rect(0,500,450,120),rect(1320,500,420,120)],objects:[target('bridge','BRIDGE',450,500,[0,20,40,70,120],70,190)],thought:'TIME CAN REPAIR THINGS.'
  },  {
    name:'MEMORY',width:1800,spawn:[100,465],exit:1650,exitY:500,platforms:[rect(0,500,1200,120),rect(1500,500,300,120)],objects:[target('room','ROOM',630,500,[-80,-60,-32,-15,0],0,310),target('floor','FLOOR',1350,500,[-32,0,32],0,250)],thought:'TIME CAN REVEAL MEMORY.'
  },  {
    name:'SUBJECT',width:1810,spawn:[100,465],exit:1640,exitY:350,platforms:[rect(0,500,1100,120),rect(510,240,235,236,'passage'),rect(1060,350,750,270,'rise')],objects:[target('crate','CONTAINER',320,500,[0,40,90],0,155),target('self','PLAYER',450,500,[7,15,30,60],15,9999)],thought:'TIME CAN CHANGE THE SUBJECT.'
  },  {
    name:'VOID',width:1500,spawn:[100,465],exit:1250,exitY:500,platforms:[rect(0,500,1500,120,'invisible')],objects:[target('self','PLAYER',1250,500,[7,15,30,60],30,9999)],thought:'THE SUBJECT EXISTS OUTSIDE TIME.'
  }
  ];
  class Player {
    constructor(x,y){
      this.x=x;
      this.y=y;
      this.w=20;
      this.h=35;
      this.vx=0;
      this.vy=0;
      this.age=15;
      this.grounded=false;
      this.coyote=0;
      this.buffer=0;
      this.facing=1;
      this.walk=0;
    }
    jump(){
      this.buffer=.1;
    }
    setAge(age,solids){
      const h=age===7?21:age===60?32:35;
      const w=age===7?13:20;
      const box={
        x:this.x,y:this.y+this.h-h,w,h
      };
      if(solids.some(r=>overlaps(box,r)))return false;
      Object.assign(this,box);
      this.age=age;
      return true;
    }
    update(dt,input,solids){
      this.buffer=Math.max(0,this.buffer-dt);
      this.coyote=this.grounded?.1:Math.max(0,this.coyote-dt);
      const direction=Number(!!input.right)-Number(!!input.left);
      const speed=this.age===60?165:235;
      this.vx=direction*speed;
      if(direction)this.facing=direction;
      this.walk+=Math.abs(this.vx)*dt*.065;
      this.x+=this.vx*dt;
      for(const r of solids)if(overlaps(this,r)){
        if(this.vx>0)this.x=r.x-this.w;
        else if(this.vx<0)this.x=r.x+r.w;
      }
      if(this.buffer>0&&this.coyote>0){
        this.vy=-(this.age===30?560:this.age===7?330:this.age===60?350:440);
        this.buffer=0;
        this.coyote=0;
        this.grounded=false;
      }
      this.vy=Math.min(950,this.vy+980*dt);
      this.y+=this.vy*dt;
      this.grounded=false;
      for(const r of solids)if(overlaps(this,r)){
        if(this.vy>=0){
          this.y=r.y-this.h;
          this.grounded=true;
          this.coyote=.1;
        }
        else this.y=r.y+r.h;
        this.vy=0;
      }
    }
  }
  class Level {
    constructor(index){
      Object.assign(this,JSON.parse(JSON.stringify(LEVELS[index])));
      this.index=index;
      this.flags={
      };
      this.elapsed=0;
      this.decay=0;
    }
    solids(){
      const out=[...this.platforms];
      const obj=id=>this.objects.find(o=>o.id===id);
      if(this.index===0){
        const age=obj('tree').timeState;
        if(age>=10&&age<200)out.push(rect(617,age===10?454:180,66,age===10?46:320,'tree'));
      }
      if(this.index===1&&obj('bridge').timeState<65)out.push(rect(450,500,870,18,'bridge'));
      if(this.index===2&&(!this.flags.floorLost||obj('floor').timeState<0))out.push(rect(1200,500,300,25,'floor'));
      if(this.index===3&&obj('crate').timeState<90)out.push(rect(290,400,64,100,'crate'));
      return out;
    }
    memoryCount(){
      const age=this.objects[0].timeState;
      return age<=-80?3:age<=-60?2:age<=-32?1:0;
    }
    canExit(){
      if(this.index===0)return !!this.flags.doorLost&&this.objects[1].timeState>=40;
      if(this.index===2)return !!this.flags.memorySeen&&this.objects[1].timeState<0;
      if(this.index===3)return !!this.flags.mirrorSeen;
      if(this.index===4)return !!this.flags.presentSelected;
      return true;
    }
    nearest(player){
      if(this.index===4)return player.x>900?this.objects[0]:null;
      const choices=this.objects.filter(o=>o.id!=='self'&&Math.abs(player.x+player.w/2-o.x)<o.range);
      if(this.index===1&&player.x>=300&&player.x<1430)return this.objects[0];
      if(this.index===3&&player.x>365)return this.objects[1];
      return choices.sort((a,b)=>Math.abs(player.x-a.x)-Math.abs(player.x-b.x))[0]||null;
    }
  }
  class TimeSystem {
    static set(level,object,value,player){
      value=clamp(value,object.states[0],object.states.at(-1));
      if(object.id==='self'&&player&&!player.setAge(value,level.solids()))return false;
      object.timeState=value;
      if(level.index===2&&object.id==='room'&&value<=-80)level.flags.memorySeen=true;
      if(level.index===4&&object.id==='self')level.flags.presentSelected=value===15;
      return true;
    }
    static step(level,object,direction,player){
      const states=object.states;
      let i=states.findIndex(v=>v>=object.timeState);
      if(i<0)i=states.length-1;
      return this.set(level,object,states[clamp(i+direction,0,states.length-1)],player);
    }
  }
  const API={
    clamp,overlaps,rect,LEVELS,Player,Level,TimeSystem
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  else root.VoidCore=API;
})(typeof window!=='undefined'?window:globalThis);
