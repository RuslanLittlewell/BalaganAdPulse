import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";

export interface CenteredPanelProps {
  title: string;
  children: ReactNode;
}

/** A shadcn Card centred on an empty screen. Knows nothing about authentication —
 * a "not found" page will want the same frame. */
export function CenteredPanel({ title, children }: CenteredPanelProps) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-[min(420px,calc(100vw-2rem))]">
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
