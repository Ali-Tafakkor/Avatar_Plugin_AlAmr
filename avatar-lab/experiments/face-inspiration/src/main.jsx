import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Box3, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { AvatarHybrid } from '@al-amr-community/usr-20dfea67-47be-4f4a-b48c-02c5f210a079--avatar03';
import { createPlayerController, createFlatNavigationSurface } from '@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig';
import { applyMaterialStudy } from './material-study.mjs';
import './style.css';

const EMOTIONS = { neutral: 'خنثی', smile: 'لبخند', laugh: 'خنده', sad: 'ناراحتی', angry: 'عصبانیت', surprise: 'تعجب' };
const base = path => new URL('./' + path, document.baseURI).href;
const navigation = createFlatNavigationSurface(0);
const diagnostics = { ready: [false,false], frames: 0, emotion: 'neutral', intensity: 0.75, view: 'both',
  camera: {}, models: [], materialStudy: null, errors: [], speechMounted: false,
  provenance: 'local DreamFace-inspired material study, not a ChatAvatar generated asset' };
Object.defineProperty(window, 'avatarFaceReviewDiagnostics', { get: () => diagnostics });
const renderers = new WeakMap();
function createRenderer({canvas}) {
  if (!renderers.has(canvas)) renderers.set(canvas, (async()=>{ const r=new WebGPURenderer({canvas, antialias:true}); await r.init(); void window.alamr?.runtime.progress({ratio:.2}); return r; })());
  return renderers.get(canvas);
}
class Boundary extends Component {
  state = {error:null};
  static getDerivedStateFromError(error) { return {error:String(error)}; }
  componentDidCatch(error) { diagnostics.errors.push(String(error)); void window.alamr?.runtime.fail({code:'face_review_failed'}); }
  render() { return this.state.error ? <div className="error" role="alert">بارگذاری مقایسه انجام نشد: {this.state.error}</div> : this.props.children; }
}
function Actor({index, handle, onReady, showLabel}) {
  const controller = useMemo(()=>createPlayerController({position:[0,0,0],yaw:0}),[]);
  const skin = useLoader(TextureLoader, base('face-study/skin-albedo.png'));
  skin.colorSpace=SRGBColorSpace; skin.flipY=false;
  const study = useRef(null);
  const ready = useCallback(()=>{
    const r=handle.current.getRuntime();
    r.previewClip('Stand'); r.setPlayback({paused:true}); r.seekClip(0);
    r.setFaceOptions({blinkEnabled:true,gazeEnabled:false,microEnabled:true});
    if(index===1) { study.current=applyMaterialStudy(r,skin); diagnostics.materialStudy={changedMeshes:study.current.changedMeshes,geometryChanged:false}; }
    diagnostics.ready[index]=true;
    void window.alamr?.runtime.progress({ratio:diagnostics.ready.every(Boolean)?.85:.5});
    onReady(index);
  },[handle,index,onReady,skin]);
  useEffect(()=>()=>{ study.current?.dispose(); diagnostics.ready[index]=false; },[index]);
  return <group position={[index===0?-.62:.62,0,0]}>
    <AvatarHybrid ref={handle} controller={controller} navigation={navigation} rotationY={0}
      legacyModelUrl={base('avatar-hybrid/legacy.glb')} textureUrl={base('avatar-hybrid/texture.png')}
      modelUrl={base('avatar-v2/avatar.gltf')} motionsUrl={base('avatar-v2/motions.json')}
      onReady={ready} onError={e=>diagnostics.errors.push(String(e))}/>
    {showLabel && <Html position={[0,2.02,0]} center style={{pointerEvents:'none'}}><div className={'model-label '+(index===1?'new':'')}>{index===0?'چهرهٔ فعلی':'نمونهٔ محلی'}<small>{index===0?'نسخهٔ مرجع':'الهام‌گرفته از DreamFace'}</small></div></Html>}
  </group>;
}
function Camera({handles,controls,view,angle,distance,request,ready}) {
  const {camera}=useThree(); const signalled=useRef(false), lastProbe=useRef(0);
  useEffect(()=>{
    if(!ready.every(Boolean)||!controls.current) return;
    const points=handles.map(h=>{
      const root=h.current.getRoot(); root.updateWorldMatrix(true,true);
      const meshes=[...new Set(h.current.getRuntime().face.bindings.map(b=>b.node))];
      const box=new Box3(); for(const mesh of meshes) if(mesh.name==='AvatarHead') box.union(new Box3().setFromObject(mesh,true));
      return box.getCenter(new Vector3());
    });
    const focus=view==='reference'?points[0]:view==='study'?points[1]:points[0].clone().add(points[1]).multiplyScalar(.5);
    if(view==='body') focus.set(0,.95,0);
    const yaw=angle==='profile'?Math.PI/2:angle==='quarter'?Math.PI/4:0;
    const d=distance;
    camera.position.copy(focus).add(new Vector3(Math.sin(yaw)*d,.012,Math.cos(yaw)*d));
    controls.current.target.copy(focus); controls.current.update();
  },[camera,handles,controls,view,angle,distance,request,ready]);
  useFrame(()=>{
    diagnostics.frames++; diagnostics.view=view;
    diagnostics.camera={position:camera.position.toArray(),target:controls.current?.target.toArray(),distance:controls.current?.getDistance()};
    if(performance.now()-lastProbe.current>200){
      lastProbe.current=performance.now();
      diagnostics.models=handles.map(h=>{
        const s=h.current?.getStatus(); if(!s) return null;
        return {emotion:s.emotion,morphs:s.morphCount,weights:Object.fromEntries(['jawOpen','mouthSmileLeft','eyeBlinkLeft','browInnerUp','browDownLeft','mouthFrownLeft'].map(k=>[k,s.weights[k]??0]))};
      });
      const evidence=document.getElementById('face-review-evidence');
      if(evidence) evidence.textContent=JSON.stringify(diagnostics,null,2);
    }
    if(!signalled.current && diagnostics.ready.every(Boolean) && diagnostics.frames>3){ signalled.current=true; void window.alamr?.runtime.ready(); }
  });
  return null;
}
function App() {
  const reference=useRef(null),study=useRef(null),controls=useRef(null);
  const handles=useMemo(()=>[reference,study],[]);
  const [ready,setReady]=useState([false,false]),[emotion,setEmotion]=useState('neutral'),[intensity,setIntensity]=useState(.75);
  const [view,setView]=useState('both'),[angle,setAngle]=useState('front'),[distance,setDistance]=useState(2.65),[request,setRequest]=useState(0),[blink,setBlink]=useState(true);
  const onReady=useCallback(index=>setReady(v=>v.map((value,i)=>i===index?true:value)),[]);
  useEffect(()=>{
    void window.alamr?.runtime.progress({ratio:.05});
    const painted=requestAnimationFrame(()=>{void window.alamr?.runtime.painting();});
    return ()=>cancelAnimationFrame(painted);
  },[]);
  useEffect(()=>{ for(const h of handles){h.current?.setEmotion(emotion);h.current?.setIntensity(intensity);h.current?.setFaceOptions({blinkEnabled:blink,gazeEnabled:false,microEnabled:true});} diagnostics.emotion=emotion;diagnostics.intensity=intensity; },[emotion,intensity,blink,ready,handles]);
  const selectView=next=>{setView(next);setAngle('front');setDistance(next==='body'?4.6:next==='both'?2.65:.82);setRequest(v=>v+1);};
  const zoom=factor=>{setDistance(Math.max(.22,Math.min(7,(controls.current?.getDistance()??distance)*factor)));setRequest(v=>v+1);};
  return <main><div className="viewport"><Canvas shadows dpr={[1,1.5]} camera={{position:[0,1.65,2.65],fov:32,near:.012,far:60}} gl={createRenderer}>
    <color attach="background" args={['#dce1df']}/><hemisphereLight args={['#f6f3ee','#69716c',1.5]}/>
    <directionalLight position={[1.5,4,5]} intensity={2.6} castShadow shadow-mapSize={[2048,2048]} shadow-normalBias={.006}/>
    <directionalLight position={[-3,2,2]} intensity={.7} color="#e6eeff"/><directionalLight position={[2,3,-3]} intensity={1.3} color="#fff1df"/>
    <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[30,30]}/><meshStandardMaterial color="#d0d6d2" roughness={.92}/></mesh>
    <Suspense fallback={null}>{handles.map((handle,index)=><Actor key={index} index={index} handle={handle} onReady={onReady} showLabel={view==='both'||view==='body'}/>)}</Suspense>
    <OrbitControls ref={controls} makeDefault minDistance={.22} maxDistance={8} minPolarAngle={.15} maxPolarAngle={Math.PI-.15} enableDamping dampingFactor={.12}/>
    <Camera handles={handles} controls={controls} view={view} angle={angle} distance={distance} request={request} ready={ready}/>
  </Canvas><div className="stage-note">مقایسه با نور یکسان · بدن و لباس اصلی</div></div>
  <aside><p className="eyebrow">AL-AMR / FACE STUDY</p><h1>مقایسهٔ چهره</h1><p className="intro">نمونهٔ محلی برای بررسی پوست، چشم‌ها و احساسات؛ الهام‌گرفته از پژوهش DreamFace.</p>
    <div className="status" role="status">{ready.every(Boolean)?'هر دو چهره آماده‌اند':'آماده‌سازی مدل‌ها…'}</div>
    <h2>انتخاب نما</h2><div className="grid">{Object.entries({both:'هر دو چهره',reference:'نزدیک چهرهٔ فعلی',study:'نزدیک نمونهٔ محلی',body:'تمام‌قد'}).map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>selectView(key)}>{label}</button>)}</div>
    <div className="angle-row">{Object.entries({front:'روبه‌رو',quarter:'سه‌رخ',profile:'نیم‌رخ'}).map(([key,label])=><button key={key} aria-pressed={angle===key} onClick={()=>{setAngle(key);setRequest(v=>v+1);}}>{label}</button>)}</div>
    <div className="angle-row"><button onClick={()=>zoom(.8)}>نزدیک‌تر ＋</button><button onClick={()=>zoom(1.25)}>دورتر −</button></div>
    <p className="hint">با کشیدن ماوس دور چهره بچرخید؛ غلتک برای زوم و دکمهٔ راست برای جابه‌جایی قاب است.</p>
    <h2>احساس مشترک دو چهره</h2><div className="grid">{Object.entries(EMOTIONS).map(([key,label])=><button key={key} aria-pressed={emotion===key} onClick={()=>setEmotion(key)}>{label}</button>)}</div>
    <label className="range">شدت احساس <output>{Math.round(intensity*100).toLocaleString('fa-IR')}٪</output><input aria-label="شدت احساس" type="range" min="0" max="1" step=".05" value={intensity} onChange={e=>setIntensity(Number(e.target.value))}/></label>
    <button className="wide" onClick={()=>handles.forEach(h=>h.current?.blink())}>یک پلک برای هر دو</button>
    <label className="check"><input type="checkbox" checked={blink} onChange={e=>setBlink(e.target.checked)}/>پلک خودکار</label>
    <div className="notice">این نمونه با دارایی‌های خود پروژه ساخته شده و خروجی سرویس ChatAvatar نیست. نسخهٔ مرجع مستقل و محفوظ است.</div>
    <details className="evidence"><summary>وضعیت مقایسه</summary><pre id="face-review-evidence" dir="ltr"/></details>
  </aside></main>;
}
createRoot(document.getElementById('root')).render(<Boundary><App/></Boundary>);
