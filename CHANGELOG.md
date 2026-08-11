# Changelog

Todas as mudanças notáveis do vibeIDE ficam registradas aqui. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.4.5] — 2026-08-11

### Corrigido

- **Nomes de arquivo se sobrepunham no mapa mental** — o nome era cortado num limite fixo de 22 caracteres, sem nenhuma relação com a largura do retângulo em que ia ser desenhado. Como `<text>` do SVG não é recortado pela caixa irmã, todo nome mais largo que o próprio retângulo passava por cima dos vizinhos e embaralhava a leitura do mapa inteiro nas regiões de arquivos pequenos. Agora o corte é calculado a partir da largura disponível (a fonte é monoespaçada, então isso é aritmética, sem medir no DOM), e um retângulo baixo demais pro texto caber na altura simplesmente não recebe nome.

- **App fechava sozinho ao rodar um script na aba Verificação** — se o gerenciador de pacotes (`npm`/`pnpm`/`yarn`) não estivesse no PATH, o processo filho emitia um evento `error` que ninguém escutava. Em Node isso não é um erro tratável: vira exceção não capturada e derruba o processo principal inteiro. Agora a falha aparece como texto no painel de saída, como qualquer outro erro do script.
- **Terminal podia ficar mudo depois de reabrir** — ao criar um terminal com um id que acabou de ser encerrado, o `onExit` atrasado do processo antigo removia do mapa a sessão *nova*. A partir daí tudo que era digitado ia pro vazio e o app ainda escrevia "processo encerrado" num terminal que estava vivo. A remoção agora confere a identidade da sessão, não só o id.
- **Terminal em branco sem explicação** — quando o shell não existe ou a pasta do projeto sumiu, o `node-pty` falha na hora; esse erro só rejeitava a chamada interna e o painel ficava preto e vazio. Agora a mensagem real do sistema aparece dentro do próprio terminal.
- **Botão "+" de novo terminal era inalcançável** — a barra de abas só aparecia com 2 abas ou mais, e o "+" mora nela. Como ele era o único jeito de chegar na segunda aba, uma segunda aba nunca podia existir. A barra aparece a partir da primeira aba.
- **Painel de atividade travava ou contava duas vezes** — três causas somadas no leitor do transcript: uma linha capturada no meio da escrita era contada como "formato não reconhecido"; bytes gravados durante a leitura eram lidos de novo na passada seguinte, duplicando tool calls e tokens; e um evento que chegasse durante uma leitura era descartado, deixando o painel parado no estado anterior — justamente no fim de cada turno. Se o arquivo fosse reescrito, o painel congelava de vez.
- **Erros de console do preview apareciam repetidos** — o `<webview>` do painel de Verificação ganhava um par novo de listeners a cada re-renderização, e um dev server re-renderiza a cada pedaço de saída. O mesmo erro era registrado dezenas de vezes.
- **Busca podia parar de mostrar o progresso** — quando o `ripgrep` falhava ao iniciar, "erro" e "fim" disparavam os dois, mandando dois eventos de conclusão pra interface.
- **App congelava ao fechar com vários terminais abertos** — encerrar a árvore de processos de cada terminal era uma chamada síncrona ao `taskkill`, que segurava o processo principal por volta de 100ms por terminal vivo antes da janela sumir. Agora roda desanexado: não bloqueia nada e ainda conclui mesmo que o app feche primeiro. Vale igual pro botão "parar" da aba Verificação, que tinha a mesma chamada.

- **Barra de contexto cravada em 100%** — a janela de contexto era um `200.000` fixo no código, então quem tem a janela de 1M via a barra vermelha no talo o tempo todo, com a sessão perfeitamente saudável — um indicador que só sabe dizer "cheio" é pior que indicador nenhum. Agora o tamanho da janela é deduzido do maior uso já observado.

### Melhorado

- **Instalador com a cara do app** — o painel lateral e o cabeçalho do instalador NSIS agora usam a identidade visual do vibeIDE (fundo escuro, a marca de registro, o wordmark), em vez da arte genérica padrão. A arte é gerada por `build/make-installer-art.ps1`, junto com o ícone.
- **Instalador menos suspeito pro Windows** — o `.exe` agora carrega os metadados de versão completos (copyright, editor), que faltando pioram a nota nas heurísticas do Defender. Toda release passa a incluir também um `.zip` sem instalador, pra quem tiver o `Setup.exe` bloqueado ou posto em quarentena. O build já está preparado pra assinatura digital (`CSC_LINK`/`CSC_KEY_PASSWORD`) — que é o que de fato resolve o aviso do SmartScreen; ver o README.

## [1.4.4] — 2026-08-04

### Adicionado

- **Pasta vazia = projeto novo** — ao abrir uma pasta sem nenhum arquivo, o Claude já entra perguntando o que você quer construir, em vez de esperar num prompt em branco sem contexto nenhum.

### Melhorado

- **Barra de controle mostra uso real de contexto** — antes era só um pulso decorativo que enchia e esvaziava a cada turno; agora o preenchimento reflete os tokens de fato usados na janela de contexto (entrada + cache) da última mensagem, com cor de aviso perto do limite.

## [1.4.3] — 2026-08-04

### Corrigido

- **Barra de título nativa do Windows cobria os botões da barra de ferramentas** — o app reservava 36px no canto superior direito pros botões nativos de minimizar/maximizar/fechar, exatamente onde ficavam os botões de Busca/Mais opções/Atualizar. Substituída por uma barra de título própria, no mesmo estilo do resto do app, sempre visível (inclusive na tela inicial, que antes não tinha nenhum jeito de fechar o app sem a barra nativa).
- **Atualização automática podia travar silenciosamente (causa raiz de verdade dessa vez)** — o `timeout.exe` do Windows se recusa a rodar sempre que a entrada padrão não é um console real, que é exatamente o caso do processo desanexado que a atualização automática usa. Como o script usava `&&`, essa falha travava a cadeia inteira antes do instalador sequer rodar. Trocado por uma espera real: o processo antigo é monitorado até terminar de verdade (em vez de um tempo fixo chutado), e o instalador roda com espera até completar (em vez de assumir quanto tempo ele leva).

## [1.4.2] — 2026-08-04

### Adicionado

- **Copiar e colar de verdade no terminal** — Ctrl+C copia o texto selecionado (em vez de interromper o comando, que continua sendo o comportamento sem seleção); Ctrl+V cola, incluindo **imagens** — uma imagem no clipboard (print de tela, por exemplo) é salva como PNG temporário e o caminho é colado no prompt, do jeito que o Claude Code CLI reconhece uma imagem anexada.

## [1.4.1] — 2026-08-04

### Corrigido

- **Atualização automática podia travar sem avisar** — o instalador rodava só 2s depois do app fechar, tempo insuficiente pra Windows liberar o arquivo `.exe` (4 processos + limpeza de hooks/MCP/pty no fechamento). Quando isso acontecia, o NSIS mostrava um aviso de "arquivo em uso" que `/S` (modo silencioso) não suprime — e como o app já tinha fechado, ninguém via esse aviso, então a atualização silenciosamente nunca terminava. Aumentado pra 6s.

### Melhorado

- **Botão de atualizar agora verifica sozinho** — antes só checava quando clicado, então uma atualização disponível ficava invisível atrás de um botão "verificar atualização" sem motivo pra clicar. Agora verifica ao abrir o app.
- **Verificador de atualização também aparece na tela inicial** — antes só existia depois de abrir um projeto.

## [1.4.0] — 2026-08-03

### Visual — vidro por padrão

- Sistema de cores trocado das tintas CMYK pra paleta neutra estilo macOS dark mode, com azul (`systemBlue`) como cor de destaque no lugar do verde.
- Cantos arredondados, sombras e um fundo em gradiente ligado por padrão — os painéis flutuantes (busca, worktree, configurações, notas de versão) agora usam vidro de verdade (`backdrop-filter`), com um brilho fino no topo que é a assinatura visual do estilo.
- Sidebar, moldura do terminal, barra de ícones, barra de commit, mapa mental, preview e atividade usam uma versão mais barata do vidro (só cor translúcida, sem blur) — ver "Desempenho" abaixo.

### Menu mais enxuto

- As 5 funções avançadas (Aparência, Notificações, Pontos de restauração, Ferramentas extras pro Claude, Tarefas em paralelo) saíram da barra principal e foram pro botão **"Mais opções"**, cada uma com uma frase em português simples explicando o que faz.
- **Tela de boas-vindas** — na primeira vez que você abre um projeto, um guia rápido explica o que cada aba faz (Terminal, Mapa mental, Visualizador, Atividade, Verificação, Buscar, Mais opções). Aparece só uma vez.

### Corrigido

- **App travava ao abrir/fechar painéis** — 7 estados booleanos independentes controlavam os painéis do lado direito; eles podiam empilhar de forma invisível (mesma posição, mesmo z-index, decidido pela ordem do DOM em vez da ordem de clique). Virou um único estado — só um painel pode estar aberto por vez, por construção.
- **Tecla Esc não fechava a maioria dos painéis** — Worktree, MCP, Hooks, Checkpoints e Aparência nunca tinham isso implementado. Centralizado num componente `SidePanel` compartilhado.
- **Painel flutuava embaixo dos botões nativos do Windows** — o app reserva 36px no topo pro Windows desenhar minimizar/maximizar/fechar por cima; os painéis começavam a 12px do topo, ficando parcialmente cobertos.
- **Explorador de arquivos, barra de commit, atividade, preview e mapa mental não ficavam com vidro** — tinham um fundo opaco (`bg-base-850`/`bg-base-900`) próprio, por cima do vidro do painel pai, cobrindo o efeito inteiro.
- **Slider "Opacidade das superfícies" não fazia nada** — a variável CSS que controla a opacidade do vidro nunca era sincronizada com a configuração; ficava sempre no valor padrão fixo.
- **Notas de versão nunca apareciam se nenhum projeto estivesse aberto** — o modal só era renderizado dentro do branch "projeto aberto", então sumia silenciosamente pra quem atualizava e não tinha reaberto um projeto ainda.

### Desempenho

- **App ficando lento com o mouse em qualquer lugar** — a máquina roda com aceleração de hardware desligada (workaround de VM/RDP/Windows IoT), então todo `backdrop-filter: blur()` caía pra renderização por software, muito mais cara. Religada por padrão — o código já tinha um fallback de 1.5s que mostra a janela mesmo se o compositor nunca ficar pronto, então o caso raro continua coberto sem penalizar todo mundo.
- Blur de verdade agora só nos painéis ocasionais (que abrem e fecham); tudo que fica sempre visível usa só cor translúcida, sem o custo de recalcular blur a cada repintura.

## [1.3.1] — 2026-08-03

### Corrigido

- **App crashava ao abrir na versão instalada (build empacotada)** — `resolveRgPath()` (busca global, `Ctrl+Shift+F`) rodava no carregamento do módulo, antes até da janela abrir, e usava `require.resolve()` puro pra achar o binário do `rg.exe`. Isso funciona em dev porque o `@vscode/ripgrep-win32-x64` fica "hoisted" na raiz do `node_modules` — mas no build empacotado o npm o aninhou dentro de `@vscode/ripgrep/node_modules/...`, fora do caminho que o resolver checa a partir de `out/main/index.js`. A falha, sendo no topo do módulo, derrubava o processo principal inteiro com "A JavaScript error occurred in the main process". A resolução agora é preguiçosa (só roda quando a busca é usada de verdade) e, no build empacotado, monta o caminho real via `process.resourcesPath` + `app.asar.unpacked` em vez de confiar cegamente no `require.resolve`.

## [1.3.0] — 2026-08-03

### Rodar mais de um agente sem virar caos

- **Terminal em abas** — várias sessões `node-pty` lado a lado, cada uma com seu próprio shell.
- **Tarefas paralelas via git worktree** — "Nova tarefa" cria uma worktree isolada em `../.vibe-worktrees/<branch>` e já abre um agente Claude rodando ali, sem tocar na working tree principal.
- **Board de status por tarefa** — rodando / aguardando input / concluído, derivado direto dos hooks do Claude Code, sem polling.
- **Diff e merge por worktree** — compara cada tarefa contra a branch atual e mescla com um clique. Remover uma worktree sempre pede confirmação explícita — nunca automático.

### Mapa mental virou folha de imposição

- Trocado o layout de grafo force-directed por um treemap: retângulos com **área proporcional ao peso em tokens** de cada arquivo, no lugar de bolinhas do mesmo tamanho.
- Cor agora só comunica estado (tinta ciano = tocado pelo agente, magenta = modificado, sobreposição = os dois, amarelo = ciclo de import) — nada de cor decorativa.
- **Parser trocado de regex pra AST** (`oxc-parser`): re-exports, `import()` dinâmico e alias de `tsconfig.json` (inclusive projetos compostos com `references`) agora resolvem corretamente.
- **Cache em disco por mtime** — reconstruir o mapa de um projeto sem mudanças fica quase instantâneo em vez de reler tudo do zero.
- **Detecção de ciclo de import e de arquivos órfãos**, com indicação visual no próprio mapa.
- **Seletor de contexto** — marca arquivos no mapa, expande a seleção N níveis pelos imports, e copia `@caminho @caminho` pro clipboard com a soma de tokens estimada. Contexto pronto pro chat sem grepar nada.
- Watcher de arquivos (`chokidar`) agora respeita o `.gitignore` do projeto.

### Notas de versão

- O app agora mostra as notas de versão automaticamente **uma única vez**, na primeira abertura depois de uma atualização — seja via update in-app ou instalação manual.

### Embalagem

- `README.md` em inglês (principal) + `README.pt-BR.md`, cobrindo todos os recursos de fato existentes.
- Licença MIT.
- Ícone do app redesenhado a partir da própria identidade visual: substrato preto quente, marca de registro (⊕) e a tira de controle CMYK, no lugar do glifo de terminal genérico.

### Correções de bastidor

- Empacotamento nativo do `oxc-parser` corrigido: o pacote é ESM-only e quebrava com `ERR_REQUIRE_ESM` no processo principal (bundlado como CommonJS) rodando sob o Node mais antigo embutido no Electron — resolvido com `import()` dinâmico.

---

## [1.2.0] e anteriores

Fases 1 a 8: fundação visual, fundo personalizável, busca global, hooks e notificações, painel de atividade e custo, checkpoints, servidor MCP interno e painel de verificação. Ver histórico do git para o detalhamento de cada fase.
