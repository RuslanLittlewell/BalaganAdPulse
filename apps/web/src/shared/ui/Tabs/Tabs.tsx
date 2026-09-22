import { memo } from "react";
import { RubberSegment } from "../RubberSegment/RubberSegment.js";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

export const Tabs = memo(function Tabs({ items, activeId, onSelect, ariaLabel, className }: TabsProps) {
  return (
    <RubberSegment
      items={items.map((item) => ({ value: item.id, label: item.label }))}
      value={activeId}
      onChange={(value) => onSelect(value)}
      trackColor="var(--muted)"
      thumbColor="var(--primary)"
      textColor="var(--muted-foreground)"
      activeTextColor="var(--primary-foreground)"
      aria-label={ariaLabel}
      className={className}
    />
  );
});
