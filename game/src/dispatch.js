// SBPD dispatch: every police cruiser gets a callsign and a role, and
// the board the HUD shows is built from the live chase — the nearest
// unit rams, the rest pursue, and the farthest sets a roadblock ahead
// of the player's direction of travel. CONDOR-1 (the air unit) holds
// the SPOTLIGHT row whenever it is up.
const CALLSIGNS = [
  'SBPD-07', 'SBPD-12', 'SBPD-19', 'SBPD-23', 'SBPD-31', 'SBPD-44',
];

export class Dispatch {
  constructor() {
    this.callsigns = new Map(); // police car object -> callsign
    this.next = 0;
    this.roadblockCar = null;
  }

  clear() {
    this.callsigns.clear();
    this.next = 0;
    this.roadblockCar = null;
  }

  callsignFor(car) {
    if (!this.callsigns.has(car)) {
      this.callsigns.set(car, CALLSIGNS[this.next % CALLSIGNS.length]);
      this.next += 1;
    }
    return this.callsigns.get(car);
  }

  // Rows for the HUD board: {callsign, role, dist}, nearest first,
  // at most 5 rows, plus the air unit on top when it flies. The
  // roadblock unit is always pinned into the visible set even though
  // it is the farthest car — otherwise it would always be sliced off.
  board(cars, px, pz, heliActive) {
    const rows = cars.map((c) => ({
      car: c,
      callsign: this.callsignFor(c),
      dist: Math.round(Math.hypot(px - c.x, pz - c.z)),
    }));
    rows.sort((a, b) => a.dist - b.dist);
    rows.forEach((r, i) => {
      let role = 'PURSUE';
      if (i === 0) role = 'RAMMING';
      else if (this.roadblockCar === r.car) role = 'ROADBLOCK';
      else if (r.dist > 90) role = 'CLOSING IN';
      r.role = role;
    });
    let shown = rows.slice(0, 4);
    const rb = rows.find((r) => this.roadblockCar === r.car);
    if (rb && !shown.includes(rb)) shown[shown.length - 1] = rb;
    const out = [];
    if (heliActive) out.push({ callsign: 'CONDOR-1', role: 'SPOTLIGHT', dist: 0, air: true });
    for (const r of shown) out.push({ callsign: r.callsign, role: r.role, dist: r.dist });
    return out.slice(0, 5);
  }

  // Pick the roadblock car: the farthest cruiser, re-picked when the
  // set of cruisers changes. Returns it (or null).
  pickRoadblock(cars, px, pz) {
    if (cars.length < 3) { this.roadblockCar = null; return null; }
    if (!this.roadblockCar || !cars.includes(this.roadblockCar)) {
      let far = null; let farD = -1;
      for (const c of cars) {
        const d = Math.hypot(px - c.x, pz - c.z);
        if (d > farD) { farD = d; far = c; }
      }
      this.roadblockCar = far;
    }
    return this.roadblockCar;
  }
}
