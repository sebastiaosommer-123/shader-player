import type { ShaderParams } from "./shader-uniforms"

const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = (position + 1.0) * 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const terracottaFragmentShaderSource = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;

  // Wave parameters
  uniform float uWaveAmp1;
  uniform float uWaveAmp2;
  uniform float uWaveAmp3;
  uniform float uWaveFreq1;
  uniform float uWaveFreq2;
  uniform float uWaveFreq3;
  uniform float uWaveSpeed1;
  uniform float uWaveSpeed2;
  uniform float uWaveSpeed3;

  // Grain parameters
  uniform float uGrainAmount;

  // Peak parameters
  uniform float uPeakRadius;
  uniform vec2 uPeakCenter;
  uniform float uPulseIntensity;
  uniform float uPulseSpeed;

  // Colors
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  uniform vec3 uYellowColor;

  varying vec2 vUv;

  // Hash function for grain
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    
    // Water Ripples
    float ripple = 0.0;
    ripple += uWaveAmp1 * sin(uWaveFreq1 * uv.y + uTime * uWaveSpeed1);
    ripple += uWaveAmp2 * sin(uWaveFreq2 * uv.x + uTime * uWaveSpeed2);
    ripple += uWaveAmp3 * sin(uWaveFreq3 * (uv.x + uv.y) + uTime * uWaveSpeed3);
    uv.y += ripple;
    
    // Terracotta Gradient with Depth
    float t = clamp(uv.y, 0.0, 1.0);
    
    // Blend colors
    vec3 color = mix(uTopColor, uMidColor, smoothstep(0.0, 0.8, t));
    color = mix(color, uBottomColor, smoothstep(0.5, 1.0, t));
    
    // Organic, Irregular Yellow Peak Pulsation
    float baseRadius = uPeakRadius;
    float pulse = uPulseIntensity * sin(uTime * uPulseSpeed)
                + uPulseIntensity * 0.67 * sin(uTime * uPulseSpeed * 1.86 + 1.0)
                + uPulseIntensity * 0.5 * sin(uTime * uPulseSpeed * 3.0 + 2.5);
    float peakRadius = baseRadius + pulse;
    float d = distance(uv, uPeakCenter) / peakRadius;
    float yellowPeak = exp(-d * d * 4.0);
    
    color = mix(color, uYellowColor, yellowPeak);
    
    // Subtle Animated Monochrome Grain
    float timeFactor = uTime * 0.15;
    vec2 grainUV = uv * uResolution.xy * 1.2 + vec2(timeFactor * 220.0, -timeFactor * 180.0);
    float reseed = floor(timeFactor * 12.0);
    float grain = hash(grainUV + vec2(reseed));
    float grainValue = (grain - 0.4) * uGrainAmount;
    color += grainValue;
    
    gl_FragColor = vec4(color, 1.0);
  }
`

const plasmaFragmentShaderSource = `
  precision highp float;
  
  uniform float uTime;
  uniform vec2 uResolution;

  // Grid parameters
  uniform float uBaseRows;
  uniform float uRowVariation;
  uniform float uBaseColumns;
  uniform float uColumnVariation;
  uniform float uAnimationSpeed;

  // Colors
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform vec3 uColor5;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    uv.x = abs(uv.x - 0.5) * 2.0;  // mirror left-right
    uv.y = uv.y;

    float time = uTime * uAnimationSpeed;

    float numRows = uBaseRows + uRowVariation * sin(time * 0.3);
    numRows = max(numRows, 1.0);
    float row = floor(uv.y * numRows);

    float speedPerRow = 1.0 + row * 0.2;

    float numCols = uBaseColumns + uColumnVariation * cos(time * 0.1 + row * 0.05);
    numCols = max(numCols, 1.0);

    float anim = sin(time * speedPerRow) * 0.1 + cos(time * speedPerRow * 0.5) * 0.05;
    float colWidth = 1.0 / numCols + anim * 0.5 / numCols;
    float col = floor(uv.x / colWidth);

    // Color selection based on column + row index
    float index = mod(col + row, 5.0);
    vec3 color = index < 0.5 ? uColor1 :
                 index < 1.5 ? uColor2 :
                 index < 2.5 ? uColor3 :
                 index < 3.5 ? uColor4 : uColor5;

    // subtle vertical darkening inside each row
    color = mix(color, color * 0.85, fract(uv.y * numRows));

    gl_FragColor = vec4(color, 1.0);
  }
`

const pixelTopographyFragmentShaderSource = `
  precision mediump float;

  uniform vec2 uResolution;
  uniform float uTime;

  // Grid parameters
  uniform float uGridX;
  uniform float uGridY;

  // Motion parameters
  uniform float uFreqX;
  uniform float uFreqY;
  uniform float uAmpX;
  uniform float uAmpY;

  // Noise parameters
  uniform float uNoiseFreq;
  uniform float uNoiseAmp;
  uniform float uNoiseSpeed;

  // Animation
  uniform float uPropagationSpeed;

  // Appearance
  uniform float uStrokeWidth;

  // Colors (4 fill + 4 stroke)
  uniform vec3 uColor1Fill;
  uniform vec3 uColor1Stroke;
  uniform vec3 uColor2Fill;
  uniform vec3 uColor2Stroke;
  uniform vec3 uColor3Fill;
  uniform vec3 uColor3Stroke;
  uniform vec3 uColor4Fill;
  uniform vec3 uColor4Stroke;

  varying vec2 vUv;

  // Fade function for Perlin noise (extended to vec2)
  vec2 fade(vec2 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  // 1D Hash function for pseudo-random gradients
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  // 2D Hash function for pseudo-random gradients
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  // 2D Classic Perlin noise
  float perlin(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = p - pi;
    vec2 u = fade(pf);
    vec2 ga = hash2(pi + vec2(0.0, 0.0));
    vec2 gb = hash2(pi + vec2(1.0, 0.0));
    vec2 gc = hash2(pi + vec2(0.0, 1.0));
    vec2 gd = hash2(pi + vec2(1.0, 1.0));
    float da = dot(ga, pf - vec2(0.0, 0.0));
    float db = dot(gb, pf - vec2(1.0, 0.0));
    float dc = dot(gc, pf - vec2(0.0, 1.0));
    float dd = dot(gd, pf - vec2(1.0, 1.0));
    return mix(mix(da, db, u.x), mix(dc, dd, u.x), u.y) * 12.0;
  }

  // 1D Perlin (original, for grid motion)
  float perlin1D(float x) {
    float pi = floor(x);
    float pf = x - pi;
    float u = pf * pf * pf * (pf * (pf * 6.0 - 15.0) + 10.0);
    float ga = hash(pi) * 2.0 - 1.0;
    float gb = hash(pi + 1.0) * 2.0 - 1.0;
    float da = ga * pf;
    float db = gb * (pf - 1.0);
    return mix(da, db, u) * 2.0;
  }

  void main() {
    vec2 st = vUv;
    vec3 color = vec3(0.0);

    float t = uTime + 938.0;

    // Setup
    vec2 medium_grid = vec2(uGridX, uGridY);
    vec2 tile_repeat = vec2(4.0, 4.0);
    float aspect = uResolution.x / uResolution.y;
    float base_stroke = uStrokeWidth;
    float original_grid_x = medium_grid.x * tile_repeat.x;
    float original_grid_y = medium_grid.y * tile_repeat.y;

    // Perlin noise parameters for less predictable motion
    float freq_x = uFreqX;
    float freq_y = uFreqY;

    // Super columns widths driven by Perlin noise
    float base_w = 1.0 / tile_repeat.x;
    float amp_x = uAmpX;
    float w0 = base_w + amp_x * perlin1D(t * freq_x + 0.0);
    float w1 = base_w + amp_x * perlin1D(t * freq_x + 10.0);
    float w2 = base_w + amp_x * perlin1D(t * freq_x + 20.0);
    float w3 = base_w + amp_x * perlin1D(t * freq_x + 130.0);
    float sum_w = w0 + w1 + w2 + w3;
    w0 /= sum_w; w1 /= sum_w; w2 /= sum_w; w3 /= sum_w;

    // Find super column and local x
    float cum_x = 0.0;
    float super_col = 0.0;
    float super_width = w0;
    if (st.x < (cum_x += w0)) {
      super_col = 0.0;
      super_width = w0;
    } else if (st.x < (cum_x += w1)) {
      super_col = 1.0;
      super_width = w1;
    } else if (st.x < (cum_x += w2)) {
      super_col = 2.0;
      super_width = w2;
    } else if (st.x < (cum_x += w3)) {
      super_col = 3.0;
      super_width = w3;
    }
    float local_super_x = (st.x - (cum_x - super_width)) / super_width;

    // Super rows heights driven by Perlin noise
    float base_h = 1.0 / tile_repeat.y;
    float amp_y = uAmpY;
    float h0 = base_h + amp_y * perlin1D(t * freq_y + 0.0);
    float h1 = base_h + amp_y * perlin1D(t * freq_y + 15.0);
    float h2 = base_h + amp_y * perlin1D(t * freq_y + 30.0);
    float h3 = base_h + amp_y * perlin1D(t * freq_y + 45.0);
    float sum_h = h0 + h1 + h2 + h3;
    h0 /= sum_h; h1 /= sum_h; h2 /= sum_h; h3 /= sum_h;

    // Find super row and local y
    float cum_y = 0.0;
    float super_row = 0.0;
    float super_height = h0;
    if (st.y < (cum_y += h0)) {
      super_row = 0.0;
      super_height = h0;
    } else if (st.y < (cum_y += h1)) {
      super_row = 1.0;
      super_height = h1;
    } else if (st.y < (cum_y += h2)) {
      super_row = 2.0;
      super_height = h2;
    } else if (st.y < (cum_y += h3)) {
      super_row = 3.0;
      super_height = h3;
    }
    float local_super_y = (st.y - (cum_y - super_height)) / super_height;

    // Medium grid within super tile
    vec2 local_super = vec2(local_super_x, local_super_y);
    vec2 effective_pos = floor(local_super * medium_grid);
    vec2 local = fract(local_super * medium_grid);

    // Row and col (local)
    float row = 2.0 - effective_pos.y;
    float col = effective_pos.x;

    // Global tile coordinates
    float global_col = col + super_col * medium_grid.x;
    float global_row = effective_pos.y + super_row * medium_grid.y;

    // Default
    vec3 tile_bg = vec3(0.0);
    vec3 tile_stroke = vec3(0.0);

    // Original layout (using only the four colors)
    vec3 original_bg = vec3(0.0);
    vec3 original_stroke = vec3(0.0);
    if (row == 0.0 || row == 2.0) {
      if (col == 3.0) {
        original_bg = uColor2Fill;
        original_stroke = uColor2Stroke;
      } else {
        original_bg = uColor1Fill;
        original_stroke = uColor1Stroke;
      }
    } else if (row == 1.0) {
      if (col == 0.0 || col == 6.0) {
        original_bg = uColor4Fill;
        original_stroke = uColor4Stroke;
      } else if (col == 3.0) {
        original_bg = uColor3Fill;
        original_stroke = uColor3Stroke;
      } else {
        original_bg = uColor2Fill;
        original_stroke = uColor2Stroke;
      }
    }

    // Global propagation logic with noise-warped distance
    float center_col = (tile_repeat.x * medium_grid.x) / 2.0;
    float center_row = (tile_repeat.y * medium_grid.y) / 2.0;
    float clean_dist = sqrt(pow(global_col - center_col, 2.0) + pow(global_row - center_row, 2.0));
    float noise_freq = uNoiseFreq;
    float noise_amp = uNoiseAmp;
    float noise_anim_speed = uNoiseSpeed;
    float noise_offset = perlin(vec2(global_col * noise_freq, global_row * noise_freq + t * noise_anim_speed)) * noise_amp;
    float dist = clean_dist + noise_offset;
    float speed = uPropagationSpeed;
    float age = t * speed - dist;

    if (age < 0.0) {
      tile_bg = original_bg;
      tile_stroke = original_stroke;
    } else {
      float phase = mod(age, 4.0);
      int stage = int(floor(phase));
      if (stage == 0) {
        tile_bg = uColor3Fill; tile_stroke = uColor3Stroke;
      } else if (stage == 1) {
        tile_bg = uColor1Fill; tile_stroke = uColor1Stroke;
      } else if (stage == 2) {
        tile_bg = uColor4Fill; tile_stroke = uColor4Stroke;
      } else {
        tile_bg = uColor2Fill; tile_stroke = uColor2Stroke;
      }
    }

    // Stroke widths adjusted for uniform pixel thickness
    float stroke_width_x = base_stroke / (tile_repeat.x * super_width);
    float stroke_width_y = base_stroke * aspect * (medium_grid.y / (original_grid_x * super_height));

    // Check if in stroke area
    if (local.x < stroke_width_x || local.x > 1.0 - stroke_width_x ||
        local.y < stroke_width_y || local.y > 1.0 - stroke_width_y) {
      color = tile_stroke;
    } else {
      color = tile_bg;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("[v0] Shader compile error:", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [Number.parseInt(result[1], 16) / 255, Number.parseInt(result[2], 16) / 255, Number.parseInt(result[3], 16) / 255]
    : [0, 0, 0]
}

export function initShader(gl: WebGLRenderingContext, shaderId: string): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShaderSource =
    shaderId === "terracotta"
      ? terracottaFragmentShaderSource
      : shaderId === "plasma"
        ? plasmaFragmentShaderSource
        : shaderId === "pixelTopography"
          ? pixelTopographyFragmentShaderSource
          : terracottaFragmentShaderSource
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[v0] Program link error:", gl.getProgramInfoLog(program))
    return null
  }

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, "position")
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  return program
}

export function updateUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  params: ShaderParams,
  time: number,
  width: number,
  height: number,
  shaderId: string,
) {
  gl.useProgram(program)

  gl.uniform2f(gl.getUniformLocation(program, "uResolution"), width, height)
  gl.uniform1f(gl.getUniformLocation(program, "uTime"), time)

  // Terracotta shader uniforms
  if (shaderId === "terracotta") {
    gl.uniform1f(gl.getUniformLocation(program, "uWaveAmp1"), params.horizontalWaveAmplitude as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveAmp2"), params.verticalWaveAmplitude as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveAmp3"), params.diagonalWaveAmplitude as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveFreq1"), params.horizontalWaveFrequency as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveFreq2"), params.verticalWaveFrequency as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveFreq3"), params.diagonalWaveFrequency as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveSpeed1"), params.horizontalWaveSpeed as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveSpeed2"), params.verticalWaveSpeed as number)
    gl.uniform1f(gl.getUniformLocation(program, "uWaveSpeed3"), params.diagonalWaveSpeed as number)
    gl.uniform1f(gl.getUniformLocation(program, "uGrainAmount"), params.grainAmount as number)
    gl.uniform1f(gl.getUniformLocation(program, "uPeakRadius"), params.highlightRadius as number)
    gl.uniform2f(
      gl.getUniformLocation(program, "uPeakCenter"),
      params.highlightX as number,
      params.highlightY as number,
    )
    gl.uniform1f(gl.getUniformLocation(program, "uPulseIntensity"), params.pulseIntensity as number)
    gl.uniform1f(gl.getUniformLocation(program, "uPulseSpeed"), params.pulseSpeed as number)

    const rgb1 = hexToRgb(params.color1 as string)
    const rgb2 = hexToRgb(params.color2 as string)
    const rgb3 = hexToRgb(params.color3 as string)
    const rgb4 = hexToRgb(params.color4 as string)

    gl.uniform3f(gl.getUniformLocation(program, "uTopColor"), rgb1[0], rgb1[1], rgb1[2])
    gl.uniform3f(gl.getUniformLocation(program, "uMidColor"), rgb2[0], rgb2[1], rgb2[2])
    gl.uniform3f(gl.getUniformLocation(program, "uBottomColor"), rgb3[0], rgb3[1], rgb3[2])
    gl.uniform3f(gl.getUniformLocation(program, "uYellowColor"), rgb4[0], rgb4[1], rgb4[2])
  }
  // Plasma shader uniforms
  else if (shaderId === "plasma") {
    gl.uniform1f(gl.getUniformLocation(program, "uBaseRows"), params.baseRows as number)
    gl.uniform1f(gl.getUniformLocation(program, "uRowVariation"), params.rowVariation as number)
    gl.uniform1f(gl.getUniformLocation(program, "uBaseColumns"), params.baseColumns as number)
    gl.uniform1f(gl.getUniformLocation(program, "uColumnVariation"), params.columnVariation as number)
    gl.uniform1f(gl.getUniformLocation(program, "uAnimationSpeed"), params.animationSpeed as number)

    const rgb1 = hexToRgb(params.color1 as string)
    const rgb2 = hexToRgb(params.color2 as string)
    const rgb3 = hexToRgb(params.color3 as string)
    const rgb4 = hexToRgb(params.color4 as string)
    const rgb5 = hexToRgb(params.color5 as string)

    gl.uniform3f(gl.getUniformLocation(program, "uColor1"), rgb1[0], rgb1[1], rgb1[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor2"), rgb2[0], rgb2[1], rgb2[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor3"), rgb3[0], rgb3[1], rgb3[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor4"), rgb4[0], rgb4[1], rgb4[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor5"), rgb5[0], rgb5[1], rgb5[2])
  }
  // Pixel Topography shader uniforms
  else if (shaderId === "pixelTopography") {
    // Grid parameters
    gl.uniform1f(gl.getUniformLocation(program, "uGridX"), params.gridX as number)
    gl.uniform1f(gl.getUniformLocation(program, "uGridY"), params.gridY as number)

    // Motion parameters
    gl.uniform1f(gl.getUniformLocation(program, "uFreqX"), params.freqX as number)
    gl.uniform1f(gl.getUniformLocation(program, "uFreqY"), params.freqY as number)
    gl.uniform1f(gl.getUniformLocation(program, "uAmpX"), params.ampX as number)
    gl.uniform1f(gl.getUniformLocation(program, "uAmpY"), params.ampY as number)

    // Noise parameters
    gl.uniform1f(gl.getUniformLocation(program, "uNoiseFreq"), params.noiseFreq as number)
    gl.uniform1f(gl.getUniformLocation(program, "uNoiseAmp"), params.noiseAmp as number)
    gl.uniform1f(gl.getUniformLocation(program, "uNoiseSpeed"), params.noiseSpeed as number)

    // Animation
    gl.uniform1f(gl.getUniformLocation(program, "uPropagationSpeed"), params.propagationSpeed as number)

    // Appearance
    gl.uniform1f(gl.getUniformLocation(program, "uStrokeWidth"), params.strokeWidth as number)

    // Colors
    const rgb1Fill = hexToRgb(params.color1Fill as string)
    const rgb1Stroke = hexToRgb(params.color1Stroke as string)
    const rgb2Fill = hexToRgb(params.color2Fill as string)
    const rgb2Stroke = hexToRgb(params.color2Stroke as string)
    const rgb3Fill = hexToRgb(params.color3Fill as string)
    const rgb3Stroke = hexToRgb(params.color3Stroke as string)
    const rgb4Fill = hexToRgb(params.color4Fill as string)
    const rgb4Stroke = hexToRgb(params.color4Stroke as string)

    gl.uniform3f(gl.getUniformLocation(program, "uColor1Fill"), rgb1Fill[0], rgb1Fill[1], rgb1Fill[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor1Stroke"), rgb1Stroke[0], rgb1Stroke[1], rgb1Stroke[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor2Fill"), rgb2Fill[0], rgb2Fill[1], rgb2Fill[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor2Stroke"), rgb2Stroke[0], rgb2Stroke[1], rgb2Stroke[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor3Fill"), rgb3Fill[0], rgb3Fill[1], rgb3Fill[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor3Stroke"), rgb3Stroke[0], rgb3Stroke[1], rgb3Stroke[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor4Fill"), rgb4Fill[0], rgb4Fill[1], rgb4Fill[2])
    gl.uniform3f(gl.getUniformLocation(program, "uColor4Stroke"), rgb4Stroke[0], rgb4Stroke[1], rgb4Stroke[2])
  }
}
