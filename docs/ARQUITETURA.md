# vibeIDE — Arquitetura atual (Fase 0)

> Levantamento de reconhecimento, sem mudança de comportamento. Único código alterado nesta fase: validação de path nos handlers de `fs.ts` (ver seção "Handlers de fs sem validação de path").

---

## 1. Inventário de canais IPC

Definidos em `src/shared/types.ts` (objeto `IPC`), registrados em `src/main/ipc/*.ts`, expostos ao renderer via `contextBridge` em `src/preload/index.ts`.

| Canal | Payload (args) | Retorno | Handler |
|---|---|---|---|
| `dialog:openFolder` | — | `string \| null` | `src/main/ipc/fs.ts` |
| `fs:readDir` | `dirPath: string` | `FileEntry[]` | `src/main/ipc/fs.ts` |
| `fs:createFile` | `filePath: string` | `void` | `src/main/ipc/fs.ts` |
| `fs:createDir` | `dirPath: string` | `void` | `src/main/ipc/fs.ts` |
| `fs:rename` | `oldPath: string, newPath: string` | `void` | `src/main/ipc/fs.ts` |
| `fs:delete` | `targetPath: string` | `void` | `src/main/ipc/fs.ts` |
| `fs:duplicate` | `sourcePath: string` | `string` (novo caminho) | `src/main/ipc/fs.ts` |
| `fs:move` | `sourcePath: string, destDir: string` | `string` (novo caminho) | `src/main/ipc/fs.ts` |
| `fs:reveal` | `targetPath: string` | `void` | `src/main/ipc/fs.ts` |
| `fs:watch` | `rootPath: string` | `void` | `src/main/ipc/fs.ts` → `src/main/file-watcher.ts` |
| `fs:unwatch` | `rootPath: string` | `void` | `src/main/ipc/fs.ts` → `src/main/file-watcher.ts` |
| `fs:event` *(main→renderer, push)* | `FsWatchEvent { type, path }` | — | emitido por `src/main/file-watcher.ts` |
| `fs:readFile` | `filePath: string` | `FileReadResult { content, size, truncated, binary }` | `src/main/ipc/fs.ts` |
| `clipboard:write` | `text: string` | `void` | `src/main/ipc/fs.ts` |
| `git:status` | `rootPath: string` | `GitRepoStatus` | `src/main/ipc/git.ts` |
| `git:diff` | `rootPath: string, filePath: string` | `string` (diff contra HEAD) | `src/main/ipc/git.ts` |
| `git:commit` | `rootPath: string, message: string` | `void` | `src/main/ipc/git.ts` |
| `git:push` | `rootPath: string` | `void` | `src/main/ipc/git.ts` |
| `pty:spawn` | `PtySpawnOptions { id, cwd, shell?, args?, cols, rows, autoRun? }` | `void` | `src/main/ipc/pty.ts` → `src/main/pty-manager.ts` |
| `pty:write` | `id: string, data: string` | `void` | `src/main/ipc/pty.ts` |
| `pty:resize` | `id: string, cols: number, rows: number` | `void` | `src/main/ipc/pty.ts` |
| `pty:kill` | `id: string` | `void` | `src/main/ipc/pty.ts` |
| `pty:data` *(main→renderer, push)* | `{ id: string, data: string }` | — | emitido por `src/main/pty-manager.ts` |
| `pty:exit` *(main→renderer, push)* | `PtyExitEvent { id, exitCode, signal? }` | — | emitido por `src/main/pty-manager.ts` |
| `shells:detect` | — | `ShellInfo[]` | `src/main/ipc/pty.ts` → `src/main/pty-manager.ts` |
| `claude:detect` | — | `string \| null` | `src/main/ipc/settings.ts` |
| `settings:get` | — | `AppSettings` | `src/main/ipc/settings.ts` |
| `settings:set` | `Partial<AppSettings>` | `AppSettings` (estado completo pós-merge) | `src/main/ipc/settings.ts` |
| `recents:get` | — | `RecentProject[]` | `src/main/ipc/settings.ts` |
| `recents:add` | `projectPath: string` | `RecentProject[]` | `src/main/ipc/settings.ts` |
| `recents:remove` | `projectPath: string` | `RecentProject[]` | `src/main/ipc/settings.ts` |
| `recents:togglePin` | `projectPath: string` | `RecentProject[]` | `src/main/ipc/settings.ts` |
| `app:getVersion` | — | `string` | `src/main/ipc/settings.ts` |
| `app:getHomeDir` | — | `string` | `src/main/ipc/settings.ts` |
| `app:checkUpdate` | — | `UpdateCheckResult` | `src/main/ipc/settings.ts` |
| `app:installUpdate` | `releaseTag: string` | `UpdateInstallResult` | `src/main/ipc/settings.ts` |
| `app:openExternal` | `url: string` | `void` (só executa se `url` casar `^https://github.com/`) | `src/main/ipc/settings.ts` |
| `graph:build` | `rootPath: string` | `ProjectGraph { root, nodes, edges, truncated }` | `src/main/ipc/graph.ts` → `src/main/graph-builder.ts` |

Registro central: `src/main/ipc/index.ts` chama os 5 `registerXHandlers()` (fs, git, pty, settings, graph).

Todas as assinaturas de canal batem entre `shared/types.ts`, o handler em `main/ipc/*.ts` e o wrapper em `preload/index.ts` — não há canal exposto no preload sem handler correspondente, nem handler sem wrapper.

---

## 2. Onde o estado do renderer é gerenciado

Duas stores **Zustand** (sem Context API, sem Redux):

- **`src/renderer/src/store/explorerStore.ts`** — `useExplorerStore`: raiz do projeto (`rootPath`), árvore carregada por diretório (`children`), diretórios expandidos/carregando, seleção, arquivo em preview, status de git (`gitStatus`, `dirtyDirs`, `isGitRepo`, `gitBranch`, `gitAhead/Behind`). Contém a lógica de debounce do refresh de git (`gitRefreshTimer`, 300ms) disparada por eventos de fs.
- **`src/renderer/src/store/terminalStore.ts`** — `useTerminalStore`: abas de terminal (`tabs: TerminalTab[]`), aba ativa.

Estado local de componente (não em store global), via `useState`/`useRef`:
- `src/renderer/src/App.tsx` — largura/colapso da sidebar (hidratado de `settings:get` no mount, persistido via `settings:set` em cada mudança), view ativa (`terminal | mindmap | preview`), flag `ready`.
- Componentes individuais (`PreviewPane.tsx`, `MindMap.tsx`, `Terminal.tsx`, `ContextMenu.tsx`, `InlineInput.tsx`, `UpdateChecker.tsx`, `WelcomeScreen.tsx`) mantêm seu próprio estado efêmero de UI localmente.

Não há um "store" central único nem Context Provider para tema/configurações — `AppSettings` é buscado sob demanda via IPC (`window.api.settings.get/set`) e replicado como `useState` onde é consumido.

---

## 3. Cores e fontes hardcoded

### Hex literais fora do sistema de tokens Tailwind

| Arquivo | Linhas | Conteúdo |
|---|---|---|
| `src/main/index.ts` | 20, 24, 25 | `backgroundColor: '#0d0d0f'`, `titleBarOverlay.color: '#0d0d0f'`, `symbolColor: '#9a9aa4'` (janela nativa do Electron, fora do CSS) |
| `src/renderer/src/styles/index.css` | 62, 67, 72, 77, 81, 85, 90, 93, 96 | paleta de syntax highlighting do preview (`.token.*`), comentário no arquivo já avisa que é intencional ("One Dark-ish hues") |
| `src/renderer/src/components/Terminal/xtermTheme.ts` | 4–24 | tema completo do xterm (16 cores ANSI + bg/fg/cursor) — objeto `Theme` passado direto pro xterm, não pode vir de classe Tailwind |
| `src/renderer/src/components/MindMap/MindMap.tsx` | 372, 376 | `stroke="#fff"`/`rgba(0,0,0,0.4)"` no nó selecionado, `fill="#c4c4cc"` no texto do nó — SVG inline, não Tailwind |
| `src/renderer/src/components/MindMap/colors.ts` | 1–7 | `colorForDir()` gera `hsl(hue, 58%, 64%)` por hash do diretório — cor determinística, não literal fixa, mas fora do sistema de tokens |

### Paleta hoje vive em `tailwind.config.js`

`tailwind.config.js:7-30` define `base.50..950`, `accent` (+ `dim`/`bright`/`muted`), `danger`, `warn` — é o único lugar "central" de cor, mas **não** corresponde aos tokens CMYK do plano (`--ink-cyan`, `--ink-magenta`, `--ink-yellow`, `--ink-overprint`, `--substrate`, `--panel`, `--rule`, `--paper`, `--muted`). Componentes React consomem essa paleta via classes Tailwind (`bg-base-900`, `text-accent`, etc.) — não há classes Tailwind com hex arbitrário (`text-[#...]`) na varredura.

### Fontes

- `tailwind.config.js:31-34` — `fontFamily.mono = '"JetBrains Mono"', ...` e `fontFamily.sans = 'Inter', ...`.
- `src/renderer/src/styles/index.css:1-6` — import das fontes via `@fontsource/inter` e `@fontsource/jetbrains-mono` (pacote npm local, não CDN — já satisfaz o requisito "sem CDN" do plano, mas só 2 famílias; o plano pede 3, incluindo Archivo Expanded/Black para display).
- `src/renderer/src/components/Terminal/Terminal.tsx:67` — `fontFamily: '"JetBrains Mono", ui-monospace, monospace'` hardcoded na config do xterm (não pode ler `theme()` do Tailwind, é objeto JS puro).
- Nenhum `font-family` inline além desse.

Não há tokens `.css` (`:root { --... }`) no projeto — zero uso de CSS custom properties hoje. Toda cor/fonte é Tailwind config ou hardcoded em `.ts`/`.tsx`/`.css` conforme acima.

---

## 4. Persistência de configurações hoje

- Biblioteca: **`electron-store`** (`src/main/store.ts`).
- Formato: JSON puro, sem criptografia, no local padrão da lib — `app.getPath('userData')/config.json` (Windows: `%APPDATA%/vibe-ide/config.json`).
- Schema (`StoreSchema`):
  ```ts
  {
    settings: AppSettings   // claudeCommand, defaultShellId, fontSize, theme, sidebarWidth, sidebarCollapsed
    recents: RecentProject[] // path, name, lastOpened, pinned — máx. 20, mais recente primeiro
  }
  ```
- Defaults declarados inline na criação do `Store` (`store.ts:10-20`).
- **Não** há leitura/escrita de `.claude/settings.json` do usuário em nenhum lugar do código hoje — nenhuma feature de hooks ou MCP ainda existe, então o invariante de "merge não-destrutivo + backup" da seção Configurações do usuário ainda não tem código para violar.
- `settings:set` faz merge raso (`{ ...current, ...partial }`) só no schema interno do app, não no projeto do usuário.

---

## 5. Handlers de fs sem validação de path

**Estado antes desta fase:** nenhum handler em `src/main/ipc/fs.ts` validava o path recebido por IPC contra a raiz do workspace. Qualquer um dos canais abaixo aceitava um path absoluto arbitrário vindo do renderer e operava direto nele:

`fs:readDir`, `fs:createFile`, `fs:createDir`, `fs:rename`, `fs:delete`, `fs:duplicate`, `fs:move`, `fs:reveal`, `fs:readFile`.

Causa raiz: o processo main nunca guardava qual era a "raiz do workspace atual" — esse conceito só existia no renderer (`explorerStore.rootPath`), que é dado não-confiável do ponto de vista do processo main.

**Correção aplicada nesta fase** (único código de feature permitido na Fase 0):

- `src/main/file-watcher.ts` passou a rastrear a raiz ativa (`activeRoot`, setada em `watchPath()`, limpa em `unwatchPath()` quando o path desmontado bate com a raiz ativa) e expõe `getWorkspaceRoot()`.
- `src/main/ipc/fs.ts` ganhou `assertInWorkspace(target)`: resolve o path recebido com `path.resolve`, compara com `path.relative(root, resolved)` e rejeita (`throw`) qualquer path que resulte em `..` ou em um resultado absoluto (fora da raiz), ou qualquer chamada feita antes de haver uma raiz aberta (`getWorkspaceRoot() === null`).
- Aplicado a todos os 9 handlers listados acima, antes de qualquer chamada de `fs`/`shell`.
- `fs:watch` e `fs:unwatch` **não** passam pela validação — são o próprio mecanismo que define a raiz.
- `git:status`/`git:diff`/`git:commit`/`git:push` e `graph:build` também recebem `rootPath` por IPC sem validação, mas ficam **fora do escopo desta correção** (só "handlers de fs" foram autorizados nesta fase) — candidatos a tratar na fase de hooks/MCP ou numa correção dedicada, já que hoje o `rootPath` que chega neles é sempre o mesmo valor que a store do renderer também usa para `fs:watch`.

`npm run typecheck` passa após a mudança. Nenhum arquivo de UI foi tocado.

---

## 6. Mapa de imports — cálculo e cache

- Implementado em `src/main/graph-builder.ts`, exposto via canal `graph:build`, chamado por `MindMap.tsx` a cada troca de `rootPath`/toggle de view.
- **Não há cache.** Cada chamada de `graph:build` refaz o scan completo do disco do zero: `collectFiles()` percorre a árvore com concorrência limitada (`FS_CONCURRENCY = 64`), depois lê cada arquivo elegível e faz parsing de imports via regex (`JS_IMPORT_RE`, `PY_IMPORT_RE`) — **não é AST**, é regex sobre o texto bruto.
- Limites: `MAX_FILES = 2500` (para de coletar e marca `truncated: true`), `MAX_FILE_SIZE = 512KB` (arquivo maior é listado como nó mas não tem imports extraídos), diretórios em `IGNORE_DIRS` (node_modules, .git, dist, build, out, .next, .nuxt, .turbo, .cache, coverage, .vscode, .idea, venv, .venv, __pycache__, .pytest_cache) são pulados inteiramente.
- Resolução de import: só resolve specifiers relativos (`./`, `../`); pacotes externos (`react`, etc.) são ignorados — não há resolução de `paths` do `tsconfig.json`, então alias de import não geram aresta no grafo.
- Cada chamada recalcula tudo em memória e retorna `{ root, nodes, edges, truncated }` direto pro renderer — nada é persistido em disco nem em memória entre chamadas.

---

## 7. Configuração atual do chokidar

`src/main/file-watcher.ts`, função `watchPath()`:

```ts
chokidar.watch(rootPath, {
  ignored: [
    '**/node_modules/**', '**/.git/**', '**/dist/**',
    '**/out/**', '**/.next/**', '**/build/**', '**/.cache/**'
  ],
  ignoreInitial: true,
  depth: 20,
  persistent: true,
  awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
})
```

- **Escopo:** um watcher por `rootPath`, guardado em `Map<string, FSWatcher>` — múltiplas raízes podem, em teoria, ser observadas ao mesmo tempo (o Map suporta), mas o fluxo do app hoje só mantém uma ativa por vez (`explorerStore.setRoot` desmonta a anterior antes de montar a nova).
- **Ignores:** lista fixa de 7 globs, não lê `.gitignore` do projeto — diferente da lista de `IGNORE_DIRS` do `graph-builder.ts`, que é mais ampla (inclui `.vscode`, `.idea`, `venv`, `__pycache__`, etc.) e não reaproveitada aqui.
- **Profundidade:** `depth: 20` — praticamente ilimitado na prática, sem relação com `.gitignore`.
- **`ignoreInitial: true`** — não emite evento para os arquivos já existentes no primeiro scan, só mudanças subsequentes.
- Eventos (`add`, `addDir`, `unlink`, `unlinkDir`, `change`) são repassados ao renderer via `fs:event`; erros do watcher (ex.: junction points sem permissão no Windows) são silenciados de propósito.
- Consumido no renderer por `explorerStore.handleFsEvent`, que recarrega só o diretório afetado e faz debounce de 300ms no refresh de git.

---

## Não coberto nesta fase

Handlers `git:*` e `graph:build` recebem `rootPath` sem validação de path — fora do escopo autorizado ("único código permitido: corrigir handlers de fs"). Nenhum arquivo de UI foi tocado. `npm run typecheck` e a leitura completa da árvore `src/` foram a única fonte usada; nada foi inferido sem checar o arquivo real.
