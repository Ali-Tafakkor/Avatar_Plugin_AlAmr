import React, { Component, Suspense, memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { PlayerRig, createPlayerController, createFlatNavigationSurface, type AvatarLocomotion, type PlayerInputAction } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { EMOTIONS, LOCOMOTION_PROFILE, type AvatarV2Status, type EmotionName } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import { AvatarWebV2, type AvatarWebV2Handle } from './AvatarWebV2';
import './style.css';

console.info('AVATAR_V2_BOOT','module_loaded');

const player = createPlayerController({ position: [0, 0, 0], yaw: 0 });
const navigation = createFlatNavigationSurface(0, {minX:-25,maxX:25,minZ:-25,maxZ:25});
const modelUrl = new URL('./avatar-v2/avatar.gltf', document.baseURI).href;
const motionsUrl = new URL('./avatar-v2/motions.json', document.baseURI).href;
const movement = {walkSpeed:LOCOMOTION_PROFILE.walkSpeed,sprintSpeed:LOCOMOTION_PROFILE.runSpeed,jumpSpeed:5.6,gravity:18.8,acceleration:12,deceleration:16};
const motionLabels:Record<string,string>={idle:'ایستاده',walk:'راه‌رفتن ورزشی',run:'دویدن ورزشی',jump:'پرش',fall:'فرود',land:'تماس با زمین',fly:'پرواز'};
const manualLabels:Record<string,string>={jaw:'بازشدن فک',smile:'لبخند',frown:'افتادگی لب',brows:'بالارفتن ابرو',browDown:'اخم',wide:'بازشدن چشم‌ها'};
type ViewMode='body'|'face'|'legs'|'follow';
type LabSnapshot={ready:boolean;frameCount:number;motion:string;animation:AvatarV2Status|null;position:readonly number[];speed:number;renderer:string;runtime:string;selfTest:string;phase:string;errors:string[];checks:Record<string,unknown>};
const evidence:LabSnapshot={ready:false,frameCount:0,motion:'idle',animation:null,position:[0,0,0],speed:0,renderer:'در حال آماده‌سازی',runtime:'waiting',selfTest:'در انتظار بررسی اولیه',phase:'بارگذاری',errors:[],checks:{}};
type GaitAudit={frames:number;minimumFlex:number;maximumFlex:number;backwardFrames:number;maximumPlaneDeviation:number};
let gaitAudit:Record<string,GaitAudit>={};
let renderedSeconds=0;
Object.defineProperty(window,'avatarLabDiagnostics',{get:()=>({...evidence,errors:[...evidence.errors]})});
const addError=(reason:unknown)=>{const message=reason instanceof Error?reason.message:String(reason);if(!evidence.errors.includes(message))evidence.errors.push(message);};
window.addEventListener('error',event=>addError(event.message));
window.addEventListener('unhandledrejection',event=>addError(event.reason));
class SceneErrorBoundary extends Component<{children:ReactNode},{message:string|null}>{
  state={message:null as string|null};
  static getDerivedStateFromError(error:Error){return{message:error.message};}
  componentDidCatch(error:Error){addError(error);void window.alamr?.runtime.fail({code:'avatar_v2_scene_failed'});}
  render(){return this.state.message?<div className="error" role="alert"><h2>بارگذاری محیط انجام نشد</h2><p>{this.state.message}</p><button onClick={()=>location.reload()}>تلاش دوباره</button></div>:this.props.children;}
}
function Stage(){return <>
  <color attach="background" args={['#dee8e8']}/><fog attach="fog" args={['#dee8e8',24,65]}/>
  <hemisphereLight args={['#f2f5ff','#8b9b83',2.2]}/>
  <directionalLight position={[6,10,7]} intensity={3} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-bias={-0.0001} shadow-normalBias={0.01}/>
  <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[160,160]}/><meshStandardMaterial color="#d0d9d3" roughness={0.96}/></mesh>
  <mesh position={[0,0.001,0]} rotation-x={-Math.PI/2}><ringGeometry args={[3.4,3.43,96]}/><meshStandardMaterial color="#ae9067" roughness={0.8}/></mesh>
  {[-1,1].flatMap(side=>[0,1,2,3].map(i=><group key={`${side}-${i}`} position={[side*8,0,-4-i*6]}>
    <mesh position={[0,0.38,0]} castShadow><cylinderGeometry args={[0.72,0.56,0.76,24]}/><meshStandardMaterial color="#b7b9a9"/></mesh>
    <mesh position={[0,1.7,0]} castShadow><sphereGeometry args={[0.85,24,20]}/><meshStandardMaterial color={i%2?'#6f8975':'#527766'} roughness={0.9}/></mesh>
  </group>))}
  {[-1,1].map(side=><mesh key={side} position={[side*5,0.24,2.5]} castShadow receiveShadow><boxGeometry args={[0.8,0.48,3.6]}/><meshStandardMaterial color="#a68b6b" roughness={0.85}/></mesh>)}
</>;}
const renderers=new WeakMap<HTMLCanvasElement,Promise<WebGPURenderer>>();
function createRenderer(props:{canvas:unknown}){
  const canvas=props.canvas as HTMLCanvasElement;let pending=renderers.get(canvas);
  if(!pending){pending=(async()=>{console.info('AVATAR_V2_BOOT','renderer_start');const renderer=new WebGPURenderer({canvas,antialias:true});await renderer.init();const backend=renderer.backend as unknown as {isWebGPUBackend?:boolean;isWebGLBackend?:boolean};evidence.renderer=backend.isWebGPUBackend?'WebGPU':backend.isWebGLBackend?'WebGL2 fallback':'Three backend';console.info('AVATAR_V2_BOOT',evidence.renderer);return renderer;})();renderers.set(canvas,pending);}return pending;
}
function Observation({avatar}:{avatar:React.RefObject<AvatarWebV2Handle|null>}){
  const signalled=useRef(false);
  useFrame((_state,delta)=>{
    renderedSeconds+=Math.min(Math.max(delta,0),0.05);
    evidence.frameCount++;const state=player.getSnapshot();evidence.position=state.pose.position;evidence.speed=Math.hypot(state.pose.velocity[0],state.pose.velocity[2]);evidence.animation=avatar.current?.getStatus()??null;
    const animation=evidence.animation;
    if(evidence.selfTest==='در حال اجرا'&&animation&&['walk','run'].includes(animation.state)){
      const audit=gaitAudit[animation.state]??={frames:0,minimumFlex:180,maximumFlex:0,backwardFrames:0,maximumPlaneDeviation:0};audit.frames++;
      for(const knee of Object.values(animation.knees)){audit.minimumFlex=Math.min(audit.minimumFlex,knee.flexDeg);audit.maximumFlex=Math.max(audit.maximumFlex,knee.flexDeg);audit.maximumPlaneDeviation=Math.max(audit.maximumPlaneDeviation,knee.planeDeviationDeg);if(knee.forwardBend < -0.001)audit.backwardFrames++;}
    }
    if(evidence.ready&&evidence.frameCount>2&&!signalled.current){signalled.current=true;void(async()=>{
      if(window.alamr){evidence.runtime='painting';const paint=await window.alamr.runtime.painting();if(!paint.ok)addError(paint.error.code);const result=await window.alamr.runtime.ready();evidence.runtime=result.ok?'ready':result.error.code;if(!result.ok)addError(result.error.code);}
      else evidence.runtime='browser-local';
    })();}
  });return null;
}
const LabScene=memo(function LabScene({avatar,view,onReady}:{avatar:React.RefObject<AvatarWebV2Handle|null>;view:ViewMode;onReady:(status:AvatarV2Status)=>void}){
  const onMotion=useCallback((value:AvatarLocomotion)=>{evidence.motion=value.state;avatar.current?.setLocomotion(value);},[avatar]);
  return <Canvas shadows dpr={[1,1.5]} camera={{position:[0,1.5,4.3],fov:42,near:0.03,far:150}} gl={createRenderer}>
    <Stage/><Suspense fallback={null}>
      <PlayerRig controller={player} navigation={navigation} movement={movement}
        camera={{initialDistance:4.3,minDistance:0.55,firstPersonEnterDistance:0.15,firstPersonExitDistance:0.3,targetHeight:view==='face'?1.60:view==='legs'?0.60:0.94,eyeHeight:1.62}}
        onAnimationFrame={onMotion}
        avatar={<AvatarWebV2 ref={avatar} controller={player} navigation={navigation} modelUrl={modelUrl} motionsUrl={motionsUrl} portrait={view==='face'} onReady={onReady} onError={addError}/>}/>
      <Observation avatar={avatar}/>
    </Suspense>
  </Canvas>;
});
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function App(){
  const avatar=useRef<AvatarWebV2Handle|null>(null);const [ready,setReady]=useState(false);const [stats,setStats]=useState({...evidence});
  const [view,setView]=useState<ViewMode>('body');const [emotion,setEmotionState]=useState<EmotionName>('smile');const [intensity,setIntensity]=useState(0.88);
  const [manual,setManual]=useState<Record<string,number>>({});const [running,setRunning]=useState(false);const [demo,setDemo]=useState('idle');
  const abortTest=useRef(false);const initialTest=useRef(false);
  const onReady=useCallback((status:AvatarV2Status)=>{evidence.ready=true;evidence.animation=status;setReady(true);console.info('AVATAR_V2_BOOT','avatar_ready');},[]);
  useEffect(()=>{const id=setInterval(()=>setStats({...evidence,errors:[...evidence.errors]}),120);return()=>{clearInterval(id);abortTest.current=true;player.resetInput();};},[]);
  const changeEmotion=(value:EmotionName)=>{setEmotionState(value);setManual({});avatar.current?.setEmotion(value);};
  const setCamera=(value:ViewMode)=>{
    setView(value);const camera=player.getCameraSnapshot();const yaw=player.getPoseSnapshot().yaw;
    player.setCamera({...camera,yaw:value==='follow'?yaw:yaw+(value==='legs'?Math.PI*0.65:Math.PI),pitch:value==='face'?0:0.05,distance:value==='face'?0.78:value==='legs'?2.7:4.1,mode:'third-person',firstPersonBlend:0});
  };
  const stop=()=>{player.resetInput();setDemo('idle');};
  const reset=()=>{
    player.resetInput();player.teleport([0,0,0],0);const pose=player.getPoseSnapshot();player.setPose({...pose,position:[0,0,0],velocity:[0,0,0],yaw:0,orientation:undefined,mode:'grounded',landingRequested:false});avatar.current?.reset();setDemo('idle');setCamera('body');
  };
  useEffect(()=>{reset();},[]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{
    if(['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement)?.tagName))return;
    if(event.repeat)return;
    if(/^Digit[0-5]$/.test(event.code)){const name=(Object.keys(EMOTIONS) as EmotionName[]).find(key=>EMOTIONS[key].key===event.code.slice(5));if(name)changeEmotion(name);}
    if(event.code==='KeyB')avatar.current?.blink();if(event.code==='KeyR')reset();
  };addEventListener('keydown',handler);return()=>removeEventListener('keydown',handler);},[]);
  const startDemo=(mode:'walk'|'run')=>{stop();setDemo(mode);setCamera('follow');player.setAction('forward',true);player.setAction('sprint',mode==='run');};
  const jump=async()=>{player.setAction('jump',true);await sleep(100);player.setAction('jump',false);};
  const check=(condition:boolean,code:string)=>{if(!condition)throw new Error(code);};
  async function runSelfTest(){
    if(running||!evidence.ready)return;setRunning(true);abortTest.current=false;reset();evidence.selfTest='در حال اجرا';evidence.checks={};gaitAudit={};
    const phase=async(name:string,ms:number)=>{
      evidence.phase=name;const start=renderedSeconds;
      // Desktop suspends hidden surfaces. Wait for rendered animation time so
      // covering the window cannot skip a face, jump or eyelid observation.
      while(renderedSeconds-start<ms/1000){await sleep(20);if(abortTest.current)throw new Error('cancelled');}
    };
    try{
      await phase('تماس کف کفش با زمین',800);const feet=avatar.current!.getStatus()!.feet;
      check(Object.values(feet).every(foot=>Math.abs(foot.soleMinY)<0.006&&Math.abs(foot.rollDeg)<3&&Math.abs(foot.pitchDeg)<3),'foot_contact');evidence.checks.feet=feet;
      setCamera('legs');const start=[...player.getPoseSnapshot().position];player.setAction('forward',true);await phase('راه‌رفتن ورزشی',2400);
      const walked=Math.hypot(player.getPoseSnapshot().position[0]-start[0],player.getPoseSnapshot().position[2]-start[2]);
      check(avatar.current!.getStatus()!.clip==='walk'&&walked>1,'walk_motion');evidence.checks.walk={distance:walked,speed:evidence.speed};
      const runStart=[...player.getPoseSnapshot().position];player.setAction('sprint',true);await phase('دویدن ورزشی',2400);
      const ran=Math.hypot(player.getPoseSnapshot().position[0]-runStart[0],player.getPoseSnapshot().position[2]-runStart[2]);
      check(avatar.current!.getStatus()!.clip==='run'&&ran>walked,'run_motion');evidence.checks.run={distance:ran,speed:evidence.speed};
      evidence.checks.knees=gaitAudit;
      for(const name of ['walk','run']){const audit=gaitAudit[name];check(Boolean(audit)&&audit.frames>8&&audit.backwardFrames===0&&audit.minimumFlex>=2&&audit.maximumFlex<=(name==='walk'?82:132)&&audit.maximumPlaneDeviation<12,`knee_${name}`);}
      stop();await phase('توقف',550);await jump();await phase('پرش',180);check(player.getPoseSnapshot().position[1]>0.1,'jump_height');evidence.checks.jump=true;await phase('فرود',1000);
      reset();setCamera('face');const signatures=new Set<string>();
      for(const name of Object.keys(EMOTIONS) as EmotionName[]){changeEmotion(name);await phase(`چهره: ${EMOTIONS[name].label}`,450);const state=avatar.current!.getStatus()!;check(state.emotion===name&&Object.values(state.weights).every(value=>Number.isFinite(value)&&value>=0&&value<=1),`face_${name}`);signatures.add(JSON.stringify(Object.entries(state.weights).filter(([key,value])=>value>0.03&&!key.startsWith('eye'))));}
      check(signatures.size===6,'face_distinct');evidence.checks.facePresets=6;avatar.current!.blink();
      let leftClosure=0,rightClosure=0,leftMeshClosure=0,rightMeshClosure=0;
      for(let sample=0;sample<14;sample++){
        await phase('بسته‌شدن و بازشدن پلک‌ها',20);const weights=avatar.current!.getStatus()!.weights;
        leftClosure=Math.max(leftClosure,weights.eyeBlinkLeft??0);rightClosure=Math.max(rightClosure,weights.eyeBlinkRight??0);
        for(const binding of avatar.current!.getRuntime()!.actor.face.bindings){
          if(binding.normalized==='eyeblinkleft')leftMeshClosure=Math.max(leftMeshClosure,binding.node.morphTargetInfluences[binding.index]);
          if(binding.normalized==='eyeblinkright')rightMeshClosure=Math.max(rightMeshClosure,binding.node.morphTargetInfluences[binding.index]);
        }
      }
      await phase('بازگشت پلک‌ها',150);const reopened=avatar.current!.getStatus()!.weights;
      check(Math.min(leftClosure,rightClosure,leftMeshClosure,rightMeshClosure)>0.5,'blink_closure');
      check(reopened.eyeBlinkLeft===0&&reopened.eyeBlinkRight===0,'blink_reopened');evidence.checks.blink={leftClosure,rightClosure,leftMeshClosure,rightMeshClosure};
      check(evidence.errors.length===0,'runtime_errors');evidence.selfTest='موفق: کفش و زانو، راه‌رفتن، دویدن، پرش، ۶ حالت صورت و پلک';evidence.phase='آمادهٔ بررسی شما';
    }catch(error){evidence.selfTest=`ناموفق: ${error instanceof Error?error.message:String(error)}`;evidence.phase='آزمون متوقف شد';}
    finally{
      console.info('AVATAR_V2_LOCAL_TEST',JSON.stringify({result:evidence.selfTest,phase:evidence.phase,checks:evidence.checks,errors:[...evidence.errors],renderer:evidence.renderer,frames:evidence.frameCount,runtime:evidence.runtime}));
      player.resetInput();changeEmotion('smile');reset();setRunning(false);
    }
  }
  useEffect(()=>{if(ready&&!initialTest.current){initialTest.current=true;const id=setTimeout(()=>{void runSelfTest();},1400);return()=>clearTimeout(id);}},[ready]);
  return <main>
    <section className="viewport" aria-label="محیط سه‌بعدی آزمایش آواتار نسخه دوم"><SceneErrorBoundary><LabScene avatar={avatar} view={view} onReady={onReady}/></SceneErrorBoundary>
      {!ready&&<div className="loading" role="status"><span className="spinner"/>در حال آماده‌سازی آواتار وب…</div>}
      <div className="scene-mark"><span>AL-AMR</span><b>WEB AVATAR / V2 LOCAL</b></div>
      <div className="scene-status"><i className={ready?'live':''}/>{motionLabels[stats.motion]??stats.motion}<small>{stats.speed.toFixed(2)} m/s</small></div>
    </section>
    <aside className="panel">
      <header><span className="eyebrow">الامر / محیط آزمایشی محلی</span><h1>آواتار <em>۲</em></h1><p>بدن، حرکت و چهرهٔ نسخهٔ وب در محیط تست الامر.</p></header>
      <div className="mode-pill"><i/>نسخهٔ محلی · در انتظار تأیید شما</div>
      {stats.errors.length>0&&<p className="runtime-error" role="alert">{stats.errors.join(' / ')}</p>}
      <section className="check"><div className="section-title"><h2>بررسی انتقال</h2><button disabled={!ready||running} onClick={()=>void runSelfTest()}>اجرای دوباره</button>{running&&<button onClick={()=>{abortTest.current=true;stop();}}>توقف آزمون</button>}</div><p id="test-result" role="status">{stats.selfTest}</p><p id="test-phase">{stats.phase}</p></section>
      <section><h2>نمای بررسی</h2><div className="clip-grid"><button aria-pressed={view==='body'} onClick={()=>setCamera('body')}>تمام بدن</button><button aria-pressed={view==='face'} onClick={()=>setCamera('face')}>صورت</button><button aria-pressed={view==='legs'} onClick={()=>setCamera('legs')}>پا و زانو</button><button aria-pressed={view==='follow'} onClick={()=>setCamera('follow')}>دنبال‌کننده</button></div></section>
      <section><h2>حرکت ورزشی</h2><div className="clip-grid"><button disabled={!ready||running} onClick={()=>startDemo('walk')}>راه‌رفتن</button><button disabled={!ready||running} onClick={()=>startDemo('run')}>دویدن</button><button disabled={!ready||running} onClick={stop}>توقف</button><button disabled={!ready||running} onClick={()=>void jump()}>پرش</button><button disabled={!ready||running} onClick={reset}>بازگشت</button></div><p className="hint">W A S D حرکت · Shift دویدن · Space پرش<br/>راه‌رفتن {movement.walkSpeed} و دویدن {movement.sprintSpeed} متر بر ثانیه. راست‌کلیک و حرکت ماوس: دوربین.</p></section>
      <section><h2>حالت صورت</h2><div className="clip-grid">{(Object.entries(EMOTIONS) as [EmotionName,typeof EMOTIONS[EmotionName]][]).map(([name,item])=><button key={name} disabled={!ready||running} aria-pressed={emotion===name} className={emotion===name?'active':''} onClick={()=>changeEmotion(name)}>{item.key} · {item.label}</button>)}</div>
        <label className="range-label">شدت احساس <output>{Math.round(intensity*100)}٪</output><input aria-label="شدت احساس" type="range" min="0" max="1" step="0.01" value={intensity} onChange={event=>{const value=Number(event.target.value);setIntensity(value);avatar.current?.setIntensity(value);}}/></label>
        <button className="text-button" disabled={!ready} onClick={()=>avatar.current?.blink()}>یک پلک · B</button>
      </section>
      <details><summary>کنترل‌های کامل چهره و بدن</summary><div className="face-options">
        {([['blinkEnabled','پلک خودکار'],['gazeEnabled','تماس چشمی'],['microEnabled','تنفس و حرکت ظریف'],['ikEnabled','اصلاح تماس پا']] as const).map(([key,label])=><label key={key}><input type="checkbox" defaultChecked onChange={event=>avatar.current?.setFaceOptions({[key]:event.target.checked})}/>{label}</label>)}
        {Object.entries(manualLabels).map(([group,label])=><label className="range-label" key={group}>{label}<input aria-label={label} type="range" min="0" max="1" step="0.01" value={manual[group]??0} onChange={event=>{const value=Number(event.target.value);setManual(previous=>({...previous,[group]:value}));avatar.current?.setManual(group,value);}}/></label>)}
      </div></details>
      <details className="diagnostics"><summary>وضعیت فنی</summary><p>فریم {stats.frameCount} · {stats.animation?.morphCount??0} کانال صورت · {stats.animation?.matchedBones??0} مفصل متحرک</p><p dir="ltr">{stats.renderer} · {stats.runtime}</p><p dir="ltr">{stats.animation?.clip??'loading'} · {stats.animation?.time.toFixed(2)} s</p><p id="feet-status">{stats.animation?.feet&&Object.entries(stats.animation.feet).map(([side,foot])=>`${side}: کف ${(foot.soleMinY*1000).toFixed(1)} mm، کجی ${foot.rollDeg.toFixed(1)}°`).join(' | ')}</p><pre id="diagnostic-json">{JSON.stringify({...stats,animation:stats.animation?{...stats.animation,weights:undefined}:null})}</pre></details>
      <footer><span className="status-dot"/>{ready?'آواتار آماده است':'در حال بارگذاری'}<span>فقط آزمایش محلی</span></footer>
    </aside>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
