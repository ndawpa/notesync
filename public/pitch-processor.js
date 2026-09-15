class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.samples = new Float32Array(4096)
    this.offset = 0
    this.minRms = 0.012
    this.port.onmessage = (event) => { if (event.data?.minRms) this.minRms = event.data.minRms }
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input) return true
    for (const sample of input) {
      this.samples[this.offset++] = sample
      if (this.offset === this.samples.length) {
        this.detect()
        this.samples.copyWithin(0, this.samples.length / 2)
        this.offset = this.samples.length / 2
      }
    }
    return true
  }

  detect() {
    let energy = 0
    for (const sample of this.samples) energy += sample * sample
    const volume = Math.sqrt(energy / this.samples.length)
    if (volume < this.minRms) { this.port.postMessage(null); return }
    const minLag = Math.max(2, Math.floor(sampleRate / 1100))
    const maxLag = Math.min(Math.floor(sampleRate / 75), this.samples.length / 2)
    const difference = new Float32Array(maxLag + 1)
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0
      for (let index = 0; index < this.samples.length - lag; index++) { const delta = this.samples[index] - this.samples[index + lag]; sum += delta * delta }
      difference[lag] = sum
    }
    const cumulative = new Float32Array(maxLag + 1)
    let running = 0, bestLag = -1
    for (let lag = 1; lag <= maxLag; lag++) {
      running += difference[lag]
      cumulative[lag] = running === 0 ? 1 : difference[lag] * lag / running
      if (lag >= minLag && bestLag < 0 && cumulative[lag] < 0.15) bestLag = lag
    }
    if (bestLag < 0) { this.port.postMessage(null); return }
    while (bestLag + 1 <= maxLag && cumulative[bestLag + 1] < cumulative[bestLag]) bestLag++
    const left = cumulative[bestLag - 1] || cumulative[bestLag], center = cumulative[bestLag], right = cumulative[bestLag + 1] || center
    const divisor = 2 * (2 * center - right - left)
    const refined = divisor === 0 ? bestLag : bestLag + (right - left) / divisor
    const confidence = Math.max(0, Math.min(1, 1 - center))
    this.port.postMessage(confidence >= 0.7 ? { frequency: sampleRate / refined, confidence, volume } : null)
  }
}

registerProcessor('notesync-pitch', PitchProcessor)
