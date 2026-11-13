import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/index.js';
import { useClientMembers } from '@/entities/membership/index.js';
import { http } from '@/shared/lib/index.js';

export function useLeadAssignees(clientId: string, board: string) {
  const { role } = useAuth();
  const partner = role === 'PARTNER';
  const members = useClientMembers(partner ? undefined : clientId, board);
  const assignees = useQuery({
    queryKey: ['crm', 'assignees', board],
    queryFn: () => http.get<Array<{id:string;name:string;image:string|null;status:'ACTIVE'}>>(`/crm/boards/${board}/assignees`),
    enabled: partner,
  });
  return partner ? assignees : members;
}
