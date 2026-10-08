# Subir o jogo na VPS (Docker) — As Aventuras do Piper

O jogo roda em 2 containers:
- **piper-jogo**: o servidor do jogo (Node 20). Os personagens ficam salvos no volume `piper-dados`.
- **piper-https**: o Caddy. Gera o certificado HTTPS sozinho (Let's Encrypt, grátis) e passa o tráfego para o jogo.

O HTTPS é obrigatório: sem ele o botão **Instalar jogo** não aparece e alguns celulares bloqueiam a conexão.

## 1. Antes de começar

1. **Endereço do jogo.** Escolha uma das opções:
   - **Com domínio próprio:** crie um registro **A** (ex.: `jogo.seudominio.com.br`) apontando para o IP da VPS.
   - **Sem domínio:** use o IP da VPS com traços no lugar dos pontos, mais `.sslip.io`. Exemplo: o IP `203.0.113.10` vira `203-0-113-10.sslip.io`. Funciona na hora e o HTTPS sai normalmente.
2. **Portas.** No painel da Hostinger (hPanel → VPS → Firewall), libere as portas **80** e **443** (TCP).
3. **Docker.** Se a VPS foi criada com o modelo "Ubuntu com Docker", ele já está instalado. Se não, rode na VPS:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

## 2. Primeira instalação

Acesse a VPS pelo SSH (`ssh root@IP_DA_VPS`) e rode:

```bash
git clone https://github.com/OziasFilipe/piper-mmorpg.git piper
cd piper
echo "DOMINIO=jogo.seudominio.com.br" > .env          # troque pelo SEU endereço (ou 203-0-113-10.sslip.io)
echo "ADMIN_PASSWORD=troque-por-uma-senha-forte" >> .env   # senha do painel admin
docker compose up -d --build
```

Espere uns 30 segundos e abra `https://SEU_ENDERECO` no celular.

Ver se está tudo certo:

```bash
docker compose ps              # os dois devem estar "running" (o jogo fica "healthy")
docker compose logs -f jogo    # log do jogo (Ctrl+C para sair)
docker compose logs caddy      # se o HTTPS falhar, o motivo aparece aqui
```

## Painel admin

Abra `https://SEU_ENDERECO/admin` e entre com a senha do `ADMIN_PASSWORD`. No painel você vê:

- **Visão geral:** quantos estão online, cadastrados, entradas e mortes do dia, memória e velocidade do servidor, gráfico de online.
- **Online:** quem está jogando, onde está, nível, IP e há quanto tempo. Dá para mandar mensagem ou expulsar.
- **Jogadores:** todos os cadastrados (busca, ordenação, só bloqueados). Tocando num jogador: equipamento, mochila, amigos, histórico, dar/tirar ouro, redefinir senha e bloquear/desbloquear a conta.
- **Log:** entradas, cadastros, saídas, chat, mortes, níveis, viagens, amizades, senhas erradas, ações do admin e erros (guardado por 60 dias).
- **Aviso geral:** mensagem para todos que estão online.

Para trocar a senha: edite o `.env` e rode `docker compose up -d`. Use uma senha forte: depois de 8 tentativas erradas o painel bloqueia aquele IP por 10 minutos.

## 3. Atualizar o jogo (depois de cada Push no GitHub)

```bash
cd piper
git pull
docker compose up -d --build
```

Os personagens **não são apagados**: ficam no volume `piper-dados`, fora da imagem.

## 4. Backup dos personagens

```bash
docker compose stop jogo
docker run --rm -v piper_piper-dados:/data -v "$PWD":/backup alpine tar czf /backup/backup-personagens.tgz -C /data .
docker compose start jogo
```

O arquivo `backup-personagens.tgz` fica na pasta `piper`. Para restaurar, troque `tar czf` por `tar xzf` (com o jogo parado).

## Problemas comuns

- **"port is already allocated" na porta 80 ou 443:** outra coisa na VPS já usa essas portas (outro site, Traefik, Nginx). Pare o serviço que está usando, ou apague o bloco `caddy` do `docker-compose.yml` e aponte o seu proxy atual para o container `piper-jogo`, porta `3000`. O proxy precisa repassar WebSocket.
- **O HTTPS não sai:** confira se o domínio aponta para o IP certo e se as portas 80 e 443 estão liberadas no firewall da Hostinger.
- **Mudar a velocidade de XP:** altere `XP_RATE` no `docker-compose.yml` e rode `docker compose up -d`.
