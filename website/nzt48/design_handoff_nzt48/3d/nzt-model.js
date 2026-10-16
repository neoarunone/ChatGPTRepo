import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { applyNZTStudioMaterials } from './studio-lighting.js?v=v2-20261017d';

/** Static model loader. No AnimationMixer, embedded clips, or running timeline.
 * All positions are meters; animate the returned groups with your own code.
 */
export async function loadNZT(scene, {
  bottleUrl = './nzt48-bottle-cap.glb',
  pillUrl = './nzt48-gold-pill-pbr.glb',
} = {}) {
  const loader = new GLTFLoader();
  const [bottleGLTF, pillGLTF] = await Promise.all([
    loader.loadAsync(bottleUrl),
    pillUrl ? loader.loadAsync(pillUrl) : Promise.resolve(null),
  ]);
  const model = bottleGLTF.scene.getObjectByName('NZT48Product');
  const bottle = model?.getObjectByName('Bottle');
  const cap = model?.getObjectByName('Cap');
  if (!model || !bottle || !cap) throw new Error('Missing NZT48Product, Bottle, or Cap group.');
  const borrowedEnvironment = scene.environment;
  applyNZTStudioMaterials(model, borrowedEnvironment);
  scene.add(model);
  const pillTemplate = pillGLTF?.scene.getObjectByName('GoldPill');
  if (pillTemplate) applyNZTStudioMaterials(pillTemplate, borrowedEnvironment);
  const capClosed = { position: cap.position.clone(), quaternion: cap.quaternion.clone() };
  const createdPills = [];
  const yAxis = new THREE.Vector3(0, 1, 0), twist = new THREE.Quaternion();

  function resetCap() {
    cap.position.copy(capClosed.position);
    cap.quaternion.copy(capClosed.quaternion);
  }

  // Optional mechanical recipe. Call from your own GSAP/scroll/frame timeline,
  // or animate cap.position and cap.quaternion directly instead.
  function setCapOpening(progress, { turns = 1.75, pitch = 0.00238, lift = 0.038 } = {}) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const unscrew = THREE.MathUtils.clamp(p / 0.42, 0, 1);
    const rise = THREE.MathUtils.clamp((p - 0.42) / 0.58, 0, 1);
    cap.position.copy(capClosed.position);
    cap.position.y += unscrew * turns * pitch + rise * lift;
    twist.setFromAxisAngle(yAxis, unscrew * Math.PI * 2 * turns);
    cap.quaternion.copy(capClosed.quaternion).multiply(twist);
  }

  // Clone one pill asset. Geometry, materials and textures are shared.
  // Default parent is the product; pass scene to animate in world space.
  function createPill(parent = model) {
    if (!pillTemplate) throw new Error('Load a pillUrl before calling createPill().');
    const pill = pillTemplate.clone(true);
    pill.name = `GoldPill_${createdPills.length + 1}`;
    parent.add(pill);
    createdPills.push(pill);
    return pill;
  }

  function dispose() {
    scene.remove(model);
    for (const pill of createdPills) pill.removeFromParent();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    for (const root of [model, pillTemplate, ...createdPills].filter(Boolean)) {
      root.traverse(object => {
        if (!object.isMesh) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value?.isTexture && value !== borrowedEnvironment) textures.add(value);
          }
        }
      });
    }
    for (const item of geometries) item.dispose();
    for (const item of materials) item.dispose();
    for (const item of textures) item.dispose();
  }

  return { model, bottle, cap, capClosed, pillTemplate, createPill, setCapOpening, resetCap, dispose };
}
