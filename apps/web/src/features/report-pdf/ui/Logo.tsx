import { Path, Svg } from "@react-pdf/renderer";
import source from "../assets/logo.svg?raw";

const viewBox = /viewBox="([^"]+)"/.exec(source)?.[1] ?? "0 0 6331 2183";
const [, , boxWidth, boxHeight] = viewBox.split(" ").map(Number);
const paths = [...source.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1]!);

export function Logo({ width, color = "#111111" }: { width: number; color?: string }) {
  return (
    <Svg width={width} height={(width * boxHeight!) / boxWidth!} viewBox={viewBox}>
      {paths.map((d, index) => <Path key={index} d={d} fill={color} />)}
    </Svg>
  );
}
