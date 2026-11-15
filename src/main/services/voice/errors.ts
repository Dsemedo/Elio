/** Mensagens curtas em português — sem paths nem conteúdo de áudio. */
export function friendlyVoiceError(raw: string): string {
  if (raw.startsWith('AUDIO_TOO_SHORT')) {
    return 'Áudio muito curto — segure o botão e fale um pouco mais.'
  }
  if (raw.startsWith('AUDIO_INVALID')) {
    return 'Não consegui ler o áudio. Tente de novo.'
  }
  if (raw.startsWith('WHISPER_MISSING')) {
    return 'O Whisper não está disponível. Use “Preparar voz” ou verifique a internet.'
  }
  if (raw.startsWith('MODEL_MISSING')) {
    return 'O modelo de voz ainda não foi baixado. Use “Preparar voz”.'
  }
  if (raw.startsWith('DOWNLOAD_FAILED')) {
    return 'Falha no download do Whisper. Confira a internet e tente de novo.'
  }
  if (raw.startsWith('UNSUPPORTED_PLATFORM')) {
    return 'Voz no MVP é para Windows 10/11 x64.'
  }
  if (raw.startsWith('TRANSCRIBE_FAILED')) {
    return 'A transcrição falhou. Tente falar de novo, com menos ruído.'
  }
  // Não vaza detalhes internos.
  return 'Não foi possível usar a voz agora. Você ainda pode digitar.'
}
