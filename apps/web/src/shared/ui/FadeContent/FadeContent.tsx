import { useEffect, useRef, useState, type ReactNode } from "react";

export interface FadeContentProps {
  children: ReactNode;
  duration?: number;
  delay?: number;
  blur?: boolean;
  initialOpacity?: number;
  easing?: string;
  className?: string;
}

export function FadeContent({
  children,
  duration = 300,
  delay = 0,
  blur = false,
  initialOpacity = 0,
  easing = "ease-out",
  className,
}: FadeContentProps) {
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : initialOpacity,
        transition: `opacity ${duration}ms ${easing}, filter ${duration}ms ${easing}`,
        filter: blur && !visible ? "blur(8px)" : "none",
      }}
    >
      {children}
    </div>
  );
}
