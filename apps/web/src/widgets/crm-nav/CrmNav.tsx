import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Target, Users } from 'lucide-react';
import { useCompanies, usePeople } from '@/entities/crm-record/index.js';
import { useLeadBoards, useLeads } from '@/entities/lead/index.js';
import { useAuth } from '@/features/auth/index.js';
import { t } from '@/shared/config/index.js';
import { useModuleMemory } from '@/shared/lib/index.js';
import { Label, SearchableSelect } from '@/shared/ui/index.js';

export function CrmNav() {
  const { data: boards } = useLeadBoards();
  const { user } = useAuth();
  const remembered = useModuleMemory((state) => user ? state.boards[user.id] : undefined);
  const rememberBoard = useModuleMemory((state) => state.rememberBoard);
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const board = boards?.find((entry) => entry.key === params.get('board')) ?? boards?.find((entry) => entry.key === remembered) ?? boards?.[0];
  const { data: leads } = useLeads(board?.key);
  const { data: companies } = useCompanies(board?.clientId);
  const { data: people } = usePeople(board?.clientId);
  const suffix = board ? `?board=${encodeURIComponent(board.key)}` : '';
  const sections = [
    { path: '/crm', label: t('crm.nav.leads'), count: leads?.length, icon: Target },
    { path: '/crm/companies', label: t('crm.nav.companies'), count: companies?.length, icon: Building2 },
    { path: '/crm/people', label: t('crm.nav.people'), count: people?.length, icon: Users },
  ];

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
    <div className="flex gap-1 md:flex-col">
      {sections.map((section) => <Link key={section.path} to={`${section.path}${suffix}`} aria-current={location.pathname === section.path ? 'page' : undefined}
        className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold md:flex-none">
        <span className="flex min-w-0 items-center gap-2"><section.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{section.label}</span></span><span className="text-xs tabular-nums text-muted-foreground">{section.count ?? '–'}</span>
      </Link>)}
    </div>
  </nav>;
}
