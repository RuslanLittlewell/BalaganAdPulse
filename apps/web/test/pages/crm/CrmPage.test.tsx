import { http as mock, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, server } from '@test/shared/index.js';
import { CrmPage } from '@/pages/crm/index.js';

const capabilities = {create:true,update:true,delete:true};
const lead = {id:'lead-1',orgId:'org-1',clientId:null,name:'Анна',company:'Acme',phone:'+48123456789',email:'anna@example.com',telegram:'@anna',website:'https://example.com',source:'Рекомендация',notes:'Демо',stage:'NEW',position:0};
beforeEach(()=>server.use(
  mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'agency',label:'Agency',capabilities},{key:'client-1',label:'Клиент',capabilities}])),
  mock.get('/api/crm/boards/:board/leads',({params})=>HttpResponse.json(params.board==='agency'?[lead]:[])),
));
const setup=()=>renderWithProviders(<CrmPage/>,{route:'/crm'});
it('shows eight columns, contacts, source and agency board selector',async()=>{
  setup();
  expect(await screen.findByLabelText('Воронка')).toHaveTextContent('Agency');
  for(const name of ['Новый лид','Связались','Квалифицирован','Предложение','Переговоры','Выигран','Проигран','Отложен']) expect(await screen.findByRole('region',{name})).toBeInTheDocument();
  expect(await screen.findByText('Рекомендация')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'anna@example.com'})).toHaveAttribute('href','mailto:anna@example.com');
});
it('switches to an empty client board without retaining agency data',async()=>{
  setup(); await screen.findByText('Анна');
  await userEvent.click(screen.getByLabelText('Воронка'));
  await userEvent.click(screen.getByRole('option',{name:'Клиент'}));
  await waitFor(()=>expect(screen.queryByText('Анна')).not.toBeInTheDocument());
  expect(await screen.findAllByText('Нет лидов')).toHaveLength(8);
});
it('opens with keyboard and retains values when saving fails',async()=>{
  server.use(mock.patch('/api/crm/boards/agency/leads/lead-1',()=>HttpResponse.json({message:'Failed'},{status:500})));
  setup(); (await screen.findByRole('button',{name:'Открыть лид: Анна'})).focus();
  await userEvent.keyboard('{Enter}');
  const input=await screen.findByLabelText('Имя / название');
  await userEvent.type(input,' Новая'); await userEvent.click(screen.getByRole('button',{name:'Сохранить'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось'); expect(input).toHaveValue('Анна Новая');
});
it('creates leads with contacts and confirms deletion',async()=>{
  let created:unknown,deleted=false;
  server.use(mock.post('/api/crm/boards/agency/leads',async({request})=>{created=await request.json();return HttpResponse.json({...lead,id:'new'},{status:201});}),mock.delete('/api/crm/boards/agency/leads/lead-1',()=>{deleted=true;return new HttpResponse(null,{status:204});}));
  setup(); await userEvent.click(await screen.findByRole('button',{name:'Добавить лид'}));
  await userEvent.type(screen.getByLabelText('Имя / название'),'Борис');
  await userEvent.type(screen.getByLabelText('Источник'),'Сайт');
  await userEvent.click(screen.getByRole('button',{name:'Создать'}));
  await waitFor(()=>expect(created).toMatchObject({name:'Борис',source:'Сайт',stage:'NEW'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('button',{name:'Открыть лид: Анна'}));
  await userEvent.click(screen.getByRole('button',{name:'Удалить'})); expect(deleted).toBe(false);
  await userEvent.click(screen.getByRole('button',{name:'Удалить лид'})); await waitFor(()=>expect(deleted).toBe(true));
});
it('keeps guests read only',async()=>{
  server.use(mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'agency',label:'Agency',capabilities:{create:false,update:false,delete:false}}])));
  setup(); await userEvent.click(await screen.findByRole('button',{name:'Открыть лид: Анна'}));
  expect(screen.getByLabelText('Имя / название')).toBeDisabled();
  expect(screen.queryByRole('button',{name:'Сохранить'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Удалить'})).not.toBeInTheDocument();
});
