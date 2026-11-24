import {makeClothingDetails,warpGarment} from '../avatar-olive-man/tailoring.mjs';
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
export function tailorBody(body){
  warpGarment(body,(x,y,z,out)=>{
    const torso=smooth(.0005,.0016,y)*(1-smooth(.0044,.0056,y))*(1-smooth(.0016,.0022,Math.abs(x)));
    const belly=smooth(.00065,.0015,y)*(1-smooth(.0027,.0042,y));
    const hem=smooth(.00018,.00065,y)*(1-smooth(.00092,.00165,y))*(1-smooth(.0016,.00215,Math.abs(x)));
    const waist=smooth(-.005,-.001,y)*(1-smooth(.001,.004,y))*(1-smooth(.002,.003,Math.abs(x)));
    return out.set(x*(1+.045*torso),y-.00060*waist-.00012*hem,z+.000080*belly*smooth(.0001,.0007,z));
  });
}
export function makeDetails(body) {
  return makeClothingDetails(body, {
    name: 'ElderClothingDetails',
    drawCollar: null,
    laces: ['#645047', '#4d3c32'],
    crossedLaces: true,
  });
}
