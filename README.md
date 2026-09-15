# Vocal Trainer MVP

Protótipo local de treinamento vocal com React, TypeScript, Web Audio API e detecção de pitch YIN implementada no projeto.

A melodia de referência é sintetizada durante o exercício e pode ser ligada, desligada ou ter seu volume ajustado antes de iniciar. Use fones para evitar que o microfone capture a própria referência.

O exercício também oferece metrônomo sincronizado ao andamento (incluindo mudanças de tempo do MIDI), tom inicial baseado na primeira nota e contagem preparatória configurável.

A timeline usa escala temporal proporcional, oferece três níveis de zoom e acompanha automaticamente o playhead em exercícios maiores que a área visível.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite, permita o microfone e pressione **Iniciar**. O acesso ao microfone exige `localhost` ou HTTPS.

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

Use **Carregar exercício** para escolher um arquivo MIDI (`.mid` ou `.midi`) ou JSON. O MIDI pode ser tipo 0 ou 1 e usar mudanças de andamento. Em arquivos com várias pistas, o MVP escolhe a pista com mais notas. Como a avaliação é monofônica, trechos com notas simultâneas usam a nota mais aguda.

O JSON continua aceitando um array de notas ou `{ "name", "bpm", "notes" }`. Veja `public/exercicio-exemplo.json`.

## Limites conhecidos

- A referência começa assim que o acesso ao microfone é concedido; não há áudio de acompanhamento nem contagem regressiva.
- O ritmo usa o primeiro e último frame vocal de cada nota como aproximação de onset e duração.
- Ambientes ruidosos, microfones com processamento próprio e harmônicos fortes podem afetar o YIN.
- Os thresholds ficam em `src/config.ts` e devem ser calibrados em dispositivos reais.
- MIDI tipo 2, divisão SMPTE e escolha manual de pista ainda não são suportados.
