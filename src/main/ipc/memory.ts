import { ipcMain } from 'electron'
import {
  IpcChannels,
  MemoryCreateInputSchema,
  MemoryIdSchema,
  MemoryUpdateInputSchema,
} from '../../shared/ipc'
import {
  createMemory,
  deleteMemory,
  listMemories,
  updateMemory,
} from '../services/memory/store'

export function registerMemoryIpc(): void {
  ipcMain.handle(IpcChannels.MEMORY_LIST, () => listMemories())

  ipcMain.handle(IpcChannels.MEMORY_CREATE, (_event, raw: unknown) => {
    const input = MemoryCreateInputSchema.parse(raw)
    return createMemory(input)
  })

  ipcMain.handle(IpcChannels.MEMORY_UPDATE, (_event, raw: unknown) => {
    const input = MemoryUpdateInputSchema.parse(raw)
    return updateMemory(input)
  })

  ipcMain.handle(IpcChannels.MEMORY_DELETE, (_event, raw: unknown) => {
    const { id } = MemoryIdSchema.parse(raw)
    const ok = deleteMemory(id)
    return { ok }
  })
}
