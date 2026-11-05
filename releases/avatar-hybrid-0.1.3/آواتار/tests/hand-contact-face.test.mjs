import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,PerspectiveCamera,Vector3} from 'three';
import {loadHybridAssets} from './load-hybrid-assets.mjs';
import {createHybridRuntime} from '../dist/hybrid/runtime.mjs';

const assets=await loadHybridAssets();
const create=()=>createHybridRuntime(assets.legacy,assets.web,assets.motions);
const frame={pose:{position:[0,0,0],velocity:[0,0,0],yaw:0,mode:'grounded'},
  locomotion:{state:'idle',grounded:true,horizontalSpeed:0,verticalSpeed:0},camera:new PerspectiveCamera()};
const depth=values=>Math.max(...Object.values(values).map(v=>v.penetration));

test('hand contact clears the reported Stand overlap and stays attached in animated clips',async()=>{
  const r=await create();
  const host=new Group();host.position.set(3,1,-2);host.rotation.y=1.2;host.add(r.root);
  try{
    let worstBefore=0,worstAfter=0,contacts=0;
    for(const [clip,c] of r.body.clips)for(let i=0;i<=12;i++){
      const at=c.duration*i/12;
      r.handContact.restore(true);r.body.sample(clip,at);r.hands.update(0);
      const before=depth(r.handContact.measure(true));
      worstBefore=Math.max(worstBefore,before);if(before>.005)contacts++;
      const elbow=r.body.bones.get('leftforearm'),wrist=r.body.bones.get('lefthand');
      const length=elbow.getWorldPosition(new Vector3()).distanceTo(wrist.getWorldPosition(new Vector3()));
      r.handContact.solve(0);const after=depth(r.handContact.measure(true));
      worstAfter=Math.max(worstAfter,after);
      assert.ok(Math.abs(elbow.getWorldPosition(new Vector3()).distanceTo(wrist.getWorldPosition(new Vector3()))-length)<1e-7);
      assert.ok(r.hands.hands.left.mesh.getWorldPosition(new Vector3()).distanceTo(wrist.getWorldPosition(new Vector3()))<1e-7);
    }
    assert.ok(worstBefore>.025&&contacts>10,'the fixture must exercise real close-contact poses');
    assert.ok(worstAfter<.004&&worstAfter<worstBefore/10);
    r.previewClip('Stand');r.setPlayback({paused:true});r.seekClip(0);
    for(let i=0;i<120;i++)r.update(1/60,frame);
    assert.ok(depth(r.handContact.measure(true))<.004,'repeated updates cannot accumulate an offset');
    assert.ok(r.handContact.getStatus().hands.left.angle<.12,'standing stays relaxed');
  }finally{r.dispose();}
});

test('the friendly face moves the real brows and has distinct smile and laugh levels',async()=>{
  const r=await create();
  try{
    r.previewClip('Stand');r.setPlayback({paused:true});
    r.setFaceOptions({blinkEnabled:false,gazeEnabled:false,microEnabled:false});r.setIntensity(.75);
    const binding=name=>r.face.bindings.find(b=>b.node.name==='AvatarHead'&&b.normalized===name);
    const sample=b=>{
      const attr=b.node.geometry.morphAttributes.position[b.index];
      let best=0;for(let i=1;i<attr.count;i++)if(Math.abs(attr.getY(i))>Math.abs(attr.getY(best)))best=i;
      return ()=>b.node.getVertexPosition(best,new Vector3()).applyMatrix4(b.node.matrixWorld);
    };
    const brow=sample(binding('browouterupleft')),corner=sample(binding('mouthsmileleft'));
    r.setInspectionFace({});r.update(0,frame);const originalBrow=brow(),originalCorner=corner();
    const states={};
    for(const name of ['neutral','smile','laugh']){
      r.setEmotion(name);for(let i=0;i<28;i++)r.update(.05,frame);
      states[name]={brow:brow(),corner:corner(),weights:r.getStatus().weights};
    }
    assert.ok(states.neutral.brow.y>originalBrow.y+.0005,'neutral raises the actual brow');
    assert.ok(states.neutral.corner.distanceTo(originalCorner)>.0003,'neutral has a real, slight smile');
    assert.ok(states.smile.corner.distanceTo(states.neutral.corner)>.0015);
    assert.ok(states.laugh.corner.distanceTo(states.smile.corner)>.0015);
    assert.ok(states.laugh.weights.jawOpen>states.smile.weights.jawOpen+.2);
    assert.equal(r.getStatus().morphCount,66);
  }finally{r.dispose();}
});
