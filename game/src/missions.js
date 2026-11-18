// Story + missions: five jobs from fixer Lena Voss, chained in order.
// Each mission has an objective text, a target point (with a beacon and a
// HUD arrow), a check for completion, and a cash reward. Failing (busted
// or target lost) restarts the mission, not the game.
export class Missions {
  constructor(landmarks) {
    this.landmarks = landmarks;
    this.index = 0;
    this.done = false;
    this.state = 'idle'; // idle | active | complete
    this.target = null;
    this.timer = 0;
    this.rivalsDown = 0;
    this.define();
  }

  define() {
    const L = this.landmarks;
    this.list = [
      {
        id: 'pickup',
        title: 'JOB 1 — THE PICKUP',
        text: 'Lena needs a package from Marina Plaza. Get there — on foot or in a car you "borrow".',
        target: L.plaza, radius: 9, reward: 150,
      },
      {
        id: 'wheels',
        title: 'JOB 2 — HOT WHEELS',
        text: 'The crew needs a fast car. Steal the red sports car parked by Aurora Tower (press E next to it) and bring it to the garage.',
        target: L.tower, radius: 12, reward: 300, needsCar: 'sports',
      },
      {
        id: 'payback',
        title: 'JOB 3 — PAYBACK',
        text: 'Rival crew "The Docks" jumped one of ours. Take down 4 rivals at the Bay Docks — punch (F) or shoot (click).',
        target: L.docks, radius: 16, reward: 450, rivals: 4,
      },
      {
        id: 'getaway',
        title: 'JOB 4 — THE GETAWAY',
        text: 'The pickup went loud. Lose the heat: reach 3 wanted stars, then drop back to 0 without getting busted.',
        target: L.beach, radius: 14, reward: 600, getaway: true, peaked: false,
      },
      {
        id: 'heist',
        title: 'JOB 5 — BAY HEIST',
        text: 'Final job: grab the syndicate cash at Sunset Pier and deliver it to the garage. Cops will be watching — drive fast.',
        target: L.pier, radius: 10, reward: 1200, thenDeliver: L.garage,
      },
    ];
  }

  current() { return this.list[this.index]; }

  start() {
    this.state = 'active';
    this.timer = 0;
    this.rivalsDown = 0;
    const m = this.current();
    this.target = m ? m.target : null;
    if (m) m.peaked = false;
    if (m) m.delivered = false;
  }

  // Returns 'done' | 'failed' | null. Called every frame with live state.
  step(dt, ctx) {
    if (this.state !== 'active' || this.done) return null;
    const m = this.current();
    if (!m) return null;
    this.timer += dt;
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    const d = Math.hypot(px - m.target.x, pz - m.target.z);

    if (m.getaway) {
      if (ctx.wanted >= 3) m.peaked = true;
      if (m.peaked && ctx.wanted === 0) return this._complete();
      this.target = ctx.wanted >= 3 ? m.target : m.target;
      return null;
    }
    if (m.rivals) {
      if (this.rivalsDown >= m.rivals) return this._complete();
      return null;
    }
    if (m.needsCar) {
      if (d < m.radius && ctx.playerCar && ctx.playerCar.kind === m.needsCar) {
        // Reached the tower in the sports car: now deliver it to the garage.
        if (!m.delivered) { m.delivered = true; this.target = this.landmarks.garage; return 'retarget'; }
      }
      if (m.delivered) {
        const dg = Math.hypot(px - this.landmarks.garage.x, pz - this.landmarks.garage.z);
        if (dg < 12 && ctx.playerCar && ctx.playerCar.kind === m.needsCar) return this._complete();
      }
      return null;
    }
    if (m.thenDeliver) {
      if (!m.delivered && d < m.radius) { m.delivered = true; this.target = m.thenDeliver; return 'retarget'; }
      if (m.delivered) {
        const dg = Math.hypot(px - m.thenDeliver.x, pz - m.thenDeliver.z);
        if (dg < 12) return this._complete();
      }
      return null;
    }
    if (d < m.radius) return this._complete();
    return null;
  }

  _complete() {
    const m = this.current();
    this.state = 'complete';
    this.index += 1;
    if (this.index >= this.list.length) this.done = true;
    return 'done';
  }

  // After a fail, restart the same mission fresh.
  restart() {
    this.state = 'idle';
    this.start();
  }

  // The rival count for JOB 3, shown on the HUD.
  progressText() {
    const m = this.current();
    if (!m) return '';
    if (m.rivals) return `Rivals down: ${this.rivalsDown}/${m.rivals}`;
    if (m.getaway) return m.peaked ? 'Heat peaked — now lose them!' : 'Raise heat to 3 stars first';
    return '';
  }
}
