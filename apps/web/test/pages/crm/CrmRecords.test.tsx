import { http as mock, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders, server } from '@test/shared/index.js';
import { CrmLayout, CrmPage, CrmRecordsPage } from '@/pages/crm/index.js';
import type { Company, Person } from '@/entities/crm-record/index.js';
import { recordViewKey, useCrmViews } from '@/features/lead-view-options/index.js';

const capabilities = { create: true, update: true, delete: true };
const company = (id: string, name: string, clientId = 'client-1'): Company => ({
  id, orgId: 'org-1', clientId, name, website: null, phone: null, notes: null,
  peopleCount: 0, leadCount: 0, createdAt: '2026-03-10T00:00:00.000Z', updatedAt: '2026-03-10T00:00:00.000Z',
});
const person = (id: string, name: string, companyId: string | null = null): Person => ({
  id, orgId: 'org-1', clientId: 'client-1', name, phone: null, email: null, telegram: null, messenger: null,
  companyId, company: companyId ? { id: companyId, name: 'Ромашка' } : null, notes: null, leadCount: 0,
  createdAt: '2026-03-10T00:00:00.000Z', updatedAt: '2026-03-10T00:00:00.000Z',
});
let companies: Company[];
let people: Person[];
let patches: unknown[];
let removed: string[];
let boardCapabilities = capabilities;
let createdCompanyBody: unknown;
let createdPersonBody: unknown;

function Address() { const location = useLocation(); return <output aria-label="Адрес">{location.pathname + location.search}</output>; }
const routes = <><Address /><Routes><Route path="/crm" element={<CrmLayout />}>
  <Route index element={<CrmPage />} />
  <Route path="companies" element={<CrmRecordsPage kind="companies" />} />
  <Route path="people" element={<CrmRecordsPage kind="people" />} />
</Route></Routes></>;
const setup = (route: string) => renderWithProviders(routes, { route });

beforeEach(() => {
  useCrmViews.setState({ views: {} });
  companies = [company('c1', 'Ромашка')];
  people = [person('p1', 'Анна', 'c1'), person('p2', 'Борис')];
  patches = [];
  removed = [];
  createdCompanyBody = undefined;
  createdPersonBody = undefined;
  boardCapabilities = capabilities;
  server.use(
    mock.get('/api/crm/boards', () => HttpResponse.json([
      { key: 'board-1', label: 'Сайт', clientId: 'client-1', clientName: 'Клиент 1', capabilities: boardCapabilities },
      { key: 'board-2', label: 'Реклама', clientId: 'client-2', clientName: 'Клиент 2', capabilities: boardCapabilities },
    ])),
    mock.get('/api/crm/boards/:board/leads', () => HttpResponse.json([])),
    mock.get('/api/crm/clients/:client/companies', ({ params }) => HttpResponse.json(params.client === 'client-1' ? companies : [company('c2', 'Лютик', 'client-2')])),
    mock.get('/api/crm/clients/:client/people', ({ params }) => HttpResponse.json(params.client === 'client-1' ? people : [])),
    mock.get('/api/crm/clients/:client/companies/:id', ({ params }) => HttpResponse.json({ ...companies.find((item) => item.id === params.id), people: people.filter((item) => item.companyId === params.id), leads: [{ id: 'lead-1', name: 'Сделка', board: { key: 'board-1', label: 'Сайт' }, stage: { id: 'NEW', name: 'Новый', color: 'blue' } }], peopleCount: 1, leadCount: 1 })),
    mock.get('/api/crm/clients/:client/people/:id', ({ params }) => HttpResponse.json({ ...people.find((item) => item.id === params.id), leads: [] })),
    mock.patch('/api/crm/clients/:client/people/:id', async ({ params, request }) => {
      const body = await request.json() as Record<string, unknown>;
      patches.push(body);
      people = people.map((item) => item.id === params.id ? { ...item, ...body } : item);
      return HttpResponse.json(people.find((item) => item.id === params.id));
    }),
    mock.post('/api/crm/clients/:client/companies', async ({ request }) => {
      const body = await request.json() as { name: string };
      createdCompanyBody = body;
      const created = company(`c${companies.length + 1}`, body.name);
      companies.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    mock.post('/api/crm/clients/:client/people', async ({ request }) => {
      const body = await request.json() as { name: string; companyId: string | null };
      createdPersonBody = body;
      const created = { ...person(`p${people.length + 1}`, body.name, body.companyId), ...body };
      people.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    mock.delete('/api/crm/clients/:client/companies/:id', ({ params }) => { removed.push(String(params.id)); companies = companies.filter((item) => item.id !== params.id); return new HttpResponse(null, { status: 204 }); }),
  );
});

it('shows section counts and keeps the selected board across sections', async () => {
  setup('/crm/people?board=board-1');
  const nav = await screen.findByRole('navigation', { name: 'Разделы CRM' });
  expect(within(nav).getByRole('link', { name: /Лиды/ })).toHaveAttribute('href', '/crm?board=board-1');
  await waitFor(() => expect(within(nav).getByRole('link', { name: /Люди/ })).toHaveTextContent('2'));
  await userEvent.click(within(nav).getByRole('link', { name: /Организации/ }));
  expect(screen.getByLabelText('Адрес')).toHaveTextContent('/crm/companies?board=board-1');
  expect(await screen.findByRole('button', { name: 'Ромашка' })).toBeInTheDocument();
  await userEvent.click(within(nav).getByLabelText('Воронка'));
  await userEvent.click(await screen.findByRole('option', { name: /Реклама/ }));
  await waitFor(() => expect(screen.getByLabelText('Адрес')).toHaveTextContent('/crm/companies?board=board-2'));
  expect(await screen.findByRole('button', { name: 'Лютик' })).toBeInTheDocument();
});

it('edits a phone in place and keeps an invalid email open', async () => {
  setup('/crm/people?board=board-1');
  const row = (await screen.findByRole('button', { name: 'Анна' })).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: 'Номер телефона' }));
  await userEvent.type(within(row).getByRole('textbox', { name: 'Номер телефона' }), '+375291112233{Enter}');
  await waitFor(() => expect(patches).toEqual([{ phone: '+375291112233' }]));
  await userEvent.click(within(row).getByRole('button', { name: 'Email' }));
  await userEvent.type(within(row).getByRole('textbox', { name: 'Email' }), 'bad{Enter}');
  expect(await within(row).findByRole('alert')).toHaveTextContent('Укажите корректный email');
  expect(patches).toHaveLength(1);
  await userEvent.keyboard('{Escape}');
  expect(within(row).queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
});

it('opens related records, confirms counts before deletion and adds an organization', async () => {
  setup('/crm/companies?board=board-1');
  await userEvent.click(await screen.findByRole('button', { name: 'Ромашка' }));
  const panel = await screen.findByRole('complementary', { name: 'Ромашка' });
  expect(panel.parentElement).toHaveClass('relative');
  expect(within(panel).getByRole('link', { name: 'Анна' })).toHaveAttribute('href', '/crm/people?record=p1&board=board-1');
  expect(within(panel).getByRole('link', { name: /Сделка/ })).toHaveAttribute('href', '/crm?board=board-1&lead=lead-1');
  await userEvent.click(within(panel).getByRole('button', { name: 'Действия записи' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Удалить' }));
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('лидами (1)');
  expect(screen.getByRole('alertdialog')).toHaveTextContent('людьми (1)');
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Удалить' }));
  await waitFor(() => expect(removed).toEqual(['c1']));
  await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));
  const form = await screen.findByRole('complementary', { name: 'Новая организация' });
  await userEvent.type(within(form).getByRole('textbox', { name: 'Название' }), 'Лютик');
  await userEvent.type(within(form).getByRole('textbox', { name: 'Сайт' }), 'https://flowers.example');
  await userEvent.type(within(form).getByRole('textbox', { name: 'Номер телефона' }), '+375291112233');
  await userEvent.click(within(form).getByRole('button', { name: 'Создать' }));
  await waitFor(() => expect(createdCompanyBody).toEqual(expect.objectContaining({ name: 'Лютик', website: 'https://flowers.example', phone: '+375291112233' })));
  expect(await screen.findByRole('complementary', { name: 'Лютик' })).toBeInTheDocument();
});

it('creates a person with contact details and an organization from the side panel', async () => {
  setup('/crm/people?board=board-1');
  await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));
  const form = await screen.findByRole('complementary', { name: 'Новый человек' });
  await userEvent.type(within(form).getByRole('textbox', { name: 'Имя' }), 'Мария');
  await userEvent.click(within(form).getByRole('combobox', { name: 'Организация' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Ромашка' }));
  await userEvent.type(within(form).getByRole('textbox', { name: 'Email' }), 'maria@example.com');
  await userEvent.type(within(form).getByRole('textbox', { name: 'Номер телефона' }), '+375291234567');
  await userEvent.click(within(form).getByRole('button', { name: 'Создать' }));
  await waitFor(() => expect(createdPersonBody).toEqual(expect.objectContaining({ name: 'Мария', companyId: 'c1', email: 'maria@example.com', phone: '+375291234567' })));
  expect(await screen.findByRole('complementary', { name: 'Мария' })).toBeInTheDocument();
});

it('keeps a failed record draft and cancels without creating it', async () => {
  server.use(mock.post('/api/crm/clients/:client/companies', () => HttpResponse.json({ error: { message: 'Проверьте сайт' } }, { status: 400 })));
  setup('/crm/companies?board=board-1');
  await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));
  const form = await screen.findByRole('complementary', { name: 'Новая организация' });
  await userEvent.type(within(form).getByRole('textbox', { name: 'Название' }), 'Лютик');
  await userEvent.click(within(form).getByRole('button', { name: 'Создать' }));
  expect(await within(form).findByRole('alert')).toHaveTextContent('Проверьте сайт');
  expect(within(form).getByRole('textbox', { name: 'Название' })).toHaveValue('Лютик');
  await userEvent.click(within(form).getByRole('button', { name: 'Отмена' }));
  await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Новая организация' })).toBeNull());
  expect(companies).toHaveLength(1);
});

it('shows invalid website feedback in the organization creation panel', async () => {
  setup('/crm/companies?board=board-1');
  await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));
  const form = await screen.findByRole('complementary', { name: 'Новая организация' });
  await userEvent.type(within(form).getByRole('textbox', { name: 'Название' }), 'Лютик');
  await userEvent.type(within(form).getByRole('textbox', { name: 'Сайт' }), 'http://');
  await userEvent.click(within(form).getByRole('button', { name: 'Создать' }));
  expect(within(form).getByRole('alert')).toBeInTheDocument();
  expect(createdCompanyBody).toBeUndefined();
});

it('opens a related lead on its board', async () => {
  setup('/crm/companies?board=board-2&record=c1');
  const panel = await screen.findByRole('complementary', { name: 'Ромашка' });
  await userEvent.click(within(panel).getByRole('link', { name: /Сделка/ }));
  expect(screen.getByLabelText('Адрес')).toHaveTextContent('/crm?board=board-1&lead=lead-1');
});

it('lets guests read records without editors or write actions', async () => {
  boardCapabilities = { create: false, update: false, delete: false };
  setup('/crm/people?board=board-1');
  const row = (await screen.findByRole('button', { name: 'Анна' })).closest('tr')!;
  expect(within(row).queryByRole('button', { name: 'Номер телефона' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Добавить' })).not.toBeInTheDocument();
  await userEvent.click(within(row).getByRole('button', { name: 'Анна' }));
  const panel = await screen.findByRole('complementary', { name: 'Анна' });
  expect(within(panel).queryByRole('button', { name: 'Действия записи' })).not.toBeInTheDocument();
});

it('filters people by organization and remembers table columns per client', async () => {
  setup('/crm/people?board=board-1');
  await screen.findByRole('button', { name: 'Анна' });
  await userEvent.click(screen.getByRole('button', { name: 'Фильтр' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Организация' }));
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Ромашка' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Борис' })).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  await userEvent.click(await screen.findByRole('switch', { name: 'Email' }));
  expect(useCrmViews.getState().views[recordViewKey('user-1', 'people', 'client-1')].cardFields).not.toContain('email');
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByLabelText('Воронка'));
  await userEvent.click(await screen.findByRole('option', { name: /Реклама/ }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Анна' })).not.toBeInTheDocument());
  expect(useCrmViews.getState().views[recordViewKey('user-1', 'people', 'client-2')]).toBeUndefined();
});

it('searches and sorts organizations, separately from people', async () => {
  companies.push(company('c3', 'Астра'));
  setup('/crm/companies?board=board-1');
  await screen.findByRole('button', { name: 'Астра' });
  await userEvent.click(screen.getByRole('button', { name: 'Сортировка' }));
  await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Название' }));
  await userEvent.click(screen.getByRole('button', { name: 'Сортировка' }));
  await userEvent.click(await screen.findByRole('menuitemradio', { name: 'По убыванию' }));
  await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row').slice(1).map((row) => within(row).getByRole('button', { name: /Ромашка|Астра/ }).textContent)).toEqual(['Ромашка', 'Астра']));
  await userEvent.type(screen.getByRole('searchbox'), 'астра');
  expect(screen.queryByRole('button', { name: 'Ромашка' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Астра' })).toBeInTheDocument();
  expect(useCrmViews.getState().views[recordViewKey('user-1', 'people', 'client-1')]).toBeUndefined();
});
