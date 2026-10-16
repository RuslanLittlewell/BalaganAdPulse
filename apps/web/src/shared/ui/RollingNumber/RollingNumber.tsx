import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/shared/lib/utils.js";

const COLUMN = Array.from({ length: 10 }, (_, digit) => digit).join("\n");
const ROLL = { duration: 0.9, ease: [0.16, 1, 0.3, 1] } as const;

function Digit({ value }: { value: number }) {
  const reduce = useReducedMotion();
  return (
    <span
      data-glyph={value}
      className="relative inline-block [clip-path:inset(0)] before:invisible before:content-[attr(data-glyph)]"
    >
      <motion.span
        data-glyph={COLUMN}
        className="absolute inset-x-0 top-0 text-center before:content-[attr(data-glyph)]"
        initial={reduce ? false : { y: "0%" }}
        animate={{ y: `${-value * 10}%` }}
        transition={reduce ? { duration: 0 } : ROLL}
      />
    </span>
  );
}

export interface RollingNumberProps {
  value: string | number;
  className?: string;
}

export function RollingNumber({ value, className }: RollingNumberProps) {
  const text = String(value);
  const chars = [...text];
  return (
    <span className={cn("tabular-nums", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="whitespace-pre">
        {chars.map((char, index) => {
          const fromEnd = chars.length - index;
          return /\d/.test(char)
            ? <Digit key={`${fromEnd}-digit`} value={Number(char)} />
            : <span key={`${fromEnd}-${char}`} data-glyph={char} className="before:content-[attr(data-glyph)]" />;
        })}
      </span>
    </span>
  );
}
