import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { QrIdentity, QrScanResult, RecruitResult } from '../types/api';

/**
 * The backend issues this once and returns the SAME payload forever after —
 * a long staleTime just avoids a redundant refetch on every mount, it isn't
 * what makes the identity stable (the server is what guarantees that).
 */
export function useMyQr(enabled = true) {
  return useQuery({
    queryKey: ['my-qr'],
    queryFn: async () => {
      const { data } = await apiClient.get<QrIdentity>('/participant/qr');
      return data;
    },
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Preview/validate only. Nothing here recruits anyone — see validateQrScan on
 * the backend. useRecruitParticipant below performs the actual recruit.
 */
export function useScanQr() {
  return useMutation({
    mutationFn: async (qrPayload: string) => {
      const { data } = await apiClient.post<QrScanResult>('/participant/ceo/scan-qr', { qrPayload });
      return data;
    },
  });
}

/**
 * The REAL atomic recruitment (Phase 7). The backend re-validates everything
 * from scratch — this call can still fail even after a successful preview
 * scan, since time passes between scanning and confirming.
 */
export function useRecruitParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (qrPayload: string) => {
      const { data } = await apiClient.post<RecruitResult>('/participant/ceo/recruit', { qrPayload });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-team'] });
    },
  });
}
