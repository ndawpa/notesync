# Arquitetura do MVP

## Fluxo

1. `MicrophoneInput` solicita o stream, cria um `AudioContext` de baixa latência e fornece buffers do `AnalyserNode`.
2. `detectPitchYin` rejeita silêncio por RMS, estima a frequência fundamental e rejeita baixa confiança.
3. Uma mediana móvel de 120 ms reduz jitter e evita penalizar cada oscilação do vibrato.
4. `App` usa `AudioContext.currentTime` como relógio da sessão, encontra a nota esperada e registra a diferença em cents.
5. `PitchVisualizer` desenha a referência e os frames aceitos em SVG.
6. Os módulos de scoring calculam afinação, onset/duração aproximados e o resultado agregado.

Os módulos de áudio não conhecem React nem a referência. O formato `ReferenceTrack` serve como fronteira para um futuro importador MusicXML; um importador precisará apenas produzir essa estrutura normalizada.

## Decisões

- YIN local: evita dependência adicional e deixa thresholds/faixa vocal sob controle.
- `AnalyserNode` no MVP: simples e adequado para validação; um `AudioWorklet` é a evolução indicada caso medições revelem jitter na thread principal.
- SVG: atende poucas centenas de frames/notas com interação e layout responsivo. Canvas pode substituí-lo em músicas longas.
- Frequência e cents: nomes de nota são apenas apresentação; o scoring nunca compara strings.
- Configuração centralizada em `src/config.ts`: thresholds de áudio, confiança, suavização, pitch e ritmo podem ser calibrados sem mudar o pipeline.

## Riscos e mitigação inicial

- Latência: relógio do `AudioContext`, `latencyHint: interactive` e ausência de `setInterval`. A latência de entrada real ainda deve ser calibrada por dispositivo.
- Ruído: gate por RMS e confiança. Um perfil de ruído ou filtro passa-banda pode ser adicionado depois.
- Erros de oitava: a faixa de busca de 75–1100 Hz reduz candidatos absurdos, mas harmônicos fortes ainda podem vencer. A próxima mitigação é continuidade temporal e priorização perto da nota esperada.
- Vibrato: mediana curta de 120 ms; não elimina expressão nem exige frequência imóvel.
- Microfones/dispositivos: processamento automático é solicitado como desativado, mas navegadores podem ignorar constraints. Os thresholds precisam de testes em hardware real e, futuramente, uma etapa de calibração.
- Ritmo: primeiro/último frame detectado é uma aproximação. Ruído e consoantes podem deslocar o onset; envelope com histerese será a evolução natural.
