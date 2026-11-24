// CONDOR-1: the SBPD air unit. Deploys when the wanted level hits 4
// stars — a helicopter that holds above the player with its searchlight
// cone on them, the way the genre's police escalate. It never lands and
// never shoots; it watches, and its cone is the tell that the whole
// department is on you.
import * as THREE from 'three';

export class Helicopter {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.cone = null;
    this.rotor = null;
    this.active = false;
    this.angle = 0;
  }

  deploy() {
    if (this.active) return;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5.2), bodyMat);
    body.position.y = 0;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.9, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x9fd0e8, roughness: 0.15, metalness: 0.7 }),
    );
    glass.position.set(0, 0.1, 2.0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.2), bodyMat);
    tail.position.set(0, 0.3, -4.2);
    const skidMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 4.6), skidMat);
    skidL.position.set(-1.3, -1.1, 0);
    const skidR = skidL.clone();
    skidR.position.x = 1.3;
    const rotor = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), bladeMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 11), bladeMat);
    rotor.add(blade1, blade2);
    rotor.position.y = 1.2;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }),
    );
    lamp.position.set(0, -0.9, 1.6);
    g.add(body, glass, tail, skidL, skidR, rotor, lamp);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    this.mesh = g;
    this.rotor = rotor;
    this.scene.add(g);

    // Searchlight cone: from the heli down to the street.
    const coneGeo = new THREE.ConeGeometry(5.5, 42, 20, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.14,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.cone = new THREE.Mesh(coneGeo, coneMat);
    this.scene.add(this.cone);
    this.active = true;
  }

  clear() {
    if (this.mesh) this.scene.remove(this.mesh);
    if (this.cone) this.scene.remove(this.cone);
    this.mesh = null; this.cone = null; this.rotor = null;
    this.active = false;
  }

  // Orbit above the player, rotor spinning, cone pinned on them.
  step(dt, px, pz) {
    if (!this.active) return;
    this.angle += dt * 0.35;
    const hx = px + Math.cos(this.angle) * 16;
    const hz = pz + Math.sin(this.angle) * 16;
    const hy = 42;
    this.mesh.position.set(hx, hy, hz);
    this.mesh.rotation.y = Math.atan2(px - hx, pz - hz);
    if (this.rotor) this.rotor.rotation.y += dt * 22;
    this.cone.position.set((hx + px) / 2, hy / 2, (hz + pz) / 2);
    this.cone.lookAt(px, 0, pz);
    this.cone.rotateX(-Math.PI / 2);
  }
}
