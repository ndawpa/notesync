interface WorkerMessage { type: 'status' | 'result' | 'error'; message?: string; text?: string }

export class SolfegeRecognizer {
  private readonly worker = new Worker(new URL('./solfege.worker.ts', import.meta.url), { type: 'module' })

  recognize(audio: Float32Array, onStatus: (message: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'status') onStatus(event.data.message ?? 'Processando…')
        if (event.data.type === 'result') resolve(event.data.text ?? '')
        if (event.data.type === 'error') reject(new Error(event.data.message ?? 'Falha ao reconhecer o solfejo.'))
      }
      this.worker.onerror = () => reject(new Error('Não foi possível iniciar o reconhecedor de solfejo.'))
      this.worker.postMessage({ audio }, [audio.buffer])
    })
  }

  terminate() { this.worker.terminate() }
}

export async function recordingTo16kMono(recording: Blob): Promise<Float32Array> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer())
    const frameCount = Math.max(1, Math.ceil(decoded.duration * 16_000))
    const offline = new OfflineAudioContext(1, frameCount, 16_000)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return new Float32Array(rendered.getChannelData(0))
  } finally {
    await context.close()
  }
}
