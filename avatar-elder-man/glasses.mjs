import { CatmullRomCurve3, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from 'three';

// Head-space metres. Clear openings preserve visible eye motion without
// refractive render passes or an opaque painted lens on the animated face.
export function mountGlasses(mount) {
  const group=new Group();group.name='ElderGlasses';
  const material=new MeshStandardMaterial({color:'#302e2a',roughness:.40,metalness:.04});
  const geometries=[];
  const tube=(name,points,radius,closed=false)=>{
    const curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p)),closed,'centripetal');
    const geometry=new TubeGeometry(curve,closed?72:32,radius,8,closed);
    geometries.push(geometry);
    const mesh=new Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;group.add(mesh);
  };
  const outline=[[-.025,.016],[-.019,.021],[.019,.020],[.027,.014],[.025,-.013],[.015,-.021],[-.015,-.021],[-.024,-.014]];
  const rim = sign => outline.map(([x,y])=>[sign*(.038+x),.049+y*.80,.139-Math.max(0,x)*.15]);
  const arms = [
    [.079,.061,.105], [.081,.061,.060], [.084,.064,.045],
    [.088,.067,.029], [.091,.067,.021], [.087,.065,.008],
    [.0835,.059,-.003], [.081,.051,-.010], [.079,.043,-.015],
  ];
  for (const sign of [-1, 1]) {
    const frame = rim(sign);
    tube('ElderFrame'+sign,frame,.00165,true);
    // The arm rises over the helix before dropping behind the ear.
    tube('ElderTemple'+sign,[frame[3], ...arms.map(([x,y,z])=>[sign*x,y,z])],.0016);
  }
  // Both bridge ends share the inner rim centerlines in all three axes.
  tube('ElderBridge',[rim(-1)[0],[-.007,.065,.1425],[.007,.065,.1425],rim(1)[0]],.0017);
  mount.add(group);
  return ()=>{group.removeFromParent();geometries.forEach(g=>g.dispose());material.dispose();};
}
