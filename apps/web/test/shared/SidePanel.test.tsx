import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidePanel } from '@/shared/ui/index.js';

function Harness() {
  const [open, setOpen] = useState(true);
  return <><button type="button" onClick={() => setOpen(true)}>Открыть</button><AnimatePresence>
    {open ? <SidePanel key="panel" label="Панель" onClose={() => setOpen(false)}><button type="button" onClick={() => setOpen(false)}>Закрыть</button></SidePanel> : null}
  </AnimatePresence></>;
}

it('keeps the panel mounted during its exit and can reopen it', async () => {
  render(<Harness />);
  const panel = screen.getByRole('complementary', { name: 'Панель' });
  expect(panel).toHaveClass('md:absolute', 'shadow-2xl');
  expect(panel.style.transform).toContain('translateX(100%)');
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(panel).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Панель' })).toBeNull());
  await userEvent.click(screen.getByRole('button', { name: 'Открыть' }));
  expect(screen.getByRole('complementary', { name: 'Панель' })).toBeInTheDocument();
});
