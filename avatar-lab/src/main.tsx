import React, { Component, Suspense, memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { WebGPURenderer } from 'three/webgpu';
import { PlayerRig, createPlayerController, createFlatNavigationSurface, type AvatarLocomotion, type PlayerInputAction } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { Avatar03, AVATAR03_CLIPS, type Avatar03Handle, type Avatar03Clip, type Avatar03Lighting, type AnimationStatus } from '@al-amr-community/replace-me--avatar03';
import modelUrl from '@al-amr-community/replace-me--avatar03/model?url';
import './style.css';

const player = createPlayerController({ position: [0, 0, 0], yaw: 0 });
const navigation = createFlatNavigationSurface(0);
const clipLabels: Record<Avatar03Clip, string> = { Stand:'ایستادن', Walk:'راه‌رفتن', Run:'دویدن', Fly:'پرواز', Jump:'پرش', HandRaise:'بالا بردن دست', StandToSit:'نشستن', Sitting:'حالت نشسته', SittoStand:'برخاستن' };
const motionLabels: Record<string,string> = {idle:'ایستاده',walk:'در حال راه‌رفتن',run:'در حال دویدن',jump:'در حال پرش',fall:'در حال فرود',land:'روی زمین',fly:'در حال پرواز'};
type LabSnapshot = { ready:boolean; frameCount:number; motion:string; animation:AnimationStatus|null; position:readonly number[]; camera:string; modelHeight:number; renderer:string; selfTest:string; errors:string[] };
let runtimePhase='waiting';
const evidence:LabSnapshot = {ready:false,frameCount:0,motion:'idle',animation:null,position:[0,0,0],camera:'third-person',modelHeight:0,renderer:'در حال آماده‌سازی',selfTest:'اجرا نشده',errors:[]};
// Read-only diagnostics belong to this test Environment, never to the Plugin or platform API.
Object.defineProperty(window,'avatarLabDiagnostics',{get:()=>({...evidence,errors:[...evidence.errors]})});
window.addEventListener('error',event=>evidence.errors.push(event.message));
window.addEventListener('unhandledrejection',event=>evidence.errors.push(String(event.reason)));

class SceneErrorBoundary extends Component<{children:ReactNode},{message:string|null}> {
  state={message:null as string|null};
  static getDerivedStateFromError(error:Error){return {message:error.message};}
  componentDidCatch(error:Error){evidence.errors.push(error.message);void window.alamr?.runtime.fail({code:'avatar_lab_scene_failed'});}
  render(){return this.state.message ? <div className="error"><h2>بارگذاری محیط انجام نشد</h2><p>{this.state.message}</p><button onClick={()=>location.reload()}>تلاش دوباره</button></div> : this.props.children;}
}

function Stage(){
  return <>
    <color attach="background" args={['#dee8e8']}/><fog attach="fog" args={['#dee8e8',24,65]}/>
    <hemisphereLight args={['#f2f5ff','#8b9b83',2.2]}/>
    <directionalLight position={[6,10,7]} intensity={3} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-bias={-0.0005} shadow-normalBias={0.03}/>
    <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[160,160]}/><meshStandardMaterial color="#d0d9d3" roughness={0.96}/></mesh>
    <mesh position={[0,0.006,0]} rotation-x={-Math.PI/2} receiveShadow><circleGeometry args={[5.5,96]}/><meshStandardMaterial color="#e8e6d9" roughness={0.9}/></mesh>
    <mesh position={[0,0.012,0]} rotation-x={-Math.PI/2}><ringGeometry args={[5.42,5.5,96]}/><meshStandardMaterial color="#ae9067" roughness={0.8}/></mesh>
    {[-1,1].flatMap(side=>[0,1,2,3].map(i=><group key={`${side}-${i}`} position={[side*8,0,-4-i*6]}>
      <mesh position={[0,0.38,0]} castShadow><cylinderGeometry args={[0.72,0.56,0.76,24]}/><meshStandardMaterial color="#b7b9a9"/></mesh>
      <mesh position={[0,1.7,0]} castShadow><sphereGeometry args={[0.85,24,20]}/><meshStandardMaterial color={i%2?'#6f8975':'#527766'} roughness={0.9}/></mesh>
    </group>))}
    {[-1,1].map(side=><mesh key={side} position={[side*5,0.24,2.5]} castShadow receiveShadow><boxGeometry args={[0.8,0.48,3.6]}/><meshStandardMaterial color="#a68b6b" roughness={0.85}/></mesh>)}
  </>;
}

function Observation({avatar}:{avatar:React.RefObject<Avatar03Handle|null>}){
  const frames=useRef(0); const signalled=useRef(false);
  useFrame(()=>{
    evidence.frameCount=++frames.current;
    if(!window.alamr)runtimePhase='bridge_missing';
    const snapshot=player.getSnapshot();
    evidence.position=snapshot.pose.position;
    evidence.camera=snapshot.camera.mode;
    evidence.animation=avatar.current?.getStatus()??null;
    if(evidence.ready && frames.current>2 && window.alamr?.runtime && !signalled.current){
      signalled.current=true;
      void (async()=>{
        if(window.alamr){
          runtimePhase='painting';
          const painting=await window.alamr.runtime.painting();
          if(!painting.ok)evidence.errors.push(`runtime.painting: ${painting.error.code}`);
          const result=await window.alamr.runtime.ready();
          runtimePhase=result.ok?'ready':`ready_${result.error.code}`;
          if(!result.ok)evidence.errors.push(`runtime.ready: ${result.error.code}`);
        }
      })();
    }
  });
  return null;
}

const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// R3F 9 can invoke an async factory again while initialization is pending.
// Share the in-flight renderer per canvas and isolate it from the UI's stats timer.
const renderers=new WeakMap<HTMLCanvasElement,Promise<WebGPURenderer>>();
function createRenderer(props:{canvas:unknown}){
  const canvas=props.canvas as HTMLCanvasElement;
  let pending=renderers.get(canvas);
  if(!pending){
    pending=(async()=>{
      const renderer=new WebGPURenderer({canvas,antialias:true});
      await renderer.init();
      evidence.renderer=renderer.backend.constructor.name;
      return renderer;
    })();
    renderers.set(canvas,pending);
  }
  return pending;
}
const LabScene=memo(function LabScene({avatar,paused,lighting,onMotion,onReady}:{avatar:React.RefObject<Avatar03Handle|null>;paused:boolean;lighting:Avatar03Lighting;onMotion:(motion:AvatarLocomotion)=>void;onReady:()=>void}){
  return <Canvas shadows dpr={[1,1.5]} camera={{position:[0,2,5],fov:48,near:0.05,far:150}} gl={createRenderer}>
    <Stage/>
    <Suspense fallback={null}>
      <PlayerRig controller={player} navigation={navigation} paused={paused} camera={{initialDistance:4.8}} onAnimationFrame={onMotion}
        avatar={<Avatar03 ref={avatar} modelUrl={modelUrl} lighting={lighting} onReady={info=>{evidence.ready=true;evidence.modelHeight=info.height;onReady();}}/>}/>
      <Observation avatar={avatar}/>
    </Suspense>
  </Canvas>;
});
function App(){
  const avatar=useRef<Avatar03Handle|null>(null);
  const [ready,setReady]=useState(false);
  const [manual,setManual]=useState<Avatar03Clip|null>(null);
  const [stats,setStats]=useState({...evidence});
  const [running,setRunning]=useState(false);
  const [lighting,setLighting]=useState<Avatar03Lighting>('unlit');
  const abortTest=useRef(false);
  const onMotion=useCallback((motion:AvatarLocomotion)=>{evidence.motion=motion.state;avatar.current?.setLocomotion(motion);},[]);
  const onReady=useCallback(()=>setReady(true),[]);
  useEffect(()=>{const timer=setInterval(()=>setStats({...evidence}),150);return()=>{clearInterval(timer);abortTest.current=true;player.resetInput();};},[]);
  const preview=(clip:Avatar03Clip|null)=>{
    setManual(clip);player.resetInput();avatar.current?.previewClip(clip);
  };
  const reset=()=>{
    player.resetInput(); player.teleport([0,0,0],0);
    const pose=player.getPoseSnapshot();player.setPose({...pose,position:[0,0,0],velocity:[0,0,0],orientation:undefined,mode:'grounded',landingRequested:false,yaw:0});
    player.setCamera({...player.getCameraSnapshot(),yaw:0,pitch:0.13,distance:4.8,mode:'third-person',firstPersonBlend:0});
  };
  useEffect(()=>{reset();},[]);

  async function runSelfTest(){
    if(running||!ready)return;
    setRunning(true);abortTest.current=false;preview(null);reset();
    evidence.selfTest='در حال بررسی';
    const passed:string[]=[];
    try{
      await sleep(300);
      const action=async(key:PlayerInputAction,ms:number)=>{player.setAction(key,true);await sleep(ms);player.setAction(key,false);if(abortTest.current)throw new Error('cancelled');};
      const start=[...player.getPoseSnapshot().position];
      player.setAction('forward',true);await sleep(900);
      if(avatar.current?.getStatus()?.clip!=='Walk')throw new Error('walk_clip');
      if(Math.hypot(player.getPoseSnapshot().position[0]-start[0],player.getPoseSnapshot().position[2]-start[2])<0.3)throw new Error('walk_distance');
      passed.push('راه‌رفتن');
      player.setAction('sprint',true);await sleep(900);
      if(avatar.current?.getStatus()?.clip!=='Run')throw new Error('run_clip');passed.push('دویدن');
      player.resetInput();await sleep(600);
      player.setAction('jump',true);await sleep(100);
      if(player.getPoseSnapshot().position[1]<=0.05)throw new Error('jump_height');
      if(avatar.current?.getStatus()?.clip!=='Jump')throw new Error('jump_clip');
      player.setAction('jump',false);passed.push('پرش');await sleep(1700);
      await action('toggleFlight',100);await sleep(450);
      if(player.getPoseSnapshot().mode!=='flying'||avatar.current?.getStatus()?.clip!=='Fly')throw new Error('flight');passed.push('پرواز');
      reset();await sleep(500);
      for(const clip of AVATAR03_CLIPS){
        avatar.current?.previewClip(clip);await sleep(260);
        const status=avatar.current?.getStatus();
        if(status?.clip!==clip||status.time<=0)throw new Error(`clip_${clip}`);
      }
      passed.push('۹ انیمیشن');avatar.current?.previewClip(null);
      evidence.selfTest=`موفق: ${passed.join('، ')}`;
    }catch(error){evidence.selfTest=`ناموفق: ${error instanceof Error?error.message:String(error)} (${passed.join('، ')})`;}
    finally{player.resetInput();avatar.current?.previewClip(null);reset();setRunning(false);}
  }

  return <main>
    <section className="viewport" aria-label="محیط سه‌بعدی آزمایش آواتار">
      <SceneErrorBoundary><LabScene avatar={avatar} paused={manual!==null} lighting={lighting} onMotion={onMotion} onReady={onReady}/></SceneErrorBoundary>
      {!ready&&<div className="loading" role="status"><span className="spinner"/>در حال آماده‌سازی آواتار ۳…</div>}
      <div className="scene-mark"><span>AL-AMR</span><b>AVATAR LAB / 03</b></div>
      <div className="scene-status"><i className={ready?'live':''}/>{manual?`بررسی: ${clipLabels[manual]}`:motionLabels[stats.motion]??stats.motion}<small>{stats.camera==='first-person'?'نمای اول‌شخص':'نمای سوم‌شخص'}</small></div>
    </section>
    <aside className="panel">
      <header><span className="eyebrow">الامر / محیط آزمایشی</span><h1>آواتار <em>۳</em></h1><p>یک شخصیت تازه، با همان کنترل‌های آشنای محیط.</p></header>
      <div className="mode-pill"><i/>مدل اصلی · ۹ انیمیشن</div>
      {location.protocol!=='http:'&&<p className="hint" dir="ltr">Runtime: {runtimePhase} · frames: {stats.frameCount}</p>}
      {stats.errors.length>0&&<p className="runtime-error" role="alert">{stats.errors.join(' / ')}</p>}
      <section><h2>حرکت در محیط</h2><div className="controls"><div><kbd>W A S D</kbd><span>حرکت</span></div><div><kbd>Shift</kbd><span>دویدن</span></div><div><kbd>Space</kbd><span>پرش / اوج‌گرفتن</span></div><div><kbd>F</kbd><span>پرواز / فرود</span></div><div><kbd>Ctrl</kbd><span>پایین‌آمدن</span></div></div><p className="hint">برای چرخاندن دوربین، دکمهٔ راست ماوس را نگه دار. غلتک ماوس فاصله را تغییر می‌دهد.</p></section>
      <section><div className="section-title"><h2>بررسی انیمیشن‌ها</h2><button className={'text-button '+(!manual?'selected':'')} disabled={!ready||running} onClick={()=>preview(null)}>کنترل عادی</button></div>
        <div className="clip-grid">{AVATAR03_CLIPS.map(clip=><button key={clip} disabled={!ready||running} aria-pressed={manual===clip} className={manual===clip?'active':''} onClick={()=>preview(clip)}>{clipLabels[clip]}</button>)}</div>
        {manual&&<p className="hint">برای ادامهٔ حرکت با صفحه‌کلید، «کنترل عادی» را بزن.</p>}
      </section>
      <div className="actions"><button disabled={!ready||running} onClick={()=>{preview(null);reset();}}>بازگشت به نقطهٔ شروع</button><button disabled={!ready||running} onClick={()=>{reset();player.setCamera({...player.getCameraSnapshot(),yaw:Math.PI,distance:3.7});}}>نمای روبه‌رو</button></div>
      <div className="actions"><button disabled={!ready||running} aria-pressed={lighting==='unlit'} onClick={()=>setLighting('unlit')}>بافت اصلی</button><button disabled={!ready||running} aria-pressed={lighting==='scene'} onClick={()=>setLighting('scene')}>نورپردازی محیط</button></div>
      <section className="check"><div className="section-title"><h2>آزمون حرکت</h2><button disabled={!ready||running} onClick={runSelfTest}>{running?'در حال اجرا…':'اجرای آزمون'}</button></div><p role="status" id="test-result">{stats.selfTest}</p></section>
      <details className="diagnostics"><summary>جزئیات آزمون</summary><p>فریم: {stats.frameCount} · ارتفاع: {stats.modelHeight} متر</p><p dir="ltr">{stats.renderer} · {stats.animation?.clip ?? 'loading'}</p><p>{stats.errors.length ? stats.errors.join(' / ') : 'خطای ثبت‌شده‌ای وجود ندارد'}</p></details>
      <footer><span className="status-dot"/> {ready?'مدل آماده است':'در حال بارگذاری'}<span>نسخهٔ آزمایشی ۰.۱</span></footer>
    </aside>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

