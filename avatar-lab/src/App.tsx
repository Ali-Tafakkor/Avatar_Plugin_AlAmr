import React,{Component,Suspense,useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {Box3,Group,Vector3} from 'three';
import {WebGPURenderer} from 'three/webgpu';
import {PlayerRig,createPlayerController,createFlatNavigationSurface,shouldRenderLocalAvatar} from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import {AvatarHybrid,type AvatarHybridHandle} from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import {SpeechPanel} from './SpeechPanel';
import {inventoryAvatar,summarizeSamples} from './performance-metrics.mjs';
import './avatar-studio.css';

const url=(p:string)=>new URL('./'+p,document.baseURI).href;
const nav=createFlatNavigationSurface(0,{minX:-25,maxX:25,minZ:-25,maxZ:25});
const movement={walkSpeed:5,sprintSpeed:9,jumpSpeed:5.6,gravity:18.8,acceleration:12,deceleration:16};
const feelings={neutral:'خنثی',smile:'لبخند',laugh:'خنده',sad:'ناراحتی',angry:'اخم',surprise:'تعجب'};
const poses={auto:'طبیعی',open:'باز',relaxed:'راحت',fist:'مشت',point:'اشاره',pinch:'گرفتن ظریف'};
const digits={thumb:'شست',index:'اشاره',middle:'میانی',ring:'حلقه',pinky:'کوچک'};
const diag:any={ready:false,frames:0,errors:[],metrics:null,avatar:null,view:'body',renderer:'loading',benchmark:null};
const rendererCache=new WeakMap<HTMLCanvasElement,Promise<WebGPURenderer>>();
function createRenderer({canvas}:{canvas:unknown}){
  const c=canvas as HTMLCanvasElement;if(!rendererCache.has(c))rendererCache.set(c,(async()=>{
    const r=new WebGPURenderer({canvas:c,antialias:true,trackTimestamp:true});await r.init();
    diag.renderer=(r.backend as any).isWebGPUBackend?'WebGPU':'WebGL2';void window.alamr?.runtime.progress({ratio:.2});return r;
  })());return rendererCache.get(c)!;
}
class Boundary extends Component<{children:ReactNode},{error:string|null}>{
  state={error:null};static getDerivedStateFromError(e:Error){return {error:e.message};}
  componentDidCatch(e:Error){diag.errors.push(e.message);void window.alamr?.runtime.fail({code:'avatar_studio_failed'});}
  render(){return this.state.error?<div className="studio-error">{this.state.error}</div>:this.props.children;}
}
function WorldPose({controller,group,drive}:{controller:any;group:React.RefObject<Group|null>;drive:boolean}){
  useFrame(()=>{const p=controller.getPoseSnapshot();if(group.current){group.current.position.fromArray(p.position);if(p.orientation)group.current.quaternion.fromArray(p.orientation);else group.current.rotation.y=p.yaw;group.current.visible=!drive||shouldRenderLocalAvatar(controller.getCameraSnapshot());}},.5);return null;
}
function InspectionCamera({avatar,controls,view,angle,request,ready}:{avatar:any;controls:any;view:string;angle:string;request:number;ready:boolean}){
  const {camera}=useThree();
  useEffect(()=>{
    if(!ready||!controls.current)return;
    const r=avatar.current?.getRuntime();if(!r)return;r.root.updateWorldMatrix(true,true);
    let target=new Vector3(0,.95,0),distance=4.4;
    if(view==='face'){
      const head=r.face.bindings.find((b:any)=>b.node.name==='AvatarHead')?.node;
      if(head)target=new Box3().setFromObject(head,true).getCenter(new Vector3());distance=.83;
    }else if(view==='neckline'){
      const neck=r.body.bones.get('head');
      if(neck)target=neck.getWorldPosition(new Vector3()).add(new Vector3(0,-.070,0));distance=.48;
    }else if(view==='left'||view==='right'){
      const h=r.hands?.hands[view],hand=h?.mesh;
      if(hand){target=new Box3().setFromObject(hand,true).getCenter(new Vector3());const offset=h.viewNormal.clone().transformDirection(h.mount.matrixWorld);const radial=target.clone().sub(avatar.current.getRoot().getWorldPosition(new Vector3()));radial.y=0;if(offset.dot(radial)<0)offset.negate();const along=new Vector3(0,1,0);const yaw=angle==='back'?Math.PI:angle==='side'?Math.PI/2:angle==='quarter'?Math.PI/4:0;offset.applyAxisAngle(along,yaw);const box=hand.geometry.boundingBox.clone().applyMatrix4(hand.matrixWorld),size=box.getSize(new Vector3());target=box.getCenter(new Vector3());const right=new Vector3(0,1,0).cross(offset).normalize(),up=offset.clone().cross(right).normalize(),extent=(axis:any)=>Math.abs(axis.x)*size.x+Math.abs(axis.y)*size.y+Math.abs(axis.z)*size.z,tan=Math.tan(((camera as any).fov??32)*Math.PI/360),aspect=(camera as any).aspect??1;const distance=Math.max(extent(up)/(2*tan),extent(right)/(2*tan*aspect))*1.14+extent(offset)*.5;camera.position.copy(target).addScaledVector(offset,distance);controls.current.target.copy(target);controls.current.update();return;}distance=.48;
    }
    if(view==='body')target.copy(avatar.current.getRoot().getWorldPosition(new Vector3())).add(new Vector3(0,.93,0));
    const yaw=angle==='back'?Math.PI:angle==='side'?Math.PI/2:angle==='quarter'?Math.PI/4:0;
    camera.position.copy(target).add(new Vector3(Math.sin(yaw)*distance,view==='neckline'?.095:.012,Math.cos(yaw)*distance));controls.current.target.copy(target);controls.current.update();
  },[avatar,controls,view,angle,request,ready,camera]);return null;
}
function Monitor({avatar,ready,benchRequest,onBenchmark}:{avatar:any;ready:boolean;benchRequest:number;onBenchmark:(x:any)=>void}){
  const buffer=useRef<any[]>([]),bench=useRef<any>(null),last=useRef(performance.now()),gpu=useRef<number|null>(null),query=useRef(false),lastQuery=useRef(0),reported=useRef(false),clock=useRef<number|null>(null);
  useEffect(()=>{if(benchRequest>0&&ready){bench.current={started:performance.now(),samples:[]};diag.benchmark={status:'running'};}},[benchRequest,ready]);
  useFrame(({gl,scene,camera})=>{
    const renderer=gl as unknown as WebGPURenderer,now=performance.now();
    const frameMs=clock.current===null?null:now-clock.current;clock.current=now;
    const start=performance.now();renderer.render(scene,camera);const cpuSubmitMs=performance.now()-start;
    diag.frames++;diag.camera={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),near:camera.near,far:camera.far};
    if((renderer.backend as any).trackTimestamp&&!query.current&&now-lastQuery.current>250){query.current=true;lastQuery.current=now;void renderer.resolveTimestampsAsync('render').then((v:any)=>{gpu.current=Number.isFinite(v)?v:null;}).catch(()=>{gpu.current=null;}).finally(()=>{query.current=false;});}
    const s=avatar.current?.getStatus();
    if(ready&&frameMs!==null&&document.visibilityState==='visible'){
      const sample={frameMs,cpuSubmitMs,avatarUpdateMs:s?.cpuUpdateMs??0,gpuMs:gpu.current};buffer.current.push(sample);
      if(bench.current)bench.current.samples.push(sample);
    }
    if(now-last.current>1000){last.current=now;
      diag.metrics={...summarizeSamples(buffer.current),rendererMemory:{...renderer.info.memory},drawCalls:renderer.info.render.drawCalls,renderedTriangles:renderer.info.render.triangles,
        jsHeapBytes:(performance as any).memory?.usedJSHeapSize??null,canvas:[renderer.domElement.width,renderer.domElement.height],dpr:renderer.getPixelRatio(),cameraDistance:camera.position.distanceTo(new Vector3(0,.95,0)),timestampSupported:!!(renderer.backend as any).trackTimestamp};
      diag.avatar={...s,weights:s?.weights,inventory:inventoryAvatar(avatar.current?.getRoot()),rootPosition:avatar.current?.getRoot()?.getWorldPosition(new Vector3()).toArray()};buffer.current=[];
      if(bench.current){diag.benchmark={status:'running',elapsedSeconds:(now-bench.current.started)/1000};
        if(now-bench.current.started>=10000){const report={date:new Date().toISOString(),kind:'single-avatar-visible-page-10s',...summarizeSamples(bench.current.samples),renderer:diag.renderer,metrics:diag.metrics,inventory:diag.avatar.inventory,handRig:s?.hands,clothing:s?.clothing,hardware:{cores:navigator.hardwareConcurrency,memoryGiB:(navigator as any).deviceMemory??null,userAgent:navigator.userAgent},notes:['CPU timings are JS update and render submission, not OS utilization.','GPU time is timestamp-query render pass time when supported.','Renderer GPU memory is tracked allocations, not total VRAM or process RAM.']};diag.benchmark={status:'complete',report};bench.current=null;onBenchmark(report);}}
    }
    if(ready&&!reported.current&&diag.frames>3){reported.current=true;void window.alamr?.runtime.ready();}
  },1);return null;
}
const fmt=(v:number|undefined|null,n=1)=>Number.isFinite(v)?v!.toLocaleString('fa-IR',{maximumFractionDigits:n}):'—';
const mb=(v:number|undefined|null)=>Number.isFinite(v)?fmt(v!/1048576)+' MiB':'—';
function saveReport(report:any){const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='avatar-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}

export function App(){
  const avatar=useRef<AvatarHybridHandle|null>(null),world=useRef<Group|null>(null),controls=useRef<any>(null);
  const [controller]=useState(()=>createPlayerController({position:[0,0,0],yaw:0}));
  const [ready,setReady]=useState(false),[view,setView]=useState('body'),[angle,setAngle]=useState('front'),[request,setRequest]=useState(0),[drive,setDrive]=useState(false);
  const [tab,setTab]=useState('hands'),[emotion,setEmotion]=useState('neutral'),[pose,setPose]=useState('auto'),[side,setSide]=useState<'both'|'left'|'right'>('both');
  const [curls,setCurls]=useState<Record<string,number>>({}),[stats,setStats]=useState<any>({...diag}),[cost,setCost]=useState<any>(null),[benchRequest,setBenchRequest]=useState(0),[report,setReport]=useState<any>(null);
  const [quality,setQuality]=useState(1.5),[shadows,setShadows]=useState(true),[intensity,setIntensity]=useState(.75),[isolated,setIsolated]=useState(false);
  useEffect(()=>{
    const timer=setInterval(()=>{setStats({...diag});const p=document.getElementById('avatar-studio-evidence');if(p)p.textContent=JSON.stringify({...diag,modelCost:cost},null,2);},500);
    return ()=>clearInterval(timer);
  },[cost]);
  useEffect(()=>{void fetch(url('asset-cost.json')).then(r=>r.ok?r.json():null).then(setCost).catch(()=>{});
    void window.alamr?.runtime.progress({ratio:.05});const f=requestAnimationFrame(()=>{void window.alamr?.runtime.painting();});return ()=>cancelAnimationFrame(f);
  },[]);
  const onReady=useCallback(()=>{avatar.current?.setEmotion('neutral');avatar.current?.setIntensity(.75);avatar.current?.setFaceOptions({blinkEnabled:true,gazeEnabled:false,microEnabled:true});diag.ready=true;setReady(true);void window.alamr?.runtime.progress({ratio:.85});},[]);
  const onError=useCallback((e:Error)=>{diag.errors.push(e.message);},[]);
  const release=useCallback(()=>{controller.resetInput();avatar.current?.previewClip(null);avatar.current?.setPlayback({paused:false,timeScale:1});avatar.current?.setLocomotion({state:'idle',grounded:true,horizontalSpeed:0,verticalSpeed:0});},[controller]);
  const inspect=useCallback((next:string)=>{release();if(next==='left'||next==='right'||next==='face'||next==='neckline'){avatar.current?.previewClip('Stand');avatar.current?.setPlayback({paused:true});avatar.current?.seekClip(0);}setDrive(false);setView(next);diag.view=next;setAngle('front');setRequest(v=>v+1);},[release]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.target as HTMLElement)?.matches('input,select,textarea'))return;if(drive&&['KeyW','KeyA','KeyS','KeyD','Space','KeyF'].includes(e.code)){avatar.current?.previewClip(null);avatar.current?.setPlayback({paused:false,timeScale:1});}};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);},[drive]);
  const clip=(name:string)=>{controller.resetInput();avatar.current?.previewClip(name as any);avatar.current?.setPlayback({paused:false});};
  const choosePose=(value:string)=>{setPose(value);setCurls({});avatar.current?.setHandPose(value,side);};
  const metrics=stats.metrics,inv=stats.avatar?.inventory;
  useEffect(()=>{const r=avatar.current?.getRuntime();if(!r)return;r.root.traverse((n:any)=>{if(n.isMesh)n.visible=!(isolated&&(view==='left'||view==='right'))||n.name===(view==='left'?'DetailedLeftHand':'DetailedRightHand');});},[isolated,view,ready]);
  return <main className="avatar-studio"><section className="studio-view" aria-label="آواتار اصلی با چهرهٔ ارتقایافته">
    <Boundary><Canvas shadows={shadows} dpr={quality} camera={{position:[0,1,4.4],fov:32,near:.008,far:100}} gl={createRenderer}>
      <color attach="background" args={['#dce1df']}/><hemisphereLight args={['#f6f3ee','#69716c',1.5]}/>
      <directionalLight position={[1.5,4,5]} intensity={2.6} castShadow={shadows} shadow-mapSize={[2048,2048]} shadow-normalBias={.006}/>
      <directionalLight position={[-3,2,2]} intensity={.7} color="#e6eeff"/><directionalLight position={[2,3,-3]} intensity={1.3} color="#fff1df"/>
      <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[100,100]}/><meshStandardMaterial color="#d0d6d2" roughness={.92}/></mesh>
      {drive&&<PlayerRig controller={controller} navigation={nav} movement={movement} avatar={<></>} onAnimationFrame={v=>avatar.current?.setLocomotion(v)} camera={{initialDistance:4.4,minDistance:.5,maxDistance:20,targetHeight:.95}}/>}
      <group ref={world}><WorldPose controller={controller} group={world} drive={drive}/><Suspense fallback={null}>
        <AvatarHybrid ref={avatar} controller={controller} navigation={nav} rotationY={0} legacyModelUrl={url('avatar-hybrid/legacy.gltf')} textureUrl={url('avatar-hybrid/image-0.png')}
          modelUrl={url('avatar-v2/avatar.gltf')} motionsUrl={url('avatar-v2/motions.json')} faceAlbedoUrl={url('appearance/face-albedo.png')} onReady={onReady} onError={onError}/>
      </Suspense></group>
      {!drive&&<><OrbitControls ref={controls} makeDefault minDistance={.08} maxDistance={20} enableDamping dampingFactor={.15}/><InspectionCamera avatar={avatar} controls={controls} view={view} angle={angle} request={request} ready={ready}/></>}
      <Monitor avatar={avatar} ready={ready} benchRequest={benchRequest} onBenchmark={setReport}/>
    </Canvas></Boundary>
    <div className="studio-brand">AL-AMR <span>AVATAR STUDIO</span></div>
    <div className="studio-badge">{ready?'آواتار آماده است':'آماده‌سازی آواتار…'} · {stats.renderer}</div>
    <div className="live-strip"><span>{fmt(metrics?.fps,0)} FPS</span><span>{fmt(metrics?.frameMs)} ms / frame</span><span>GPU: {mb(metrics?.rendererMemory?.total)}</span></div>
    <p className="studio-tip">{drive?'WASD حرکت · Shift دویدن · Space پرش · F پرواز':'ماوس: چرخش · غلتک: زوم · دکمهٔ راست: جابه‌جایی قاب'}</p>
  </section><aside className="studio-panel"><header><small>آواتار اصلی · نسخهٔ محلی</small><h1>چهرهٔ تازه،<br/>دست‌های دقیق‌تر</h1><p>همان بدن و لباس، با کنترل مستقل هر پنج انگشت.</p></header>
    {stats.errors.length>0&&<p role="alert" className="studio-alert">{stats.errors.join(' / ')}</p>}
    <div className="studio-grid">{Object.entries({body:'تمام‌قد',face:'چهره',left:'دست چپ',right:'دست راست',neckline:'نمای نزدیک یقه'}).map(([key,label])=><button key={key} aria-pressed={!drive&&view===key} onClick={()=>inspect(key)}>{label}</button>)}</div>
    <div className="studio-angles">{Object.entries({front:'روبه‌رو',quarter:'سه‌رخ',side:'نیم‌رخ',back:'پشت'}).map(([key,label])=><button key={key} aria-pressed={angle===key} onClick={()=>{setAngle(key);setRequest(v=>v+1);}}>{label}</button>)}</div>
    <nav className="studio-tabs">{Object.entries({hands:'دست و انگشت',face:'چهره و حرکت',resources:'منابع سیستم'}).map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</nav>
    <div hidden={tab!=='hands'}><label className="studio-check"><input type="checkbox" checked={isolated} onChange={e=>setIsolated(e.target.checked)}/>نمای مستقل دست برای بررسی کف و پشت</label><h2>حالت دست‌ها</h2><div className="studio-grid">{Object.entries(poses).map(([key,label])=><button key={key} aria-pressed={pose===key} disabled={!ready} onClick={()=>choosePose(key)}>{label}</button>)}</div>
      <label className="studio-select">اعمال روی <select value={side} onChange={e=>{setSide(e.target.value as any);setCurls({});}}><option value="both">هر دو دست</option><option value="left">دست چپ</option><option value="right">دست راست</option></select></label>
      <h2>خم‌شدن هر انگشت</h2>{Object.entries(digits).map(([key,label])=><label className="studio-range" key={key}>{label}<output>{fmt((curls[key]??stats.avatar?.hands?.hands[side==='right'?'right':'left']?.curl[key]??0)*100,0)}٪</output><input aria-label={'خم‌شدن '+label} type="range" min="0" max="1" step=".02" value={curls[key]??stats.avatar?.hands?.hands[side==='right'?'right':'left']?.curl[key]??0} onChange={e=>{const n=Number(e.target.value);setCurls(v=>({...v,[key]:n}));avatar.current?.setFingerCurl(side,key,n);}}/></label>)}
      <p className="studio-note">پنج انگشت با سه بند متحرک در هر دست. حرکت مچ همراه بدن است؛ اسلایدرها واقعاً ریگ انگشتان را تغییر می‌دهند.</p>
    </div>
    <div hidden={tab!=='face'}><h2>احساس چهره</h2><div className="studio-grid">{Object.entries(feelings).map(([key,label])=><button key={key} aria-pressed={emotion===key} onClick={()=>{setEmotion(key);avatar.current?.setEmotion(key as any);}}>{label}</button>)}</div>
      <label className="studio-range">شدت احساس<output>{fmt(intensity*100,0)}٪</output><input aria-label="شدت احساس" type="range" min="0" max="1" step=".05" value={intensity} onChange={e=>{setIntensity(+e.target.value);avatar.current?.setIntensity(+e.target.value);}}/></label><button className="studio-wide" onClick={()=>avatar.current?.blink()}>یک پلک</button>
      <h2>حرکت بدن</h2><div className="studio-grid">{Object.entries({Stand:'ایستاده',Walk:'راه‌رفتن',Run:'دویدن',HandRaise:'بالابردن دست',Sitting:'نشسته',Fly:'پرواز'}).map(([key,label])=><button key={key} onClick={()=>clip(key)}>{label}</button>)}</div>
      <button className="studio-wide" aria-pressed={drive} onClick={()=>{release();setDrive(v=>!v);}}>کنترل با صفحه‌کلید {drive?'· روشن':'· خاموش'}</button>
      <SpeechPanel avatar={avatar} ready={ready} onInspect={()=>inspect('face')}/>
    </div>
    <div hidden={tab!=='resources'}><h2>پایش زندهٔ همین اجرا</h2><dl className="metrics">
      <dt>نرخ نمایش</dt><dd>{fmt(metrics?.fps,0)} FPS</dd><dt>میانگین هر فریم</dt><dd>{fmt(metrics?.frameMs)} ms</dd><dt>فریم کندتر · صدک ۹۵</dt><dd>{fmt(metrics?.p95Ms)} ms</dd>
      <dt>CPU · به‌روزرسانی آواتار</dt><dd>{fmt(metrics?.avatarUpdateMs,2)} ms</dd><dt>CPU · ارسال رندر</dt><dd>{fmt(metrics?.cpuSubmitMs,2)} ms</dd><dt>GPU · زمان رندر</dt><dd>{metrics?.gpuMs==null?'پشتیبانی نشده':fmt(metrics.gpuMs,2)+' ms'}</dd>
      <dt>حافظهٔ GPU ثبت‌شدهٔ صحنه</dt><dd>{mb(metrics?.rendererMemory?.total)}</dd><dt>بافت‌های GPU</dt><dd>{mb(metrics?.rendererMemory?.texturesSize)}</dd><dt>حافظهٔ JS صفحه</dt><dd>{mb(metrics?.jsHeapBytes)}</dd>
      <dt>مثلث‌های آواتار</dt><dd>{fmt(inv?.triangles,0)}</dd><dt>رأس‌های آواتار</dt><dd>{fmt(inv?.vertices,0)}</dd><dt>بافر هندسهٔ آواتار</dt><dd>{mb(inv?.geometryBytes)}</dd><dt>فرمان رسم صحنه</dt><dd>{fmt(metrics?.drawCalls,0)}</dd><dt>بوم رندر</dt><dd>{metrics?.canvas?.join(' × ')??'—'}</dd>
      <dt>فایل‌های مدل و بافت و حرکت</dt><dd>{mb(cost?.model?.bytes)}</dd><dt>مدل‌ها و موتور اختیاری گفتار</dt><dd>{mb(cost?.speech?.bytes)}</dd><dt>کل بستهٔ محیط</dt><dd>{mb(cost?.bundle?.bytes)}</dd>
    </dl><p className="studio-note">اعداد CPU زمان اجرای کد هستند. حافظهٔ GPU، تخصیص‌های ثبت‌شدهٔ این صحنه است؛ درصد مصرف کل CPU/GPU یا کل RAM سیستم از مرورگر گزارش نمی‌شود. فایل گفتار فقط هنگام فعال‌سازی بارگذاری می‌شود.</p>
      <label className="studio-select">تراکم پیکسل <select value={quality} onChange={e=>setQuality(+e.target.value)}><option value="1">۱ · سبک‌تر</option><option value="1.5">۱٫۵ · متعادل</option><option value="2">۲ · دقیق‌تر</option></select></label>
      <label className="studio-check"><input type="checkbox" checked={shadows} onChange={e=>setShadows(e.target.checked)}/>سایه‌ها</label>
      <button className="studio-wide" disabled={!ready||stats.benchmark?.status==='running'} onClick={()=>setBenchRequest(v=>v+1)}>اندازه‌گیری ۱۰ ثانیه‌ای</button>
      {stats.benchmark?.status==='running'&&<p role="status">در حال اندازه‌گیری… {fmt(stats.benchmark.elapsedSeconds??0,0)} ثانیه</p>}
      {report&&<><p role="status">نتیجه: {fmt(report.fps,0)} FPS · صدک ۹۵: {fmt(report.p95Ms)} ms</p><button className="studio-wide" onClick={()=>saveReport({...report,assetCost:cost})}>ذخیرهٔ گزارش JSON</button></>}
    </div>
    <details className="studio-evidence"><summary>جزئیات فنی اجرا</summary><pre id="avatar-studio-evidence" dir="ltr"/></details>
  </aside></main>;
}
