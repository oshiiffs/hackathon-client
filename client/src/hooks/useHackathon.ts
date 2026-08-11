import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { HackathonStatePayload } from '../types/api';
import { useHackathonStore } from '../store/hackathonStore';

export function useHackathonState() {
  const setState = useHackathonStore((s) => s.setState);
  return useQuery({
    queryKey: ['hackathon-state'],
    queryFn: async () => {
      const { data } = await apiClient.get<HackathonStatePayload>('/hackathon/state');
      setState(data);
      return data;
    },
    refetchInterval: 4000, // fallback poll; sockets push instant updates on top of this
  });
}
