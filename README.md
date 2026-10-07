# As Aventuras do Piper
**Epiper Tecnologia** · MMORPG 2D online para celular, jogado com o aparelho deitado.

## Jogar no computador (teste local)
1. Instale o Node.js 18+ (https://nodejs.org).
2. Dê dois cliques em `iniciar.bat`. Ele abre http://localhost:3000.

## Colocar online no Render.com
1. Este projeto já está no repositório **github.com/OziasFilipe/piper-mmorpg**. Abra o GitHub Desktop, faça **Commit to main** e depois **Push origin** (o `.gitignore` já deixa `node_modules` e `data` de fora).
2. Entre em https://render.com, faça login com o GitHub.
3. Clique em **New +** > **Blueprint**, escolha o repositório e confirme. O Render lê o `render.yaml` sozinho.
   (Alternativa: **New +** > **Web Service** com Build `npm install`, Start `node server.js`, Health check `/health`.)
4. Quando terminar, o jogo fica em `https://aventuras-do-piper.onrender.com` (ou o nome que o Render der).

**Importante sobre o plano gratuito do Render:**
- O servidor "dorme" após 15 minutos sem jogadores. O primeiro acesso depois disso demora ~1 minuto.
- O disco é apagado a cada novo deploy/reinício, então **os personagens salvos se perdem**.
  Para um jogo de verdade, use o plano **Starter** com o disco persistente (já está pronto no `render.yaml`, é só descomentar).

## Publicar na Play Store (depois)
O jogo já é um app web instalável (PWA, tela cheia e paisagem).
Com o site no ar, use o https://www.pwabuilder.com : cole o endereço do Render e gere o pacote **Android (TWA)**.
Ele gera o `.aab` para enviar à Google Play Console.

## Como o jogo funciona
- **Abertura:** "Epiper Tecnologia apresenta" → "As Aventuras do Piper" → tela de título → entrar / criar personagem.
- **Criação de personagem:** nome, senha, vocação (Guerreiro ou Mago), cor de pele, estilo e cor de cabelo, com prévia animada.
- **Controles no celular:** joystick à esquerda. O **ataque é automático** ao encostar no inimigo.
  Magias: toque numa magia para **escolher** e aperte **LANÇAR**. Poções nos botões vermelho/azul. Toque no mapa para andar até lá, ou num NPC para conversar.
- **No PC:** setas/WASD andam · 1–4 escolhem a magia · Espaço lança · Q/E poções · I mochila · Enter chat.
- Níveis, pontos de atributo, 14 monstros, loot, lojas, 12 missões, PvP fora da cidade (nível 8+).

## Arte
Os personagens são montados em camadas (corpo, cabelo, armadura, elmo, arma e escudo) a partir dos PNGs em `public/assets/chars/`.
Cada folha tem 3 colunas (parado, passo 1, passo 2) × 4 linhas (baixo, esquerda, cima, direita), células de 128×192.
Para trocar por artes novas (feitas à mão ou com IA), basta substituir os PNGs mantendo esse formato.
Para regenerar: `python3 tools/gen_chars.py` e `python3 tools/gen_ui.py` (precisa do Pillow).

## Configuração
Variáveis de ambiente: `PORT` (padrão 3000), `XP_RATE` (padrão 2), `DATA_DIR` (pasta dos saves, padrão `./data`).
Conteúdo do jogo (monstros, itens, magias, missões, lojas): `public/defs.js`.
