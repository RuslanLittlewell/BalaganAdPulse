import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readNavCollapsed, writeNavCollapsed } from "@/shared/lib/index.js";

interface NavCollapseValue {
  collapsed: boolean;
  toggle: () => void;
}

const NavCollapseContext = createContext<NavCollapseValue | null>(null);

/**
 * Whether the navigation shows labels or only icons.
 *
 * The state lives here rather than in the shell because its two consumers sit
 * on opposite sides of the layout: the chevron is in the header, the labels are
 * in the sidebar, and neither renders the other.
 */
export function NavCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readNavCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((wasCollapsed) => {
      writeNavCollapsed(!wasCollapsed);
      return !wasCollapsed;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
  return <NavCollapseContext.Provider value={value}>{children}</NavCollapseContext.Provider>;
}

export function useNavCollapse(): NavCollapseValue {
  const value = useContext(NavCollapseContext);
  if (!value) throw new Error("useNavCollapse must be used inside NavCollapseProvider");
  return value;
}
