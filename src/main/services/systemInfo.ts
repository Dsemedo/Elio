import {
  cpus,
  freemem,
  hostname,
  platform,
  release,
  totalmem,
  arch,
  uptime,
} from 'node:os'

export type SystemSnapshot = {
  platform: NodeJS.Platform
  release: string
  arch: string
  hostname: string
  uptimeSec: number
  totalMemBytes: number
  freeMemBytes: number
  usedMemBytes: number
  memUsedPercent: number
  cpuModel: string
  cpuCount: number
  /** Média aproximada entre duas amostras; null se ainda não amostrado. */
  cpuLoadPercent: number | null
  note: string
}

type CpuSample = {
  idle: number
  total: number
}

function sampleCpu(): CpuSample {
  let idle = 0
  let total = 0
  for (const cpu of cpus()) {
    const t = cpu.times
    idle += t.idle
    total += t.user + t.nice + t.sys + t.idle + t.irq
  }
  return { idle, total }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Snapshot local do SO via Node `os` (funciona no Windows sem native addon).
 * Sem paths do usuário e sem dados de processos de terceiros.
 */
export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  const list = cpus()
  const first = list[0]
  const totalMemBytes = totalmem()
  const freeMemBytes = freemem()
  const usedMemBytes = Math.max(0, totalMemBytes - freeMemBytes)

  let cpuLoadPercent: number | null = null
  if (list.length > 0) {
    const a = sampleCpu()
    await sleep(220)
    const b = sampleCpu()
    const idleDelta = b.idle - a.idle
    const totalDelta = b.total - a.total
    if (totalDelta > 0) {
      cpuLoadPercent = Math.round((1 - idleDelta / totalDelta) * 1000) / 10
      cpuLoadPercent = Math.min(100, Math.max(0, cpuLoadPercent))
    }
  }

  const isWin = platform() === 'win32'
  const note = isWin
    ? 'Leitura básica via Node (memória e CPU aproximada). Sem ranking de apps que mais pesam neste pedaço.'
    : 'Leitura básica via Node. O alvo do MVP é Windows; neste SO os números ainda são aproximados.'

  return {
    platform: platform(),
    release: release(),
    arch: arch(),
    hostname: hostname(),
    uptimeSec: Math.floor(uptime()),
    totalMemBytes,
    freeMemBytes,
    usedMemBytes,
    memUsedPercent:
      totalMemBytes > 0 ? Math.round((usedMemBytes / totalMemBytes) * 1000) / 10 : 0,
    cpuModel: first?.model?.trim() || 'CPU',
    cpuCount: list.length,
    cpuLoadPercent,
    note,
  }
}
