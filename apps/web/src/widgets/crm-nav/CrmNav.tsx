import { useMemo } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Target, Users } from 'lucide-react';
import { isRunning, RunningDot, runningFirst, useCampaignReferences } from '@/entities/campaign/index.js';
import { useCompanies, usePeople } from '@/entities/crm-record/index.js';
import { useLeadBoards, useLeads, type LeadBoard } from '@/entities/lead/index.js';
import { useAuth } from '@/features/auth/index.js';
import { inCampaigns } from '@/features/lead-view-options/index.js';
import { t } from '@/shared/config/index.js';
import { useModuleMemory } from '@/shared/lib/index.js';
import { Label, MultiSelect, SearchableSelect } from '@/shared/ui/index.js';

const CAMPAIGN_PARAM = 'campaign';

export function useSelectedBoard() {
  const { data: boards } = useLeadBoards();
  const { user } = useAuth();
  const remembered = useModuleMemory((state) => user ? state.boards[user.id] : undefined);
  const [params] = useSearchParams();
  const board = boards?.find((entry) => entry.key === params.get('board')) ?? boards?.find((entry) => entry.key === remembered) ?? boards?.[0];
  return { boards, board };
}

export function useCampaignScope(board: LeadBoard | undefined) {
  const [params] = useSearchParams();
  const byCampaign = board?.campaignCrm ?? false;
  const { data: references } = useCampaignReferences(byCampaign ? board?.key : undefined);
  const campaigns = useMemo(() => runningFirst(references ?? []), [references]);
  const campaignIds = useMemo(() => {
    if (!byCampaign) return [];
    const known = new Set(campaigns.map((campaign) => campaign.id));
    return [...new Set(params.getAll(CAMPAIGN_PARAM))].filter((id) => known.has(id));
  }, [byCampaign, campaigns, params]);
  return { byCampaign, campaigns, campaignIds };
}

export function CrmNav() {
  const { user } = useAuth();
  const rememberBoard = useModuleMemory((state) => state.rememberBoard);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { boards, board } = useSelectedBoard();
  const { byCampaign, campaigns, campaignIds } = useCampaignScope(board);
  const { data: leads } = useLeads(board?.key);
  const leadCount = leads ? inCampaigns(leads, campaignIds).length : undefined;
  const { data: companies } = useCompanies(board?.clientId);
  const { data: people } = usePeople(board?.clientId);
  const sections = [
    { path: '/crm', label: t('crm.nav.leads'), count: leadCount, icon: Target },
    { path: '/crm/companies', label: t('crm.nav.companies'), count: companies?.length, icon: Building2 },
    { path: '/crm/people', label: t('crm.nav.people'), count: people?.length, icon: Users },
  ];

  function chooseCampaigns(ids: readonly string[]) {
    const next = new URLSearchParams(params);
    next.delete(CAMPAIGN_PARAM);
    for (const id of ids) next.append(CAMPAIGN_PARAM, id);
    next.delete('lead');
    navigate(`${location.pathname}?${next.toString()}`);
  }

  function sectionLink(path: string) {
    const query = new URLSearchParams(board ? { board: board.key } : {});
    if (path === '/crm') for (const id of campaignIds) query.append(CAMPAIGN_PARAM, id);
    const search = query.toString();
    return search ? `${path}?${search}` : path;
  }

  function choose(key: string) {
    if (user) rememberBoard(user.id, key);
    navigate(`${location.pathname}?board=${encodeURIComponent(key)}`);
  }

  return <nav aria-label={t('crm.nav.title')} className="flex shrink-0 flex-col gap-2 border-b border-border pb-2 md:w-56 md:border-b-0 md:border-r md:pr-3">
    {(boards ?? []).length > 1 ? <div><Label htmlFor="crm-board" className="sr-only">{t('crm.board')}</Label>
      <SearchableSelect
        id="crm-board"
        className="h-8"
        value={board?.key}
        onValueChange={choose}
        options={(boards ?? []).map((candidate) => ({
          value: candidate.key,
          label: `${candidate.label} ${candidate.clientName}`,
          node: <span className="flex min-w-0 gap-2"><span className="truncate">{candidate.label}</span><span className="truncate text-xs text-muted-foreground">{candidate.clientName}</span></span>,
        }))}
        searchLabel={t('crm.nav.searchBoards')}
        emptyLabel={t('select.search.empty')}
      />
    </div> : board ? <span className="truncate px-2 text-sm font-semibold">{board.label}</span> : null}
    {byCampaign && board ? <MultiSelect
      className="h-8 w-full"
      items={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name, icon: <RunningDot running={isRunning(campaign.status)} /> }))}
      chosen={campaignIds}
      onChange={chooseCampaigns}
      placeholder={t('crm.campaign.all')}
      allLabel={t('crm.campaign.all')}
      ariaLabel={t('crm.campaign')}
      emptyMeansAll
      searchable
    /> : null}
    <div className="flex gap-1 md:flex-col">
      {sections.map((section) => <Link key={section.path} to={sectionLink(section.path)} aria-current={location.pathname === section.path ? 'page' : undefined}
        className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold md:flex-none">
        <span className="flex min-w-0 items-center gap-2"><section.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{section.label}</span></span><span className="text-xs tabular-nums text-muted-foreground">{section.count ?? '–'}</span>
      </Link>)}
    </div>
  </nav>;
}
