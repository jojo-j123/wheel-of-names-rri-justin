/**
 * Synthesised sound design (Web Audio). No audio files → works offline, zero latency,
 * and ticks are generated from real wheel movement, not a pre-recorded loop.
 *
 * Events: spin_start, wheel_tick, spin_loop, slowdown, final_tick, winner_reveal, celebration.
 * The AudioContext is only created/resumed after a user gesture (browser autoplay rules).
 */
export type SoundEvent = 'spin_start' | 'wheel_tick' | 'spin_loop' | 'slowdown' | 'final_tick' | 'winner_reveal' | 'celebration'

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private loop: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null
  private drone: { osc: OscillatorNode[]; gain: GainNode } | null = null
  private lastTick = 0
  enabled = true

  /** Call from a click/keydown handler. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 4
      this.master.connect(comp).connect(this.ctx.destination)
      this.noise = this.makeNoise()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    // Cosmetic noise only — not used for any draw decision.
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null
    return this.ctx
  }

  play(event: SoundEvent, intensity = 1) {
    const ctx = this.ready()
    if (!ctx) return
    switch (event) {
      case 'wheel_tick':
        return this.tick(ctx, intensity, false)
      case 'final_tick':
        return this.tick(ctx, 1.4, true)
      case 'spin_start':
        return this.whoosh(ctx)
      case 'spin_loop':
        return this.startLoop(ctx)
      case 'slowdown':
        return this.startDrone(ctx)
      case 'winner_reveal':
        return this.reveal(ctx, intensity)
      case 'celebration':
        return this.celebrate(ctx, intensity)
    }
  }

  /** Peg click. Rate-limited so extremely fast spins don't turn into noise. */
  private tick(ctx: AudioContext, intensity: number, final: boolean) {
    const now = ctx.currentTime
    if (!final && now - this.lastTick < 0.028) return
    this.lastTick = now
    const out = this.master!
    const g = ctx.createGain()
    const vol = Math.min(1, 0.18 + 0.32 * intensity) * (final ? 1.3 : 1)
    g.gain.setValueAtTime(vol, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 0.18 : 0.06))
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = final ? 1800 : 2600 + 900 * Math.random()
    bp.Q.value = 6
    src.connect(bp).connect(g).connect(out)
    src.start(now, Math.random(), 0.2)
    // Body of the click.
    const osc = ctx.createOscillator()
    const og = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(final ? 520 : 1100, now)
    osc.frequency.exponentialRampToValueAtTime(final ? 180 : 420, now + 0.05)
    og.gain.setValueAtTime(vol * 0.5, now)
    og.gain.exponentialRampToValueAtTime(0.0001, now + (final ? 0.2 : 0.05))
    osc.connect(og).connect(out)
    osc.start(now)
    osc.stop(now + 0.25)
  }

  private whoosh(ctx: AudioContext) {
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(300, now)
    f.frequency.exponentialRampToValueAtTime(2400, now + 0.9)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.35)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
    src.connect(f).connect(g).connect(this.master!)
    src.start(now)
    src.stop(now + 1.3)
  }

  /** Air rush whose loudness follows wheel speed (see setSpeed). */
  private startLoop(ctx: AudioContext) {
    this.stopLoop()
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 500
    filter.Q.value = 0.7
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(gain).connect(this.master!)
    src.start()
    this.loop = { src, gain, filter }
  }

  /** 0..1 normalised wheel speed; drives the spin loop. */
  setSpeed(speed: number) {
    if (!this.loop || !this.ctx) return
    const s = Math.max(0, Math.min(1, speed))
    const t = this.ctx.currentTime
    this.loop.gain.gain.setTargetAtTime(this.enabled ? 0.11 * s * s : 0, t, 0.05)
    this.loop.filter.frequency.setTargetAtTime(300 + 1400 * s, t, 0.05)
  }

  stopLoop() {
    if (!this.loop || !this.ctx) return
    const { src, gain } = this.loop
    const t = this.ctx.currentTime
    gain.gain.setTargetAtTime(0, t, 0.08)
    src.stop(t + 0.5)
    this.loop = null
  }

  /** Low tension drone under the final slowdown. */
  private startDrone(ctx: AudioContext) {
    this.stopDrone()
    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07, now + 1.2)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 600
    const osc = [110, 110.6, 164.8].map((f) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f, now)
      o.frequency.linearRampToValueAtTime(f * 1.06, now + 5)
      o.connect(lp)
      o.start(now)
      return o
    })
    lp.connect(gain).connect(this.master!)
    this.drone = { osc, gain }
  }

  stopDrone(fast = false) {
    if (!this.drone || !this.ctx) return
    const t = this.ctx.currentTime
    this.drone.gain.gain.cancelScheduledValues(t)
    this.drone.gain.gain.setTargetAtTime(0.0001, t, fast ? 0.02 : 0.15)
    this.drone.osc.forEach((o) => o.stop(t + (fast ? 0.2 : 0.8)))
    this.drone = null
  }

  private chord(ctx: AudioContext, freqs: number[], start: number, dur: number, vol: number, type: OscillatorType = 'sawtooth') {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(vol, start + 0.03)
    g.gain.exponentialRampToValueAtTime(vol * 0.5, start + dur * 0.4)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, start)
    lp.frequency.exponentialRampToValueAtTime(900, start + dur)
    lp.connect(g).connect(this.master!)
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      o.detune.value = (i % 2 ? 1 : -1) * 6
      o.connect(lp)
      o.start(start)
      o.stop(start + dur + 0.05)
    })
  }

  /** Brass-like stab. */
  private reveal(ctx: AudioContext, intensity: number) {
    const now = ctx.currentTime
    const big = intensity > 1
    this.chord(ctx, [261.6, 329.6, 392, 523.3], now, big ? 2.4 : 1.6, big ? 0.16 : 0.12)
    const sub = ctx.createOscillator()
    const sg = ctx.createGain()
    sub.frequency.setValueAtTime(90, now)
    sub.frequency.exponentialRampToValueAtTime(45, now + 0.6)
    sg.gain.setValueAtTime(0.45, now)
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.8)
    sub.connect(sg).connect(this.master!)
    sub.start(now)
    sub.stop(now + 0.9)
  }

  /** Rising sparkle arpeggio + final chord. */
  private celebrate(ctx: AudioContext, intensity: number) {
    const now = ctx.currentTime
    const notes = [523.3, 659.3, 784, 1046.5, 1318.5, 1568]
    notes.forEach((f, i) => this.chord(ctx, [f], now + i * 0.07, 0.5, 0.07, 'triangle'))
    this.chord(ctx, [392, 523.3, 659.3, 784], now + notes.length * 0.07, intensity > 1 ? 2.8 : 1.8, 0.09, 'triangle')
  }

  stopAll() {
    this.stopLoop()
    this.stopDrone(true)
  }
}

export const sound = new SoundEngine()
