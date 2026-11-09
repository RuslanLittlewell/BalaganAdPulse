import { http as mock, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { freezeDate, renderWithProviders, server } from '@test/shared/index.js';
import { CrmLayout, CrmPage } from '@/pages/crm/index.js';
freezeDate('2026-09-15T12:00:00');

const capabilities = {create:true,update:true,delete:true};
const lead = {id:'lead-1',orgId:'org-1',projectId:'project-1',project:{id:'project-1',clientId:'client-1',name:'Сайт'},name:'Анна',tags:['Срочно'],companyId:'c1',personId:'p1',company:{id:'c1',name:'Acme',website:'https://example.com'},person:{id:'p1',name:'Анна',phone:'+48123456789',email:'anna@example.com',telegram:'@anna',messenger:null},source:'Рекомендация',notes:'Демо',stage:'NEW',position:0,amount:null,service:null,customValues:{},campaignId:null,adId:null,assigneeId:null,assignee:null,origin:'MANUAL',ad:null,metaSource:null,createdAt:'2026-09-05T00:00:00.000Z',updatedAt:'2026-09-05T00:00:00.000Z'};
beforeEach(()=>server.use(
  mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'project-1',label:'Сайт',clientId:'client-1',clientName:'Ромашка',capabilities},{key:'project-2',label:'Реклама',clientId:'client-1',clientName:'Ромашка',capabilities}])),
  mock.get('/api/crm/boards/:board/leads',({params})=>HttpResponse.json(params.board==='project-1'?[lead]:[])),
));
const setup=(route='/crm')=>renderWithProviders(<Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes>,{route});
const panel=()=>screen.queryByRole('complementary');

it('shows the colored stages, the board selector and the cards with their default fields',async()=>{
  setup();
  expect(await screen.findByLabelText('Воронка')).toHaveTextContent('Сайт');
  for(const name of ['Новый','Квалифицированный','Целевой','КП']) expect(await screen.findByRole('region',{name})).toBeInTheDocument();
  const card=await screen.findByTestId('lead-card-lead-1');
  expect(card).toHaveTextContent('Срочно');
  expect(card).toHaveTextContent('Acme');
  expect(card).not.toHaveTextContent('Рекомендация');
});
it('switches to an empty project board without retaining the previous board data',async()=>{
  setup(); await screen.findByText('Анна');
  await userEvent.click(screen.getByLabelText('Воронка'));
  await userEvent.click(screen.getByRole('option',{name:/Реклама/}));
  await waitFor(()=>expect(screen.queryByText('Анна')).not.toBeInTheDocument());
  expect(screen.getByTestId('crm-count-NEW')).toHaveTextContent('0');
});
it('opens a lead in the side panel from the keyboard and keeps the board beside it',async()=>{
  setup(); (await screen.findByRole('button',{name:'Открыть лид: Анна'})).focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByRole('complementary',{name:'Анна'})).toBeInTheDocument();
  expect(screen.getByRole('complementary',{name:'Анна'}).parentElement).toHaveClass('relative');
  expect(screen.getByRole('region',{name:'Новый'})).toBeInTheDocument();
  expect(screen.getByTestId('lead-card-lead-1')).toHaveAttribute('data-selected','true');
});
it('reopens the lead named in the address',async()=>{
  setup('/crm?board=project-1&lead=lead-1');
  expect(await screen.findByRole('complementary',{name:'Анна'})).toBeInTheDocument();
});
it('opens no panel for a lead that is not on the selected board',async()=>{
  setup('/crm?board=project-2&lead=lead-1');
  await screen.findByRole('region',{name:'Новый'});
  await waitFor(()=>expect(screen.getByTestId('crm-count-NEW')).toHaveTextContent('0'));
  expect(panel()).toBeNull();
});
it('closes the panel when another board is chosen',async()=>{
  setup('/crm?board=project-1&lead=lead-1');
  await screen.findByRole('complementary',{name:'Анна'});
  await userEvent.click(screen.getByLabelText('Воронка'));
  await userEvent.click(screen.getByRole('option',{name:/Реклама/}));
  await waitFor(()=>expect(panel()).toBeNull());
});
it('creates a lead in Новый from the header and opens it',async()=>{
  const stored=[lead];let created:unknown;
  server.use(
    mock.get('/api/crm/boards/project-1/leads',()=>HttpResponse.json(stored)),
    mock.post('/api/crm/boards/project-1/leads',async({request})=>{created=await request.json();const fresh={...lead,id:'new',name:'Борис',tags:[]};stored.push(fresh);return HttpResponse.json(fresh,{status:201});}),
  );
  setup();
  await userEvent.click(await screen.findByRole('button',{name:'Добавить лид'}));
  const form = await screen.findByRole('complementary',{name:'Новый лид'});
  await userEvent.type(within(form).getByRole('textbox',{name:'Имя / название'}),'Борис');
  await userEvent.type(within(form).getByRole('textbox',{name:'Сумма сделки'}),'50000');
  await userEvent.click(within(form).getByRole('button',{name:'Создать'}));
  await waitFor(()=>expect(created).toEqual(expect.objectContaining({name:'Борис',stage:'NEW',amount:'50000'})));
  expect(await screen.findByRole('complementary',{name:'Борис'})).toBeInTheDocument();
  expect(await screen.findByText('Лид создан')).toBeInTheDocument();
});
it('uses the chosen column in the creation panel and keeps draft values after an API error',async()=>{
  const stored: Record<string, unknown>[]=[lead];
  let body: unknown;
  let fail=true;
  server.use(
    mock.get('/api/crm/boards/project-1/leads',()=>HttpResponse.json(stored)),
    mock.post('/api/crm/boards/project-1/leads',async({request})=>{
      body=await request.json();
      if(fail) return HttpResponse.json({error:{message:'Недоступно'}},{status:400});
      const fresh={...lead,id:'new-target',name:'Борис',stage:'TARGET',amount:'1500.0000'};stored.push(fresh);
      return HttpResponse.json(fresh,{status:201});
    }),
  );
  setup();
  await userEvent.click(await screen.findByRole('button',{name:'Добавить лид в столбец Целевой'}));
  const form=await screen.findByRole('complementary',{name:'Новый лид'});
  expect(within(form).getByRole('combobox',{name:'Этап'})).toHaveTextContent('Целевой');
  await userEvent.type(within(form).getByRole('textbox',{name:'Имя / название'}),'Борис');
  await userEvent.type(within(form).getByRole('textbox',{name:'Сумма сделки'}),'1500');
  await userEvent.click(within(form).getByRole('button',{name:'Создать'}));
  expect(await within(form).findByRole('alert')).toHaveTextContent('Недоступно');
  expect(within(form).getByRole('textbox',{name:'Имя / название'})).toHaveValue('Борис');
  fail=false;
  await userEvent.click(within(form).getByRole('button',{name:'Создать'}));
  await waitFor(()=>expect(body).toEqual(expect.objectContaining({name:'Борис',stage:'TARGET',amount:'1500'})));
  expect(await screen.findByRole('complementary',{name:'Борис'})).toBeInTheDocument();
});
it('closes an unfinished lead creation panel without a request',async()=>{
  const posted=vi.fn();
  server.use(mock.post('/api/crm/boards/project-1/leads',()=>{posted();return HttpResponse.json(lead,{status:201});}));
  setup();
  await userEvent.click(await screen.findByRole('button',{name:'Добавить лид'}));
  const form=await screen.findByRole('complementary',{name:'Новый лид'});
  await userEvent.type(within(form).getByRole('textbox',{name:'Имя / название'}),'Черновик');
  await userEvent.click(within(form).getByRole('button',{name:'Отмена'}));
  await waitFor(()=>expect(screen.queryByRole('complementary',{name:'Новый лид'})).toBeNull());
  expect(posted).not.toHaveBeenCalled();
});
it('submits linked records, contact values and a board field from the creation panel',async()=>{
  let body: unknown;
  const stored=[lead];
  server.use(
    mock.get('/api/crm/boards/project-1/leads',()=>HttpResponse.json(stored)),
    mock.get('/api/crm/boards/project-1/fields',()=>HttpResponse.json([{id:'f1',name:'Приоритет',type:'SELECT',position:0,options:[{id:'high',name:'Высокий',color:'red'}]}])),
    mock.get('/api/crm/clients/client-1/people',()=>HttpResponse.json([{id:'p1',name:'Анна'}])),
    mock.get('/api/crm/clients/client-1/companies',()=>HttpResponse.json([{id:'c1',name:'Ромашка'}])),
    mock.post('/api/crm/boards/project-1/leads',async({request})=>{body=await request.json();const fresh={...lead,id:'new-fields',name:'Сделка'};stored.push(fresh);return HttpResponse.json(fresh,{status:201});}),
  );
  setup();
  await userEvent.click(await screen.findByRole('button',{name:'Добавить лид'}));
  const form=await screen.findByRole('complementary',{name:'Новый лид'});
  await userEvent.type(within(form).getByRole('textbox',{name:'Имя / название'}),'Сделка');
  await userEvent.click(within(form).getByRole('combobox',{name:'Контакт'}));
  await userEvent.type(await screen.findByRole('searchbox',{name:'Поиск'}),'Ан');
  await userEvent.click(await screen.findByRole('option',{name:'Анна'}));
  await userEvent.click(within(form).getByRole('combobox',{name:'Организация'}));
  await userEvent.click(await screen.findByRole('option',{name:'Ромашка'}));
  await userEvent.type(within(form).getByRole('textbox',{name:'Номер телефона'}),'+375291234567');
  await userEvent.click(await within(form).findByRole('combobox',{name:'Приоритет'}));
  await userEvent.click(await screen.findByRole('option',{name:'Высокий'}));
  await userEvent.click(within(form).getByRole('button',{name:'Создать'}));
  await waitFor(()=>expect(body).toEqual(expect.objectContaining({personId:'p1',companyId:'c1',contact:expect.objectContaining({phone:'+375291234567'}),customValues:{f1:'high'}})));
});
it('creates an organization in a side panel from a lead and links it back',async()=>{
  let created: unknown;
  let patched: unknown;
  let current: Record<string, unknown>={...lead,companyId:null,company:null};
  server.use(
    mock.get('/api/crm/boards/project-1/leads',()=>HttpResponse.json([current])),
    mock.post('/api/crm/clients/client-1/companies',async({request})=>{created=await request.json();return HttpResponse.json({id:'c2',name:'Лютик',website:null},{status:201});}),
    mock.patch('/api/crm/boards/project-1/leads/lead-1',async({request})=>{patched=await request.json();current={...current,companyId:'c2',company:{id:'c2',name:'Лютик',website:null}};return HttpResponse.json(current);}),
  );
  setup('/crm?board=project-1&lead=lead-1');
  const leadPanel=await screen.findByRole('complementary',{name:'Анна'});
  await userEvent.click(within(leadPanel).getByRole('button',{name:'Добавить Организация'}));
  const form=await screen.findByRole('complementary',{name:'Новая организация'});
  await userEvent.type(within(form).getByRole('textbox',{name:'Название'}),'Лютик');
  await userEvent.click(within(form).getByRole('button',{name:'Создать'}));
  await waitFor(()=>expect(created).toEqual(expect.objectContaining({name:'Лютик'})));
  await waitFor(()=>expect(patched).toEqual({companyId:'c2'}));
  expect(await screen.findByRole('complementary',{name:'Анна'})).toHaveTextContent('Лютик');
});
it('keeps guests read only',async()=>{
  server.use(mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'project-1',label:'Сайт',clientName:'Ромашка',capabilities:{create:false,update:false,delete:false}}])));
  setup(); await userEvent.click(await screen.findByRole('button',{name:'Открыть лид: Анна'}));
  await screen.findByRole('complementary',{name:'Анна'});
  expect(screen.getByRole('complementary')).toHaveTextContent('Acme');
  expect(screen.queryByRole('button',{name:'Организация'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Добавить лид'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Действия лида'})).not.toBeInTheDocument();
});

const imported = {
  ...lead, id: 'lead-meta', name: 'Мария', companyId: null, company: null, personId: null, person: null, notes: null, source: null,
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
    await userEvent.click(await screen.findByRole('radio', {name: 'Информация'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Посмотреть креатив'}));

    expect(await screen.findByRole('heading', {name: 'Видео 1'})).toBeInTheDocument();
    await waitFor(() => expect(requested).toBe(true));
    expect(await screen.findByText('У объявления нет креатива')).toBeInTheDocument();
  });

  it('offers no creative for an imported lead whose ad is not linked yet, nor for a hand-made lead', async () => {
    projectBoard([{...imported, ad: null, adId: null}, {...lead, id: 'lead-hand', name: 'Олег', origin: 'MANUAL', ad: null, metaSource: null}]);
    renderWithProviders(<CrmPage/>, {route: '/crm'});

    await userEvent.click(await screen.findByRole('button', {name: 'Открыть лид: Мария'}));
    await userEvent.click(await screen.findByRole('radio', {name: 'Информация'}));
    await screen.findByRole('region', {name: 'Источник: Meta'});
    expect(screen.queryByRole('button', {name: 'Посмотреть креатив'})).not.toBeInTheDocument();
  });
});
