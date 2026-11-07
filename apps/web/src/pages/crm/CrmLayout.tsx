import { Outlet } from 'react-router-dom';
import { CrmNav } from '@/widgets/crm-nav/index.js';

export function CrmLayout() {
  return <div className="flex h-full min-h-0 flex-col gap-3 md:flex-row"><CrmNav /><main className="min-h-0 min-w-0 flex-1"><Outlet /></main></div>;
}
