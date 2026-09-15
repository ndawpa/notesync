export interface RecognizedWord { text: string; start: number; end: number }
export interface SolfegeRecognition { text: string; words: RecognizedWord[] }
interface WorkerMessage { type: 'status' | 'result' | 'error' | 'ready'; message?: string; text?: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }

export class SolfegeRecognizer {
  private readonly worker = new Worker(new URL('./solfege.worker.ts', import.meta.url), { type: 'module' })

  preload(onStatus: (message: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'status') onStatus(event.data.message ?? 'Carregando…')
        if (event.data.type === 'ready') resolve()
        if (event.data.type === 'error') reject(new Error(event.data.message ?? 'Falha ao carregar o modelo.'))
      }
      this.worker.onerror = () => reject(new Error('Não foi possível iniciar o reconhecedor de solfejo.'))
      this.worker.postMessage({ type: 'load' })
    })
  }

  recognize(audio: Float32Array, onStatus: (message: string) => void): Promise<SolfegeRecognition> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'status') onStatus(event.data.message ?? 'Processando…')
        if (event.data.type === 'result') resolve({ text: event.data.text ?? '', words: (event.data.chunks ?? []).map((chunk) => ({ text: chunk.text, start: chunk.timestamp[0], end: chunk.timestamp[1] ?? chunk.timestamp[0] })) })
        if (event.data.type === 'error') reject(new Error(event.data.message ?? 'Falha ao reconhecer o solfejo.'))
      }
      this.worker.onerror = () => reject(new Error('Não foi possível iniciar o reconhecedor de solfejo.'))
      this.worker.postMessage({ audio }, [audio.buffer])
    })
  }

  terminate() { this.worker.terminate() }
}

export async function recordingTo16kMono(recording: Blob, trimStartSeconds = 0): Promise<Float32Array> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer())
    const offset = Math.max(0, Math.min(decoded.duration, trimStartSeconds))
    const frameCount = Math.max(1, Math.ceil((decoded.duration - offset) * 16_000))
    const offline = new OfflineAudioContext(1, frameCount, 16_000)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start(0, offset)
    const rendered = await offline.startRendering()
    return new Float32Array(rendered.getChannelData(0))
  } finally {
    await context.close()
  }
}
