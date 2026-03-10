import { getAudioContext } from "./audio-context"

type DownloadIntensity = "soft" | "strong"

/**
 * Plays a two-note ascending confirmation sound for download completion
 * Matches the audio family of existing digital clicks using sine waves and exponential envelopes
 * @param intensity - "soft" or "strong" to match existing audio system patterns
 */
export function playDownloadConfirmation(intensity: DownloadIntensity = "soft"): void {
  const context = getAudioContext()
  if (!context) return

  const now = context.currentTime
  const volume = intensity === "strong" ? 0.25 : 0.15

  // Note 1: 400Hz
  const osc1 = context.createOscillator()
  osc1.type = "sine"
  osc1.frequency.setValueAtTime(400, now)

  const gain1 = context.createGain()
  gain1.gain.setValueAtTime(volume, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15) // 150ms duration

  // Low-pass filter for smoothness
  const filter1 = context.createBiquadFilter()
  filter1.type = "lowpass"
  filter1.frequency.setValueAtTime(600, now)

  osc1.connect(gain1)
  gain1.connect(filter1)
  filter1.connect(context.destination)

  osc1.start(now)
  osc1.stop(now + 0.15)

  // Note 2: 600Hz (ascending, starts 100ms after first)
  const osc2 = context.createOscillator()
  osc2.type = "sine"
  osc2.frequency.setValueAtTime(600, now + 0.1)

  const gain2 = context.createGain()
  gain2.gain.setValueAtTime(volume, now + 0.1)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25) // 150ms duration

  // Low-pass filter for smoothness
  const filter2 = context.createBiquadFilter()
  filter2.type = "lowpass"
  filter2.frequency.setValueAtTime(800, now + 0.1)

  osc2.connect(gain2)
  gain2.connect(filter2)
  filter2.connect(context.destination)

  osc2.start(now + 0.1)
  osc2.stop(now + 0.25)
}
