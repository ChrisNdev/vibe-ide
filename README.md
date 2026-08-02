# vibeIDE

Cockpit desktop para rodar o [Claude Code](https://claude.com/claude-code): explorador de arquivos, terminal real e algumas ferramentas que evitam gastar tokens de IA em coisas que dá pra resolver localmente — ver o mapa do projeto, ler um arquivo, ver um diff, dar commit.

Feito com Electron + React + TypeScript.

## Instalação (Windows)

A forma mais fácil: baixe o instalador pronto, sem precisar clonar nada.

**[⬇ Baixar a última versão](https://github.com/ChrisNdev/vibe-ide/releases/latest)** — pegue o `vibeIDE-Setup-x.x.x.exe` nos assets da release.

Execute o `.exe`, escolha a pasta de instalação e pronto — cria atalho na área de trabalho e no menu iniciar. (O Windows pode avisar "Editor desconhecido" por não ser assinado digitalmente; clique em "Mais informações" → "Executar assim mesmo".)

## Recursos

- **Explorador de arquivos** — árvore de diretórios com carregamento sob demanda, status de git por arquivo (modificado/staged/novo/etc.), criar/renomear/duplicar/mover/excluir, tudo com atualização automática via `chokidar`.
- **Terminal real** — `node-pty` com um shell de verdade (PowerShell/cmd/bash/WSL, detecção automática), renderizado com WebGL (e fallback automático pra Canvas ou DOM se a GPU não aguentar). Abre já rodando `claude`.
- **Mapa mental do projeto** — grafo interativo (estilo Graphify) das relações de import entre os arquivos do projeto. Construído 100% localmente via leitura de arquivos + regex no processo principal — **nenhuma chamada de IA envolvida**, então visualizar a estrutura do projeto não custa token nenhum. Arrasta, dá zoom, e mostra tamanho/estimativa de tokens de cada arquivo em hover.
- **Visualizador local (Preview)** — clique num arquivo no explorador e o conteúdo aparece com numeração de linha e realce de sintaxe (TS/TSX/JS/JSX/JSON/CSS/HTML/Python/YAML/Bash/Markdown), lido direto do disco. Mostra tamanho e estimativa de tokens, e tem um toggle pra ver o diff do arquivo contra o HEAD (via `simple-git`) — nada disso passa pelo Claude.
- **Commit rápido** — barra fixa no rodapé do explorador com a branch atual, contadores de commits à frente/atrás do remoto, caixa de mensagem (`Ctrl+Enter` para commitar) e botão de push, sem precisar abrir o terminal.

## Rodando a partir do código-fonte

Pra quem quer mexer no código em vez de só usar o instalador. Pré-requisitos: [Node.js](https://nodejs.org) 18+ e o [Claude Code CLI](https://claude.com/claude-code) instalado (é o que o terminal já abre rodando).

```bash
npm install
npm run dev
```

Isso builda o processo principal/preload, sobe o Vite em modo dev pro renderer e abre a janela do Electron com hot reload.

## Build

```bash
npm run typecheck   # checa main + renderer
npm run build       # build de produção (electron-vite)
npm run build:win   # build + instalador NSIS pra Windows (out/ → dist/)
```

## Arquitetura

```
src/
  main/       processo principal do Electron — fs, git, pty, mapa mental, janela
    ipc/      um handler por domínio (fs, git, pty, settings, graph)
  preload/    ponte contextBridge entre main e renderer (contextIsolation + sandbox ligados)
  renderer/   app React (explorador, terminal, mapa mental, preview)
  shared/     tipos e constantes de IPC compartilhados entre os três mundos
```

Toda comunicação entre a UI e o sistema de arquivos/git/terminal passa pelo `preload` via `contextBridge` — o renderer roda com `nodeIntegration: false` e `sandbox: true`, sem acesso direto a Node/Electron.

## Licença

Projeto pessoal, sem licença definida.
