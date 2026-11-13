import { beforeEach, describe, expect, it } from 'vitest';
import { http as mock, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { aLead, aProject, aSession, renderWithProviders, server } from '@test/shared/index.js';
import { ProjectPage } from '@/pages/project/index.js';
import { CrmPage } from '@/pages/crm/index.js';
import { MainNav } from '@/widgets/main-nav/MainNav.js';
import { CreateLeadPanel } from '@/widgets/lead-side-panel/index.js';
import { t } from '@/shared/config/index.js';

function partnerSession() {
  server.use(mock.get('/api/auth/me', () => HttpResponse.json(aSession({role:'PARTNER',modules:['PROJECTS','CRM'],tariff:null,partner:{campaignId:'c1',projectId:'p1'}}))));
}
beforeEach(() => {
  server.use(
    mock.get('/api/projects', () => HttpResponse.json([aProject({id:'p1',name:'Gealan'})])),
    mock.get('/api/projects/p1/campaigns/names', () => HttpResponse.json([{id:'c1',name:'North campaign',channel:'META'}])),
  );
});

describe('the partner view', () => {
  it('shows the project page without KPI settings', async () => {
    partnerSession();
    renderWithProviders(<Routes><Route path="/projects/:projectId" element={<ProjectPage />} /></Routes>,{route:'/projects/p1'});
    await screen.findByRole('heading',{name:'Gealan'});
    expect(screen.queryByRole('switch',{name:t('project.kpiTracked')})).not.toBeInTheDocument();
  });

  it('offers the project and CRM in its menu', async () => {
    partnerSession();renderWithProviders(<MainNav />);
    await waitFor(()=>expect(within(screen.getByRole('navigation',{name:t('nav.sections')})).getAllByRole('link')).toHaveLength(2));
    expect(screen.getByRole('link',{name:t('nav.projects')})).toHaveAttribute('href','/projects/p1');
    expect(screen.getByRole('link',{name:t('nav.crm')})).toBeInTheDocument();
  });

  it('preselects the only campaign when creating a partner lead', async () => {
    partnerSession();
    let created: unknown;
    server.use(
      mock.get('/api/crm/clients/cl1/people',()=>HttpResponse.json([])),mock.get('/api/crm/clients/cl1/companies',()=>HttpResponse.json([])),
      mock.get('/api/crm/boards/p1/leads',()=>HttpResponse.json([])),mock.get('/api/crm/boards/p1/assignees',()=>HttpResponse.json([])),
      mock.post('/api/crm/boards/p1/leads',async ({request})=>{created=await request.json();return HttpResponse.json({id:'lead-new'}, {status:201});}),
    );
    renderWithProviders(<CreateLeadPanel boardKey="p1" clientId="cl1" initialStage="NEW" fields={[]} onCreated={()=>{}} onClose={()=>{}} />);
    const campaign = await screen.findByRole('combobox',{name:t('crm.card.campaign')});
    await waitFor(()=>expect(campaign).toHaveTextContent('North campaign'));
    await userEvent.type(screen.getByLabelText(t('crm.form.name')),'Phone lead');
    await userEvent.click(screen.getByRole('button',{name:t('crm.form.create')}));
    await waitFor(()=>expect(created).toMatchObject({name:'Phone lead',campaignId:'c1'}));
  });
});


it('keeps lead work enabled while hiding board management and deletion for partners', async () => {
  partnerSession();
  server.use(
    mock.get('/api/crm/boards',()=>HttpResponse.json([{key:'p1',label:'Gealan',clientId:'cl1',clientName:'Client',capabilities:{create:true,update:true,delete:false}}])),
    mock.get('/api/crm/boards/p1/leads',()=>HttpResponse.json([aLead({id:'own-lead',projectId:'p1',campaignId:'c1',name:'North lead',createdAt:new Date().toISOString(),project:{id:'p1',name:'Gealan',clientId:'cl1'}})])),
    mock.get('/api/crm/clients/cl1/people',()=>HttpResponse.json([])),mock.get('/api/crm/clients/cl1/companies',()=>HttpResponse.json([])),
    mock.get('/api/crm/boards/p1/assignees',()=>HttpResponse.json([])),
  );
  renderWithProviders(<CrmPage />,{route:'/crm'});
  expect(await screen.findByRole('button',{name:t('crm.create')})).toBeEnabled();
  expect(screen.queryByRole('button',{name:t('crm.columns.add')})).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:t('crm.view.options')}));
  expect(screen.queryByRole('button',{name:t('crm.view.boardFields')})).not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await userEvent.click(await screen.findByText('North lead'));
  expect(await screen.findByTestId('lead-side-panel')).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:t('action.delete')})).not.toBeInTheDocument();
});
