import { AUDIO_CONFIG } from '../config'

export class MicrophoneInput {
  readonly context: AudioContext
  readonly analyser: AnalyserNode
  private readonly stream: MediaStream
  private readonly source: MediaStreamAudioSourceNode
  private readonly buffer: Float32Array<ArrayBuffer>
  private recorder?: MediaRecorder
  private recordingChunks: Blob[] = []

  private constructor(context: AudioContext, stream: MediaStream) {
    this.context = context
    this.stream = stream
    this.source = context.createMediaStreamSource(stream)
    this.analyser = context.createAnalyser()
    this.analyser.fftSize = AUDIO_CONFIG.fftSize
    this.analyser.smoothingTimeConstant = 0
    this.source.connect(this.analyser)
    this.buffer = new Float32Array(this.analyser.fftSize)
  }

  static async create(): Promise<MicrophoneInput> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não oferece acesso ao microfone.')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    const context = new AudioContext({ latencyHint: 'interactive' })
    await context.resume()
    return new MicrophoneInput(context, stream)
  }

  readSamples(): Float32Array<ArrayBuffer> {
    this.analyser.getFloatTimeDomainData(this.buffer)
    return this.buffer
  }

  startRecording() {
    if (typeof MediaRecorder === 'undefined') throw new Error('Este navegador não permite gravar áudio para avaliar o solfejo.')
    this.recordingChunks = []
    this.recorder = new MediaRecorder(this.stream)
    this.recorder.addEventListener('dataavailable', (event) => { if (event.data.size) this.recordingChunks.push(event.data) })
    this.recorder.start(1000)
  }

  stopRecording(): Promise<Blob | undefined> {
    const recorder = this.recorder
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(undefined)
    return new Promise((resolve) => {
      recorder.addEventListener('stop', () => {
        const recording = new Blob(this.recordingChunks, { type: recorder.mimeType })
        this.recorder = undefined; this.recordingChunks = []
        resolve(recording)
      }, { once: true })
      recorder.stop()
    })
  }

  async close() {
    if (this.recorder?.state !== 'inactive') this.recorder?.stop()
    this.source.disconnect()
    this.stream.getTracks().forEach((track) => track.stop())
    if (this.context.state !== 'closed') await this.context.close()
  }
}
