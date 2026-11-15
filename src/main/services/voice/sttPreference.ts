import { parseSttPreference, type SttPreference } from '../../../shared/sttPolicy'

/** Lê ELIO_STT_PROVIDER do ambiente do processo main. */
export function readSttPreferenceFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SttPreference {
  return parseSttPreference(env.ELIO_STT_PROVIDER)
}
