// Story + missions: eight jobs from fixer Lena Voss, chained in order.
// Each mission has an objective text, a target point (with a beacon and a
// HUD arrow), a check for completion, and a cash reward. Failing (busted
// or target lost) restarts the mission, not the game. Every job also
// carries Lena's briefing line (the dialogue box) and a stage line the
// HUD shows, so the player always knows the job, the stage and the next
// step: JOB 6 wrecks a fleeing car by ramming, JOB 7 is a timed three
// -checkpoint courier run, JOB 8 clears the docks and delivers the score.
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
        brief: 'Danny. Package at Marina Plaza. Walk or borrow wheels — just get it.',
        target: L.plaza, radius: 9, reward: 150,
      },
      {
        id: 'wheels',
        title: 'JOB 2 — HOT WHEELS',
        text: 'The crew needs a fast car. Steal the red sports car parked by Aurora Tower (press E next to it) and bring it to the garage.',
        brief: 'We need wheels with a pulse. That red sports car by Aurora Tower — bring it to Reyes.',
        target: L.tower, radius: 12, reward: 300, needsCar: 'sports',
      },
      {
        id: 'payback',
        title: 'JOB 3 — PAYBACK',
        text: 'Rival crew "The Docks" jumped one of ours. Take down 4 rivals at the Bay Docks — punch (F) or shoot (click).',
        brief: 'The Docks jumped one of ours. Four of them at the bay. Make it hurt.',
        target: L.docks, radius: 16, reward: 450, rivals: 4,
      },
      {
        id: 'getaway',
        title: 'JOB 4 — THE GETAWAY',
        text: 'The pickup went loud. Lose the heat: reach 3 wanted stars, then drop back to 0 without getting busted.',
        brief: 'You went loud, Danny. Get to three stars, then vanish. Lose them all.',
        target: L.beach, radius: 14, reward: 600, getaway: true, peaked: false,
      },
      {
        id: 'heist',
        title: 'JOB 5 — BAY HEIST',
        text: 'Grab the syndicate cash at Sunset Pier and deliver it to the garage. Cops will be watching — drive fast.',
        brief: 'Syndicate cash is sitting at Sunset Pier. Grab it, run it to Reyes. Fast.',
        target: L.pier, radius: 10, reward: 1200, thenDeliver: L.garage,
      },
      {
        id: 'meridian',
        title: 'JOB 6 — THE MERIDIAN JOB',
        text: 'A syndicate Meridian GT is fleeing the docks. Ram it three times until it is wrecked — on foot you cannot hurt it.',
        brief: 'A syndicate Meridian is running from the docks. Put it in a wall. Three good hits.',
        target: L.docks, radius: 20, reward: 900, wreck: true,
      },
      {
        id: 'courier',
        title: 'JOB 7 — COURIER RUN',
        text: 'Three drops, one clock: Sunset Pier, then Marina Plaza, then the garage — 2:30 on the clock. Late means the deal dies.',
        brief: 'Three drops, two and a half minutes. Pier, plaza, garage. Do not be late.',
        target: L.pier, radius: 10, reward: 1000, courier: true,
        checkpoints: [L.pier, L.plaza, L.garage], timeLimit: 150,
      },
      {
        id: 'lastscore',
        title: 'JOB 8 — THE LAST SCORE',
        text: 'Final job: clear 6 syndicate guards at the Bay Docks, then run the score to Sunset Pier. Finish this and Solmar Bay is yours.',
        brief: 'Last one, Danny. Six guards at the docks, then the score goes to the pier. End it.',
        target: L.docks, radius: 16, reward: 2000, rivals: 6, thenDeliver: L.pier,
      },
    ];
  }

  current() { return this.list[this.index]; }

  jobLabel() {
    return this.done ? 'STORY COMPLETE' : `JOB ${this.index + 1}/8`;
  }

  start() {
    this.state = 'active';
    this.timer = 0;
    this.rivalsDown = 0;
    const m = this.current();
    this.target = m ? m.target : null;
    if (!m) return;
    m.peaked = false;
    m.delivered = false;
    m.spawned = false;
    m.phase = 0;
    m.checkpointIndex = 0;
    m.targetCondition = 100;
    m.ramCd = 0;
    if (m.courier) this.target = m.checkpoints[0];
  }

  // Returns 'done' | 'failed' | 'retarget' | 'ram' | null.
  // Called every frame with live state.
  step(dt, ctx) {
    if (this.state !== 'active' || this.done) return null;
    const m = this.current();
    if (!m) return null;
    this.timer += dt;
    if (m.ramCd > 0) m.ramCd -= dt;
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    const d = Math.hypot(px - m.target.x, pz - m.target.z);

    if (m.courier) {
      const left = m.timeLimit - this.timer;
      if (left <= 0) return 'failed';
      const cp = m.checkpoints[m.checkpointIndex];
      if (Math.hypot(px - cp.x, pz - cp.z) < m.radius) {
        m.checkpointIndex += 1;
        if (m.checkpointIndex >= m.checkpoints.length) return this._complete();
        this.target = m.checkpoints[m.checkpointIndex];
        return 'retarget';
      }
      return null;
    }
    if (m.wreck) {
      const t = ctx.targetCar;
      if (t && ctx.playerCar) {
        const td = Math.hypot(ctx.playerCar.x - t.x, ctx.playerCar.z - t.z);
        if (td < 3.6 && m.ramCd <= 0) {
          m.ramCd = 1.5;
          m.targetCondition = Math.max(0, m.targetCondition - 34);
          if (m.targetCondition <= 0) return this._complete();
          return 'ram';
        }
      }
      return null;
    }
    if (m.getaway) {
      if (ctx.wanted >= 3) m.peaked = true;
      if (m.peaked && ctx.wanted === 0) return this._complete();
      return null;
    }
    if (m.rivals) {
      if (m.phase === 0) {
        if (this.rivalsDown >= m.rivals) {
          if (m.thenDeliver) {
            m.phase = 1;
            this.target = m.thenDeliver;
            return 'retarget';
          }
          return this._complete();
        }
        return null;
      }
      const dg = Math.hypot(px - m.thenDeliver.x, pz - m.thenDeliver.z);
      if (dg < 12) return this._complete();
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

  // The stage line for the HUD: job number, stage, and the live count.
  stageText() {
    const m = this.current();
    if (!m) return '';
    const job = `JOB ${this.index + 1}/8`;
    if (m.courier) {
      const left = Math.max(0, Math.ceil(m.timeLimit - this.timer));
      return `${job} · CHECKPOINT ${Math.min(m.checkpointIndex + 1, 3)}/3 · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} LEFT`;
    }
    if (m.wreck) return `${job} · TARGET CONDITION ${m.targetCondition}% · RAM IT`;
    if (m.rivals) {
      const stage = m.thenDeliver ? (m.phase === 0 ? 'STAGE 1/2 — CLEAR' : 'STAGE 2/2 — DELIVER') : 'CLEAR THEM';
      return `${job} · ${stage} · RIVALS ${this.rivalsDown}/${m.rivals}`;
    }
    if (m.getaway) return `${job} · ${m.peaked ? 'HEAT PEAKED — NOW LOSE THEM' : 'RAISE HEAT TO 3 STARS'}`;
    if (m.needsCar || m.thenDeliver) return `${job} · STAGE ${m.delivered ? '2/2 — DELIVER' : '1/2 — GET THERE'}`;
    return `${job} · GET THERE`;
  }

  // The next step, in one line, for the HUD.
  nextText() {
    const m = this.current();
    if (!m) return '';
    if (m.courier) {
      const names = ['Sunset Pier', 'Marina Plaza', "Reyes' Garage"];
      return `NEXT: ${names[Math.min(m.checkpointIndex, 2)]}`;
    }
    if (m.wreck) return 'NEXT: Wreck the Meridian GT';
    if (m.rivals && m.phase === 1) return "NEXT: Deliver the score to Sunset Pier";
    if (m.needsCar && m.delivered) return "NEXT: Deliver it to Reyes' Garage";
    if (m.thenDeliver && m.delivered) return 'NEXT: Deliver it';
    return '';
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
