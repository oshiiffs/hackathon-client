import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { DirectoryParticipant } from '../types/api';

/** Public roster browse — every participant/CEO's self-set profile. Most
 * useful before the CEO Challenge, when nobody yet knows who's on which team. */
export function useParticipantDirectory() {
  return useQuery({
    queryKey: ['participant-directory'],
    queryFn: async () => {
      const { data } = await apiClient.get<DirectoryParticipant[]>('/participant/directory');
      return data;
    },
  });
}
