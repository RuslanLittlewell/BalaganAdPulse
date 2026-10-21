import { Mesh, Program, Renderer, Triangle } from "ogl";

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uGrainIntensity;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;
out vec4 fragColor;

const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;

  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;

  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = clamp(mix(uHorizonColor, body, t), 0.0, 1.0);

  float alpha = clamp(t, 0.0, 1.0);
  float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
  alpha = clamp(alpha + (g - 0.5) * uGrainIntensity, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`;

const rgb = (hex: string): Float32Array => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return new Float32Array([1, 1, 1]);
  return new Float32Array([1, 2, 3].map((index) => parseInt(match[index], 16) / 255));
};

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name);

function scene() {
  const renderer = new Renderer({
    webgl: 2,
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new Float32Array([1, 1]) },
      uSpeed: { value: 0.4 },
      uAmplitude: { value: 2.5 },
      uWaveScale: { value: 0.65 },
      uWaveRatio: { value: 0.9 },
      uSwell: { value: 35 },
      uTurbulence: { value: 17 },
      uTilt: { value: 1.11 },
      uZoom: { value: 1.1 },
      uHeight: { value: 5.5 },
      uFogDepth: { value: 15 },
      uSteps: { value: 70 },
      uGrainIntensity: { value: 0.05 },
      uHorizonColor: { value: rgb(token("--wave-horizon")) },
      uWaveColor: { value: rgb(token("--wave-color")) },
      uCrestColor: { value: rgb(token("--wave-color")) },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
  return { renderer, gl, program, mesh };
}

export function mountWaves(container: HTMLElement): void {
  let parts: ReturnType<typeof scene>;
  try {
    parts = scene();
  } catch {
    return;
  }
  const { renderer, gl, program, mesh } = parts;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);

  const uniforms = program.uniforms as Record<string, { value: number | Float32Array }>;
  const draw = () => renderer.render({ scene: mesh });

  const resize = () => {
    const rect = container.getBoundingClientRect();
    renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
    const resolution = uniforms.iResolution.value as Float32Array;
    resolution[0] = gl.drawingBufferWidth;
    resolution[1] = gl.drawingBufferHeight;
    draw();
  };

  const recolor = () => {
    uniforms.uHorizonColor.value = rgb(token("--wave-horizon"));
    uniforms.uWaveColor.value = rgb(token("--wave-color"));
    uniforms.uCrestColor.value = rgb(token("--wave-color"));
    draw();
  };

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const started = performance.now();
  let frame = 0;
  const loop = (now: number) => {
    uniforms.iTime.value = (now - started) / 1000;
    draw();
    frame = requestAnimationFrame(loop);
  };
  const play = () => {
    if (frame === 0 && !still.matches && !document.hidden) frame = requestAnimationFrame(loop);
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  new ResizeObserver(resize).observe(container);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor);
  still.addEventListener("change", () => (still.matches ? pause() : play()));
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  resize();
  play();
}
