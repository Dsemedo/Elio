import { ipcMain } from 'electron'
import { IpcChannels } from '../../shared/channels'
import {
  disconnectSpotify,
  getSpotifyConnectionStatus,
  runSpotifyIntent,
} from '../services/spotify'

export function registerSpotifyIpc(): void {
  ipcMain.handle(IpcChannels.SPOTIFY_STATUS, async () => getSpotifyConnectionStatus())

  ipcMain.handle(IpcChannels.SPOTIFY_CONNECT, async () => {
    const result = await runSpotifyIntent({ kind: 'spotify_connect' })
    const status = await getSpotifyConnectionStatus()
    return { ...result, status }
  })

  ipcMain.handle(IpcChannels.SPOTIFY_DISCONNECT, async () => {
    await disconnectSpotify()
    const status = await getSpotifyConnectionStatus()
    return { ok: true, message: 'Spotify desconectado neste PC.', status }
  })
}
