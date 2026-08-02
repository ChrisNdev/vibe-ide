import { useEffect, useState } from 'react'
import {
  FolderOpen,
  FolderPlus,
  FilePlus,
  RefreshCw,
  Pencil,
  Copy,
  Trash2,
  ExternalLink,
  Files
} from 'lucide-react'
import type { FileEntry } from '@shared/types'
import { useExplorerStore } from '@renderer/store/explorerStore'
import TreeNode, { type CreatingState } from './TreeNode'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import InlineInput from './InlineInput'
import { basename, dirname, join } from './pathUtils'

interface MenuState {
  x: number
  y: number
  entry: FileEntry | null
}

export default function FileExplorer(): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const rootChildren = useExplorerStore((s) => (rootPath ? s.children[rootPath] : undefined))
  const setRoot = useExplorerStore((s) => s.setRoot)
  const loadDir = useExplorerStore((s) => s.loadDir)
  const refreshGitStatus = useExplorerStore((s) => s.refreshGitStatus)
  const handleFsEvent = useExplorerStore((s) => s.handleFsEvent)

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [creatingIn, setCreatingIn] = useState<CreatingState | null>(null)
  const [creatingRoot, setCreatingRoot] = useState<'file' | 'dir' | null>(null)

  useEffect(() => {
    ;(async () => {
      const home = await window.api.app.getHomeDir()
      await setRoot(home)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const off = window.api.fs.onEvent((evt) => handleFsEvent(evt.path))
    return off
  }, [handleFsEvent])

  const openFolder = async (): Promise<void> => {
    const picked = await window.api.dialog.openFolder()
    if (!picked) return
    await setRoot(picked)
    void window.api.recents.add(picked)
  }

  const refreshRoot = (): void => {
    if (!rootPath) return
    void loadDir(rootPath, true)
    void refreshGitStatus()
  }

  const refreshParentOf = (path: string): void => {
    const parent = dirname(path)
    void loadDir(parent, true)
    void refreshGitStatus()
  }

  const handleCreateSubmit = async (dirPath: string, kind: 'file' | 'dir', name: string): Promise<void> => {
    const target = join(dirPath, name)
    try {
      if (kind === 'file') await window.api.fs.createFile(target)
      else await window.api.fs.createDir(target)
      await loadDir(dirPath, true)
    } finally {
      setCreatingIn(null)
      setCreatingRoot(null)
    }
  }

  const handleRenameSubmit = async (entry: FileEntry, newName: string): Promise<void> => {
    const newPath = join(dirname(entry.path), newName)
    try {
      if (newName !== entry.name) await window.api.fs.rename(entry.path, newPath)
    } finally {
      setRenamingPath(null)
      refreshParentOf(entry.path)
    }
  }

  const buildItems = (entry: FileEntry): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []
    if (entry.isDirectory) {
      items.push(
        { label: 'Novo arquivo', icon: FilePlus, onSelect: () => setCreatingIn({ dirPath: entry.path, kind: 'file' }) },
        { label: 'Nova pasta', icon: FolderPlus, onSelect: () => setCreatingIn({ dirPath: entry.path, kind: 'dir' }) }
      )
    }
    items.push(
      { label: 'Renomear', icon: Pencil, onSelect: () => setRenamingPath(entry.path), separatorBefore: entry.isDirectory },
      { label: 'Duplicar', icon: Files, onSelect: () => void window.api.fs.duplicate(entry.path).then(() => refreshParentOf(entry.path)) },
      {
        label: 'Excluir',
        icon: Trash2,
        danger: true,
        onSelect: () => {
          if (window.confirm(`Excluir "${entry.name}"? O item vai para a lixeira.`)) {
            void window.api.fs.delete(entry.path).then(() => refreshParentOf(entry.path))
          }
        }
      },
      {
        label: 'Revelar no explorador',
        icon: ExternalLink,
        onSelect: () => void window.api.fs.reveal(entry.path),
        separatorBefore: true
      },
      { label: 'Copiar caminho', icon: Copy, onSelect: () => void window.api.clipboard.writeText(entry.path) }
    )
    return items
  }

  const rootMenuItems: ContextMenuItem[] = rootPath
    ? [
        { label: 'Novo arquivo', icon: FilePlus, onSelect: () => setCreatingRoot('file') },
        { label: 'Nova pasta', icon: FolderPlus, onSelect: () => setCreatingRoot('dir') },
        { label: 'Atualizar', icon: RefreshCw, onSelect: refreshRoot, separatorBefore: true },
        { label: 'Copiar caminho', icon: Copy, onSelect: () => void window.api.clipboard.writeText(rootPath) }
      ]
    : []

  return (
    <div className="flex h-full flex-col bg-base-850">
      <div className="flex items-center justify-between gap-1 px-3 py-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-base-400">
          {rootPath ? basename(rootPath) : 'explorador'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            title="Abrir pasta"
            className="rounded p-1 text-base-400 hover:bg-base-700/60 hover:text-base-200"
            onClick={openFolder}
          >
            <FolderOpen size={14} />
          </button>
          <button
            title="Atualizar"
            className="rounded p-1 text-base-400 hover:bg-base-700/60 hover:text-base-200"
            onClick={refreshRoot}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto pb-4"
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY, entry: null })
        }}
      >
        {creatingRoot && rootPath && (
          <InlineInput
            initialValue={creatingRoot === 'file' ? 'novo-arquivo.ts' : 'nova-pasta'}
            indent={6}
            onSubmit={(value) => handleCreateSubmit(rootPath, creatingRoot, value)}
            onCancel={() => setCreatingRoot(null)}
          />
        )}
        {rootChildren?.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            renamingPath={renamingPath}
            creatingIn={creatingIn}
            onContextMenu={(e, target) => setMenu({ x: e.clientX, y: e.clientY, entry: target })}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenamingPath(null)}
            onCreateSubmit={handleCreateSubmit}
            onCreateCancel={() => setCreatingIn(null)}
          />
        ))}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.entry ? buildItems(menu.entry) : rootMenuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
