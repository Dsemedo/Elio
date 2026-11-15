import { describe, expect, it } from 'vitest'
import { getSystemSnapshot } from '../src/main/services/systemInfo'
import { SystemSnapshotSchema } from '../src/shared/ipc'

describe('systemInfo', () => {
  it('produz snapshot compatível com o schema Zod', async () => {
    const snap = await getSystemSnapshot()
    const parsed = SystemSnapshotSchema.parse(snap)
    expect(parsed.cpuCount).toBeGreaterThan(0)
    expect(parsed.totalMemBytes).toBeGreaterThan(0)
    expect(parsed.memUsedPercent).toBeGreaterThanOrEqual(0)
    expect(parsed.memUsedPercent).toBeLessThanOrEqual(100)
  })
})
