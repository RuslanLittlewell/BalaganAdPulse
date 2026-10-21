import { Mesh, Program, Renderer, Triangle } from "ogl";

const SPEED = 0.8;
const SPREAD = 1.2;
const LENGTH = 1.6;
const MOUSE_INFLUENCE = 0.1;

const vertex = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragment = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;
uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform vec2  mousePos;
uniform float mouseInfluence;

varying vec2 vUv;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float spreadFactor = pow(max(cosAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp((iResolution.x - distance) / iResolution.x, 0.5, 1.0);
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0
  );
  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor;
}

void main() {
  vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
  vec2 mouseScreenPos = mousePos * iResolution.xy;
  vec2 finalRayDir = normalize(mix(rayDir, normalize(mouseScreenPos - rayPos), mouseInfluence));

  vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
  vec4 color = rays1 * 0.5 + rays2 * 0.4;

  float brightness = 1.0 - (coord.y / iResolution.y);
  color.x *= 0.1 + brightness * 0.8;
  color.y *= 0.3 + brightness * 0.6;
  color.z *= 0.5 + brightness * 0.5;
  color.rgb *= raysColor;
  gl_FragColor = color;
}`;

export function mountRays(container: HTMLElement): void {
  let renderer: Renderer;
  try {
    renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true });
  } catch {
    return;
  }
  const gl = renderer.gl;
  if (!gl) return;
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: [1, 1] },
    rayPos: { value: [0, 0] },
    rayDir: { value: [0, 1] },
    raysColor: { value: [1, 1, 1] },
    raysSpeed: { value: SPEED },
    lightSpread: { value: SPREAD },
    rayLength: { value: LENGTH },
    mousePos: { value: [0.5, 0.5] },
    mouseInfluence: { value: MOUSE_INFLUENCE },
  };
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program: new Program(gl, { vertex, fragment, uniforms }) });
  const draw = () => renderer.render({ scene: mesh });

  const place = () => {
    renderer.dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setSize(container.clientWidth, container.clientHeight);
    const width = container.clientWidth * renderer.dpr;
    const height = container.clientHeight * renderer.dpr;
    uniforms.iResolution.value = [width, height];
    uniforms.rayPos.value = [0.5 * width, -0.2 * height];
    draw();
  };

  const mouse = { x: 0.5, y: 0.5 };
  const smooth = { x: 0.5, y: 0.5 };
  window.addEventListener("mousemove", (event) => {
    const rect = container.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width;
    mouse.y = (event.clientY - rect.top) / rect.height;
  });

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let visible = true;
  const loop = (now: number) => {
    uniforms.iTime.value = now / 1000;
    smooth.x = smooth.x * 0.92 + mouse.x * 0.08;
    smooth.y = smooth.y * 0.92 + mouse.y * 0.08;
    uniforms.mousePos.value = [smooth.x, smooth.y];
    draw();
    frame = requestAnimationFrame(loop);
  };
  const play = () => {
    if (frame === 0 && visible && !still.matches && !document.hidden) frame = requestAnimationFrame(loop);
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  new ResizeObserver(place).observe(container);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play();
    else pause();
  }).observe(container);
  still.addEventListener("change", () => (still.matches ? pause() : play()));
  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  place();
  play();
}
