import {Float32BufferAttribute,MathUtils} from 'three';
import {attribute,float,mix,smoothstep,texture,uv,vec2,vec3} from 'three/tsl';
import {outlineAt} from '../avatar-olive-man/hair.mjs';

// Height of the hairline in the sculpted head's frame. A rounded recession
// replaces the step where the forehead met the upper temples.
const hairline = [
  [0,.101], [.72,.101], [.90,.106], [1.03,.113], [1.17,.122],
  [1.34,.130], [1.51,.135], [1.66,.136], [1.85,.137], [Math.PI,.137],
];
export function prepareFace(head,points){
  const material=head.material;
  const original={colorNode:material.colorNode,roughnessNode:material.roughnessNode,thicknessColorNode:material.thicknessColorNode,normalScale:material.normalScale.clone()};
  // Generated atlas registration measured against the donor landmarks.
  // Correct the sampling only: the topology, eyelid UVs and normal map stay intact.
  const coordinate=vec2(uv().x,uv().y.sub(.038));
  const sampled=texture(material.map,coordinate).rgb;
  const bald=points.map(p=>{
    const angle=Math.abs(Math.atan2(p.x,p.z-.035));
    const temple=MathUtils.smoothstep(angle,.64,.89)*(1-MathUtils.smoothstep(angle,1.52,1.88));
    const edge=outlineAt(hairline,angle);
    return (p.y-edge)/MathUtils.lerp(.013,.008,temple);
  });
  head.geometry.setAttribute('elderBald',new Float32BufferAttribute(bald,1));
  const crown=smoothstep(0,1,attribute('elderBald','float'));
  // Remap both temples and the crown to a hair-free forehead patch in the
  // same atlas. Use an area of the texture so the skin retains pores and tone.
  const crownUV=vec2(uv().x.mul(.08).add(.46),uv().y.mul(.02).add(.18));
  const clean=texture(material.map,crownUV).rgb.mul(.94);
  material.colorNode=mix(sampled,clean,crown);
  material.normalScale.set(.04,.04);
  material.roughnessNode=float(.64);
  material.thicknessColorNode=vec3(.42,.16,.10).mul(float(1).sub(crown.mul(.15)));
  material.needsUpdate=true;
  return ()=>{Object.assign(material,original);head.geometry.deleteAttribute('elderBald');material.needsUpdate=true;};
}
