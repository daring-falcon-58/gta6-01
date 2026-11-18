// Solmar Bay: a sun-soaked coastal grid city, built procedurally from a
// seed — roads, blocks of towers, palm-lined beach, ocean, pier, park and
// street props. Exports the colliders, the road graph (for traffic and
// pedestrians) and the named landmarks missions point at.
import * as THREE from 'three';
import { mulberry32, pick, range } from './rng.js';

export const CITY = {
  half: 200,          // city extends -200..200 on x and z
  block: 40,          // road spacing
  roadWidth: 10,
  beachZ: 172,        // south edge: beach then ocean
};

const PALETTE = [0x2e4a6b, 0x6b4a2e, 0x3d6b52, 0x7a6a3d, 0x5b3d6b, 0x2e6b6b, 0x8a5a2e, 0x46586b];
const ROOF = [0x39424e, 0x4e3a2e, 0x2e4a3a, 0x524a3a];

function windowTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#' + base.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      g.fillStyle = rng() < 0.45 ? '#ffe9a8' : '#1d2f45';
      g.fillRect(x, y, 8, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = []; // {minX, maxX, minZ, maxZ}
  const roads = [];     // road centre lines for traffic: {axis:'x'|'z', at, from, to}

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a2f22, 1.1));
  scene.fog = new THREE.Fog(0xcfe4f5, 260, 620);

  // Ground: grass-green base, sand beach strip, ocean plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: 0x4a7a45, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 34),
    new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.05, CITY.beachZ + 8);
  beach.receiveShadow = true;
  group.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 260),
    new THREE.MeshStandardMaterial({ color: 0x1d6fb8, roughness: 0.25, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.beachZ + 150);
  group.add(ocean);

  // Roads: asphalt strips on the grid, with centre dashes.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.95 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5d76e });
  const roadLines = [];
  for (let a = -CITY.half; a <= CITY.half; a += CITY.block) {
    roadLines.push(a);
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(2 * CITY.half, CITY.roadWidth), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.08, a); rx.receiveShadow = true;
    group.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 2 * CITY.half), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(a, 0.08, 0); rz.receiveShadow = true;
    group.add(rz);
    roads.push({ axis: 'x', at: a, from: -CITY.half, to: CITY.half });
    roads.push({ axis: 'z', at: a, from: -CITY.half, to: CITY.half });
    for (let d = -CITY.half + 8; d < CITY.half; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.1, a);
      group.add(dash);
    }
  }

  // Buildings: one or two towers per block. Blocks sit BETWEEN the roads,
  // so block centres are offset half a block from the road lines (roads
  // run on multiples of 40; blocks centre on -180, -140, ...). Centring
  // them on the road lines put towers in the middle of the asphalt.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -CITY.half + CITY.block / 2; bx < CITY.half; bx += CITY.block) {
    for (let bz = -CITY.half + CITY.block / 2; bz < CITY.beachZ - 10; bz += CITY.block) {
      if (Math.abs(bx) < 24 && Math.abs(bz) < 24) continue; // central plaza
      if (rng() < 0.12) continue; // empty lot / parking
      const w = range(rng, 12, 22);
      const d = range(rng, 12, 22);
      const h = range(rng, 10, rng() < 0.18 ? 64 : 30);
      const base = pick(rng, PALETTE);
      const mat = new THREE.MeshStandardMaterial({ map: windowTexture(rng, base), roughness: 0.85 });
      const tower = new THREE.Mesh(boxGeo, mat);
      tower.scale.set(w, h, d);
      tower.position.set(bx + range(rng, -4, 4), h / 2, bz + range(rng, -4, 4));
      tower.castShadow = true; tower.receiveShadow = true;
      group.add(tower);
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: pick(rng, ROOF), roughness: 1 }));
      roof.scale.set(w + 0.6, 1, d + 0.6);
      roof.position.set(tower.position.x, h + 0.5, tower.position.z);
      group.add(roof);
      colliders.push({
        minX: tower.position.x - w / 2 - 0.5, maxX: tower.position.x + w / 2 + 0.5,
        minZ: tower.position.z - d / 2 - 0.5, maxZ: tower.position.z + d / 2 + 0.5,
      });
    }
  }

  // Central plaza: fountain + palms.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 12, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x9fb4c7, roughness: 0.6 }),
  );
  plaza.position.set(0, 0.6, 0);
  plaza.castShadow = true;
  group.add(plaza);
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 2.2, 5, 12),
    new THREE.MeshStandardMaterial({ color: 0x7fc4e8, roughness: 0.2, transparent: true, opacity: 0.8 }),
  );
  jet.position.set(0, 3.5, 0);
  group.add(jet);

  // Palm trees along the beach and plaza.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8a4a, roughness: 1 });
  function palm(x, z) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 8), trunkMat);
    trunk.position.y = 3.5; trunk.castShadow = true;
    p.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      p.add(leaf);
    }
    p.position.set(x, 0, z);
    group.add(p);
  }
  for (let x = -180; x <= 180; x += 24) palm(x + range(rng, -4, 4), CITY.beachZ - 2);
  for (let i = 0; i < 8; i += 1) palm(Math.cos(i * 0.8) * 18, Math.sin(i * 0.8) * 18);

  // Pier into the ocean.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 70), new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 }));
  pier.position.set(-120, 0.8, CITY.beachZ + 40);
  pier.castShadow = true;
  group.add(pier);

  // Street lights at intersections.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdf8a, emissiveIntensity: 0.7 });
  for (let a = -160; a <= 160; a += 40) {
    for (const b of [-160, -80, 0, 80, 160]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), poleMat);
      pole.position.set(a + 6, 3, b + 6);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), lampMat);
      lamp.position.set(a + 6, 6.1, b + 6);
      group.add(lamp);
    }
  }

  scene.add(group);
  return {
    group, colliders, roads,
    landmarks: {
      plaza: { x: 0, z: 0, label: 'Marina Plaza' },
      pier: { x: -120, z: CITY.beachZ + 30, label: 'Sunset Pier' },
      beach: { x: 60, z: CITY.beachZ + 4, label: 'Solmar Beach' },
      garage: { x: 120, z: -120, label: "Reyes' Garage" },
      docks: { x: -160, z: 120, label: 'Bay Docks' },
      tower: { x: 80, z: 80, label: 'Aurora Tower' },
    },
  };
}

// Push a circle (x,z,r) out of building colliders; returns corrected pos.
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx; const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - c.minX; const pr = c.maxX - x;
        const pt = z - c.minZ; const pb = c.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r;
        else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r;
        else z = c.maxZ + r;
      }
    }
  }
  return { x, z };
}

export function clampToCity(x, z) {
  return {
    x: Math.max(-CITY.half + 4, Math.min(CITY.half - 4, x)),
    z: Math.max(-CITY.half + 4, Math.min(CITY.beachZ + 26, z)),
  };
}
