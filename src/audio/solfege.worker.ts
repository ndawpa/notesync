import { pipeline, type AutomaticSpeechRecognitionPipeline, type AutomaticSpeechRecognitionOutput } from '@huggingface/transformers'

let transcriber: AutomaticSpeechRecognitionPipeline | undefined
interface ModelProgress { progress?: number }
const createTranscriber = pipeline as unknown as (task: 'automatic-speech-recognition', model: string, options: { device: 'wasm'; dtype: 'q8'; progress_callback: (progress: ModelProgress) => void }) => Promise<AutomaticSpeechRecognitionPipeline>

self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    self.postMessage({ type: 'status', message: transcriber ? 'Reconhecendo o solfejo…' : 'Carregando o modelo de solfejo…' })
    transcriber ??= await createTranscriber('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: (progress) => {
        const value = typeof progress.progress === 'number' ? Math.round(progress.progress) : undefined
        self.postMessage({ type: 'status', message: value === undefined ? 'Carregando o modelo de solfejo…' : `Carregando o modelo de solfejo… ${value}%` })
      },
    })
    self.postMessage({ type: 'status', message: 'Reconhecendo o solfejo…' })
    const output = await transcriber(event.data.audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 }) as AutomaticSpeechRecognitionOutput
    self.postMessage({ type: 'result', text: output.text })
  } catch (reason) {
    self.postMessage({ type: 'error', message: reason instanceof Error ? reason.message : 'Falha ao reconhecer o solfejo.' })
  }
}
