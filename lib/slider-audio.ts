import { getAudioContext, resumeAudioContext } from "./audio-context";

// The AudioInitializer will now use resumeAudioContext from lib/audio-context.ts

// Slider Sound Functions
let sliderOsc: OscillatorNode | null = null
let sliderGain: GainNode | null = null

export const startSliderSound = (normalizedValue: number) => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    resumeAudioContext().catch(() => {});
  }

  if (sliderOsc) return;

  try {
    sliderOsc = ctx.createOscillator()
    sliderGain = ctx.createGain()

    sliderOsc.connect(sliderGain)
    sliderGain.connect(ctx.destination)

    // Frequency range: 200Hz to 600Hz based on slider position
    sliderOsc.frequency.setValueAtTime(200 + normalizedValue * 400, ctx.currentTime)
    sliderOsc.type = "sine"

    sliderGain.gain.setValueAtTime(0.015, ctx.currentTime)

    sliderOsc.start(ctx.currentTime)
  } catch (error) {
    sliderOsc = null
    sliderGain = null
  }
}

// Update frequency as slider moves
export const updateSliderSound = (normalizedValue: number) => {
  const ctx = getAudioContext();
  if (!sliderOsc || !ctx) return

  try {
    sliderOsc.frequency.linearRampToValueAtTime(200 + normalizedValue * 400, ctx.currentTime + 0.005)
  } catch (error) {
    // Silently fail
  }
}

// Stop sound when slider drag ends
export const stopSliderSound = () => {
  const ctx = getAudioContext();
  if (!sliderOsc || !sliderGain || !ctx) return

  try {
    sliderGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.01)
    sliderOsc.stop(ctx.currentTime + 0.01)

    sliderOsc = null
    sliderGain = null
  } catch (error) {
    sliderOsc = null
    sliderGain = null
  }
}
