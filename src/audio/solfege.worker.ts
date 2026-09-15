import { pipeline, type AutomaticSpeechRecognitionPipeline, type AutomaticSpeechRecognitionOutput } from '@huggingface/transformers'

let transcriber: AutomaticSpeechRecognitionPipeline | undefined

self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    self.postMessage({ type: 'status', message: transcriber ? 'Reconhecendo o solfejo…' : 'Carregando o modelo de solfejo…' })
    transcriber ??= await pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
      progress_callback: (progress) => {
        const value = 'progress' in progress && typeof progress.progress === 'number' ? Math.round(progress.progress) : undefined
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
