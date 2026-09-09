import { useId } from "react";
import "./BalaganSignature.css";

import { balaganGlyphs, balaganWidth } from "./balaganGlyphs.js";

const penStrokes: Record<string, string> = {
  B: "M 80,330 C 0,660 480,780 630,570 C 810,280 390,240 360,330 M 380,530 C 330,330 240,100 190,20 M 390,260 C 760,390 670,-160 390,-30",
  a: "M 350,405 C 120,520 20,180 120,80 C 240,-30 400,270 480,420 L 540,430 C 510,300 410,110 500,85 C 620,30 690,150 745,245",
  l: "M 150,270 C 150,460 210,720 300,590 C 420,410 70,240 135,110 C 240,-60 380,90 470,220",
  g: "M 350,405 C 120,520 20,180 120,80 C 240,-30 420,290 550,425 C 500,200 410,-140 280,-300 C 150,-510 -120,-160 180,-130 C 440,-130 660,30 750,240",
  n: "M 155,450 C 140,270 80,120 70,10 M 110,140 C 210,530 560,540 465,310 C 300,-10 580,30 720,240",
};

const glyphScale = 354 / (balaganWidth + 160);

export function BalaganSignature() {
  const maskId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 374 124"
      role="img"
      aria-label="Balagan"
      className="balagan-signature text-foreground"
    >
      {balaganGlyphs.map(({ letter, x, d }, index) => (
        <g key={index} transform={`translate(${10 + x * glyphScale} 78) scale(${glyphScale} ${-glyphScale})`}>
          <defs>
            <mask id={`${maskId}-letter-${index}`} maskUnits="userSpaceOnUse" x="-250" y="-600" width="1400" height="2000">
              <path
                className="balagan-signature__reveal"
                d={penStrokes[letter]}
                fill="none"
                stroke="white"
                strokeWidth="320"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                style={{ animationDelay: `${index === 0 ? 0.2 : 0.95 + (index - 1) * 0.36}s`, animationDuration: index === 0 ? "0.75s" : "0.36s" }}
              />
            </mask>
          </defs>
          <path d={d} fill="currentColor" mask={`url(#${maskId}-letter-${index})`} />
        </g>
      ))}
    </svg>
  );
}
