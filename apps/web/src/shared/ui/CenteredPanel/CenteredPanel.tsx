import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import { LightRays } from "../LightRays/index.js";

export interface CenteredPanelProps {
  title: string;
  children: ReactNode;
  wide?: boolean;
  above?: ReactNode;
}

export function CenteredPanel({ title, children, wide = false, above }: CenteredPanelProps) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-4">
      <div
        aria-hidden="true"
        data-testid="signed-out-rays"
        className="pointer-events-none absolute inset-0 -z-0"
      >
        <LightRays raysOrigin="top-center" raysSpeed={0.8} lightSpread={1.2} rayLength={1.6} />
      </div>

      <div className="relative z-10 flex max-w-full flex-col items-center gap-6">
        {above}
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
    </div>
  );
}
