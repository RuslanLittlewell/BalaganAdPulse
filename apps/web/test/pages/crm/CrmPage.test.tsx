import { http as mock, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, server } from '@test/shared/index.js';
import { CrmPage } from '@/pages/crm/index.js';

const capabilities = {create:true,update:true,delete:true};
const lead = {id:'lead-1',orgId:'org-1',projectId:'project-1',project:{id:'project-1',clientId:'client-1',name:'Сайт'},name:'Анна',tags:['Срочно'],company:'Acme',phone:'+48123456789',email:'anna@example.com',telegram:'@anna',website:'https://example.com',source:'Рекомендация',notes:'Демо',stage:'NEW',position:0};
beforeEach(()=>server.use(
  mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'project-1',label:'Сайт',clientName:'Ромашка',capabilities},{key:'project-2',label:'Реклама',clientName:'Ромашка',capabilities}])),
  mock.get('/api/crm/boards/:board/leads',({params})=>HttpResponse.json(params.board==='project-1'?[lead]:[])),
));
const setup=()=>renderWithProviders(<CrmPage/>,{route:'/crm'});
it('shows the four fixed stages, contacts, tags and the project board selector',async()=>{
  setup();
  expect(await screen.findByLabelText('Воронка')).toHaveTextContent('Сайт');
  for(const name of ['Новый','Квалифицированный','Целевой','КП']) expect(await screen.findByRole('region',{name})).toBeInTheDocument();
  expect(await screen.findByTestId('lead-tags-lead-1')).toHaveTextContent('Срочно');
  expect(screen.queryByText('Рекомендация')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'anna@example.com'})).toHaveAttribute('href','mailto:anna@example.com');
});
it('switches to an empty project board without retaining the previous board data',async()=>{
  setup(); await screen.findByText('Анна');
  await userEvent.click(screen.getByLabelText('Воронка'));
  await userEvent.click(screen.getByRole('option',{name:/Реклама/}));
  await waitFor(()=>expect(screen.queryByText('Анна')).not.toBeInTheDocument());
  expect(await screen.findAllByText('Нет лидов')).toHaveLength(4);
});
it('opens with keyboard and retains values when saving fails',async()=>{
  server.use(mock.patch('/api/crm/boards/project-1/leads/lead-1',()=>HttpResponse.json({message:'Failed'},{status:500})));
  setup(); (await screen.findByRole('button',{name:'Открыть лид: Анна'})).focus();
  await userEvent.keyboard('{Enter}');
  const notes=await screen.findByLabelText('Описание');
  await userEvent.type(notes,' Новая'); await userEvent.click(screen.getByRole('button',{name:'Сохранить'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось'); expect(notes).toHaveValue('Демо Новая');
});
it('creates a lead with the retained fields and confirms deletion',async()=>{
  let created:unknown,deleted=false;
  server.use(mock.post('/api/crm/boards/project-1/leads',async({request})=>{created=await request.json();return HttpResponse.json({...lead,id:'new'},{status:201});}),mock.delete('/api/crm/boards/project-1/leads/lead-1',()=>{deleted=true;return new HttpResponse(null,{status:204});}));
  setup(); await userEvent.click(await screen.findByRole('button',{name:'Добавить лид'}));
  await userEvent.type(screen.getByLabelText('Имя / название'),'Борис');
  await userEvent.type(screen.getByLabelText('Описание'),'С сайта');
  await userEvent.click(screen.getByRole('button',{name:'Создать'}));
  await waitFor(()=>expect(created).toMatchObject({name:'Борис',notes:'С сайта',stage:'NEW'}));
  expect(await screen.findByRole('button',{name:'Сохранить'})).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Отмена'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button',{name:'Открыть лид: Анна'}));
  await userEvent.click(screen.getByRole('button',{name:'Удалить'})); expect(deleted).toBe(false);
  await userEvent.click(screen.getByRole('button',{name:'Удалить лид'})); await waitFor(()=>expect(deleted).toBe(true));
});
it('keeps guests read only',async()=>{
  server.use(mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'project-1',label:'Сайт',clientName:'Ромашка',capabilities:{create:false,update:false,delete:false}}])));
  setup(); await userEvent.click(await screen.findByRole('button',{name:'Открыть лид: Анна'}));
  expect(screen.getByLabelText('Описание')).toBeDisabled();
  expect(screen.queryByRole('button',{name:'Сохранить'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Удалить'})).not.toBeInTheDocument();
});

const imported = {
  ...lead, id: 'lead-meta', name: 'Мария', company: null, email: null, website: null, notes: null, source: null,
  projectId: 'project-1', campaignId: 'campaign-1', adId: 'ad-1', origin: 'META',
  ad: {id: 'ad-1', name: 'Видео 1', externalId: '555'},
  metaSource: {
    accountId: '123456', formId: '777888',
    campaign: {externalId: 'c1', name: 'Весна'}, adSet: {externalId: 's1', name: 'Москва'}, ad: {externalId: '555', name: 'Видео 1'},
    submittedAt: '2026-09-10T10:00:00.000Z', answers: [{question: 'full_name', values: ['Мария']}], answersOmitted: false,
  },
};

describe('imported leads on the board', () => {
  const projectBoard = (leads: unknown[]) => server.use(
    mock.get('/api/crm/boards', () => HttpResponse.json([{key: 'project-1', label: 'Сайт', clientName: 'Ромашка', capabilities}])),
    mock.get('/api/crm/boards/:board/leads', () => HttpResponse.json(leads)),
    mock.get('/api/projects', () => HttpResponse.json([])),
    mock.get('/api/projects/project-1/campaigns/names', () => HttpResponse.json([])),
  );

  it('names neither Meta nor the campaign on an imported lead\'s board card', async () => {
    projectBoard([{...imported, tags: []}, {...lead, id: 'lead-hand', name: 'Олег', source: null, origin: 'MANUAL', ad: null, metaSource: null, tags: []}]);
    renderWithProviders(<CrmPage/>, {route: '/crm'});

    const card = await screen.findByTestId('lead-card-lead-meta');
    expect(card).not.toHaveTextContent('Весна');
    expect(card).not.toHaveTextContent('Meta');
    expect(screen.queryByTestId('lead-tags-lead-meta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lead-tags-lead-hand')).not.toBeInTheDocument();
  });

  it('opens the creative of the ad an imported lead came from', async () => {
    let requested = false;
    projectBoard([imported]);
    server.use(
      mock.get('/api/ads/ad-1/creatives', () => { requested = true; return HttpResponse.json([]); }),
    );
    renderWithProviders(<CrmPage/>, {route: '/crm'});

    await userEvent.click(await screen.findByRole('button', {name: 'Открыть лид: Мария'}));
    await userEvent.click(await screen.findByRole('radio', {name: 'Доп. информация'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Посмотреть креатив'}));

    expect(await screen.findByRole('heading', {name: 'Видео 1'})).toBeInTheDocument();
    await waitFor(() => expect(requested).toBe(true));
    expect(await screen.findByText('У объявления нет креатива')).toBeInTheDocument();
  });

  it('offers no creative for an imported lead whose ad is not linked yet, nor for a hand-made lead', async () => {
    projectBoard([{...imported, ad: null, adId: null}, {...lead, id: 'lead-hand', name: 'Олег', origin: 'MANUAL', ad: null, metaSource: null}]);
    renderWithProviders(<CrmPage/>, {route: '/crm'});

    await userEvent.click(await screen.findByRole('button', {name: 'Открыть лид: Мария'}));
    await userEvent.click(await screen.findByRole('radio', {name: 'Доп. информация'}));
    await screen.findByRole('region', {name: 'Источник: Meta'});
    expect(screen.queryByRole('button', {name: 'Посмотреть креатив'})).not.toBeInTheDocument();
  });
});
