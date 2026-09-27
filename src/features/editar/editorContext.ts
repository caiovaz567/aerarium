import { createContext, useContext } from 'react'

/** Opens the edit dialogs from any screen. `null` means "new". */
export interface Editor {
  card(id: string | null): void
  plan(id: string | null, preset?: { readonly cardId: string | null }): void
  subscription(id: string | null): void
}

export const EditorContext = createContext<Editor | null>(null)

export function useEditor(): Editor {
  const editor = useContext(EditorContext)
  if (!editor) throw new Error('useEditor precisa do EditorProvider.')
  return editor
}
