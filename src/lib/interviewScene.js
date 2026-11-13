// The interview room as a small film set: a crescent table under pendant lamps, five faceless board
// members whose hands, pens and notepads do the acting, and a camera that moves like a film camera.
// Plain three.js (no React inside) so the render loop never touches React state. Loaded lazily, only
// when the room opens. Everything is built from code - there are no model or image files to download.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const KEY = 26; // the lamp over the table
const SPOT = 15; // the light on whoever has the floor
const C = new THREE.Vector3(0, 0, 1.25); // the candidate's chair: the centre the table curves around
const R_IN = 1.72;
const R_OUT = 2.58;
const SEAT_R = 2.84;
const TABLE_Y = 0.76;
const TABLE_SPAN = 50; // degrees either side
const EYE = new THREE.Vector3(0, 1.2, 1.95); // where the candidate's eyes are
const TWO_ROWS = 1.35; // frames narrower than this lay the marks cards out three and two
const SEAT_ANGLE = { m1: -36, m2: -18, chairman: 0, m3: 18, m4: 36 };
export const SEAT_ORDER = ['m1', 'm2', 'chairman', 'm3', 'm4'];

const CAST = {
  chairman: { skin: '#b08462', hair: '#c9c6be', outfit: 'suit', cloth: '#2b2f38', accent: '#7c1f2d', specs: true },
  m1: { skin: '#bd9070', hair: '#17120f', outfit: 'saree', cloth: '#0f6460', blouse: '#0a403e', accent: '#d0aa55', female: true },
  m2: { skin: '#9a6d4a', hair: '#1b1613', outfit: 'bandhgala', cloth: '#1d2c4d', accent: '#d0aa55', specs: true },
  m3: { skin: '#c49a78', hair: '#2a1a12', outfit: 'saree', cloth: '#76213f', blouse: '#4f152b', accent: '#dcb873', female: true },
  m4: { skin: '#a67654', hair: '#9a968f', outfit: 'nehru', cloth: '#454d41', sleeve: '#cdc2a8', accent: '#b08a45' }
};

const rad = THREE.MathUtils.degToRad;
const damp = THREE.MathUtils.damp;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ease = (u) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
const bell = (u) => Math.sin(Math.PI * clamp(u, 0, 1));
const polar = (r, deg, y = 0) => new THREE.Vector3(C.x + r * Math.sin(rad(deg)), y, C.z - r * Math.cos(rad(deg)));

// A repeatable random stream, so the room looks the same on every visit.
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// ------------------------------------------------------------------ painted textures

const canvasTexture = (w, h, draw, { repeat } = {}) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};

const woodTexture = (base, streak, seed = 7, repeat = [2, 2]) => canvasTexture(512, 512, (g, w, h) => {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = r() * h;
    g.strokeStyle = streak;
    g.globalAlpha = 0.04 + r() * 0.16;
    g.lineWidth = 0.5 + r() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    const wob = 2 + r() * 7;
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / (30 + r() * 60) + i) * wob);
    g.stroke();
  }
  g.globalAlpha = 1;
}, { repeat });

const speckleTexture = (base, dots, seed = 3, repeat = [6, 6], strength = 0.1) => canvasTexture(256, 256, (g, w, h) => {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = dots[Math.floor(r() * dots.length)];
    g.globalAlpha = r() * strength;
    g.fillRect(r() * w, r() * h, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  g.globalAlpha = 1;
}, { repeat });

const wallTexture = () => canvasTexture(1024, 512, (g, w, h) => {
  // Upper wall: deep green, darker toward the ceiling. Lower third: walnut panelling with a brass rail.
  const up = g.createLinearGradient(0, 0, 0, h);
  up.addColorStop(0, '#07130f');
  up.addColorStop(0.62, '#163328');
  g.fillStyle = up;
  g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 2600; i++) { g.fillStyle = r() > 0.5 ? '#1f4637' : '#06110d'; g.globalAlpha = r() * 0.07; g.fillRect(r() * w, r() * h * 0.66, 2, 2 + r() * 5); }
  g.globalAlpha = 1;
  const y0 = h * 0.66;
  g.fillStyle = '#2b1a10';
  g.fillRect(0, y0, w, h - y0);
  for (let i = 0; i < 90; i++) { g.strokeStyle = '#120a05'; g.globalAlpha = 0.1 + r() * 0.25; g.lineWidth = 1 + r() * 2; const x = r() * w; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - 0.5) * 8, h); g.stroke(); }
  g.globalAlpha = 1;
  const panels = 8;
  for (let i = 0; i < panels; i++) {
    const x = (i + 0.09) * (w / panels);
    const pw = (w / panels) * 0.82;
    g.strokeStyle = '#160d07';
    g.lineWidth = 5;
    g.strokeRect(x, y0 + 22, pw, h - y0 - 44);
    g.strokeStyle = 'rgba(190,140,90,0.22)';
    g.lineWidth = 1.5;
    g.strokeRect(x + 5, y0 + 27, pw - 10, h - y0 - 54);
  }
  for (const cx of [w * 0.25, w * 0.75]) {
    const pool = g.createRadialGradient(cx, h * 0.5, 4, cx, h * 0.5, h * 0.62);
    pool.addColorStop(0, 'rgba(255,186,110,0.34)');
    pool.addColorStop(0.35, 'rgba(255,170,95,0.12)');
    pool.addColorStop(1, 'rgba(255,170,95,0)');
    g.fillStyle = pool;
    g.fillRect(cx - h, 0, h * 2, h);
  }
  const rail = g.createLinearGradient(0, y0 - 5, 0, y0 + 5);
  rail.addColorStop(0, '#e2c27e');
  rail.addColorStop(1, '#7c5d2b');
  g.fillStyle = rail;
  g.fillRect(0, y0 - 4, w, 8);
});

const plateTexture = (text) => canvasTexture(512, 128, (g, w, h) => {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#ecd294');
  bg.addColorStop(0.5, '#c39c50');
  bg.addColorStop(1, '#8d6c30');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,40,10,0.55)';
  g.lineWidth = 3;
  g.strokeRect(9, 9, w - 18, h - 18);
  g.fillStyle = '#2a1c08';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 50px Georgia, "Times New Roman", serif';
  const label = text.toUpperCase().split('').join(' ');
  g.fillText(label, w / 2, h / 2 + 3, w - 50);
});

const padTexture = () => {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3ecd6';
  g.fillRect(0, 0, 192, 256);
  g.fillStyle = '#b64538';
  g.fillRect(0, 0, 192, 20);
  g.strokeStyle = 'rgba(70,110,170,0.33)';
  g.lineWidth = 1;
  for (let y = 44; y < 250; y += 17) { g.beginPath(); g.moveTo(10, y); g.lineTo(182, y); g.stroke(); }
  g.strokeStyle = 'rgba(190,60,60,0.4)';
  g.beginPath(); g.moveTo(30, 20); g.lineTo(30, 256); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, g, line: 0 };
};

// One more line of "handwriting" on a member's pad.
const scribble = (pad, r) => {
  if (pad.line >= 12) return;
  const { g } = pad;
  const y = 40 + pad.line * 17;
  g.strokeStyle = 'rgba(24,32,74,0.82)';
  g.lineWidth = 1.5;
  g.lineJoin = 'round';
  g.beginPath();
  let x = 36;
  const end = 80 + r() * 96;
  g.moveTo(x, y);
  while (x < end) {
    const word = 8 + r() * 18;
    const stop = Math.min(end, x + word);
    while (x < stop) { x += 2.2; g.lineTo(x, y - r() * 7 + (r() > 0.86 ? -5 : 0)); }
    x += 6;
    g.moveTo(x, y);
  }
  g.stroke();
  pad.line += 1;
  pad.texture.needsUpdate = true;
};

const cardFace = (label, marks, outOf) => canvasTexture(384, 512, (g, w, h) => {
  g.fillStyle = '#f6f0df';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#a8843f';
  g.lineWidth = 6;
  g.strokeRect(16, 16, w - 32, h - 32);
  g.lineWidth = 1.5;
  g.strokeRect(27, 27, w - 54, h - 54);
  g.fillStyle = '#6f5a2e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 30px Georgia, serif';
  g.fillText(label.toUpperCase().split('').join(' '), w / 2, 92, w - 80);
  g.fillStyle = '#16211c';
  g.font = '700 190px Georgia, serif';
  g.fillText(String(marks), w / 2, 262);
  g.fillStyle = '#a8843f';
  g.fillRect(w / 2 - 60, 368, 120, 3);
  g.fillStyle = '#4c5650';
  g.font = '600 44px Georgia, serif';
  g.fillText(`out of ${outOf}`, w / 2, 420);
});

const cardBack = () => canvasTexture(384, 512, (g, w, h) => {
  g.fillStyle = '#0e3a2c';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a85c';
  g.lineWidth = 6;
  g.strokeRect(18, 18, w - 36, h - 36);
  g.lineWidth = 1.5;
  g.strokeRect(30, 30, w - 60, h - 60);
  g.globalAlpha = 0.5;
  for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * 40, 40); g.lineTo(i * 40 + 440, h - 40); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = '#0e3a2c';
  g.fillRect(72, 200, w - 144, 112);
  g.strokeRect(72, 200, w - 144, 112);
  g.fillStyle = '#e4c77f';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 46px Georgia, serif';
  g.fillText('M A R K S', w / 2, 258);
});

// ------------------------------------------------------------------ small builders

const clay = (color, roughness = 0.82, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
const brass = () => new THREE.MeshStandardMaterial({ color: '#c9a455', roughness: 0.32, metalness: 0.9 });

// A capsule lying along +Z with its base at the origin (limbs, fingers).
const boneGeo = (radius, length, radialSegments = 10) => {
  const g = new THREE.CapsuleGeometry(radius, length, 4, radialSegments);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, length / 2);
  return g;
};

const shadow = (mesh, cast = true, receive = true) => { mesh.castShadow = cast; mesh.receiveShadow = receive; return mesh; };

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

// Point a +Z bone from a to b.
const aim = (mesh, a, b) => {
  mesh.position.copy(a);
  _v1.subVectors(b, a).normalize();
  mesh.quaternion.setFromUnitVectors(Z, _v1);
};

// A stylised hand: palm, four two-joint fingers and a thumb. `side` is -1 for the right hand.
const makeHand = (skin, side) => {
  const hand = new THREE.Group();
  const palm = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), skin));
  palm.scale.set(0.041, 0.016, 0.049);
  palm.position.set(0, 0, 0.045);
  hand.add(palm);
  const fingers = [];
  const lengths = [0.06, 0.068, 0.063, 0.05];
  for (let i = 0; i < 4; i++) {
    const order = side < 0 ? 3 - i : i; // the index finger sits on the thumb side
    const x = (i - 1.5) * 0.0185;
    const len = lengths[order];
    const knuckle = new THREE.Group();
    knuckle.position.set(x, 0.002, 0.083 - Math.abs(i - 1.5) * 0.004);
    knuckle.rotation.y = (i - 1.5) * 0.07;
    knuckle.add(shadow(new THREE.Mesh(boneGeo(0.0088, len * 0.5, 8), skin)));
    const mid = new THREE.Group();
    mid.position.z = len * 0.52;
    mid.add(shadow(new THREE.Mesh(boneGeo(0.008, len * 0.44, 8), skin)));
    knuckle.add(mid);
    hand.add(knuckle);
    fingers.push({ knuckle, mid });
  }
  const thumb = new THREE.Group();
  thumb.position.set(-side * 0.034, 0, 0.028);
  thumb.rotation.y = -side * 0.75;
  thumb.add(shadow(new THREE.Mesh(boneGeo(0.0105, 0.03, 8), skin)));
  const tip = new THREE.Group();
  tip.position.z = 0.034;
  tip.rotation.y = side * 0.35;
  tip.add(shadow(new THREE.Mesh(boneGeo(0.0095, 0.026, 8), skin)));
  thumb.add(tip);
  hand.add(thumb);
  hand.userData = { fingers, thumb, curl: 0.15 };
  return hand;
};

const setCurl = (hand, curl) => {
  hand.userData.curl = curl;
  for (const f of hand.userData.fingers) { f.knuckle.rotation.x = curl * 0.75; f.mid.rotation.x = curl * 1.15; }
  hand.userData.thumb.rotation.x = curl * 0.35;
};

const makePen = () => {
  const pen = new THREE.Group();
  const body = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.118, 10), clay('#14161a', 0.35)));
  body.position.y = 0.071;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0052, 0.016, 10), brass());
  tip.rotation.x = Math.PI;
  tip.position.y = 0.008;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0056, 0.012, 10), brass());
  cap.position.y = 0.134;
  pen.add(body, tip, cap);
  return pen; // tip at the origin, body along +Y
};

const makeGlasses = () => {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.35, metalness: 0.3 });
  const lens = new THREE.MeshStandardMaterial({ color: '#cfe4ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.16 });
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0017, 8, 28), frame);
    rim.position.set(s * 0.03, 0, 0);
    rim.scale.set(1.22, 0.78, 1);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.02, 20), lens);
    glass.position.set(s * 0.03, 0, 0);
    glass.scale.set(1.22, 0.78, 1);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.1, 6), frame);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(s * 0.057, 0.004, -0.05);
    g.add(rim, glass, arm);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.016, 6), frame);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.y = 0.004;
  g.add(bridge);
  return g;
};

// ------------------------------------------------------------------ a board member

// Local frame: origin on the floor under the chair, +Z toward the candidate, +X the member's left.
class Member {
  constructor(id, label, quality) {
    this.id = id;
    const cast = CAST[id];
    this.cast = cast;
    this.rand = rng(id.charCodeAt(id.length - 1) * 977 + 13);
    this.root = new THREE.Group();
    this.root.position.copy(polar(SEAT_R, SEAT_ANGLE[id]));
    this.root.rotation.y = -rad(SEAT_ANGLE[id]);

    const skin = clay(cast.skin, 0.62);
    const cloth = clay(cast.cloth, 0.86);
    const sleeve = clay(cast.sleeve || cast.blouse || cast.cloth, 0.86);
    const hair = clay(cast.hair, 0.7);
    const accent = cast.outfit === 'suit' ? clay(cast.accent, 0.6) : new THREE.MeshStandardMaterial({ color: cast.accent, roughness: 0.4, metalness: 0.65 });
    const seg = quality === 'low' ? 14 : 24;

    // Chair
    const leather = clay('#2a0f12', 0.5);
    const back = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.0, 0.1, 4, 0.05), leather));
    back.position.set(0, 0.95, -0.24);
    back.rotation.x = -0.09;
    this.root.add(back);
    if (quality !== 'low') {
      const stud = brass();
      for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), stud);
        s.position.set(-0.27 + i * 0.09, 1.41, -0.215);
        this.root.add(s);
      }
    }

    // Upper body leans from the hips.
    this.upper = new THREE.Group();
    this.upper.position.set(0, 0.6, -0.02);
    this.root.add(this.upper);
    const profile = [[0.001, -0.02], [0.125, -0.02], [0.14, 0.08], [0.158, 0.22], [0.174, 0.33], [0.18, 0.4], [0.17, 0.452], [0.12, 0.495], [0.05, 0.512], [0.001, 0.515]].map(([r, y]) => new THREE.Vector2(r, y));
    this.torsoGeo = new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(26), seg);
    this.clips = [];
    const torso = shadow(new THREE.Mesh(this.torsoGeo, cast.outfit === 'saree' ? sleeve : cloth));
    torso.scale.set(1.3, 1, 0.72);
    this.upper.add(torso);
    const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.05, 0.1, 14), skin));
    neck.position.y = 0.535;
    this.upper.add(neck);
    this.dress(cast, { cloth, accent, skin });

    // Head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.59, 0.005);
    this.upper.add(this.head);
    const skull = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, seg, 18), skin));
    skull.scale.set(0.094, 0.117, 0.104);
    skull.position.y = 0.095;
    this.head.add(skull);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), skin);
      ear.scale.set(0.01, 0.024, 0.016);
      ear.position.set(s * 0.094, 0.09, 0.0);
      this.head.add(ear);
    }
    const cap = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, seg, 12, 0, Math.PI * 2, 0, Math.PI * (cast.female ? 0.6 : 0.5)), hair));
    cap.scale.set(0.101, 0.125, 0.113);
    cap.position.set(0, 0.098, -0.006);
    cap.rotation.x = cast.female ? -0.42 : -0.36;
    this.head.add(cap);
    if (cast.female) {
      const bun = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), hair));
      bun.position.set(0, 0.06, -0.105);
      this.head.add(bun);
    }
    // Arms and hands live in the member's frame and are re-posed every frame.
    this.arms = {};
    for (const [name, s] of [['R', -1], ['L', 1]]) {
      const up = shadow(new THREE.Mesh(boneGeo(0.05, 0.27), sleeve));
      const fore = shadow(new THREE.Mesh(boneGeo(0.043, 0.25), sleeve));
      const cuff = new THREE.Mesh(boneGeo(0.037, 0.03), cast.outfit === 'saree' ? accent : clay('#e6e0d2', 0.7));
      const hand = makeHand(skin, s);
      this.root.add(up, fore, cuff, hand);
      this.arms[name] = { s, up, fore, cuff, hand, pos: new THREE.Vector3(s * 0.15, TABLE_Y + 0.03, 0.4), yaw: -s * 0.32, pitch: 0, roll: 0 };
    }
    this.rest = { R: new THREE.Vector3(-0.135, TABLE_Y + 0.028, 0.39), L: new THREE.Vector3(0.15, TABLE_Y + 0.026, 0.41) };
    setCurl(this.arms.R.hand, 0.8);
    setCurl(this.arms.L.hand, 0.16);
    this.pen = makePen();
    this.pen.position.set(0.026, -0.012, 0.094);
    this.pen.rotation.set(-0.95, 0, -0.45);
    this.arms.R.hand.add(this.pen);

    // On the desk
    this.pad = padTexture();
    this.padMat = new THREE.MeshStandardMaterial({ map: this.pad.texture, roughness: 0.9, emissive: '#ffd27a', emissiveIntensity: 0 });
    const side = clay('#e9e2cc', 0.9);
    this.padMesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.2), [side, side, this.padMat, side, side, side]), false);
    this.padMesh.position.set(-0.115, TABLE_Y + 0.008, 0.52);
    this.padMesh.rotation.y = -0.12;
    this.root.add(this.padMesh);
    this.padTop = new THREE.Vector3(-0.115, TABLE_Y + 0.016, 0.5);

    const plateBase = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.07, 0.05, 2, 0.008), clay('#2a170c', 0.45)));
    plateBase.position.set(0, TABLE_Y + 0.036, 0.97);
    plateBase.rotation.x = -0.28;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.056), new THREE.MeshStandardMaterial({ map: plateTexture(label), roughness: 0.38, metalness: 0.75 }));
    plate.position.set(0, 0, 0.0256);
    plateBase.add(plate);
    this.root.add(plateBase);
    this.plate = plateBase;

    const gx = id === 'chairman' ? 0.34 : 0.3;
    const gz = id === 'chairman' ? 0.74 : 0.72;
    const glassMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.027, 0.105, 20, 1, true), glassMat);
    glass.position.set(gx, TABLE_Y + 0.056, gz);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0012, 6, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, transparent: true, opacity: 0.55 }));
    lip.rotation.x = Math.PI / 2;
    lip.position.set(gx, TABLE_Y + 0.108, gz);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.026, 0.066, 20), new THREE.MeshStandardMaterial({ color: '#9cc4d8', roughness: 0.08, transparent: true, opacity: 0.38, depthWrite: false }));
    water.position.set(gx, TABLE_Y + 0.039, gz);
    const coaster = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.004, 20), clay('#3a2616', 0.7)), false);
    coaster.position.set(gx, TABLE_Y + 0.003, gz);
    this.root.add(coaster, water, glass, lip);

    if (cast.specs) {
      const glasses = makeGlasses();
      glasses.position.set(id === 'chairman' ? -0.3 : 0.2, TABLE_Y + 0.02, id === 'chairman' ? 0.44 : 0.66);
      glasses.rotation.set(-Math.PI / 2 + 0.06, 0, id === 'chairman' ? -0.5 : 0.45, 'YXZ');
      this.root.add(glasses);
    }

    // Pose state (targets are recomputed every frame, the pose eases toward them).
    this.pose = { lean: 0, turn: 0, yaw: 0, pitch: 0, env: 0 };
    this.t = this.rand() * 20;
    this.writeUntil = 0;
    this.nextWrite = 3 + this.rand() * 6;
    this.nodAt = -10;
    this.nextNod = 4 + this.rand() * 8;
    this.tell = null;
    this.scribbleAt = 0;
    this.glow = 0;
    this.card = null;
    // How the member took the last answer: shapes their posture for a while afterwards.
    this.mood = { name: 'neutral', at: -100 };
  }

  // A layer of clothing: a copy of the torso, a touch larger, cut to shape by planes given in the upper
  // body's own frame as [normal, point]. What lies on the positive side of every plane is kept.
  layer(material, grow, planes) {
    material.clippingPlanes = planes.map(([n, p0]) => {
      const clip = { plane: new THREE.Plane(), n: new THREE.Vector3(...n).normalize(), p0: new THREE.Vector3(...p0) };
      this.clips.push(clip);
      return clip.plane;
    });
    material.clipShadows = true;
    const mesh = shadow(new THREE.Mesh(this.torsoGeo, material));
    mesh.scale.set(1.3 * grow, 1 + (grow - 1) * 0.4, 0.72 * grow);
    this.upper.add(mesh);
    return mesh;
  }

  dress(cast, { cloth, accent, skin }) {
    const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); this.upper.add(mesh); return mesh; };
    const vNeck = (y0, k, z = 0.03) => [[[-k, 1, 0], [0, y0, 0]], [[k, 1, 0], [0, y0, 0]], [[0, 0, 1], [0, 0, z]]];
    if (cast.outfit === 'suit') {
      this.layer(clay('#e9e4d8', 0.8), 1.012, vNeck(0.27, 2.3));
      const tie = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.19, 0.012, 2, 0.005), accent);
      add(tie, 0, 0.37, 0.126, 0.09);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), accent);
      knot.scale.set(1, 0.85, 0.6);
      add(knot, 0, 0.468, 0.116);
      for (const s of [-1, 1]) {
        const lapel = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.23, 0.012, 2, 0.005), clay(new THREE.Color(cast.cloth).multiplyScalar(1.28), 0.8));
        add(lapel, s * 0.066, 0.385, 0.117, 0.1, 0, -s * 0.38);
        const collar = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.012, 2, 0.005), clay('#f4f0e6', 0.8));
        add(collar, s * 0.034, 0.488, 0.082, 0.3, s * 0.5, -s * 0.5);
      }
    } else if (cast.outfit === 'bandhgala') {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 20), clay(new THREE.Color(cast.cloth).multiplyScalar(1.35), 0.8));
      add(collar, 0, 0.49, 0.004, Math.PI / 2);
      for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.0095, 10, 8), accent), 0, 0.44 - i * 0.065, 0.118 + (i < 3 ? 0.003 * i : 0.004));
      const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.012, 0.01, 2, 0.004), clay('#efe7d2', 0.8));
      add(pocket, 0.105, 0.37, 0.1, 0, 0.35, 0.04);
    } else if (cast.outfit === 'nehru') {
      this.layer(clay(cast.sleeve, 0.85), 1.012, vNeck(0.4, 1.7));
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), clay(new THREE.Color(cast.cloth).multiplyScalar(1.3), 0.85));
      add(collar, 0, 0.495, 0.004, Math.PI / 2);
      for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), accent), 0, 0.36 - i * 0.07, 0.124 + (i < 2 ? 0.003 * i : 0.004));
    } else {
      // Saree: the pallu crosses the chest to the left shoulder, edged with a zari border.
      const neck = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skin);
      neck.scale.set(0.058, 0.04, 0.03);
      add(neck, 0, 0.475, 0.07);
      const edge = [0.8, 0.6, 0];
      this.layer(cloth, 1.035, [[edge, [-0.02, 0.22, 0]]]);
      this.layer(accent, 1.05, [[edge, [-0.02, 0.22, 0]], [[-0.8, -0.6, 0], [0.004, 0.238, 0]]]);
      const fall = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.4, 0.03, 3, 0.014), cloth));
      add(fall, 0.15, 0.27, -0.125, -0.1, 0, 0.05);
    }
  }

  // Shoulder position in the member's frame, following the lean of the upper body.
  shoulder(s, out) {
    return out.set(s * 0.186, 0.4, 0).applyQuaternion(this.upper.quaternion).add(this.upper.position);
  }

  poseArm(arm) {
    const S = this.shoulder(arm.s, _v1.clone());
    const W = arm.pos;
    const a = 0.27;
    const b = 0.25;
    const dir = _v2.subVectors(W, S);
    const d = Math.min(dir.length(), a + b - 0.004);
    dir.normalize();
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
    const pole = _v3.set(arm.s * 0.75, -0.45, -0.5);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const E = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pole, a * Math.sqrt(1 - cosA * cosA));
    const wrist = S.clone().addScaledVector(dir, d);
    aim(arm.up, S, E);
    aim(arm.fore, E, wrist);
    arm.cuff.position.copy(E).lerp(wrist, 0.9);
    arm.cuff.quaternion.copy(arm.fore.quaternion);
    arm.hand.position.copy(wrist);
    arm.hand.rotation.set(arm.pitch, arm.yaw, arm.roll, 'YXZ');
  }

  lookAngles(worldPoint) {
    const p = this.root.worldToLocal(_v1.copy(worldPoint));
    const dy = 1.28 - p.y;
    const flat = Math.hypot(p.x, p.z);
    return { yaw: clamp(Math.atan2(p.x, p.z), -1.25, 1.25), pitch: clamp(Math.atan2(dy, flat), -0.4, 0.7) };
  }

  startTell(name, now) {
    if (name === 'nod') { this.nodAt = now; return; }
    if (name === 'scribble') { this.writeUntil = now + 2.6; this.nextWrite = now + 6; return; }
    this.tell = { name, at: now };
  }

  setMood(name, now) {
    this.mood = { name, at: now };
    if (name === 'pleased') { this.nodAt = now + 0.2; this.writeUntil = now + 2.4; this.nextWrite = now + 7; }
    else if (name === 'sceptical') { this.tell = { name: this.rand() < 0.5 ? 'tilt' : 'steeple', at: now }; this.writeUntil = 0; this.nextWrite = now + 5; }
    else if (name === 'displeased') { this.tell = { name: 'leanBack', at: now }; this.writeUntil = 0; this.nextWrite = now + 9; }
  }

  update(dt, now, ctx) {
    this.t += dt;
    const t = this.t;
    const { phase, active, level, speakers } = ctx;
    const mine = active === this.id;
    const speaking = mine && (phase === 'asking' || phase === 'closing');
    const answering = phase === 'answering';
    const conferring = phase === 'submitting';
    const pose = this.pose;
    pose.env = damp(pose.env, speaking ? level : 0, speaking && level > pose.env ? 18 : 6, dt);

    // Where to look
    let look = this.lookAngles(EYE);
    let lean = 0.015;
    let turnShare = 0.3;
    const R = this.arms.R;
    const L = this.arms.L;
    const rT = _v2.copy(this.rest.R);
    const lT = this.rest.L.clone();
    let rPitch = 0.1;
    let lRoll = 0;
    let lPitch = 0;
    let lCurl = 0.16;
    let rYaw = null;
    let lYaw = -0.32;
    let roll = 0;
    let writing = false;

    if (speaking) {
      lean = 0.07 + pose.env * 0.05;
      look.yaw += Math.sin(t * 0.7) * 0.06;
      look.pitch += -pose.env * 0.07 + Math.sin(t * 5.1) * 0.012 * (0.3 + pose.env);
      // The left hand talks.
      lT.set(0.16 + Math.sin(t * 1.3) * 0.02, TABLE_Y + 0.075 + pose.env * 0.07 + Math.sin(t * 2.1) * 0.012, 0.45 + Math.sin(t * 0.9) * 0.02);
      lRoll = -0.3 - pose.env * 0.45;
      lPitch = -0.25 - pose.env * 0.25;
      lCurl = 0.28;
    } else if (phase === 'asking' || phase === 'closing') {
      // Someone else has the floor: glance their way, or keep reading your notes.
      const sp = speakers[active];
      if (sp && Math.sin(t * 0.23 + this.rand.offset) > -0.5) { look = this.lookAngles(sp); turnShare = 0.45; }
    } else if (answering) {
      lean = mine ? 0.05 : 0.02;
      if (now > this.nextWrite && now > this.writeUntil) {
        this.writeUntil = now + 1.6 + this.rand() * 2.6;
        this.nextWrite = this.writeUntil + (mine ? 4 : 7) + this.rand() * (mine ? 7 : 14);
      }
      writing = now < this.writeUntil;
      if (now > this.nextNod && !writing) { this.nodAt = now; this.nextNod = now + (mine ? 5 : 11) + this.rand() * 9; }
    } else if (conferring) {
      const idx = SEAT_ORDER.indexOf(this.id);
      const partner = { 0: 1, 1: 0, 3: 4, 4: 3 }[idx];
      if (partner !== undefined) {
        look = this.lookAngles(speakers[SEAT_ORDER[partner]]);
        look.pitch += 0.08 + Math.sin(t * 4.3 + idx) * 0.03;
        lean = 0.1;
        turnShare = 0.55;
      } else {
        writing = true;
        lean = 0.08;
      }
    }

    if (writing) {
      look = this.lookAngles(this.root.localToWorld(_v1.copy(this.padTop)));
      look.pitch = Math.min(0.62, look.pitch + 0.12);
      lean += 0.05;
      const row = (this.pad.line % 12) / 12;
      rT.set(this.padTop.x - 0.045 + ((t * 0.045) % 0.085) + Math.sin(t * 17) * 0.004, TABLE_Y + 0.027 + Math.abs(Math.sin(t * 21)) * 0.003, this.padTop.z - 0.115 + row * 0.07 + Math.sin(t * 23) * 0.004);
      rPitch = 0.16;
      if (now > this.scribbleAt) { scribble(this.pad, this.rand); this.scribbleAt = now + 0.55 + this.rand() * 0.4; }
    }

    // A mood fades over about half a minute. Pleased: a little forward. Sceptical: head slightly to one
    // side. Displeased: sits back with hands folded on the table. Speaking or writing comes first.
    const moodAge = now - this.mood.at;
    if (this.mood.name !== 'neutral' && moodAge < 30 && !speaking && !writing) {
      const k = ease(Math.min(moodAge / 0.8, (30 - moodAge) / 4));
      if (this.mood.name === 'pleased') { lean += 0.035 * k; look.pitch -= 0.02 * k; }
      if (this.mood.name === 'sceptical') { roll += 0.1 * k * (this.rand.offset % 2 ? 1 : -1); look.pitch -= 0.03 * k; }
      if (this.mood.name === 'displeased') {
        lean -= 0.08 * k;
        rT.lerp(_v1.set(-0.035, TABLE_Y + 0.03, 0.47), k);
        lT.lerp(_v3.set(0.045, TABLE_Y + 0.052, 0.49), k);
        rYaw = lerp(0.32, 1.05, k);
        lYaw = lerp(-0.32, -1.1, k);
        rPitch = lerp(rPitch, 0.05, k);
        lCurl = lerp(lCurl, 0.45, k);
      }
    }

    // A nod: a quick dip of the head, sometimes two.
    const nu = (now - this.nodAt) / 0.9;
    if (nu >= 0 && nu < 1) look.pitch += Math.sin(nu * Math.PI * 2) ** 2 * 0.13;

    // One-off tells
    if (this.tell) {
      const u = (now - this.tell.at);
      if (this.tell.name === 'penTap') {
        const dur = 1.5;
        if (u > dur) this.tell = null;
        else {
          const k = bell(u / dur);
          rT.y += Math.abs(Math.sin(u * Math.PI * 3.2)) * 0.03 * k + 0.01 * k;
          rT.z += 0.04 * k;
          rPitch = 0.1 - Math.abs(Math.sin(u * Math.PI * 3.2)) * 0.5 * k;
          look.pitch += 0.05 * k;
        }
      } else if (this.tell.name === 'leanIn') {
        const dur = 3.2;
        if (u > dur) this.tell = null;
        else lean += 0.09 * bell(u / dur);
      } else if (this.tell.name === 'leanBack') {
        // Unconvinced: sits back, the pen hand goes still, the other hand flattens on the table.
        const dur = 4.5;
        if (u > dur) this.tell = null;
        else {
          const k = ease(Math.min(u / 0.8, (dur - u) / 0.8));
          lean -= 0.13 * k;
          look.pitch -= 0.05 * k;
          lT.lerp(_v1.set(0.2, TABLE_Y + 0.024, 0.36), k);
          rT.lerp(_v3.set(-0.2, TABLE_Y + 0.03, 0.36), k);
        }
      } else if (this.tell.name === 'watch') {
        const dur = 2.2;
        if (u > dur) this.tell = null;
        else {
          const k = ease(Math.min(u / 0.5, (dur - u) / 0.5));
          lT.lerp(_v1.set(0.08, TABLE_Y + 0.17, 0.3), k);
          lRoll = lerp(lRoll, 0.9, k);
          lPitch = lerp(lPitch, -0.5, k);
          const w = this.lookAngles(this.root.localToWorld(_v3.set(0.08, TABLE_Y + 0.17, 0.3)));
          look.yaw = lerp(look.yaw, w.yaw, k);
          look.pitch = lerp(look.pitch, w.pitch + 0.1, k);
        }
      } else if (this.tell.name === 'tilt') {
        // Not convinced: the head goes to one side and stays there a moment.
        const dur = 3.2;
        if (u > dur) this.tell = null;
        else roll += 0.17 * ease(Math.min(u / 0.5, (dur - u) / 0.7)) * (this.rand.offset % 2 ? 1 : -1);
      } else if (this.tell.name === 'steeple') {
        // Weighing it up: fingertips together in front of the chest.
        const dur = 4.2;
        if (u > dur) this.tell = null;
        else {
          const k = ease(Math.min(u / 0.7, (dur - u) / 0.7));
          rT.lerp(_v1.set(-0.03, TABLE_Y + 0.15, 0.33), k);
          lT.lerp(_v3.set(0.03, TABLE_Y + 0.15, 0.33), k);
          rPitch = lerp(rPitch, -1.15, k);
          lPitch = lerp(lPitch, -1.15, k);
          rYaw = lerp(0.32, 0.55, k);
          lYaw = lerp(-0.32, -0.55, k);
          lCurl = lerp(lCurl, 0.05, k);
          lean += 0.03 * k;
          look.pitch -= 0.03 * k;
        }
      } else if (this.tell.name === 'push') {
        // Sliding the marks card across: the right hand follows the card as far as the arm reaches.
        const dur = 1.5;
        if (u > dur) this.tell = null;
        else {
          const k = bell(u / dur);
          rT.lerp(_v1.set(-0.04, TABLE_Y + 0.035, 0.66), k);
          lean += 0.12 * k;
          look.pitch += 0.2 * k;
        }
      }
    }

    // Ease everything toward its target.
    const breathe = Math.sin(t * 1.25) * 0.006;
    pose.lean = damp(pose.lean, lean, 3.2, dt);
    pose.yaw = damp(pose.yaw, look.yaw, 4.2, dt);
    pose.pitch = damp(pose.pitch, look.pitch, 5.5, dt);
    this.upper.rotation.set(pose.lean + breathe, pose.yaw * turnShare, 0);
    if (this.clips.length) {
      this.upper.updateWorldMatrix(true, false);
      for (const c of this.clips) c.plane.setFromNormalAndCoplanarPoint(c.n, c.p0).applyMatrix4(this.upper.matrixWorld);
    }
    this.upper.scale.y = 1 + Math.sin(t * 1.25) * 0.006;
    pose.roll = damp(pose.roll || 0, roll, 4, dt);
    this.head.rotation.set(pose.pitch + Math.sin(t * 0.61) * 0.012, pose.yaw * (1 - turnShare) + Math.sin(t * 0.37) * 0.02, pose.roll + Math.sin(t * 0.43) * 0.015, 'YXZ');

    R.pos.x = damp(R.pos.x, rT.x, writing ? 14 : 7, dt);
    R.pos.y = damp(R.pos.y, rT.y, 16, dt);
    R.pos.z = damp(R.pos.z, rT.z, writing ? 14 : 7, dt);
    R.pitch = damp(R.pitch, rPitch, 12, dt);
    R.yaw = damp(R.yaw, rYaw ?? (writing ? 0.12 : 0.32), 5, dt);
    L.pos.x = damp(L.pos.x, lT.x, 6, dt);
    L.pos.y = damp(L.pos.y, lT.y, 7, dt);
    L.pos.z = damp(L.pos.z, lT.z, 6, dt);
    L.roll = damp(L.roll, lRoll, 7, dt);
    L.pitch = damp(L.pitch, lPitch, 7, dt);
    L.yaw = damp(L.yaw, lYaw, 5, dt);
    setCurl(L.hand, damp(L.hand.userData.curl, lCurl, 6, dt));
    this.poseArm(R);
    this.poseArm(L);

    // An unread note makes the pad glow softly.
    this.padMat.emissiveIntensity = this.glow > 0 ? 0.1 + (Math.sin(now * 3.2) * 0.5 + 0.5) * 0.22 : damp(this.padMat.emissiveIntensity, 0, 6, dt);
  }
}

// ------------------------------------------------------------------ the scene

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export function createBoardScene(canvas, { quality = 'high', labels = {}, onFrame } = {}) {
  const low = quality === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : low ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true; // clothes are shells cut to shape (see Member.layer)

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050807');
  scene.fog = new THREE.Fog('#050807', 6.5, 15);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.1;

  const disposables = [];
  const tex = (t) => { disposables.push(t); return t; };

  // Room shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshStandardMaterial({ map: tex(speckleTexture('#1b1210', ['#3a2420', '#0a0605', '#4a2a22'], 5, [14, 14], 0.16)), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallMap = tex(wallTexture());
  wallMap.wrapS = THREE.RepeatWrapping;
  wallMap.repeat.set(2, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, roughness: 0.82 });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.6), wallMat);
  backWall.position.set(0, 2.3, -4.3);
  backWall.receiveShadow = true;
  scene.add(backWall);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.6), wallMat);
    side.position.set(s * 6.2, 2.3, 0.5);
    side.rotation.y = -s * Math.PI / 2;
    scene.add(side);
  }
  // Tall windows at dusk behind the board, with sheer curtains.
  const glow = new THREE.MeshBasicMaterial({ color: '#22364a' });
  const frameMat = clay('#1a0f08', 0.5);
  for (const x of [-4.5, 4.5]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.3), glow);
    pane.position.set(x, 2.55, -4.28);
    scene.add(pane);
    const sheer = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.3), new THREE.MeshBasicMaterial({ map: tex(canvasTexture(128, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#42566c');
      gr.addColorStop(1, '#16202b');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)'; g.fillRect(i * 8, 0, 4, h); }
    })) }));
    sheer.position.set(x, 2.55, -4.27);
    scene.add(sheer);
    for (const [fx, fy, fw, fh] of [[0, 1.19, 1.4, 0.08], [0, -1.19, 1.4, 0.1], [-0.66, 0, 0.08, 2.4], [0.66, 0, 0.08, 2.4], [0, 0, 0.04, 2.3], [0, 0.35, 1.25, 0.04]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.05), frameMat);
      bar.position.set(x + fx, 2.55 + fy, -4.25);
      scene.add(bar);
    }
    for (const s of [-1, 1]) {
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.9, 10), clay('#3d1418', 0.9));
      drape.position.set(x + s * 0.86, 2.3, -4.15);
      scene.add(drape);
    }
  }
  // A plain wall clock above the chair: it shows the real time.
  const clock = new THREE.Group();
  clock.position.set(0, 2.42, -4.26);
  clock.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 40).rotateX(Math.PI / 2), brass()));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.265, 40), clay('#efe7d3', 0.7));
  face.position.z = 0.022;
  clock.add(face);
  for (let i = 0; i < 12; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.012, i % 3 ? 0.03 : 0.055, 0.004), clay('#2a1c10', 0.6));
    const a = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(a) * 0.225, Math.cos(a) * 0.225, 0.026);
    tick.rotation.z = -a;
    clock.add(tick);
  }
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.14, 0.005).translate(0, 0.06, 0), clay('#1c130c', 0.5));
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.21, 0.005).translate(0, 0.095, 0), clay('#1c130c', 0.5));
  hourHand.position.z = 0.03;
  minuteHand.position.z = 0.034;
  clock.add(hourHand, minuteHand);
  scene.add(clock);

  // The crescent table: walnut top, green leather inlay, a panelled front.
  const sector = (rIn, rOut, span) => {
    const s = new THREE.Shape();
    const steps = 48;
    for (let i = 0; i <= steps; i++) { const a = rad(-span + (2 * span * i) / steps); const x = rOut * Math.sin(a); const y = rOut * Math.cos(a); if (i) s.lineTo(x, y); else s.moveTo(x, y); }
    for (let i = steps; i >= 0; i--) { const a = rad(-span + (2 * span * i) / steps); s.lineTo(rIn * Math.sin(a), rIn * Math.cos(a)); }
    s.closePath();
    return s;
  };
  const woodMap = tex(woodTexture('#4a2c18', '#1c0f07', 7, [1.2, 1.2]));
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, roughness: 0.36, metalness: 0.05 });
  const top = shadow(new THREE.Mesh(new THREE.ExtrudeGeometry(sector(R_IN, R_OUT, TABLE_SPAN), { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3, curveSegments: 48 }), wood));
  top.rotation.x = -Math.PI / 2;
  top.position.set(C.x, TABLE_Y - 0.062, C.z);
  scene.add(top);
  const inlay = new THREE.Mesh(new THREE.ShapeGeometry(sector(R_IN + 0.09, R_OUT - 0.09, TABLE_SPAN - 2.2), 48), new THREE.MeshStandardMaterial({ map: tex(speckleTexture('#12493a', ['#1c6650', '#0a2c22'], 9, [10, 4], 0.22)), roughness: 0.88 }));
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(C.x, TABLE_Y + 0.0012, C.z);
  inlay.receiveShadow = true;
  scene.add(inlay);
  const trim = new THREE.Mesh(new THREE.ShapeGeometry(sector(R_IN + 0.078, R_OUT - 0.078, TABLE_SPAN - 1.9), 48), brass());
  trim.rotation.x = -Math.PI / 2;
  trim.position.set(C.x, TABLE_Y + 0.0006, C.z);
  scene.add(trim);
  const panelMap = tex(woodTexture('#3a2112', '#150b05', 21, [10, 1]));
  const front = shadow(new THREE.Mesh(new THREE.CylinderGeometry(R_IN + 0.05, R_IN + 0.05, 0.7, 64, 1, true, Math.PI - rad(TABLE_SPAN - 1), rad(TABLE_SPAN - 1) * 2), new THREE.MeshStandardMaterial({ map: panelMap, roughness: 0.5, side: THREE.DoubleSide })));
  front.position.set(C.x, TABLE_Y - 0.4, C.z);
  scene.add(front);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R_IN + 0.056, R_IN + 0.056, 0.025, 64, 1, true, Math.PI - rad(TABLE_SPAN - 1), rad(TABLE_SPAN - 1) * 2), brass());
  skirt.position.set(C.x, TABLE_Y - 0.72, C.z);
  scene.add(skirt);

  // Pendant lamps over the table
  const lampShade = new THREE.MeshStandardMaterial({ color: '#1d3a2f', roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2b0' });
  for (const deg of [-30, 0, 30]) {
    const p = polar((R_IN + R_OUT) / 2 + 0.1, deg, 2.28);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 28, 1, true), lampShade);
    shade.position.copy(p);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.008, 8, 36), brass());
    rim.rotation.x = Math.PI / 2;
    rim.position.copy(p).y -= 0.1;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.2, 6), brass());
    rod.position.copy(p).y += 1.2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), bulb);
    b.position.copy(p).y -= 0.06;
    scene.add(shade, rim, rod, b);
  }

  // Lights
  scene.add(new THREE.HemisphereLight('#6f86a8', '#22140d', 0.2));
  const key = new THREE.SpotLight('#ffd3a0', KEY, 9, 0.95, 0.9, 1.7);
  key.position.set(0, 3.4, 0.9);
  key.target.position.copy(polar(2.3, 0, 0.7));
  key.castShadow = !low;
  key.shadow.mapSize.setScalar(quality === 'high' ? 2048 : 1024);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  key.shadow.camera.near = 0.6;
  key.shadow.camera.far = 8;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#6f8fc2', 0.55);
  rim.position.set(-2.5, 3.2, -4);
  scene.add(rim);
  const haloMap = tex(canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.28)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }));
  const sconce = (x, y, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffcf99' }));
    lamp.position.z = 0.09;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6).rotateX(Math.PI / 2), brass());
    arm.position.set(0, -0.05, 0.05);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloMap, color: '#ffb066', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.z = 0.12;
    halo.scale.setScalar(1.3);
    g.add(lamp, arm, halo);
    scene.add(g);
  };
  // The wall texture tiles twice along each wall, with a pool of light at 1/4 and 3/4 of every tile.
  for (const x of [-6.75, -2.25, 2.25, 6.75]) sconce(x, 2.3, -4.3, 0);
  for (const s of [-1, 1]) for (const z of [-4.75, -1.25, 2.25, 5.75]) sconce(s * 6.2, 2.3, z, -s * Math.PI / 2);
  for (const s of [-1, 1]) {
    const fill = new THREE.PointLight('#ffb878', 3.2, 6, 1.8);
    fill.position.set(s * 2.25, 2.3, -3.9);
    scene.add(fill);
  }

  // Dust in the lamp light
  let dust = null;
  if (!low) {
    const n = 70;
    const pos = new Float32Array(n * 3);
    const r = rng(99);
    for (let i = 0; i < n; i++) { const p = polar(1.5 + r() * 1.3, -45 + r() * 90, 0.95 + r() * 1.2); pos.set([p.x, p.y, p.z], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffe6c2', size: 0.007, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);
  }

  // The board
  const members = {};
  const spots = {};
  const speakers = {};
  for (const id of SEAT_ORDER) {
    const m = new Member(id, labels[id] || (id === 'chairman' ? 'Chairperson' : `Member ${id.slice(1)}`), quality);
    m.rand.offset = SEAT_ORDER.indexOf(id) * 1.7;
    members[id] = m;
    scene.add(m.root);
    speakers[id] = m.root.localToWorld(new THREE.Vector3(0, 1.28, 0));
    const spot = new THREE.SpotLight('#ffe1b8', 0, 5.5, 0.4, 0.9, 1.5);
    spot.position.copy(polar(SEAT_R - 1.25, SEAT_ANGLE[id], 2.7));
    spot.target.position.copy(polar(SEAT_R - 0.42, SEAT_ANGLE[id], 0.78));
    scene.add(spot, spot.target);
    spots[id] = spot;
  }

  // The Chairperson's extras: the candidate's file tied with red tape, and the call bell.
  {
    const ch = members.chairman.root;
    const file = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.022, 0.32, 2, 0.006), clay('#c9a86a', 0.85)), true);
    file.position.set(0.37, TABLE_Y + 0.012, 0.42);
    file.rotation.y = 0.16;
    const tapeMat = clay('#a3232a', 0.7);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.0235, 0.02), tapeMat);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0235, 0.325), tapeMat);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.04), new THREE.MeshStandardMaterial({ map: tex(canvasTexture(256, 96, (g, w, h) => { g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2018'; g.font = '700 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('D A F', w / 2, h / 2 + 3); })), roughness: 0.9 }));
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(-0.05, 0.0122, 0.09);
    file.add(t1, t2, tag);
    ch.add(file);
    const bellBase = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.012, 24), clay('#1b120b', 0.5)));
    bellBase.position.set(-0.4, TABLE_Y + 0.006, 0.66);
    const dome = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), brass()));
    dome.position.set(-0.4, TABLE_Y + 0.012, 0.66);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), brass());
    knob.position.set(-0.4, TABLE_Y + 0.062, 0.66);
    ch.add(bellBase, dome, knob);
  }
  // Tea for two of the members.
  for (const id of ['m1', 'm4']) {
    const porcelain = clay('#f1ede4', 0.35);
    const saucer = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.045, 0.01, 24), porcelain), false);
    saucer.position.set(0.37, TABLE_Y + 0.005, 0.42);
    const cup = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.05, 20), porcelain));
    cup.position.set(0.37, TABLE_Y + 0.035, 0.42);
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.033, 20), clay('#7a4a22', 0.3));
    tea.rotation.x = -Math.PI / 2;
    tea.position.set(0.37, TABLE_Y + 0.057, 0.42);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 14), porcelain);
    handle.position.set(0.41, TABLE_Y + 0.036, 0.42);
    members[id].root.add(saucer, cup, tea, handle);
  }

  // ------------------------------------------------------------------ camera

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  const cam = { pos: new THREE.Vector3(0, 1.5, 4.2), look: new THREE.Vector3(0, 1, -1.3), fov: 40 };
  const goal = { pos: cam.pos.clone(), look: cam.look.clone(), fov: 40 };
  const view = { w: 1, h: 1, top: 0, bottom: 0, tTop: 0, tBottom: 0, aspect: 1.6 };
  const parallax = { x: 0, y: 0, tx: 0, ty: 0, gain: 1 };
  let shotName = '';
  let shotAt = 0;

  const shots = {
    wide() {
      let fov = view.aspect < 1 ? 50 : 40;
      const half = Math.atan(Math.tan(rad(fov / 2)) * view.aspect);
      const edge = polar(SEAT_R, 36);
      const need = edge.x + 0.62; // half the width the shot must hold: the outer seats and a margin
      const z = Math.max(EYE.z, need / Math.tan(half) + edge.z);
      // A letterbox frame seen from the candidate's chair has room to spare: tighten the lens to fill it.
      if (z === EYE.z) fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(need / (z - edge.z) / view.aspect)), 24, fov);
      return { pos: new THREE.Vector3(0, 1.42 + (z - EYE.z) * 0.12, z), look: new THREE.Vector3(0, 0.95, -1.0), fov };
    },
    member(id) {
      const a = SEAT_ANGLE[id];
      // Narrow frames (phones) hold one member from head to hands, clear of the controls above.
      // Wide frames sit lower and closer, with the neighbours at the edges.
      const narrow = view.aspect < 1.7;
      const dist = narrow ? 1.9 : 1.8;
      const fov = narrow ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(0.49, 0.36 / view.aspect) / (dist - 0.36))) : 31;
      const pos = polar(SEAT_R - dist, a, 1.17);
      const side = new THREE.Vector3(Math.cos(rad(a)), 0, Math.sin(rad(a)));
      pos.addScaledVector(side, id === 'chairman' ? 0.16 : -Math.sign(a) * 0.2);
      return { pos, look: polar(SEAT_R - 0.36, a, narrow ? 0.98 : 0.88), fov };
    },
    hands(id) {
      const a = SEAT_ANGLE[id];
      const pos = polar(SEAT_R - 1.22, a, 1.2);
      const side = new THREE.Vector3(Math.cos(rad(a)), 0, Math.sin(rad(a)));
      pos.addScaledVector(side, -0.3);
      return { pos, look: polar(SEAT_R - 0.47, a, 0.8), fov: view.aspect < 1.2 ? 34 : 27 };
    },
    confer() {
      const w = shots.wide();
      w.pos.y += 0.1;
      w.fov -= 1.5;
      return w;
    },
    finale() {
      const portrait = view.aspect < TWO_ROWS;
      const width = portrait ? 0.62 : 1.02;
      const fov = 32;
      const half = Math.atan(Math.tan(rad(fov / 2)) * view.aspect);
      const d = Math.max(0.95, (width / 2) / Math.tan(half));
      const look = polar(R_IN + (portrait ? 0.29 : 0.2), 0, TABLE_Y);
      return { pos: new THREE.Vector3(0, TABLE_Y + d * 0.86, look.z + d * 0.52), look, fov };
    }
  };
  const setShot = (name, id, now, cut = false) => {
    const key = `${name}:${id || ''}`;
    if (key === shotName) return;
    shotName = key;
    shotAt = now;
    const s = shots[name](id);
    goal.pos.copy(s.pos);
    goal.look.copy(s.look);
    goal.fov = s.fov;
    if (cut) { cam.pos.copy(s.pos); cam.look.copy(s.look); cam.fov = s.fov; }
  };
  const refreshShot = () => { const k = shotName; shotName = ''; const [name, id] = k.split(':'); if (shots[name]) setShot(name, id || undefined, shotAt, false); layoutFinale(); };

  const applyCamera = (dt, now) => {
    const k = 1 - Math.exp(-dt * 2.6);
    cam.pos.lerp(goal.pos, k);
    cam.look.lerp(goal.look, k);
    cam.fov += (goal.fov - cam.fov) * k;
    parallax.x = damp(parallax.x, parallax.tx, 6, dt);
    parallax.y = damp(parallax.y, parallax.ty, 6, dt);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    // The "window": moving your head (or mouse, or phone) slides the camera, the subject stays put.
    const dist = cam.pos.distanceTo(cam.look);
    const amp = 0.075 * dist * parallax.gain;
    camera.position.addScaledVector(_v1.setFromMatrixColumn(camera.matrixWorld, 0), parallax.x * amp + Math.sin(now * 0.21) * 0.012);
    camera.position.addScaledVector(_v2.setFromMatrixColumn(camera.matrixWorld, 1), parallax.y * amp * 0.55 + Math.sin(now * 0.17) * 0.008);
    camera.lookAt(cam.look);
    // Keep the subject centred in the part of the canvas the overlays leave free.
    view.top = damp(view.top, view.tTop, 5, dt);
    view.bottom = damp(view.bottom, view.tBottom, 5, dt);
    const inner = Math.max(80, view.h - view.top - view.bottom);
    const full = view.h + Math.abs(view.bottom - view.top);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(rad(cam.fov / 2)) * (full / inner)));
    camera.aspect = view.w / full;
    if (view.top > 0.5 || view.bottom > 0.5) camera.setViewOffset(view.w, full, 0, view.bottom > view.top ? view.bottom - view.top : 0, view.w, view.h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ state + direction

  const state = { phase: 'idle', active: 'chairman', level: 0, autoLevel: false, followUp: false, paused: false, phaseAt: 0 };
  let finale = null;
  let now = 0;
  let last = performance.now();
  let raf = 0;
  let acc = 0;
  let disposed = false;
  const frameGap = quality === 'high' ? 0 : low ? 1 / 24 : 1 / 30;

  const direct = () => {
    if (finale) { setShot('finale', undefined, now); return; }
    const { phase, active } = state;
    const since = now - state.phaseAt;
    if (phase === 'asking') {
      if (state.followUp && since < 1.9) setShot('hands', active, now);
      else setShot('member', active, now);
    } else if (phase === 'answering') {
      // Mostly the member who asked; now and then the whole board, or someone's pen at work.
      const cycle = since % 46;
      if (cycle < 15) setShot('member', active, now);
      else if (cycle < 24) setShot('wide', undefined, now);
      else if (cycle < 38) setShot('member', active, now);
      else {
        const writer = SEAT_ORDER.find((id) => now < members[id].writeUntil);
        if (writer && shotName.startsWith('hands')) return;
        if (writer) setShot('hands', writer, now); else setShot('member', active, now);
      }
    } else if (phase === 'submitting') setShot('confer', undefined, now);
    else if (phase === 'closing') setShot('member', 'chairman', now);
    else setShot('wide', undefined, now);
  };

  const pads = SEAT_ORDER.map((id) => ({ id, x: 0, y: 0, visible: false }));
  const projectPads = () => {
    for (const p of pads) {
      const m = members[p.id];
      _v1.copy(m.padTop);
      m.root.localToWorld(_v1);
      _v1.project(camera);
      p.visible = _v1.z < 1 && Math.abs(_v1.x) < 0.98 && _v1.y > -0.98 && _v1.y < 0.98;
      p.x = (_v1.x * 0.5 + 0.5) * view.w;
      p.y = (-_v1.y * 0.5 + 0.5) * view.h;
    }
  };

  // Where the marks cards come to rest: one row in a wide frame, three and two in a tall one.
  const layoutFinale = () => {
    if (!finale) return;
    const slots = view.aspect < TWO_ROWS
      ? [[-5.4, 0.42], [0, 0.42], [5.4, 0.42], [-2.9, 0.16], [2.9, 0.16]]
      : [[-11.4, 0.2], [-5.7, 0.2], [0, 0.2], [5.7, 0.2], [11.4, 0.2]];
    finale.cards.forEach((c, i) => {
      c.to.copy(polar(R_IN + slots[i][1], slots[i][0], TABLE_Y + 0.006));
      c.yawTo = -rad(slots[i][0]) * 0.6;
    });
  };

  // The marks cards (built when the finale starts).
  const startFinale = (marks, { onReveal, onDone } = {}) => {
    const back = tex(cardBack());
    const edge = clay('#efe8d4', 0.8);
    const cards = SEAT_ORDER.map((id, i) => {
      const mk = marks.find((x) => x.id === id) || { marks: 0, outOf: 55, label: id };
      const front = tex(cardFace(mk.label || id, mk.marks, mk.outOf));
      front.center.set(0.5, 0.5);
      front.rotation = Math.PI;
      const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.004, 0.213), [edge, edge, new THREE.MeshStandardMaterial({ map: back, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: front, roughness: 0.75 }), edge, edge]));
      const from = members[id].root.localToWorld(new THREE.Vector3(-0.02, TABLE_Y + 0.006, 0.62));
      mesh.position.copy(from);
      mesh.rotation.y = -rad(SEAT_ANGLE[id]);
      scene.add(mesh);
      return { id, mesh, from, to: from.clone(), yawFrom: -rad(SEAT_ANGLE[id]), yawTo: 0, start: 0.5 + i * 0.22, flipAt: 3.5 + i * 0.85, revealed: false };
    });
    finale = { at: now, cards, onReveal, onDone, done: false };
    layoutFinale();
    for (const c of cards) members[c.id].startTell('push', now + c.start - 0.25);
  };

  const updateFinale = () => {
    const t = now - finale.at;
    // The nameplates sink out of the way so nothing hides a card.
    for (const id of SEAT_ORDER) members[id].plate.position.y = TABLE_Y + 0.036 - ease(t / 0.9) * 0.11;
    for (const c of finale.cards) {
      const u = ease((t - c.start) / 1.25);
      c.mesh.position.lerpVectors(c.from, c.to, u);
      c.mesh.rotation.y = lerp(c.yawFrom, c.yawTo, u);
      const f = clamp((t - c.flipAt) / 0.75, 0, 1);
      c.mesh.position.y = TABLE_Y + 0.006 + bell(f) * 0.11;
      c.mesh.rotation.z = ease(f) * Math.PI;
      if (f > 0.55 && !c.revealed) { c.revealed = true; finale.onReveal?.(c.id); }
    }
    if (!finale.done && t > finale.cards[finale.cards.length - 1].flipAt + 1.1) { finale.done = true; finale.onDone?.(); }
  };

  const frame = (ms) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dtReal = clamp((ms - last) / 1000, 0, 0.1);
    last = ms;
    if (frameGap) { acc += dtReal; if (acc < frameGap) return; }
    const dt = frameGap ? Math.min(0.1, acc) : dtReal;
    acc = 0;
    step(dt);
    renderer.render(scene, camera);
    if (onFrame) { projectPads(); onFrame(pads); }
  };

  // Advance the room by dt seconds (no drawing).
  const step = (dt) => {
    if (state.paused) { // hold the picture; a slow drift keeps it from looking frozen
      now += dt * 0.15;
      applyCamera(dt * 0.15, now);
      return;
    }
    now += dt;
    direct();
    // The browser's own voice gives no loudness to follow, so the gestures get a plausible rhythm instead.
    const level = state.autoLevel ? 0.22 + 0.4 * Math.abs(Math.sin(now * 7.3)) * (0.55 + 0.45 * Math.sin(now * 2.1)) : state.level;
    const ctx = { phase: finale ? 'finale' : state.phase, active: state.active, level, speakers };
    for (const id of SEAT_ORDER) {
      const m = members[id];
      m.update(dt, now, ctx);
      const lit = finale ? 0.4 : state.phase === 'idle' || state.phase === 'submitting' ? 0.5 : id === state.active ? 1 : 0.12;
      spots[id].intensity = damp(spots[id].intensity, lit * SPOT, 3, dt);
    }
    key.intensity = damp(key.intensity, finale ? KEY * 1.7 : KEY, 2, dt);
    if (finale) updateFinale();
    if (dust) { dust.rotation.y = Math.sin(now * 0.03) * 0.05; dust.position.y = Math.sin(now * 0.11) * 0.04; }
    const d = new Date();
    minuteHand.rotation.z = -((d.getMinutes() + d.getSeconds() / 60) / 60) * Math.PI * 2;
    hourHand.rotation.z = -(((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2;
    applyCamera(dt, now);
  };

  const api = {
    resize(w, h) {
      view.w = Math.max(1, w);
      view.h = Math.max(1, h);
      view.aspect = view.w / Math.max(80, view.h - view.tTop - view.tBottom);
      renderer.setSize(view.w, view.h, false);
      refreshShot();
    },
    setInsets(top, bottom) {
      if (Math.abs(top - view.tTop) < 2 && Math.abs(bottom - view.tBottom) < 2) return;
      view.tTop = top;
      view.tBottom = bottom;
      view.aspect = view.w / Math.max(80, view.h - top - bottom);
      refreshShot();
    },
    setState(next) {
      const phaseChanged = next.phase !== undefined && next.phase !== state.phase;
      const activeChanged = next.active !== undefined && next.active !== state.active;
      Object.assign(state, next);
      if (phaseChanged || activeChanged) {
        state.phaseAt = now;
        if (state.phase === 'asking') {
          const m = members[state.active];
          if (m && state.followUp) m.startTell('penTap', now);
        }
      }
    },
    setLevel(level, auto = false) { state.level = level; state.autoLevel = auto; },
    setParallax(x, y, gain = 1) { parallax.tx = clamp(x, -1, 1); parallax.ty = clamp(y, -1, 1); parallax.gain = gain; },
    // Run the room forward without waiting for real time (used by tests and screenshots).
    simulate(seconds) { for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30); renderer.render(scene, camera); },
    tell(id, name) { members[id]?.startTell(name, now); },
    // pleased | neutral | sceptical | displeased: how a member took the answer they just heard.
    setMood(id, mood) { members[id]?.setMood(mood, now); },
    setUnread(id, on) { if (members[id]) members[id].glow = on ? 1 : 0; },
    playFinale(marks, handlers) { if (!finale) startFinale(marks, handlers); },
    snapshot() { return { shot: shotName, phase: state.phase, active: state.active, finale: !!finale }; },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { if (m.map) m.map.dispose(); m.dispose(); }
      });
      for (const t of disposables) t.dispose();
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    }
  };

  setShot('wide', undefined, 0, true);
  raf = requestAnimationFrame(frame);
  return api;
}
