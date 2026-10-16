'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';

export interface SpecularProps {
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  speed?: number;
  proximity?: number;
}

const PAD = 20;
const ASLEEP = 0.002;

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45 * min(uIntensity, 1.0);

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

function createScene(fx: HTMLElement, dpr: number) {
  const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const geometry = new Triangle(gl);
  if (geometry.attributes.uv) delete geometry.attributes.uv;

  const program = new Program(gl, {
    vertex: VERT,
    fragment: FRAG,
    uniforms: {
      uCenter: { value: [0, 0] },
      uHalfSize: { value: [1, 1] },
      uRadius: { value: 0 },
      uAngle: { value: 2.4 },
      uPx: { value: dpr },
      uLineColor: { value: [1, 1, 1] },
      uBaseColor: { value: [0.32, 0.32, 0.32] },
      uIntensity: { value: 0 },
      uShineSize: { value: 0.17 },
      uShineFade: { value: 0.7 },
      uThickness: { value: 1 },
      uBaseWidth: { value: dpr }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });
  fx.appendChild(gl.canvas);

  const dispose = () => {
    if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };

  return { renderer, program, mesh, dispose };
}

type Scene = ReturnType<typeof createScene>;

const Specular = ({
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  shineSize = 10,
  shineFade = 40,
  thickness = 1,
  speed = 0.35,
  proximity = 250
}: SpecularProps) => {
  const fxRef = useRef<HTMLSpanElement>(null);
  const propsRef = useRef<Required<SpecularProps>>({} as Required<SpecularProps>);
  const reduce = useReducedMotion();

  propsRef.current = { lineColor, baseColor, intensity, shineSize, shineFade, thickness, speed, proximity };

  useEffect(() => {
    const fx = fxRef.current;
    const host = fx?.parentElement;
    if (!fx || !host || reduce) return;

    const dpr = window.devicePixelRatio || 1;
    const size = { w: 1, h: 1, radius: 0 };
    const lineC = new Color();
    const baseC = new Color();
    let scene: Scene | null = null;
    let unsupported = false;
    let raf = 0;
    let pointerAngle: number | null = null;
    let proximityT = 0;
    let angle = 2.4;
    let idleAngle = 2.4;
    let bright = 0;
    let last = 0;

    const resize = () => {
      if (!scene) return;
      const rect = host.getBoundingClientRect();
      const style = getComputedStyle(host);
      const reach = (border: string) => `${-(PAD + (parseFloat(border) || 0))}px`;
      fx.style.inset = [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .map(reach)
        .join(' ');
      size.w = rect.width;
      size.h = rect.height;
      size.radius = parseFloat(style.borderTopLeftRadius) || 0;
      scene.renderer.setSize(size.w + PAD * 2, size.h + PAD * 2);
      scene.program.uniforms.uCenter.value = [(PAD + size.w / 2) * dpr, (PAD + size.h / 2) * dpr];
      scene.program.uniforms.uHalfSize.value = [(size.w / 2) * dpr, (size.h / 2) * dpr];
    };
    const ro = new ResizeObserver(resize);

    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      scene?.dispose();
      scene = null;
      bright = 0;
    };

    const update = (now: number) => {
      if (!scene) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const p = propsRef.current;

      idleAngle += p.speed * dt;
      const target = pointerAngle ?? idleAngle;
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      angle += diff * (1 - Math.exp(-dt * 7));
      bright += (proximityT - bright) * (1 - Math.exp(-dt * 8));

      if (proximityT === 0 && bright < ASLEEP) {
        sleep();
        return;
      }

      lineC.set(p.lineColor);
      baseC.set(p.baseColor);
      const { uniforms } = scene.program;
      uniforms.uAngle.value = angle;
      uniforms.uRadius.value = Math.min(size.radius, Math.min(size.w, size.h) / 2) * dpr;
      uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b];
      uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b];
      uniforms.uIntensity.value = p.intensity * bright;
      uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
      uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
      uniforms.uThickness.value = p.thickness * dpr;
      scene.renderer.render({ scene: scene.mesh });
      raf = requestAnimationFrame(update);
    };

    const wake = () => {
      if (scene || unsupported) return;
      try {
        scene = createScene(fx, dpr);
      } catch {
        unsupported = true;
        return;
      }
      ro.observe(host);
      resize();
      last = performance.now();
      raf = requestAnimationFrame(update);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (rect.width / 2);
        const ny = (cy - e.clientY) / (rect.height / 2);
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
      } else {
        pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = host.matches(':disabled') ? 0 : Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
      proximityT = t * t * (3 - 2 * t);
      if (proximityT > 0) wake();
    };
    window.addEventListener('pointermove', onPointerMove);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      sleep();
    };
  }, [reduce]);

  return (
    <span
      ref={fxRef}
      aria-hidden="true"
      className="pointer-events-none absolute [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
    />
  );
};

export default Specular;
