# vibeIDE — Plano de Evolução

> Documento de especificação para execução assistida por agente.
> Salve como `docs/PLANO.md` na raiz do repositório.

---

## COMO USAR ESTE DOCUMENTO

Este arquivo **não** é para ser executado de uma vez. Salve-o no repo e use o prompt de abertura abaixo, trocando o número da fase a cada rodada.

```
Leia docs/PLANO.md por completo, incluindo as seções INVARIANTES e
PROTOCOLO DE EXECUÇÃO.

Execute apenas a FASE 0. Não comece nenhuma outra fase.
Se qualquer coisa no plano conflitar com o código que já existe,
pare e me pergunte antes de mudar qualquer arquivo.
```

Depois da Fase 0, as rodadas seguintes são iguais, trocando só o número.

---

## CONTEXTO DO PROJETO

vibeIDE é um cockpit desktop (Electron + React + TypeScript) para operar o Claude Code CLI. Hoje entrega: explorador de arquivos com status de git, terminal real via `node-pty` com xterm/WebGL, mapa de imports calculado localmente, preview de arquivo com realce de sintaxe e diff contra HEAD, e uma barra de commit rápido.

**A tese do produto mudou.** Deixou de ser "economizar token" e passou a ser:

> Devolver ao humano visibilidade e controle sobre um agente autônomo.

O recurso escasso no vibecoding não é token — é supervisão. Toda decisão de produto neste plano deriva disso. Uma feature entra se ela responde a uma destas quatro perguntas:

1. O que o agente está fazendo agora?
2. O que ele mudou?
3. Funcionou?
4. Como eu volto?

---

## INVARIANTES — nunca violar

Estas regras valem para todas as fases. Violar qualquer uma é motivo para reverter o trabalho.

### Segurança
- `contextIsolation: true` e `sandbox: true` permanecem ligados. Nunca ligar `nodeIntegration`.
- Toda comunicação renderer↔sistema continua passando pelo `preload` via `contextBridge`.
- **Todo path recebido por IPC deve ser validado contra a raiz do workspace** antes de qualquer operação de fs. Resolver com `path.resolve` e rejeitar o que sair da raiz. Isso vale inclusive para código já existente — se algum handler atual não valida, corrigir é parte da Fase 0.
- Nunca `child_process` com `shell: true` sobre string montada com input do usuário.
- Nada de `eval`, `Function()` ou `webSecurity: false`.

### Compatibilidade
- **Não alterar assinatura de canal IPC existente.** Só adicionar canais novos. Se um canal antigo precisar mudar, criar `canal.v2` e manter o antigo funcionando.
- Não renomear, mover ou reorganizar arquivos existentes. Nenhum refactor "de passagem".
- Não reformatar arquivo que não faz parte da mudança. Diff mínimo, sempre.
- Não trocar biblioteca já em uso (`chokidar`, `simple-git`, `node-pty`, xterm) por alternativa.
- Toda feature nova nasce **desligável**. Se quebrar, o usuário desliga nas configurações e o app volta ao comportamento atual.

### Terminal
- O renderizador WebGL do xterm não é tocado. **Nunca ligar `allowTransparency`** no terminal principal — derruba o ganho do WebGL e gera artefato de repintura.
- Não alterar a detecção de shell nem o comando de abertura (`claude`).

### Qualidade
- `npm run typecheck` precisa passar ao fim de cada fase. Sem `any` novo, sem `@ts-ignore`.
- `npm run build` precisa passar ao fim de cada fase.
- Nenhuma dependência nova sem justificar em uma linha no commit. Dependências pré-aprovadas por fase estão listadas em cada seção — fora dessa lista, perguntar antes.
- Tipos de IPC novos vão em `src/shared/`, seguindo o padrão já existente ali.
- Um handler novo por domínio novo, em `src/main/ipc/`, seguindo o padrão de arquivo por domínio.

### Configurações do usuário
- **Nunca sobrescrever `.claude/settings.json` do usuário.** Ler, fazer merge não-destrutivo, e preferir `.claude/settings.local.json` quando o formato permitir. Fazer backup com timestamp antes de escrever.
- Nada de escrever fora de: raiz do workspace, `app.getPath('userData')`, e `.claude/` do projeto.

---

## PROTOCOLO DE EXECUÇÃO

1. **Uma fase por vez.** Não adiantar trabalho de fase futura.
2. **Um branch por fase**: `feat/fase-N-nome`. Merge só depois que eu testar.
3. **Antes de escrever código**, apresentar um plano curto: arquivos que vão ser tocados, canais IPC novos, dependências novas. Esperar confirmação.
4. **Ambiguidade = pergunta, nunca suposição.** Se o plano descreve algo que não bate com o código real, parar e perguntar.
5. Ao fim da fase: rodar `typecheck` e `build`, listar o que foi feito e o que ficou de fora, e parar.
6. Nenhum commit com mais de um assunto.

---

# SISTEMA DE DESIGN

Direção: **console de máquina impressora flexográfica**. A escolha não é decorativa — uma tira de controle numa folha de prova existe para verificar se um processo autônomo produziu a saída correta, que é exatamente a função do vibeIDE.

## Cor — CMYK como canal semântico

As tintas de processo são o modelo de estado do app, não uma paleta de gosto:

| Token | Hex | Significado |
|---|---|---|
| `--ink-cyan` | `#2E93B8` | tocado pelo agente nesta sessão |
| `--ink-magenta` | `#C4457F` | modificado / não commitado |
| `--ink-yellow` | `#D9A521` | diagnóstico, aviso, aguardando permissão |
| `--ink-overprint` | `#7A5E9E` | ciano + magenta (agente editou E está sujo) |

Substrato e superfícies — preto de tinta é **quente**, papel não-revestido nunca é branco:

| Token | Hex | Uso |
|---|---|---|
| `--substrate` | `#141210` | fundo da janela |
| `--panel` | `#1C1A18` | painéis |
| `--rule` | `#2A2724` | fio de 1px |
| `--paper` | `#EDE6DA` | texto primário |
| `--muted` | `#8A8378` | texto secundário |

**Regras duras:**
- Zero `box-shadow` em qualquer lugar. Profundidade é degrau de valor + fio de 1px.
- Raio de canto máximo 3px.
- Cor de tinta só comunica estado. Nunca usar ciano/magenta/amarelo como enfeite.

## Tipografia — três vozes

- **Archivo Expanded / Black** — display. No máximo 4 ocorrências no app inteiro (nome do projeto, título de estado vazio, splash, sobre).
- **Archivo** — UI, labels, menus.
- **Commit Mono** — código, dados, todos os números.

**Todo número é tabular e monoespaçado** — contador de token, linhas, commits à frente/atrás. Número que "pula" ao atualizar em painel de telemetria é bug, não estilo.

## Densidade e detalhe

- Grid rígido de 4px. Linha da árvore de arquivos: 22px de altura.
- **Remover ícones coloridos de tipo de arquivo.** Trocar por tag de duas letras em mono (`TS`, `TSX`, `MD`) na cor `--muted`.
- Foco de teclado visível: 1px inset em `--ink-yellow`. Nunca o outline padrão do Chromium.
- Barra de título própria (frameless) — é onde mora a tira de controle.

## Movimento

Mecânico, sem elasticidade. Transição de estado em 80ms linear. Nada de easing com bounce.

**Um único momento orquestrado:** quando o agente inicia um turno, a tira de controle "entinta" da esquerda para a direita; quando o hook `Stop` dispara, a marca de registro encaixa com um clique. Respeitar `prefers-reduced-motion`.

## Elemento assinatura — a tira de controle

Faixa fina fixa na barra de título, composta de patches quadrados em cunha de degraus (não barra de progresso — degrau é o que se lê numa prova). Cada patch é uma leitura real:

```
┌──────────────────────────────────────────────┐
│ ▪▪▪▪▪▪░░  ▪▪░░░░░░  ▪▪▪▪▪░░░  ▪░░░░░░░  ⊕   │
│ contexto   tokens     git        erros    reg │
└──────────────────────────────────────────────┘
```

O `⊕` é a marca de registro: alinhada quando o arquivo aberto bate com o HEAD, deslocada em proporção ao tamanho do diff quando diverge. Fora de registro = diff.

## Escrita na interface

- Estado vazio convida à ação: "Abra uma pasta pra começar — `Ctrl+O`", não "Nenhuma pasta aberta".
- Erro diz o que quebrou e o que fazer. Não pede desculpa, não é vago.
- Botão e resultado usam a mesma palavra: botão "Commitar" → toast "Commitado".
- Voz ativa, sentence case, sem filler.

---

# FASES

## FASE 0 — Reconhecimento (sem escrever código de feature)

**Objetivo:** mapear o que existe antes de mexer em qualquer coisa.

Entregar um documento `docs/ARQUITETURA.md` contendo:
- Inventário de todos os canais IPC atuais: nome, payload, retorno, arquivo onde vive.
- Onde o estado do renderer é gerenciado hoje (context, store, props).
- Onde as cores e fontes estão hardcoded — lista de arquivos e ocorrências.
- Como as configurações são persistidas hoje (formato, local, schema).
- Quais handlers de fs **não** validam path contra a raiz do workspace.
- Onde o mapa de imports é calculado e como é cacheado (se é).
- Como o chokidar está configurado: escopo, ignores, profundidade.

**Único código permitido nesta fase:** corrigir os handlers de fs sem validação de path, se houver. Nada mais.

**Critério de aceite:** o documento existe, `typecheck` passa, nenhum arquivo de UI foi tocado.

---

## FASE 1 — Fundação visual (sem mudança de comportamento)

**Objetivo:** instalar o sistema de design como tokens, sem alterar nenhuma funcionalidade.

- Criar `src/renderer/styles/tokens.css` com todas as variáveis da seção Sistema de Design.
- Estender `tailwind.config.js` mapeando os tokens (`substrate`, `panel`, `rule`, `paper`, `muted`, `ink-cyan`, `ink-magenta`, `ink-yellow`, `ink-overprint`). **Não remover** nada que já esteja lá.
- Substituir cores hardcoded pelos tokens, arquivo por arquivo, usando o inventário da Fase 0.
- Instalar as três fontes localmente em `src/renderer/assets/fonts` com `@font-face` e `font-display: swap`. Sem CDN — o app roda offline.
- Aplicar: densidade de 4px, altura de linha 22px na árvore, remoção de `box-shadow`, raio máximo 3px, foco em amarelo.
- Trocar ícones de tipo de arquivo por tag de duas letras.
- Aplicar tabular-nums em todo número.

**Dependências permitidas:** nenhuma.

**Critério de aceite:** o app funciona exatamente como antes. Nenhuma cor literal restou nos componentes. Screenshot antes/depois de cada painel.

---

## FASE 2 — Fundo personalizável

**Objetivo:** o usuário escolhe imagem, gradiente ou cor sólida como fundo, sem que o sistema de tintas perca legibilidade.

### Arquitetura em camadas

```
L0  mídia        imagem / gradiente / cor sólida / Mica (Win11)
L1  véu          duotone + substrato @ N%   ← garante contraste
L2  superfícies  painéis com --surface-alpha
L3  conteúdo     texto e tintas, sempre 100% opacos
```

Texto nunca fica direto sobre a mídia. L3 sempre sobre L2.

### Duotone

A imagem do usuário passa por separação nas tintas do app antes de virar fundo: filtro SVG `feComponentTransfer` mapeando o preto da imagem para `--substrate` e o branco para a cor spot. Qualquer foto entra na paleta.

### Tokens

```css
:root {
  --bg-blur: 24px;
  --bg-scale: 1.04;        /* evita borda clara do blur */
  --veil: 0.72;
  --surface-alpha: 0.78;
  --spot: #C4457F;
}
```

### Guarda de contraste (obrigatória)

Ao carregar a imagem, desenhar em canvas offscreen 32×32 e calcular luminância média. Se a L1 resultante ficar acima de L\* 20, **subir `--veil` automaticamente** até atingir o alvo e informar no painel: "Véu ajustado pra 84% — a imagem é clara demais". Não bloquear, informar.

Toggle **"Contraste garantido"**, ligado por padrão, que trava o mínimo.

### Terminal — atenção

O canvas do xterm continua **opaco**. O painel do terminal recebe uma superfície própria com o véu aplicado **atrás** do canvas, e `theme.background` do xterm é setado em JS com a cor resultante da composição das camadas — calculada, não herdada por CSS. O usuário vê o mesmo tom, o WebGL é preservado.

Opção separada e explícita: "Terminal translúcido (usa renderizador Canvas, pode ficar mais lento)".

### Performance

- **Um `backdrop-filter` por painel, nunca por linha.** Painel translúcido, linhas 100% transparentes. Árvore com centenas de nós com backdrop-filter mata a GPU.
- Pré-processar a imagem uma vez no main process: gerar versão borrada e versão no tamanho da tela, cachear em `userData`, servir pronta. Não borrar em CSS a cada frame.
- `will-change: transform` e `translateZ(0)` na L0.

### Encanamento

- Registrar protocolo próprio no main (`protocol.handle('vibe', ...)`) — `file://` não passa com sandbox ligado.
- **Copiar** a imagem escolhida para `userData/backgrounds/` em vez de guardar o caminho original. Persistir só hash + parâmetros no settings existente.
- Windows 11: expor `backgroundMaterial: 'mica'` com `transparent: true` como opção "Usar papel de parede do sistema".

### Configurações expostas

Blur, brilho, saturação, opacidade do véu, opacidade das superfícies, cor spot. Seis sliders, preview ao vivo, botão **Restaurar padrão** sempre visível.

Ship com presets curados: folha de prova, retícula meio-tom, marcas de registro, papel kraft, e sólido. A maioria dos usuários nunca sobe imagem própria.

**Formato de tema:** `.vibe-theme.json` com tokens + fundo em base64, importável e exportável. Vira tema compartilhável.

**Dependências permitidas:** `sharp` (ou canvas nativo do Electron, preferível se evitar binário nativo extra).

**Critério de aceite:** carregar uma foto clara não deixa nenhum texto abaixo de 4.5:1. Terminal continua em WebGL. Scroll da árvore em repo grande sem queda de FPS.

---

## FASE 3 — Busca global

**Objetivo:** fechar o buraco mais óbvio. Sem busca local, o usuário pede pro agente grepar e queima contexto.

- `ripgrep` via `rg --json` no main process, canal IPC novo.
- Bundlar o binário do rg (via `@vscode/ripgrep`) — não depender de instalação do usuário.
- Resultados agrupados por arquivo, clicáveis para o preview com scroll até a linha.
- Filtros: case sensitive, regex, incluir/excluir glob.
- Respeitar `.gitignore` por padrão, com toggle.
- Debounce, cancelamento da busca anterior, limite de resultados.
- `Ctrl+Shift+F` abre; `Ctrl+P` para fuzzy file open.

**Dependências permitidas:** `@vscode/ripgrep`.

**Critério de aceite:** busca em repo de 10k arquivos retorna primeiros resultados em menos de 300ms.

---

## FASE 4 — Hooks e notificações

**Objetivo:** instalar a infraestrutura de eventos. Tudo depois disso depende dela.

O Claude Code expõe hooks em `.claude/settings.json`: `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `SessionStart`, `UserPromptSubmit`, `SubagentStop`, `PreCompact`. É interface documentada e estável — preferível a scraping.

- Servidor HTTP local no main, porta efêmera, bind em `127.0.0.1`, token de sessão aleatório no header. Rejeitar requisição sem token.
- Script de hook pequeno instalado em `.claude/hooks/` que faz POST nesse servidor.
- Instalação via **merge não-destrutivo** no settings do usuário, com backup timestampado. Botão "Desinstalar hooks" que reverte exatamente.
- Painel de configuração mostrando quais hooks estão instalados e o que cada um faz.

**Primeiro consumidor — notificações:**
- Notificação desktop + som em `Stop` e `Notification`.
- Só dispara se a janela não estiver focada.
- Configurável: ligar/desligar, escolher som, silenciar por sessão.

**Segundo consumidor — a tira de controle:**
- `UserPromptSubmit` inicia a animação de entintagem.
- `Stop` encaixa a marca de registro.

**Dependências permitidas:** nenhuma (usar `http` e `Notification` do Electron).

**Critério de aceite:** desinstalar os hooks devolve o `settings.json` byte a byte ao estado anterior. App funciona normalmente com hooks desinstalados.

---

## FASE 5 — Painel de atividade e custo

**Objetivo:** responder "o que o agente está fazendo agora" e "quanto custou".

Fonte: transcript JSONL em `~/.claude/projects/<cwd-encoded>/<session>.jsonl`. Cada linha é uma mensagem com blocos `tool_use`, `usage` (input/output/cache) e timestamp.

- Tailar com `chokidar` (já em uso), lendo incrementalmente por offset — nunca reler o arquivo inteiro.
- **Parse defensivo obrigatório.** O schema é não-oficial e muda entre versões: campo desconhecido é ignorado, linha malformada é pulada e contada, nunca derruba a UI. Se mais de 20% das linhas falharem, mostrar aviso "Formato de transcript não reconhecido — atualize o vibeIDE" e degradar para painel vazio, sem quebrar nada.

**O painel entrega:**
- Timeline de tool calls: arquivos lidos, arquivos editados, comandos rodados, com timestamp.
- Árvore de subagents (`Task`) aninhada.
- Todo list do `TodoWrite` renderizada como checklist real.
- Tokens e custo acumulando por turno, com gráfico por sessão.
- Badge "tocado pelo agente" na árvore de arquivos, em `--ink-cyan`, ao lado do status de git existente. Overprint quando os dois estados coincidem.

- Navegador de sessões passadas: buscar em todas as sessões do projeto, ver o que foi feito, retomar com `claude --resume <id>`.

**Dependências permitidas:** nenhuma.

**Critério de aceite:** transcript de 50MB não trava a UI. Claude Code com formato desconhecido não quebra o app.

---

## FASE 6 — Checkpoints

**Objetivo:** responder "como eu volto".

Snapshot automático antes de cada escrita do agente, disparado pelo hook `PreToolUse` de `Edit`/`Write`/`MultiEdit`.

**Implementação — não encostar no estado do usuário:**
- Usar `GIT_INDEX_FILE` apontando para índice temporário + `git add -A` + `git commit-tree`, gravando em `refs/vibe/checkpoints`.
- **Nunca** tocar no index real, no HEAD, no stash ou na working tree do usuário.
- Se o projeto não for um repo git, desabilitar a feature e explicar o porquê na UI. Não inicializar repo por conta própria.

**Cuidados obrigatórios:**
- Arquivos untracked precisam entrar no snapshot; `.gitignore` precisa ser respeitado.
- Submódulos: não recursar. Avisar na UI que submódulos não são versionados no checkpoint.
- Limite de tamanho: se o snapshot passar de N MB, pular e avisar em vez de travar.
- Poda automática: manter os últimos 100 checkpoints, `gc` do resto.

**UI:**
- Timeline de checkpoints rotulada com o prompt que originou cada um.
- Diff de qualquer checkpoint contra o estado atual.
- "Restaurar" com confirmação explícita mostrando exatamente quais arquivos serão sobrescritos. Antes de restaurar, criar um checkpoint do estado atual — restaurar também precisa ter volta.

**Critério de aceite:** rodar 50 checkpoints e verificar que `git status`, `git stash list` e `git log` do usuário estão intactos.

---

## FASE 7 — Servidor MCP interno

**Objetivo:** transformar o vibeIDE de visualizador em **provedor de contexto**. É a única versão da tese de economia de token que se sustenta tecnicamente.

Expor as ferramentas do próprio app via MCP para o Claude que roda no terminal:

| Ferramenta | Retorna |
|---|---|
| `get_project_graph` | o mapa de imports já calculado, pronto — em vez de 12 `Grep` |
| `get_diagnostics` | `tsc --noEmit` + eslint em JSON, rodando local |
| `get_open_file` | arquivo aberto no preview e a seleção atual |
| `get_console_errors` | erros capturados do dev server (depende da Fase 8) |

- Servidor MCP stdio ou HTTP local, registrado em `.mcp.json` do projeto via merge não-destrutivo.
- Botão de instalar/desinstalar, igual aos hooks.
- Cada ferramenta com descrição curta e schema estrito — descrição ruim gasta contexto e a ferramenta não é usada.

**Critério de aceite:** desinstalar remove a entrada do `.mcp.json` sem tocar em outras entradas.

---

## FASE 8 — Verificação

**Objetivo:** responder "funcionou?".

- Runner dos scripts do `package.json` com painel de output, parse de ANSI e extração de erro.
- Detecção da porta do dev server a partir do output.
- `<webview>` embutido apontando para a porta detectada.
- Captura de erros de console e requests falhados do webview.
- **Botão "Mandar pro Claude"**: escreve o erro formatado no pty. É o loop mais repetido do vibecoding e hoje é copiar/colar manual.
- Painel de diagnósticos: `tsc --noEmit` e eslint rodando local, marcadores inline no preview, contagem na tira de controle.

**Segurança do webview:** `nodeIntegration: false`, `contextIsolation: true`, `allowpopups` desligado, e só permitir navegação para localhost.

**Critério de aceite:** um erro de runtime no dev server aparece no painel em menos de 1s e vai pro terminal com um clique.

---

## FASE 9 — Paralelismo

**Objetivo:** rodar mais de um agente sem virar caos.

- Abas de terminal (múltiplas sessões `node-pty`).
- Gerenciador de git worktrees: "Nova tarefa" cria worktree em `../.vibe-worktrees/<branch>` e abre um terminal com `claude` ali.
- Board de agentes com estado derivado dos hooks: rodando / aguardando input / concluído.
- Diff de cada worktree contra a base, botão de merge.
- Limpeza: remover worktree com confirmação, nunca automático.

**Critério de aceite:** fechar o app com 3 worktrees ativas não deixa processo órfão nem worktree corrompida.

---

## FASE 10 — Mapa como folha de imposição

**Objetivo:** o grafo force-directed com nós coloridos é o visual padrão de demo de biblioteca de grafo — genérico por construção, e não responde a pergunta nenhuma.

Redesenhar como folha de imposição:
- Retângulos em grid, **área proporcional ao peso em tokens**.
- Arestas como fios de 1px.
- Cor só pelas tintas semânticas.
- Rótulos em Commit Mono.

A leitura muda: você olha e vê onde está o peso do projeto.

**Junto, corrigir a dívida técnica do parser:**
- Trocar regex por AST com `oxc-parser`. Regex quebra em re-export, `import()` dinâmico e alias de `tsconfig`.
- Resolver os `paths` do tsconfig.
- Scan incremental: cache em disco com chave por mtime, rescan só do que mudou.
- Detecção de ciclo e de arquivos órfãos.
- Seletor de contexto: marcar nós, gerar `@caminho @caminho` no clipboard com soma de tokens estimada. Expandir seleção por imports em N níveis.

**Revisar a configuração do chokidar** enquanto isso: respeitar `.gitignore`, limitar profundidade, `ignoreInitial`. Chokidar em repo grande sem ignores estoura memória.

**Dependências permitidas:** `oxc-parser`.

---

## FASE 11 — Embalagem

Não é polimento — é o que decide se alguém encontra o projeto.

- `README.md` em inglês, `README.pt-BR.md` com o conteúdo atual.
- GIF de 10s no topo mostrando o painel de atividade e o mapa.
- Licença MIT.
- Topics no repo: `claude-code`, `electron`, `ai-coding`, `developer-tools`, `vibe-coding`.
- Descrição do repo preenchida.
- `electron-updater` apontando para as releases do GitHub.
- Builds mac e linux, não só NSIS.
- Bitmap lateral customizado no instalador NSIS — quase todo Electron shipa o default.
- Ícone do app derivado da tira de controle.
- Repo separado `vibe-ide-themes` para os `.vibe-theme.json` da comunidade.

---

# O QUE NÃO CONSTRUIR

Estas exclusões são deliberadas. Se o plano parecer pedir alguma delas, é engano — pergunte.

- **Editor completo (Monaco/CodeMirror).** É esteira rolante contra o VS Code e não é a tese. Preview read-only + diff + "abrir no editor externo" basta.
- **Painel de chat com IA.** O terminal já é o agente. Duplicar é confusão de modelo mental.
- **Cliente git completo.** Só o que serve auditoria: diff por hunk, blame, histórico, branch switcher.
- **Sistema de plugins.** Cedo demais, e trava a arquitetura antes dela estar madura.
- **Sincronização em nuvem / conta de usuário.** O app é local. Continua local.
