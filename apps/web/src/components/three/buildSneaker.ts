import * as THREE from 'three';
import { HEEL_TAB, LACES, SOLE, STRIPE, TOE_CAP, TONGUE, UPPER, type Cmd } from '@/lib/sneaker/geometry';
import type { SneakerPalette } from '@/lib/sneaker/palette';

/**
 * Procedural 3D sneaker built from the same path data as the flat SVG art
 * (lib/sneaker/geometry.ts). Each part is its own mesh so the scroll
 * choreography can "explode" the shoe into its components.
 */

const S = 0.16; // svg units -> world units (shoe is ~21 long)
const CX = 65;
const GROUND = 58;

function toShape(cmds: Cmd[]): THREE.Shape {
  const shape = new THREE.Shape();
  const X = (x: number) => (x - CX) * S;
  const Y = (y: number) => (GROUND - y) * S;
  for (const c of cmds) {
    if (c[0] === 'M') shape.moveTo(X(c[1]), Y(c[2]));
    else if (c[0] === 'L') shape.lineTo(X(c[1]), Y(c[2]));
    else if (c[0] === 'C') shape.bezierCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6]));
    else shape.closePath();
  }
  return shape;
}

function extrude(cmds: Cmd[], depth: number, bevel: number, segments = 8): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(toShape(cmds), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel * 0.55,
    bevelSegments: segments,
    curveSegments: 40,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

export interface SneakerPart {
  name: string;
  object: THREE.Object3D;
  /** direction (world units) this part travels when fully exploded */
  explode: THREE.Vector3;
  base: THREE.Vector3;
}

export interface SneakerModel {
  group: THREE.Group;
  parts: SneakerPart[];
  signalMaterial: THREE.MeshStandardMaterial;
  coreGlowMaterial: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function buildSneaker(p: SneakerPalette): SneakerModel {
  const group = new THREE.Group();
  const parts: SneakerPart[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const add = (name: string, obj: THREE.Object3D, explode: [number, number, number]) => {
    group.add(obj);
    parts.push({ name, object: obj, explode: new THREE.Vector3(...explode), base: obj.position.clone() });
  };

  const upperMat = new THREE.MeshPhysicalMaterial(
    p.pearl
      ? {
          color: p.upper,
          roughness: 0.3,
          metalness: 0.32,
          clearcoat: 0.9,
          clearcoatRoughness: 0.18,
          envMapIntensity: 1.7,
          iridescence: 0.35,
          iridescenceIOR: 1.3,
          sheen: 0.6,
          sheenColor: new THREE.Color('#8fd6ff'),
          sheenRoughness: 0.4,
        }
      : { color: p.upper, roughness: 0.42, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.35 },
  );
  const accentMat = new THREE.MeshPhysicalMaterial(
    p.metal
      ? { color: p.accent, metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 3.6 }
      : { color: p.accent, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 },
  );
  const toeMat = new THREE.MeshPhysicalMaterial({ color: p.toe, roughness: 0.5, clearcoat: 0.25 });
  const heelMat = new THREE.MeshPhysicalMaterial(
    p.metal
      ? { color: p.heel, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 3.2 }
      : { color: p.heel, roughness: 0.4, clearcoat: 0.4 },
  );
  const soleMat = new THREE.MeshPhysicalMaterial(
    p.iceSole
      ? {
          color: '#eaf6ff',
          emissive: new THREE.Color('#8fd6ff'),
          emissiveIntensity: 0.4,
          roughness: 0.1,
          metalness: 0,
          transmission: 0.62,
          thickness: 2.4,
          ior: 1.31,
          attenuationColor: new THREE.Color('#8fd6ff'),
          attenuationDistance: 3.2,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          envMapIntensity: 1.6,
          transparent: true,
        }
      : { color: p.sole, roughness: 0.55, clearcoat: 0.15 },
  );
  const coreGlowMat = new THREE.MeshBasicMaterial({ color: '#8fd6ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const laceMat = new THREE.MeshStandardMaterial({ color: p.lace, roughness: 0.85 });
  const signalMat = new THREE.MeshStandardMaterial({
    color: '#0d3d2a',
    emissive: new THREE.Color('#2ef2a6'),
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.1,
  });
  disposables.push(upperMat, accentMat, toeMat, heelMat, soleMat, laceMat, signalMat, coreGlowMat);

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    disposables.push(geo);
    const m = new THREE.Mesh(geo, mat);
    return m;
  };

  // --- sole (widest, chunky) ---
  const sole = mesh(extrude(SOLE, 3.5, 0.4, 10), soleMat);
  add('sole', sole, [0, -1.6, 0]);

  if (p.iceSole) {
    // glowing core inside the glacier sole
    const core = mesh(new THREE.CapsuleGeometry(0.5, 12.5, 8, 24), coreGlowMat);
    core.rotation.z = Math.PI / 2;
    core.scale.set(1, 1, 2.6);
    core.position.set(0.4, 0.9, 0);
    add('core', core, [0, -1.3, 0]);
  }

  // midsole signal window (the "buy signal" capsule in the heel)
  const win = mesh(new THREE.CapsuleGeometry(0.26, 1.8, 8, 20), signalMat);
  win.rotation.z = Math.PI / 2;
  win.scale.set(1, 1, 2.1);
  win.position.set(-7.2, (GROUND - 52.4) * S, 0);
  add('signal', win, [-0.6, -1.3, 0]);

  // --- upper body ---
  const upper = mesh(extrude(UPPER, 2.9, 0.45, 12), upperMat);
  upper.position.z = 0;
  add('upper', upper, [0, 1.2, 0]);

  // overlays sit a hair wider than the upper so they read as panels
  const toe = mesh(extrude(TOE_CAP, 3.3, 0.5, 12), toeMat);
  toe.position.z = 0;
  add('toe', toe, [1.4, 0.7, 0]);

  const heel = mesh(extrude(HEEL_TAB, 3.3, 0.5, 12), heelMat);
  add('heel', heel, [-1.4, 0.7, 0]);

  const stripe = mesh(extrude(STRIPE, 3.9, 0.32, 8), accentMat);
  add('stripe', stripe, [0, 0.6, 1.5]);

  const tongue = mesh(extrude(TONGUE, 1.9, 0.5, 8), upperMat);
  tongue.position.set(0.05, 0.05, 0);
  add('tongue', tongue, [0, 2.2, 0]);

  // --- laces: crossing bars + eyelet rows on both sides ---
  const laces = new THREE.Group();
  for (const [x1, y1, x2, y2] of LACES) {
    const ax = (x1 - CX) * S;
    const ay = (GROUND - y1) * S;
    const bx = (x2 - CX) * S;
    const by = (GROUND - y2) * S;
    const cxm = (ax + bx) / 2;
    const cym = (ay + by) / 2;
    const ang = Math.atan2(by - ay, bx - ax);
    const len = Math.hypot(bx - ax, by - ay);
    for (const z of [-2.08, 2.08]) {
      const g = new THREE.CapsuleGeometry(0.15, len - 0.1, 4, 10);
      disposables.push(g);
      const m = new THREE.Mesh(g, laceMat);
      m.position.set(cxm, cym + 0.1, z);
      m.rotation.z = ang - Math.PI / 2;
      laces.add(m);
    }
    // cross lace over the throat
    const cg = new THREE.CapsuleGeometry(0.15, 3.9, 4, 10);
    disposables.push(cg);
    const cm = new THREE.Mesh(cg, laceMat);
    cm.position.set(cxm + 0.03, cym + 0.28, 0);
    cm.rotation.x = Math.PI / 2;
    cm.rotation.z = -0.15;
    laces.add(cm);
  }
  add('laces', laces, [0, 3.0, 0]);

  // sit the whole thing on y=0 and center
  group.position.y = 0;
  group.rotation.y = 0;

  return {
    group,
    parts,
    signalMaterial: signalMat,
    coreGlowMaterial: coreGlowMat,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
