import { pipeline, type AutomaticSpeechRecognitionPipeline, type AutomaticSpeechRecognitionOutput } from '@huggingface/transformers'

let transcriber: AutomaticSpeechRecognitionPipeline | undefined
interface ModelProgress { progress?: number }
const createTranscriber = pipeline as unknown as (task: 'automatic-speech-recognition', model: string, options: { device: 'wasm'; dtype: 'q8'; progress_callback: (progress: ModelProgress) => void }) => Promise<AutomaticSpeechRecognitionPipeline>

async function loadModel() {
  transcriber ??= await createTranscriber('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (progress) => {
      const value = typeof progress.progress === 'number' ? Math.round(progress.progress) : undefined
      self.postMessage({ type: 'status', message: value === undefined ? 'Carregando o modelo de solfejo…' : `Carregando o modelo de solfejo… ${value}%` })
    },
  })
  return transcriber
}

self.onmessage = async (event: MessageEvent<{ type?: 'load'; audio?: Float32Array }>) => {
  try {
    self.postMessage({ type: 'status', message: transcriber ? 'Reconhecendo o solfejo…' : 'Carregando o modelo de solfejo…' })
    const model = await loadModel()
    if (event.data.type === 'load') { self.postMessage({ type: 'ready' }); return }
    if (!event.data.audio) throw new Error('Áudio ausente.')
    self.postMessage({ type: 'status', message: 'Reconhecendo o solfejo…' })
    const output = await model(event.data.audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: 'word' }) as AutomaticSpeechRecognitionOutput & { chunks?: Array<{ text: string; timestamp: [number, number | null] }> }
    self.postMessage({ type: 'result', text: output.text, chunks: output.chunks ?? [] })
  } catch (reason) {
    self.postMessage({ type: 'error', message: reason instanceof Error ? reason.message : 'Falha ao reconhecer o solfejo.' })
  }
}
