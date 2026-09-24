import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildSneaker, type SneakerModel } from './buildSneaker';
import type { SneakerPalette } from '@/lib/sneaker/palette';

export interface Pose {
  /** matches a section's data-stage value (landing mode) */
  key?: string;
  /** fraction of half-viewport-width: -1 = left edge, +1 = right edge */
  x: number;
  y: number;
  scale: number;
  rotY: number;
  rotX?: number;
  rotZ?: number;
  /** 0 = assembled, 1 = fully exploded */
  explode?: number;
  /** floor grid opacity */
  floor?: number;
  /** ambient halo / particles intensity */
  glow?: number;
}

export interface StageOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  palette: SneakerPalette;
  mode: 'landing' | 'viewer';
  reducedMotion: boolean;
  /** landing: poses keyed by section index (matches [data-stage] order) */
  poses?: Pose[];
  /** landing: elements whose scroll position drives the pose interpolation */
  stageSelector?: string;
}

const VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vH;
  varying float vDist;
  void main() {
    vUv = uv;
    vec3 p = position;
    float d = length(p.xy);
    float wave = sin(p.x * 0.55 + uTime * 0.6) * cos(p.y * 0.5 + uTime * 0.45) * 0.42;
    float ridge = sin(p.x * 0.18 - uTime * 0.25) * 0.9 * smoothstep(3.0, 14.0, abs(p.y));
    p.z += (wave + ridge) * smoothstep(0.0, 6.0, d);
    vH = p.z;
    vDist = d;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  varying float vH;
  varying float vDist;
  void main() {
    vec2 g = vUv * 64.0;
    vec2 w = fwidth(g);
    vec2 a = abs(fract(g - 0.5) - 0.5) / max(w, vec2(0.0001));
    float line = 1.0 - min(min(a.x, a.y), 1.0);
    float fade = smoothstep(19.0, 3.0, vDist);
    vec3 col = mix(uColorA, uColorB, smoothstep(-0.6, 1.1, vH));
    gl_FragColor = vec4(col, line * fade * uOpacity);
  }
`;

function radialTexture(inner: string, outer = 'rgba(0,0,0,0)'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class SneakerStage {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private model!: SneakerModel;
  private rig = new THREE.Group(); // pose-driven
  private spin = new THREE.Group(); // mouse/drag/auto driven
  private floorMat!: THREE.ShaderMaterial;
  private floor!: THREE.Mesh;
  private particles!: THREE.Points;
  private halo!: THREE.Mesh;
  private glowSprite!: THREE.Mesh;
  private shadow!: THREE.Mesh;
  private pool!: THREE.Mesh;
  private keyLight!: THREE.DirectionalLight;
  private warm!: THREE.PointLight;
  private cool!: THREE.PointLight;
  private raf = 0;
  private running = false;
  private visible = true;
  private disposed = false;
  private clock = new THREE.Clock();
  private mouse = new THREE.Vector2();
  private mouseS = new THREE.Vector2();
  private dragging = false;
  private dragVel = 0;
  private dragRot = 0;
  private lastX = 0;
  private cur: Pose = { x: 0, y: 0, scale: 1, rotY: 0, explode: 0, floor: 1, glow: 1 };
  private sections: HTMLElement[] = [];
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private cleanups: Array<() => void> = [];
  private pmrem?: THREE.PMREMGenerator;
  private envTex?: THREE.Texture;

  constructor(private o: StageOptions) {
    this.init();
  }

  private init() {
    const { canvas, container, palette, mode } = this.o;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    // procedural studio environment — no network fetch (CSP-safe)
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.75;

    this.camera.position.set(0, 2.6, 17);
    this.camera.lookAt(0, 0, 0);

    // lights: warm brass key from upper-right, signal-green rim from behind-left
    this.keyLight = new THREE.DirectionalLight(0xeaeffc, 2.3);
    this.keyLight.position.set(-7, 10, 8); // top-left
    this.scene.add(this.keyLight);
    // dual-tone rim from behind: cyan (left) -> violet (right)
    this.warm = new THREE.PointLight(0x8fd6ff, 200, 40, 1.5);
    this.warm.position.set(-9, 3, -6);
    this.scene.add(this.warm);
    this.cool = new THREE.PointLight(0x7c5cff, 230, 40, 1.5);
    this.cool.position.set(9, 3, -6);
    this.scene.add(this.cool);
    const fill = new THREE.PointLight(0xffa800, 18, 30, 1.6); // faint amber fill
    fill.position.set(5, 1, 9);
    this.scene.add(fill);

    this.model = buildSneaker(palette);
    this.spin.add(this.model.group);
    this.rig.add(this.spin);
    this.scene.add(this.rig);

    // soft contact shadow under the shoe
    const shadowTex = radialTexture('rgba(0,0,0,0.75)');
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(26, 11, 1);
    this.shadow.position.y = -0.12;
    this.rig.add(this.shadow);

    // ultramarine ambient light pool on the grid floor, directly under the shoe
    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(67,56,202,1)', 'rgba(67,56,202,0)'),
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.scale.set(30, 15, 1);
    this.pool.position.y = -0.3;
    this.rig.add(this.pool);

    // backdrop glow
    this.glowSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(124,92,255,0.5)', 'rgba(124,92,255,0)'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glowSprite.scale.set(30, 30, 1);
    this.glowSprite.position.set(0, 1.2, -6);
    this.rig.add(this.glowSprite);

    // brass halo ring
    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(9.2, 0.022, 8, 200),
      new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.halo.position.set(0, 1.4, -3.5);
    this.halo.rotation.x = 0.28;
    this.rig.add(this.halo);

    // price-terrain floor
    this.floorMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.75 },
        uColorA: { value: new THREE.Color('#7c5cff') },
        uColorB: { value: new THREE.Color('#8fd6ff') },
      },
    });
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 46, 90, 90), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.4;
    this.rig.add(this.floor);

    // drifting motes
    const N = 320;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 4 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -1 + Math.random() * 12;
      pos[i * 3 + 2] = Math.sin(a) * r - 4;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        size: 0.075,
        color: 0xcfd6ff,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.rig.add(this.particles);

    if (mode === 'viewer') {
      // a viewer wants a quieter stage
      this.floorMat.uniforms.uOpacity!.value = 0.35;
      this.particles.visible = false;
      this.halo.visible = false;
      this.cur = { x: 0, y: 0, scale: 1, rotY: -0.5, explode: 0, floor: 0.6, glow: 0.7 };
    } else {
      this.sections = Array.from(document.querySelectorAll<HTMLElement>(this.o.stageSelector ?? '[data-stage]'));
      this.cur = { ...(this.o.poses?.[0] ?? this.cur) };
    }

    // events
    const onMove = (e: PointerEvent) => {
      this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    this.cleanups.push(() => window.removeEventListener('pointermove', onMove));

    if (mode === 'viewer') {
      const down = (e: PointerEvent) => {
        this.dragging = true;
        this.lastX = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      };
      const move = (e: PointerEvent) => {
        if (!this.dragging) return;
        const dx = e.clientX - this.lastX;
        this.lastX = e.clientX;
        this.dragVel = dx * 0.012;
        this.dragRot += dx * 0.012;
      };
      const up = (e: PointerEvent) => {
        this.dragging = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      };
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      this.cleanups.push(() => {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
      });
    }

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver(
      ([entry]) => {
        this.visible = !!entry?.isIntersecting;
        if (this.visible) this.start();
        else this.stop();
      },
      { threshold: 0 },
    );
    this.io.observe(container);
    const vis = () => (document.hidden ? this.stop() : this.visible && this.start());
    document.addEventListener('visibilitychange', vis);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', vis));

    this.resize();
    this.applyPose(this.cur);
    this.renderOnce();
    if (!this.o.reducedMotion) this.start();
  }

  private resize() {
    const { container } = this.o;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // narrower screens need a wider field so the shoe still fits
    this.camera.fov = w < 700 ? 40 : 30;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private halfWidthAtOrigin() {
    const dist = this.camera.position.length();
    return Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist * this.camera.aspect;
  }

  private targetPose(): Pose {
    const { poses, mode } = this.o;
    if (mode === 'viewer' || !poses || poses.length === 0) return this.cur;
    if (this.sections.length === 0) return poses[0]!;
    const vh = window.innerHeight;
    // position of each section's midpoint relative to viewport center
    const mids = this.sections.map((s) => {
      const r = s.getBoundingClientRect();
      return r.top + r.height / 2 - vh / 2;
    });
    // find the two sections bracketing the viewport center (mid crosses 0)
    const byKey = new Map(poses.map((p) => [p.key, p] as const));
    const seq = this.sections.map((el) => byKey.get(el.dataset.stage) ?? poses[0]!);
    let i = 0;
    while (i < mids.length - 1 && mids[i + 1]! <= 0) i++;
    const a = seq[i]!;
    const b = seq[Math.min(i + 1, seq.length - 1)]!;
    const span = (mids[i + 1] ?? mids[i]! + 1) - mids[i]!;
    const raw = span === 0 ? 0 : clamp01(-mids[i]! / span);
    // dwell on each pose, then transition quickly through the middle of the gap
    const t = smooth(clamp01((raw - 0.12) / 0.5));
    const mix = (k: keyof Pose, d = 0) => lerp((a[k] as number) ?? d, (b[k] as number) ?? d, t);
    return {
      x: mix('x'),
      y: mix('y'),
      scale: mix('scale', 1),
      rotY: mix('rotY'),
      rotX: mix('rotX'),
      rotZ: mix('rotZ'),
      explode: mix('explode'),
      floor: mix('floor', 1),
      glow: mix('glow', 1),
    };
  }

  private applyPose(p: Pose) {
    const narrow = this.camera.aspect < 0.9;
    const hw = this.halfWidthAtOrigin();
    this.rig.position.x = narrow ? 0 : p.x * hw;
    this.rig.position.y = p.y * hw * 0.5 + (narrow ? 3.1 : 0);
    const base = this.o.mode === 'landing' ? 0.31 : 0.56;
    const s = p.scale * base * (narrow ? 0.72 : this.camera.aspect < 1.3 ? 0.85 : 1);
    this.rig.scale.setScalar(s);
    this.rig.visible = s > 0.012;
    this.rig.rotation.set(p.rotX ?? 0, p.rotY, p.rotZ ?? 0);
    const ex = p.explode ?? 0;
    for (const part of this.model.parts) {
      part.object.position.copy(part.base).addScaledVector(part.explode, ex * 1.0);
    }
    this.floorMat.uniforms.uOpacity!.value = (this.o.mode === 'viewer' ? 0.35 : 0.75) * (p.floor ?? 1);
    (this.glowSprite.material as THREE.MeshBasicMaterial).opacity = 0.9 * (p.glow ?? 1);
    (this.particles.material as THREE.PointsMaterial).opacity = 0.75 * (p.glow ?? 1);
  }

  private frame = () => {
    if (!this.running || this.disposed) return;
    const t = this.clock.getElapsedTime();
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // ease current pose toward the scroll-derived target
    const target = this.targetPose();
    const k = 0.085;
    const c = this.cur;
    c.x = lerp(c.x, target.x, k);
    c.y = lerp(c.y, target.y, k);
    c.scale = lerp(c.scale, target.scale, k);
    c.rotY = lerp(c.rotY, target.rotY, k);
    c.rotX = lerp(c.rotX ?? 0, target.rotX ?? 0, k);
    c.rotZ = lerp(c.rotZ ?? 0, target.rotZ ?? 0, k);
    c.explode = lerp(c.explode ?? 0, target.explode ?? 0, k);
    c.floor = lerp(c.floor ?? 1, target.floor ?? 1, k);
    c.glow = lerp(c.glow ?? 1, target.glow ?? 1, k);
    this.applyPose(c);

    // mouse parallax + idle float on the inner rig
    this.mouseS.lerp(this.mouse, 0.06);
    if (this.o.mode === 'viewer') {
      if (!this.dragging) {
        this.dragVel *= 0.94;
        this.dragRot += this.dragVel + 0.004;
      }
      this.spin.rotation.y = this.dragRot;
      this.spin.rotation.x = this.mouseS.y * 0.05;
    } else {
      this.spin.rotation.y = Math.sin(t * 0.35) * 0.22 + this.mouseS.x * 0.35;
      this.spin.rotation.x = -this.mouseS.y * 0.12;
    }
    this.spin.position.y = 0.55 + Math.sin(t * 1.2) * 0.13;
    this.model.signalMaterial.emissiveIntensity = 1.2 + Math.sin(t * 2.2) * 0.7;
    this.model.coreGlowMaterial.opacity = 0.7 + Math.sin(t * 1.6) * 0.18;

    this.halo.rotation.z = t * 0.06;
    this.particles.rotation.y = t * 0.018;
    this.floorMat.uniforms.uTime!.value = t;
    this.warm.position.x = -9 + Math.sin(t * 0.5) * 1.5;
    this.cool.position.x = 9 + Math.cos(t * 0.4) * 1.5;
    this.camera.position.x = this.mouseS.x * 0.5;
    this.camera.position.y = 2.6 + this.mouseS.y * 0.3;
    this.camera.lookAt(0, 0.4, 0);

    this.renderer.render(this.scene, this.camera);
    void dt;
    this.raf = requestAnimationFrame(this.frame);
  };

  private renderOnce() {
    if (this.disposed) return;
    this.applyPose(this.cur);
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running || this.disposed || this.o.reducedMotion) return;
    this.running = true;
    this.clock.start();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    this.cleanups.forEach((fn) => fn());
    this.model.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) {
        const anyMat = mat as THREE.MeshBasicMaterial;
        anyMat.map?.dispose();
        mat.dispose();
      }
    });
    this.envTex?.dispose();
    this.pmrem?.dispose();
    this.renderer.dispose();
  }
}
