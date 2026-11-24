import { mountHybridAppearance } from '../avatar-lab/src/hybrid-appearance.mjs';
import { stabilizeHandContact } from '../avatar-olive-man/hand-contact.mjs';
import { makeDetails, tailorBody } from './tailoring.mjs';
import { mountGlasses } from './glasses.mjs';
import {prepareFace} from './skin.mjs';
import {refineScalp} from './scalp.mjs';

const bell = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
export function shapePortrait({x,y,z}, result) {
  const side=Math.abs(x), front=bell(z,.105,.065);
  const jaw=bell(y,-.033,.030)*bell(side,.055,.035)*front;
  const cheek=bell(y,.006,.025)*bell(side,.060,.024)*front;
  const chin=bell(y,-.052,.020)*bell(x,0,.035)*front;
  const nose=bell(y,.018,.022)*bell(x,0,.020)*bell(z,.143,.026);
  const bridge=bell(y,.041,.025)*bell(x,0,.013)*bell(z,.130,.030);
  const brow=bell(y,.067,.011)*bell(side,.036,.025)*front;
  result.set(x*(1+.09*jaw+.042*cheek+.055*nose),
    y-.003*chin-.001*brow,
    z+.0025*cheek+.003*chin+.006*nose+.002*bridge+.0015*brow);
  // Keep a nonzero radial derivative so the inverse-transpose normal
  // transform remains defined on the scalp as well as on morph endpoints.
  const scalp=.96*smooth(.080,.113,y);
  if(scalp){
    const nx=x/.091,ny=(y-.089)/.105,nz=(z-.035)/.105;
    const r=Math.hypot(nx,ny,nz);
    result.x+=(nx/r*.091-result.x)*scalp;
    result.y+=(.089+ny/r*.105-result.y)*scalp;
    result.z+=(.035+nz/r*.105-result.z)*scalp;
  }
  return result;
}

export function applyElderAppearance(runtime, clothingAlbedo) {
  const restoreGeometry=refineScalp(runtime);
  const dispose = mountHybridAppearance(runtime, clothingAlbedo, {
    shape:shapePortrait,prepareFace,mountHeadDetails:mountGlasses,
    tailorBody,makeClothingDetails:makeDetails,stabilizeHandContact,
    clothingName:'Elder · taupe cotton shirt, charcoal trousers, brown leather shoes',
  });
  return ()=>{dispose();restoreGeometry();};
}
