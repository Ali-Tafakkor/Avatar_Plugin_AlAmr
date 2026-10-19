/** The same prepared test courtyard for the single and comparison views. */
export function LabStage(){return <>
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
