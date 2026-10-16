import * as THREE from './vendor/three.module.min.js';

/** HDR studio softboxes. Share this exact rig with the bottle and capsules. */
export function setupNZTStudio(renderer, scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const bottlePanels=[],capPanels=[];
  function softbox(list,center,w,h,power,color,softness=.06){
    const c=new THREE.Vector3(...center),n=c.clone().normalize();
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),n).normalize();
    const up=new THREE.Vector3().crossVectors(n,right).normalize();
    list.push({c,n,right,up,w,h,power,color,softness});
  }
  // Clean packshot rig (matched to the approved product photos): one big soft key left, a dimmer
  // soft fill right, a soft top box for the cap, thin neutral edge strips. Neutral white, no coloured kickers.
  softbox(bottlePanels,[-3.6,1.2,3.4],3.4,6,4.2,[1,.98,.95],.35); // Big soft key, left-front.
  softbox(bottlePanels,[3.8,1,2.6],2.6,6,2.2,[1,1,1],.35); // Soft fill, right.
  softbox(bottlePanels,[-1.6,.8,5],.5,6,2.4,[1,1,1],.2); // Gentle vertical strip, front-left (glass edge).
  softbox(bottlePanels,[2.4,.8,4.4],.4,6,1.4,[1,1,1],.2); // Gentle vertical strip, front-right.
  softbox(bottlePanels,[0,5.4,.6],4,2.4,3.4,[1,1,.98],.3); // Soft overhead box: cap top and shoulder.
  softbox(bottlePanels,[.4,1,-4],5,6,1.1,[1,.97,.92],.4); // Dim back wall, keeps the rim alive.
  // Cap only: tall strips with dark gaps, so the metal shows the photo's bright/dark vertical gold bands.
  for(const [x,z,w,power] of [[-4,2.4,2.2,5],[-.9,5,1.1,3],[3.4,3.4,2,4.2],[3.6,-3,2,1.8],[-4,-2.6,1.8,1.6]])
    softbox(capPanels,[x,1,z],w,8,power,[1,.98,.94],.45);
  softbox(capPanels,[0,5.4,.6],4,3,4,[1,1,.98],.3);
  const smooth=(x,s)=>{const t=THREE.MathUtils.clamp(x/s+.5,0,1);return t*t*(3-2*t);};
  const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
  function bake(panels,ambient,width=1536,height=768){
    const data=new Float32Array(width*height*4),ray=new THREE.Vector3(),hit=new THREE.Vector3();
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const phi=((x+.5)/width-.5)*Math.PI*2,el=((y+.5)/height-.5)*Math.PI;
      ray.set(Math.cos(el)*Math.cos(phi),Math.sin(el),Math.cos(el)*Math.sin(phi));
      const up=Math.max(ray.y,0),rgb=[ambient+.04*up,ambient*1.03+.04*up,ambient*1.17+.045*up];
      for(const p of panels){const dot=ray.dot(p.n);if(dot<=0)continue;hit.copy(ray).multiplyScalar(p.c.length()/dot).sub(p.c);
        const a=smooth(1-Math.abs(hit.dot(p.right))/(p.w*.5),p.softness),b=smooth(1-Math.abs(hit.dot(p.up))/(p.h*.5),p.softness),strength=a*b*p.power;
        for(let k=0;k<3;k++)rgb[k]+=strength*p.color[k];
      }
      const i=(y*width+x)*4;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=1;
    }
    const hdr=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
    hdr.mapping=THREE.EquirectangularReflectionMapping;hdr.needsUpdate=true;
    const target=pmrem.fromEquirectangular(hdr);hdr.dispose();return target;
  }
  const target=bake(bottlePanels,.07),capTarget=bake(capPanels,.03,1024,512);pmrem.dispose();
  target.texture.userData.capEnvironment=capTarget.texture;
  scene.environment=target.texture;
  const lights=[];
  const add=(color,power,xyz)=>{const light=new THREE.DirectionalLight(color,power);light.position.set(...xyz);scene.add(light);lights.push(light);};
  add(0xfffaf2,1.1,[-3,4,5]);add(0xffffff,.35,[4,1,3]);add(0xfff1dc,.6,[2,3,-4]);
  const fill=new THREE.HemisphereLight(0xfff4e6,0x0c0a0c,.22);scene.add(fill);lights.push(fill);
  return {environment:target.texture,dispose(){for(const light of lights)scene.remove(light);if(scene.environment===target.texture)scene.environment=null;target.dispose();capTarget.dispose();}};
}

export function applyNZTStudioMaterials(model, environment) {
  model.traverse(object => {
    if (!object.isMesh) return;
    const material=object.material;
    if(environment && !material.isMeshBasicMaterial)material.envMap=environment;
    if (material.name==='Reflective gold cap') {
      if(environment?.userData.capEnvironment)material.envMap=environment.userData.capEnvironment;
      // Warm satin gold like the product photos: deep brown-gold darks, soft vertical highlights, no chrome glare.
      material.color.set(0xf0b648);material.metalness=1;material.roughness=.2;material.envMapIntensity=1.2;if('clearcoat' in material){material.clearcoat=0;}
    } else if (material.name==='Glossy amber-black bottle') {
      material.color.set(0x110904);if('specularColor' in material)material.specularColor.set(0xffe6c8);if(material.attenuationColor)material.attenuationColor.set(0x2a1406);if('attenuationDistance' in material)material.attenuationDistance=Math.min(material.attenuationDistance,.04);if('transmission' in material)material.transmission=Math.min(material.transmission,.25);material.envMapIntensity=.55;material.roughness=.22;if('clearcoat' in material){material.clearcoat=.6;material.clearcoatRoughness=.22;}if('specularIntensity' in material)material.specularIntensity=.6;
    } else if (material.name==='Matte black label with gold foil') {
      material.envMapIntensity=.8;
    } else if (material.name==='Matte printed label') {
      material.envMapIntensity=.7;
    } else if (material.name==='Polished uniform gold') {
      // Orange gel capsule from the product photos: glossy, non-metallic.
      material.color.set(0xf28c12);material.metalness=0;material.roughness=.1;material.envMapIntensity=1.1;
    } else if (material.name.startsWith('Studio baked amber')) {
      material.toneMapped=false;
    } else if (material.name.startsWith('Studio golden amber')) {
      material.envMapIntensity=.8;
    }
  });
}
