import { ChevronRight, ChevronDown, Folder, FolderOpen, Circle } from 'lucide-react'
import type { FileEntry, GitFileStatus } from '@shared/types'
import { useExplorerStore } from '@renderer/store/explorerStore'
import FileTypeTag from './FileTypeTag'
import { join } from './pathUtils'
import InlineInput from './InlineInput'

export interface CreatingState {
  dirPath: string
  kind: 'file' | 'dir'
}

interface TreeNodeProps {
  entry: FileEntry
  depth: number
  renamingPath: string | null
  creatingIn: CreatingState | null
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
  onRenameSubmit: (entry: FileEntry, newName: string) => void
  onRenameCancel: () => void
  onCreateSubmit: (dirPath: string, kind: 'file' | 'dir', name: string) => void
  onCreateCancel: () => void
}

function statusClass(status: GitFileStatus | undefined): string {
  switch (status) {
    case 'modified':
      return 'text-warn'
    case 'added':
    case 'untracked':
      return 'text-accent'
    case 'renamed':
      return 'text-accent'
    case 'staged':
      return 'text-accent-bright'
    case 'deleted':
      return 'text-danger line-through'
    case 'conflicted':
      return 'text-danger font-semibold'
    default:
      return 'text-base-200'
  }
}

const INDENT = 15

export default function TreeNode(props: TreeNodeProps): JSX.Element {
  const { entry, depth, renamingPath, creatingIn, onContextMenu, onRenameSubmit, onRenameCancel, onCreateSubmit, onCreateCancel } = props

  const expanded = useExplorerStore((s) => s.expanded.has(entry.path))
  const selected = useExplorerStore((s) => s.selectedPath === entry.path)
  const children = useExplorerStore((s) => s.children[entry.path])
  const loading = useExplorerStore((s) => s.loadingDirs.has(entry.path))
  const status = useExplorerStore((s) => s.gitStatus[entry.path])
  const dirty = useExplorerStore((s) => s.dirtyDirs.has(entry.path))
  const touched = useExplorerStore((s) => s.touchedFiles.has(entry.path))
  const toggleExpand = useExplorerStore((s) => s.toggleExpand)
  const setSelected = useExplorerStore((s) => s.setSelected)
  const setPreview = useExplorerStore((s) => s.setPreview)

  const indent = depth * INDENT + 6
  const isRenaming = renamingPath === entry.path

  const handleClick = (): void => {
    setSelected(entry.path)
    if (entry.isDirectory) toggleExpand(entry.path)
    else setPreview(entry.path)
  }

  const handleDoubleClick = (): void => {
    void window.api.fs.reveal(entry.path)
  }

  if (isRenaming) {
    return (
      <InlineInput
        initialValue={entry.name}
        indent={indent}
        onSubmit={(value) => onRenameSubmit(entry, value)}
        onCancel={onRenameCancel}
      />
    )
  }

  const DirIcon = expanded ? FolderOpen : Folder

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setSelected(entry.path)
          onContextMenu(e, entry)
        }}
        className={`group flex h-[22px] cursor-default items-center gap-1.5 rounded-sm pr-2 text-[13px] ${
          selected ? 'bg-accent-muted text-base-100' : 'hover:bg-base-800/70 text-base-200'
        }`}
        style={{ paddingLeft: indent }}
      >
        {entry.isDirectory ? (
          expanded ? (
            <ChevronDown size={13} className="shrink-0 text-base-400" />
          ) : (
            <ChevronRight size={13} className="shrink-0 text-base-400" />
          )
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        {entry.isDirectory ? (
          <DirIcon size={14} className="shrink-0 text-base-300" />
        ) : (
          <FileTypeTag name={entry.name} />
        )}
        <span className={`truncate ${statusClass(status)}`}>{entry.name}</span>
        {!entry.isDirectory && touched && (
          <span title={status !== undefined ? 'Tocado pelo agente + modificado' : 'Tocado pelo agente nesta sessão'}>
            <Circle size={5} className={`shrink-0 ${status !== undefined ? 'fill-ink-overprint text-ink-overprint' : 'fill-ink-cyan text-ink-cyan'}`} />
          </span>
        )}
        {entry.isDirectory && dirty && !expanded && (
          <Circle size={5} className="ml-auto shrink-0 fill-warn text-warn" />
        )}
      </div>

      {entry.isDirectory && expanded && (
        <div>
          {creatingIn?.dirPath === entry.path && (
            <InlineInput
              initialValue={creatingIn.kind === 'file' ? 'novo-arquivo.ts' : 'nova-pasta'}
              indent={indent + INDENT}
              onSubmit={(value) => onCreateSubmit(entry.path, creatingIn.kind, value)}
              onCancel={onCreateCancel}
            />
          )}
          {loading && !children && (
            <div className="py-1 text-[12px] text-base-500" style={{ paddingLeft: indent + INDENT }}>
              carregando…
            </div>
          )}
          {children?.length === 0 && !creatingIn && (
            <div className="py-1 text-[12px] text-base-500" style={{ paddingLeft: indent + INDENT }}>
              vazio
            </div>
          )}
          {children?.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              renamingPath={renamingPath}
              creatingIn={creatingIn}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function childPath(dirPath: string, name: string): string {
  return join(dirPath, name)
}
