# Changelog

Todas as mudanças notáveis do vibeIDE ficam registradas aqui. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

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
