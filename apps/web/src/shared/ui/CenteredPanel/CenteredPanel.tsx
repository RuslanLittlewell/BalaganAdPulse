import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { LightRays } from "../LightRays/index.js";

export interface CenteredPanelProps {
  title: string;
  children: ReactNode;
  /** Room for a form that lays out in two columns. The default is the width one
   * column of fields wants, which is what sign-in and sign-up are. */
  wide?: boolean;
}

/** A shadcn Card centred on an empty screen. Knows nothing about authentication —
 * a "not found" page will want the same frame. */
export function CenteredPanel({ title, children, wide = false }: CenteredPanelProps) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
      {/* Decoration, and nothing more: hidden from assistive technology, behind
          everything, and absent where WebGL is. */}
      <div
        aria-hidden="true"
        data-testid="signed-out-rays"
        className="pointer-events-none absolute inset-0 -z-0"
      >
        <LightRays raysOrigin="top-center" raysSpeed={0.8} lightSpread={1.2} rayLength={1.6} />
      </div>

      <Card
        className={"relative z-10 " + (wide
          ? "w-[min(760px,calc(100vw-2rem))]"
          : "w-[min(420px,calc(100vw-2rem))]")}
      >
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-bold">{title}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
