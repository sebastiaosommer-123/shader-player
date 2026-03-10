import { getAudioContext, resumeAudioContext, isAudioReady } from "./audio-context";

let isAudioEnabled = true;

export async function playDigitalClick(intensity: "soft" | "strong" | "weak" | "medium" = "soft") {
  if (!isAudioEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;
  
  if (ctx.state === "suspended") {
    await resumeAudioContext();
  }
  
  if (!isAudioReady()) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Connect audio nodes: oscillator -> filter -> gain -> output
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Oscillator settings - square wave at 180Hz
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.type = "square";

    // Low-pass filter for smoothness
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    let volume = 0.04;
    if (intensity === "strong") volume = 0.06;
    else if (intensity === "medium") volume = 0.05;
    else if (intensity === "weak") volume = 0.03;

    const now = ctx.currentTime;
    
    // Envelope: quick attack, exponential decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    // Play the sound with precise timing
    osc.start(now);
    osc.stop(now + 0.11);
  } catch (error) {
    // Silently fail if audio doesn't work
  }
}
