import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { TRANSCRIBE_TIMEOUT_MS } from '../constants'
import { SHERPA_NUM_THREADS } from './constants'
import { parseSherpaStdout } from './parseOutput'
import {
  assertPathInsideSherpa,
  sherpaBinaryPath,
  sherpaLibDir,
  sherpaModelPath,
  sherpaTokensPath,
} from './paths'

export async function runSherpaOffline(wavPath: string): Promise<string> {
  const cli = sherpaBinaryPath()
  const model = sherpaModelPath()
  const tokens = sherpaTokensPath()
  assertPathInsideSherpa(cli)
  assertPathInsideSherpa(model)
  assertPathInsideSherpa(tokens)

  const args = [
    `--nemo-ctc-model=${model}`,
    `--tokens=${tokens}`,
    `--num-threads=${SHERPA_NUM_THREADS}`,
    '--decoding-method=greedy_search',
    wavPath,
  ]

  const binDir = dirname(cli)
  const libDir = sherpaLibDir()
  const pathSep = process.platform === 'win32' ? ';' : ':'
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH'

  return await new Promise<string>((resolve, reject) => {
    const child = spawn(cli, args, {
      shell: false,
      windowsHide: true,
      cwd: binDir,
      env: {
        ...process.env,
        [pathKey]:
          process.platform === 'win32'
            ? `${binDir}${pathSep}${process.env.Path ?? process.env.PATH ?? ''}`
            : process.env.PATH,
        ...(process.platform === 'win32'
          ? {}
          : {
              LD_LIBRARY_PATH: `${libDir}${pathSep}${binDir}${pathSep}${process.env.LD_LIBRARY_PATH ?? ''}`,
            }),
      },
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('TRANSCRIBE_FAILED: tempo esgotado na transcrição (Sherpa)'))
    }, TRANSCRIBE_TIMEOUT_MS)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
      if (stdout.length > 200_000) stdout = stdout.slice(-200_000)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
      if (stderr.length > 4000) stderr = stderr.slice(-4000)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      console.error('[elio] voice: sherpa spawn falhou', {
        code: (err as NodeJS.ErrnoException).code,
      })
      reject(new Error('SHERPA_MISSING: não foi possível iniciar o sherpa-onnx-offline'))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      const stderrTail = stderr.trim().slice(-500)
      if (code !== 0) {
        console.error('[elio] voice: sherpa-onnx-offline exit', {
          code,
          stderr: stderrTail || undefined,
        })
        reject(new Error('TRANSCRIBE_FAILED: o Sherpa não conseguiu transcrever'))
        return
      }
      const text = parseSherpaStdout(stdout)
      if (!text) {
        console.error('[elio] voice: sherpa sem texto', {
          stderr: stderrTail || undefined,
        })
        reject(new Error('TRANSCRIBE_FAILED: saída do Sherpa vazia'))
        return
      }
      resolve(text)
    })
  })
}
