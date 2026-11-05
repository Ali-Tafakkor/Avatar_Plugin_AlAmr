import {AnimationClip,AnimationMixer,Quaternion,QuaternionKeyframeTrack,Vector3,VectorKeyframeTrack} from 'three';

export const QUIET_IDLE = Object.freeze({
  periodSeconds:12,breathPeriodSeconds:4,headYawDegrees:1,neckYawDegrees:.2,
  chestWidthExpansion:.0035,chestDepthExpansion:.0035,
});

/** An instance-local Stand clip. Keep the authored Stand0 stance, replacing
 * its large motion with slow yaw and a tiny chest expansion. Other clips and
 * loader-cached tracks remain untouched, so the normal mixer owns transitions. */
export function createQuietStandClip(stand, model) {
  const sampler=new AnimationMixer(model);
  sampler.clipAction(stand).play();sampler.update(0);model.updateWorldMatrix(true,true);
  const duration=QUIET_IDLE.periodSeconds, times=Float32Array.from({length:145},(_,i)=>i*duration/144);
  const up=new Vector3(0,1,0), axis=new Vector3(), q=new Quaternion(), delta=new Quaternion();
  const tracks=stand.tracks.map(track=>{
    const initial=Array.from(track.createInterpolant().evaluate(0));
    const dot=track.name.lastIndexOf('.'), name=track.name.slice(0,dot), property=track.name.slice(dot+1);
    const bone=model.getObjectByName(name), clean=name.toLowerCase().replace(/mixamorig|[^a-z0-9]/g,'');
    if(property==='quaternion'&&bone&&(clean==='head'||clean==='neck')){
      axis.copy(up).applyQuaternion(bone.parent.getWorldQuaternion(q).invert()).normalize();
      const amplitude=(clean==='head'?QUIET_IDLE.headYawDegrees:QUIET_IDLE.neckYawDegrees)*Math.PI/180;
      const base=new Quaternion().fromArray(initial), values=[];
      for(const t of times){
        delta.setFromAxisAngle(axis,amplitude*Math.sin(2*Math.PI*t/duration));
        q.copy(base).premultiply(delta).normalize();values.push(q.x,q.y,q.z,q.w);
      }
      return new QuaternionKeyframeTrack(track.name,times,values);
    }
    if((property==='scale'&&clean==='spine2') || ((property==='position'||property==='scale')&&clean==='neck')){
      const values=[];
      for(const t of times){
        const inhale=.5-.5*Math.cos(2*Math.PI*t/QUIET_IDLE.breathPeriodSeconds);
        const expansion=1+QUIET_IDLE.chestWidthExpansion*inhale;
        // Uniform chest expansion keeps arm constraints length preserving.
        // Counter-scale the neck branch and its offset so breathing does not
        // bob or resize the expressive head.
        const factor=clean==='spine2'?expansion:1/expansion;
        values.push(initial[0]*factor,initial[1]*factor,initial[2]*factor);
      }
      return new VectorKeyframeTrack(track.name,times,values);
    }
    const result=track.clone();
    result.times=Float32Array.of(0,duration);result.values=Float32Array.from([...initial,...initial]);
    return result;
  });
  sampler.stopAllAction();sampler.uncacheRoot(model);
  return new AnimationClip('Stand',duration,tracks);
}
