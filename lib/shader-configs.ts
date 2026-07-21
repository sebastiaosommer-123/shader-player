// Shader configuration system for extensible shader management

export type ShaderParameter =
  | {
      key: string
      label: string
      type: "slider"
      min: number
      max: number
      step: number
    }
  | {
      key: string
      // Optional: a swatch whose position in the group already identifies it
      // needs no "Color 1" beside it. Roles that carry meaning (Fill, Stroke)
      // still label themselves.
      label?: string
      type: "color"
    }

export interface ShaderParameterGroup {
  name: string
  parameters: ShaderParameter[]
  // "wrap" lays the controls out in a horizontal run that wraps, which suits
  // compact unlabeled swatches. Defaults to one control per row.
  layout?: "stack" | "wrap"
}

export interface ShaderConfig {
  id: string
  name: string
  fragmentShader: string
  defaultParams: Record<string, number | string>
  parameterGroups: ShaderParameterGroup[]
}

// Fragment shader for Gradient Wave
const terracottaFragmentShader = `
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

// Fragment shader for Flex Tile
const plasmaWaveFragmentShader = `
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

// Fragment shader for Pixel Topography
const pixelTopographyFragmentShader = `
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

// Shader registry - add new shaders here
export const SHADER_CONFIGS: Record<string, ShaderConfig> = {
  terracotta: {
    id: "terracotta",
    name: "Gradient Wave",
    fragmentShader: terracottaFragmentShader,
    defaultParams: {
      horizontalWaveAmplitude: 0.05,
      horizontalWaveFrequency: 49.7,
      horizontalWaveSpeed: 1.6,
      verticalWaveAmplitude: 0.36,
      verticalWaveFrequency: 0.0,
      verticalWaveSpeed: 0.23,
      diagonalWaveAmplitude: 0.3,
      diagonalWaveFrequency: 0.0,
      diagonalWaveSpeed: 0.7,
      highlightRadius: 0.7,
      highlightX: 0.5,
      highlightY: 0.86,
      pulseIntensity: 0.04,
      pulseSpeed: 0.25,
      grainAmount: 0.06,
      color1: "#524d73",
      color2: "#ff8861",
      color3: "#ff8742",
      color4: "#fff34d",
    },
    parameterGroups: [
      {
        name: "Horizontal Wave",
        parameters: [
          { key: "horizontalWaveAmplitude", label: "Amplitude", type: "slider", min: 0, max: 1, step: 0.01 },
          { key: "horizontalWaveFrequency", label: "Frequency", type: "slider", min: 0, max: 200, step: 0.01 },
          { key: "horizontalWaveSpeed", label: "Speed", type: "slider", min: 0, max: 3, step: 0.001 },
        ],
      },
      {
        name: "Vertical Wave",
        parameters: [
          { key: "verticalWaveAmplitude", label: "Amplitude", type: "slider", min: 0, max: 1, step: 0.01 },
          { key: "verticalWaveFrequency", label: "Frequency", type: "slider", min: 0, max: 200, step: 0.01 },
          { key: "verticalWaveSpeed", label: "Speed", type: "slider", min: 0, max: 3, step: 0.001 },
        ],
      },
      {
        name: "Diagonal Wave",
        parameters: [
          { key: "diagonalWaveAmplitude", label: "Amplitude", type: "slider", min: 0, max: 1, step: 0.01 },
          { key: "diagonalWaveFrequency", label: "Frequency", type: "slider", min: 0, max: 200, step: 0.01 },
          { key: "diagonalWaveSpeed", label: "Speed", type: "slider", min: 0, max: 3, step: 0.001 },
        ],
      },
      {
        name: "Highlight",
        parameters: [
          { key: "highlightRadius", label: "Radius", type: "slider", min: 0.1, max: 1, step: 0.01 },
          { key: "highlightX", label: "X Position", type: "slider", min: 0, max: 1, step: 0.01 },
          { key: "highlightY", label: "Y Position", type: "slider", min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        name: "Pulse",
        parameters: [
          { key: "pulseIntensity", label: "Intensity", type: "slider", min: 0, max: 0.1, step: 0.01 },
          { key: "pulseSpeed", label: "Speed", type: "slider", min: 0, max: 3, step: 0.001 },
        ],
      },
      {
        name: "Grain",
        parameters: [{ key: "grainAmount", label: "Amount", type: "slider", min: 0, max: 0.2, step: 0.01 }],
      },
      {
        name: "Color Palette",
        layout: "wrap",
        parameters: [
          { key: "color1", type: "color" },
          { key: "color2", type: "color" },
          { key: "color3", type: "color" },
          { key: "color4", type: "color" },
        ],
      },
    ],
  },
  plasma: {
    id: "plasma",
    name: "Flex Tile",
    fragmentShader: plasmaWaveFragmentShader,
    defaultParams: {
      baseRows: 5.0,
      rowVariation: 25.0,
      baseColumns: 5.0,
      columnVariation: 25.0,
      animationSpeed: 1.0,
      color1: "#AD0E00",
      color2: "#FF61EA",
      color3: "#FF6F0F",
      color4: "#FFC7E8",
      color5: "#FF5757",
    },
    parameterGroups: [
      {
        name: "Grid Structure",
        parameters: [
          { key: "baseRows", label: "Rows", type: "slider", min: 1, max: 50, step: 0.1 },
          { key: "rowVariation", label: "Row Randomness", type: "slider", min: 0, max: 50, step: 0.1 },
          { key: "baseColumns", label: "Columns", type: "slider", min: 1, max: 50, step: 0.1 },
          { key: "columnVariation", label: "Column Randomness", type: "slider", min: 0, max: 50, step: 0.1 },
        ],
      },
      {
        name: "Animation",
        parameters: [{ key: "animationSpeed", label: "Motion Speed", type: "slider", min: 0, max: 10, step: 0.1 }],
      },
      {
        name: "Color Palette",
        layout: "wrap",
        parameters: [
          { key: "color1", type: "color" },
          { key: "color2", type: "color" },
          { key: "color3", type: "color" },
          { key: "color4", type: "color" },
          { key: "color5", type: "color" },
        ],
      },
    ],
  },
  pixelTopography: {
    id: "pixelTopography",
    name: "Pixel Topography",
    fragmentShader: pixelTopographyFragmentShader,
    defaultParams: {
      gridX: 25.0,
      gridY: 25.0,
      freqX: 0.4,
      freqY: 0.4,
      ampX: 0.1,
      ampY: 0.2,
      noiseFreq: 0.09,
      noiseAmp: 0.6,
      noiseSpeed: 0.1,
      propagationSpeed: 0.5,
      strokeWidth: 0.2,
      color1Fill: "#7F6E18",
      color1Stroke: "#736316",
      color2Fill: "#2E280C",
      color2Stroke: "#241F09",
      color3Fill: "#FDC3D9",
      color3Stroke: "#EBB5C9",
      color4Fill: "#E3C52B",
      color4Stroke: "#D4B728",
    },
    parameterGroups: [
      {
        name: "Grid Structure",
        parameters: [
          { key: "gridX", label: "Columns", type: "slider", min: 0, max: 100, step: 1 },
          { key: "gridY", label: "Rows", type: "slider", min: 0, max: 100, step: 1 },
        ],
      },
      {
        name: "Vertical Wave",
        parameters: [
          { key: "freqX", label: "Frequency", type: "slider", min: 0, max: 5, step: 0.01 },
          { key: "ampX", label: "Amplitude", type: "slider", min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        name: "Horizontal Wave",
        parameters: [
          { key: "freqY", label: "Frequency", type: "slider", min: 0, max: 5, step: 0.01 },
          { key: "ampY", label: "Amplitude", type: "slider", min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        name: "Distortion",
        parameters: [
          { key: "noiseFreq", label: "Frequency", type: "slider", min: 0, max: 1, step: 0.01 },
          { key: "noiseAmp", label: "Amplitude", type: "slider", min: 0, max: 2, step: 0.01 },
          { key: "noiseSpeed", label: "Speed", type: "slider", min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        name: "Flow",
        parameters: [
          { key: "propagationSpeed", label: "Propagation Speed", type: "slider", min: 0, max: 3, step: 0.01 },
        ],
      },
      {
        name: "Style",
        parameters: [{ key: "strokeWidth", label: "Stroke Width", type: "slider", min: 0, max: 0.5, step: 0.001 }],
      },
      {
        name: "Color Pair 1",
        parameters: [
          { key: "color1Fill", label: "Fill", type: "color" },
          { key: "color1Stroke", label: "Stroke", type: "color" },
        ],
      },
      {
        name: "Color Pair 2",
        parameters: [
          { key: "color2Fill", label: "Fill", type: "color" },
          { key: "color2Stroke", label: "Stroke", type: "color" },
        ],
      },
      {
        name: "Color Pair 3",
        parameters: [
          { key: "color3Fill", label: "Fill", type: "color" },
          { key: "color3Stroke", label: "Stroke", type: "color" },
        ],
      },
      {
        name: "Color Pair 4",
        parameters: [
          { key: "color4Fill", label: "Fill", type: "color" },
          { key: "color4Stroke", label: "Stroke", type: "color" },
        ],
      },
    ],
  },
}

export function getShaderConfig(id: string): ShaderConfig {
  return SHADER_CONFIGS[id] || SHADER_CONFIGS.terracotta
}

export function getAllShaderIds(): string[] {
  return Object.keys(SHADER_CONFIGS)
}
