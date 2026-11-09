import { http as mock, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aLead, freezeDate, renderWithProviders, server } from '@test/shared/index.js';
import { CrmPage } from '@/pages/crm/index.js';
import { useModuleMemory } from '@/shared/lib/index.js';
import { useCrmViews } from '@/features/lead-view-options/index.js';
freezeDate('2026-09-15T12:00:00');

const leads = [
  aLead({ id: 'target', name: 'Целевой лид', stage: 'TARGET', position: 0, company: { id: 'c1', name: 'Ромашка', website: null } }),
  aLead({ id: 'new-2', name: 'Борис', stage: 'NEW', position: 1 }),
  aLead({ id: 'new-1', name: 'Анна', stage: 'NEW', position: 0, amount: '50000.0000' }),
];

beforeEach(() => {
  useModuleMemory.setState({ crmViews: {}, boards: {} });
  useCrmViews.setState({ views: {} });
  server.use(
    mock.get('/api/crm/boards', () => HttpResponse.json([{ key: 'project-1', label: 'Сайт', clientId: 'client-1', clientName: 'Ромашка', capabilities: { create: true, update: true, delete: true } }])),
    mock.get('/api/crm/boards/project-1/leads', () => HttpResponse.json(leads)),
  );
});

it('shows leads in board order with stage pills and chosen card columns, then opens a row', async () => {
  renderWithProviders(<CrmPage />, { route: '/crm?board=project-1' });
  await screen.findByRole('button', { name: 'Открыть лид: Анна' });
  await userEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  await userEvent.click(await screen.findByRole('radio', { name: 'Таблица' }));
  const table = await screen.findByRole('table');
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    'Название', 'Этап', 'Сумма сделки', 'Ответственный', 'Организация', 'Номер телефона', 'Дата поступления', 'Метки',
  ]);
  expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getByRole('button').textContent)).toEqual(['Анна', 'Борис', 'Целевой лид']);
  expect(within(table).getByText('Ромашка')).toBeInTheDocument();
  expect(within(table).getByText('50000.0000')).toBeInTheDocument();
  await userEvent.click(within(table).getByRole('button', { name: 'Анна' }));
  expect(await screen.findByRole('complementary', { name: 'Анна' })).toBeInTheDocument();
});

it('sorts the table by the selected field', async () => {
  renderWithProviders(<CrmPage />, { route: '/crm?board=project-1' });
  await screen.findByRole('button', { name: 'Открыть лид: Анна' });
  await userEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  await userEvent.click(await screen.findByRole('radio', { name: 'Таблица' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Сортировка' }));
  await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Название' }));
  await userEvent.click(screen.getByRole('button', { name: 'Сортировка' }));
  await userEvent.click(await screen.findByRole('menuitemradio', { name: 'По убыванию' }));
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getByRole('button').textContent)).toEqual(['Целевой лид', 'Борис', 'Анна']));
});

it('sorts by a column when its header is pressed, ascending then descending then off', async () => {
  renderWithProviders(<CrmPage />, { route: '/crm?board=project-1' });
  await screen.findByRole('button', { name: 'Открыть лид: Анна' });
  await userEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  await userEvent.click(await screen.findByRole('radio', { name: 'Таблица' }));
  await userEvent.keyboard('{Escape}');
  const table = await screen.findByRole('table');
  const names = () => within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('button')[0]!.textContent);
  const header = () => within(screen.getByRole('table')).getByRole('columnheader', { name: 'Название' });

  await userEvent.click(within(table).getByRole('button', { name: 'Название' }));
  await waitFor(() => expect(names()).toEqual(['Анна', 'Борис', 'Целевой лид']));
  await waitFor(() => expect(header()).toHaveAttribute('aria-sort', 'ascending'));

  await userEvent.click(within(header()).getByRole('button', { name: 'Название' }));
  await waitFor(() => expect(names()).toEqual(['Целевой лид', 'Борис', 'Анна']));
  await waitFor(() => expect(header()).toHaveAttribute('aria-sort', 'descending'));

  await userEvent.click(within(header()).getByRole('button', { name: 'Название' }));
  await waitFor(() => expect(header()).not.toHaveAttribute('aria-sort'));
  expect(screen.queryByRole('button', { name: 'Убрать сортировку' })).toBeNull();
});
