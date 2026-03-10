import { getAudioContext } from "./audio-context"

/**
 * Plays an intense glowing light sound effect that matches the 1.2s scan animation
 * Creates a bright, shimmering, sci-fi energy sound using multiple layered frequencies
 * @returns A cleanup function to stop the sound early if needed
 */
export function playScanSound(): () => void {
  const context = getAudioContext()
  if (!context) return () => {}

  const now = context.currentTime
  const duration = 1.2 // Match scan animation duration exactly

  // Master gain for overall volume control
  const masterGain = context.createGain()
  masterGain.gain.setValueAtTime(0, now)
  masterGain.gain.linearRampToValueAtTime(0.35, now + 0.1) // Quick fade in
  masterGain.gain.setValueAtTime(0.35, now + duration - 0.2) // Sustain
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration) // Fade out
  masterGain.connect(context.destination)

  // Layer 1: High bright glow (main energy sound)
  const osc1 = context.createOscillator()
  osc1.type = "sine"
  osc1.frequency.setValueAtTime(800, now) // Bright, high frequency

  const gain1 = context.createGain()
  gain1.gain.setValueAtTime(0.4, now)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + duration)

  // High-pass filter for brightness
  const highPass1 = context.createBiquadFilter()
  highPass1.type = "highpass"
  highPass1.frequency.setValueAtTime(600, now)

  osc1.connect(gain1)
  gain1.connect(highPass1)
  highPass1.connect(masterGain)

  // Layer 2: Low rumble (intensity/power)
  const osc2 = context.createOscillator()
  osc2.type = "sine"
  osc2.frequency.setValueAtTime(150, now) // Deep rumble

  const gain2 = context.createGain()
  gain2.gain.setValueAtTime(0.25, now)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration)

  osc2.connect(gain2)
  gain2.connect(masterGain)

  // Layer 3: Shimmer/sparkle (white noise high-pass)
  const bufferSize = context.sampleRate * duration
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate)
  const output = noiseBuffer.getChannelData(0)

  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1
  }

  const noiseSource = context.createBufferSource()
  noiseSource.buffer = noiseBuffer

  const gain3 = context.createGain()
  gain3.gain.setValueAtTime(0.15, now)
  gain3.gain.exponentialRampToValueAtTime(0.001, now + duration)

  // High-pass filter for sparkle effect
  const highPass2 = context.createBiquadFilter()
  highPass2.type = "highpass"
  highPass2.frequency.setValueAtTime(3000, now) // Only high frequencies for shimmer

  noiseSource.connect(gain3)
  gain3.connect(highPass2)
  highPass2.connect(masterGain)

  // Start all oscillators and noise
  osc1.start(now)
  osc1.stop(now + duration)
  osc2.start(now)
  osc2.stop(now + duration)
  noiseSource.start(now)

  // Cleanup function
  return () => {
    try {
      osc1.stop()
      osc2.stop()
      noiseSource.stop()
    } catch (e) {
      // Already stopped
    }
  }
}
