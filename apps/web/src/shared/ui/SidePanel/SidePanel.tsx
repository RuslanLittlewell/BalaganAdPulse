import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const LAYERED = '[role="listbox"],[role="menu"],[role="dialog"],[role="alertdialog"]';

export function SidePanel({ label, testId, wide = false, onClose, children }: { label: string; testId?: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest(LAYERED)) return;
      if (document.querySelector(LAYERED)) return;
      onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <motion.aside aria-label={label} data-testid={testId}
    initial={{ x: reducedMotion ? 0 : '100%', opacity: reducedMotion ? 1 : 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: reducedMotion ? 0 : '100%', opacity: reducedMotion ? 1 : 0 }}
    transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
    className={`fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-background shadow-2xl md:absolute md:inset-y-0 md:right-0 md:left-auto ${wide ? 'md:w-[720px]' : 'md:w-[480px]'} md:max-w-full md:rounded-2xl md:border md:border-border`}>
    {children}
  </motion.aside>;
}
