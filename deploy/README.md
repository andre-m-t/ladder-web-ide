# Deploy temporário na VPS (demonstração)

Configuração isolada do ambiente de desenvolvimento (`docker-compose.yml` na raiz).
Não entra no pacote de depósito do INPI (`scripts/build-deposito.sh`).

O Caddy do **host** termina TLS e faz proxy para contêineres que escutam só em
`127.0.0.1`. As portas no host vêm **exclusivamente** de `deploy/.env`.

## 1. Verificar o host

Na VPS (como root ou com sudo):

```bash
systemctl status caddy --no-pager
ss -tlnp | grep -E ':80|:443'
df -h /var/lib/docker
docker compose version
```

- Caddy deve estar `active (running)` e `:443` em escuta.
- Reserve cerca de **15 GB** livres em `/var/lib/docker` (imagem do backend ~7,3 GB
  na primeira construção).
- Confirme que `BACKEND_PORT` e `FRONTEND_PORT` escolhidos em `deploy/.env` não
  aparecem em `ss -tlnp` (ex.: `8010`, `3010`).

## 2. DNS

Crie um registro **A** (ou **AAAA**) apontando o subdomínio escolhido para o IP
da VPS. O valor de `DOMINIO` e `PUBLIC_URL` em `deploy/.env` deve coincidir com
esse nome (com `https://` em `PUBLIC_URL`).

## 3. Subir os contêineres

```bash
cp deploy/.env.example deploy/.env
# Edite deploy/.env: DOMINIO, PUBLIC_URL, portas e CORS_ORIGINS.

deploy/deploy.sh
```

`deploy/deploy.sh` confere as variáveis obrigatórias, avisa se as portas do
host já parecem ocupadas, sobe o compose de produção (`up -d --build`), espera
o backend ficar `healthy` e testa `/health`. Ao final, imprime o bloco pronto
para o Caddy do host (passo 4). Ele não toca no Caddy nem em nada fora do
projeto `ladderflow`.

Equivalente manual, se preferir rodar sem o script:

```bash
docker compose --env-file deploy/.env \
  -f deploy/docker-compose.prod.yml \
  --project-directory . \
  up -d --build
```

A primeira construção do backend demora (download da base ESP-IDF + MATIEC). Os
dois núcleos da VPS ficarão ocupados por vários minutos; outros projetos no
mesmo host continuam no ar, mas podem responder mais devagar nesse intervalo.

## 4. Configurar o Caddy do host

Gere o hash da senha de demonstração:

```bash
caddy hash-password
```

Renderize o bloco a partir de `deploy/.env` e cole no final de
`/etc/caddy/Caddyfile` (substitua `SUBSTITUA_PELO_HASH` pelo hash gerado):

```bash
set -a
source deploy/.env
set +a
sed -e "s/__DOMINIO__/$DOMINIO/g" \
    -e "s/__BACKEND_PORT__/$BACKEND_PORT/g" \
    -e "s/__FRONTEND_PORT__/$FRONTEND_PORT/g" \
    deploy/Caddyfile.exemplo
```

Valide e recarregue (não derruba os outros sites do arquivo):

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## 5. Aquecer o cache de compilação

Antes de chamar o orientador, dispare uma compilação para evitar o build frio
(~66 s em dev; pode ser maior na VPS):

```bash
set -a
source deploy/.env
set +a

curl -sf -u professor:SUA_SENHA \
  -H "Content-Type: application/json" \
  -d "{\"source\":$(jq -Rs . < backend/tests/fixtures/blink.st)}" \
  "$PUBLIC_URL/compile" -o /tmp/ladderflow-blink.bin \
  && echo "OK: $(wc -c < /tmp/ladderflow-blink.bin) bytes"
```

Sem `jq`, envie o corpo JSON manualmente ou use `POST /compile` pela interface
após login no `basic_auth`.

## 6. Teste rápido

```bash
curl -sf -u professor:SUA_SENHA "$PUBLIC_URL/health" | head -c 200
```

Abra `https://<DOMINIO>` no Chrome ou Edge 89+ (Web Serial para gravar no ESP32).

## 7. Remover (sem afetar outros projetos)

```bash
deploy/remover.sh
```

`deploy/remover.sh` roda `down -v --rmi all` (contêineres, rede, o volume
`esp-build-cache` e as imagens `ladderflow-backend:dev`/`ladderflow-frontend:prod`)
e depois remove as imagens **base** de terceiros baixadas só para este deploy
(`espressif/idf:v5.4.1`, `node:22-bookworm-slim`, `caddy:2-alpine`) — mas
**só** as que nenhum outro contêiner do host ainda usa, conferido por
`docker ps -a --filter ancestor=<imagem>` antes de cada remoção. Ele nunca
roda `docker system prune` nem `docker builder prune`, porque esses comandos
são globais e apagariam cache de build de outros projetos no mesmo host.

Ao final ele lembra os dois passos manuais que não faz sozinho:

1. Remover o bloco do subdomínio em `/etc/caddy/Caddyfile` (colado no passo
   4) e recarregar:
   ```bash
   caddy validate --config /etc/caddy/Caddyfile
   systemctl reload caddy
   ```
2. Apagar `deploy/.env` (local, não versionado), se não for repetir o teste.

Depois desses dois passos manuais, a VPS volta ao estado anterior à
instanciação do LadderFlow: nenhum contêiner, imagem, volume ou bloco de
proxy do projeto permanece, e os demais projetos do host não são tocados em
nenhum momento deste script.
