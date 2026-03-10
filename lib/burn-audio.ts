import { getAudioContext, resumeAudioContext } from "./audio-context";

export const playBurnSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  if (ctx.state === "suspended") {
    resumeAudioContext().catch(() => {});
  }
  
  // Create a master gain to control overall volume
  const masterGain = ctx.createGain()
  masterGain.connect(ctx.destination)
  masterGain.gain.setValueAtTime(0, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.5) // Fade in

  // --- Layer 1: The Rumble (Brown Noise) ---
  const bufferSize = ctx.sampleRate * 2 // 2 seconds of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let lastOut = 0
  
  // Generate brown noise
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    data[i] = (lastOut + (0.02 * white)) / 1.02
    lastOut = data[i]
    data[i] *= 3.5 // Compensate for gain loss
  }

  const rumbleSource = ctx.createBufferSource()
  rumbleSource.buffer = buffer
  rumbleSource.loop = true
  
  // Filter the rumble to make it sound like fire, not just noise
  const rumbleFilter = ctx.createBiquadFilter()
  rumbleFilter.type = "lowpass"
  rumbleFilter.frequency.value = 400
  
  rumbleSource.connect(rumbleFilter)
  rumbleFilter.connect(masterGain)
  rumbleSource.start()

  // Return a stop function
  return () => {
    // Fade out
    const t = ctx.currentTime
    masterGain.gain.cancelScheduledValues(t)
    masterGain.gain.setValueAtTime(masterGain.gain.value, t)
    masterGain.gain.linearRampToValueAtTime(0, t + 0.5)
    
    setTimeout(() => {
      rumbleSource.stop()
      // ctx.close() 
      
      // Disconnect nodes to free resources
      rumbleSource.disconnect()
      rumbleFilter.disconnect()
      masterGain.disconnect()
    }, 500)
  }
}
