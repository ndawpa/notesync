# Vocal Trainer MVP

Protótipo local de treinamento vocal com React, TypeScript, Web Audio API e detecção de pitch YIN implementada no projeto.

Além da avaliação de afinação e ritmo, há um modo opcional e independente de solfejo. Ele grava somente a sessão atual, executa o Whisper Tiny localmente em um Web Worker e compara a transcrição com as sílabas esperadas em solfejo fixo (C = Dó). O áudio não é enviado a um backend.

A melodia de referência é sintetizada durante o exercício e pode ser ligada, desligada ou ter seu volume ajustado antes de iniciar. Use fones para evitar que o microfone capture a própria referência.

O exercício também oferece metrônomo sincronizado ao andamento e à fórmula de compasso (incluindo mudanças encontradas no MIDI), tom inicial baseado na primeira nota e contagem preparatória configurável.

A timeline usa escala temporal proporcional, oferece três níveis de zoom e acompanha automaticamente o playhead em exercícios maiores que a área visível.

Durante a reprodução, o playhead permanece amarelo e a nota esperada ativa recebe destaque verde-azulado tanto na timeline quanto na figura rítmica da partitura.

O eixo MIDI e o piano virtual permanecem fixos durante a rolagem; a tecla esperada é destacada em tempo real.

O usuário pode alternar entre a timeline e uma partitura simplificada que respeita fórmulas como 4/4, 3/4 e 6/8, escolher entre cifras (`C`, `D`, `E`) e nomes em português (`Dó`, `Ré`, `Mi`), e editar pitch, início e duração ao selecionar uma nota. Clicar novamente no rótulo selecionado oculta os rótulos. Na partitura, os rótulos visuais omitem o número da oitava. As alterações permanecem na sessão atual do navegador.

Colcheias e semicolcheias consecutivas são agrupadas automaticamente por barras, respeitando pausas, limites de pulsação e a organização ternária de compassos compostos como 6/8.

Na partitura, a clave pode ser escolhida automaticamente ou definida manualmente como Sol, Sol 8vb ou Fá. O modo automático minimiza notas fora do pentagrama e linhas suplementares sem alterar a altura sonora usada na avaliação.

A armadura pode ser importada automaticamente do evento MIDI `Key Signature` (`0x59`), removida ou escolhida manualmente entre tonalidades maiores e menores. Sem armadura, os acidentes aparecem junto às notas; com armadura, os acidentes já previstos por ela não são repetidos. A partitura também reconhece a colcheia pontuada.

A clave, a armadura e a fórmula de compasso permanecem fixas à esquerda durante a rolagem da partitura. Quando o MIDI contém mudanças de armadura ou de compasso, o indicador fixo acompanha os valores ativos na posição atual da reprodução.

As barras de compasso mantêm um pequeno espaçamento antes das notas do primeiro tempo, evitando que a cabeça da nota fique desenhada sobre a barra.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite, permita o microfone e pressione **Iniciar**. O acesso ao microfone exige `localhost` ou HTTPS.

No modo **Solfejo**, o modelo de reconhecimento é baixado do Hugging Face e guardado no cache do navegador na primeira avaliação. Esse primeiro processamento pode demorar e requer conexão; as execuções seguintes reutilizam o modelo armazenado. O reconhecimento de sílabas cantadas é experimental e funciona melhor com fones de ouvido e articulação clara no início de cada nota.

O reconhecedor usa Transformers.js 3.8.1 fixado e Whisper Tiny em `q8`/WASM. Essa combinação evita uma incompatibilidade de criação de sessão observada entre modelos Whisper quantizados e versões mais recentes do ONNX Runtime.

## Publicar

O projeto segue o mesmo modelo de publicação do YouTube Converter: imagem no GitHub Container Registry e chart Helm OCI.

Teste a imagem localmente:

```bash
docker compose up --build
```

Abra `http://localhost:8080`. O endpoint de saúde é `http://localhost:8080/healthz`.

Ao enviar a branch `main` para o GitHub, os workflows:

- executam lint, testes e build;
- publicam `ghcr.io/<owner>/<repository>:latest` e uma tag baseada no commit;
- publicam o chart em `oci://ghcr.io/<owner>/charts/notesync` quando o diretório `helm/` mudar.

Para Kubernetes, configure um domínio e TLS em um arquivo de valores:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: notesync.seudominio.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: notesync-tls
      hosts:
        - notesync.seudominio.com
```

Instale com:

```bash
helm upgrade --install notesync ./helm \
  --namespace notesync --create-namespace \
  --values values-production.yaml
```

HTTPS é obrigatório em produção para o navegador permitir acesso ao microfone.

### GitHub Pages

O workflow `pages.yml` também publica automaticamente a interface em:

```text
https://ndawpa.github.io/notesync/
```

No primeiro uso, abra **Settings → Pages** no repositório e, em **Build and deployment → Source**, selecione **GitHub Actions**. O deploy seguinte criará ou atualizará a URL pública com HTTPS.

## Exercícios

Use **Carregar exercício** para escolher um arquivo MIDI (`.mid` ou `.midi`) ou JSON. O MIDI pode ser tipo 0 ou 1 e usar mudanças de andamento, fórmula de compasso (`Time Signature`, evento `0x58`) e armadura (`Key Signature`, evento `0x59`). Em arquivos com várias pistas, o MVP escolhe a pista com mais notas. Como a avaliação é monofônica, trechos com notas simultâneas usam a nota mais aguda.

O BPM pode ser alterado entre 20 e 300 antes de iniciar. A aplicação redimensiona o tempo das notas e preserva proporcionalmente eventuais mudanças de andamento do MIDI. Quando o arquivo contém eventos MIDI de letra (`Lyric`, ou `Text` como alternativa), a opção **Letra** fica disponível nos rótulos da timeline e da partitura.

O JSON continua aceitando um array de notas ou `{ "name", "bpm", "timeSignatures", "keySignatures", "notes" }`. Veja `public/exercicio-exemplo.json`.

## Limites conhecidos

- A letra só pode ser exibida quando estiver realmente embutida como evento de texto no MIDI; arquivos que contêm apenas notas não permitem recuperar a letra da música.
- O ritmo usa o primeiro e último frame vocal de cada nota como aproximação de onset e duração.
- Ambientes ruidosos, microfones com processamento próprio e harmônicos fortes podem afetar o YIN.
- Os thresholds ficam em `src/config.ts` e devem ser calibrados em dispositivos reais.
- MIDI tipo 2, divisão SMPTE e escolha manual de pista ainda não são suportados.
