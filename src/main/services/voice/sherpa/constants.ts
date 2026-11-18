/** Pin sherpa-onnx (subprocess, sem native addon — ADR 0019 / A0a). */
export const SHERPA_RELEASE = 'v2.0.1'

/** Modelo NeMo CTC pt-BR int8 (FastConformer). */
export const SHERPA_MODEL_ID = 'pt-nemo-ctc' as const
export const SHERPA_MODEL_DIR_NAME =
  'sherpa-onnx-nemo-stt_pt_fastconformer_hybrid_large_pc-int8'
export const SHERPA_MODEL_FILE = 'model.int8.onnx'
export const SHERPA_TOKENS_FILE = 'tokens.txt'
export const SHERPA_MODEL_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-stt_pt_fastconformer_hybrid_large_pc-int8.tar.bz2'
/** Archive ~99 MB; onnx ~126 MB. */
export const SHERPA_MODEL_SIZE_HINT_MB = 126
export const SHERPA_MODEL_ARCHIVE_MIN_BYTES = 40_000_000
export const SHERPA_MODEL_FILE_MIN_BYTES = 80_000_000

export const SHERPA_BINARY_ARCHIVE_MIN_BYTES = 5_000_000
export const SHERPA_NUM_THREADS = 2

export function sherpaBinaryArchiveUrl(platform: NodeJS.Platform): string | null {
  if (platform === 'win32') {
    return `https://github.com/k2-fsa/sherpa-onnx/releases/download/${SHERPA_RELEASE}/sherpa-onnx-${SHERPA_RELEASE}-win-x64-shared-MD-Release-no-tts.tar.bz2`
  }
  if (platform === 'linux') {
    return `https://github.com/k2-fsa/sherpa-onnx/releases/download/${SHERPA_RELEASE}/sherpa-onnx-${SHERPA_RELEASE}-linux-x64-shared-no-tts.tar.bz2`
  }
  return null
}

export function sherpaOfflineCliName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'sherpa-onnx-offline.exe' : 'sherpa-onnx-offline'
}
