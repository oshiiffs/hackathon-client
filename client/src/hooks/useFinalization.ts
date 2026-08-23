import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { FinalizationStatus, HeatCategory } from '../types/api';

/** Polled while the CEO is on CeoFinalizePage — this is also the endpoint
 * whose reads drive every server-side timer self-heal (lazy-starting the
 * CEO Name Selection timer, auto-finalizing once HEAT Category Selection
 * closes). The interval keeps that self-heal responsive and keeps
 * nameSelectionEndsAt/categorySelectionEndsAt/team.finalizedAt fresh without
 * the page needing a manual refresh or button click to advance. */
export function useFinalizationStatus(enabled = true) {
  return useQuery({
    queryKey: ['finalization-status'],
    queryFn: async () => {
      const { data } = await apiClient.get<FinalizationStatus>('/participant/ceo/finalization');
      return data;
    },
    enabled,
    retry: false,
    staleTime: 0,
    refetchInterval: 2000,
  });
}

/** Autosaves the in-progress team name and/or HEAT category pick — the
 * buttonless replacement for the old "type a name, click Continue" / "pick a
 * category, click Finalize" flow. The server rejects either field once its
 * own step's window has closed (NAME_SELECTION_CLOSED / CATEGORY_SELECTION_
 * CLOSED) rather than trusting the client to only call this at the right
 * time. */
export function useSaveFinalizeDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name?: string; category?: HeatCategory }) => {
      const { data } = await apiClient.patch<FinalizationStatus>('/participant/ceo/finalize/draft', input);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['finalization-status'], data);
    },
  });
}

/** Called once the CEO Name -> HEAT Category transition video ends or
 * errors — starts the HEAT Category Selection timer server-side. Idempotent:
 * safe to call more than once (e.g. a retried request), never resets an
 * already-started timer. */
export function useStartCategoryTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<FinalizationStatus>('/participant/ceo/finalize/start-category-timer');
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['finalization-status'], data);
    },
  });
}

/**
 * Real, immediate finalize — tapping a HEAT category calls this directly
 * instead of only draft-saving the pick and waiting for the category
 * timer to run out. This is the same POST /participant/ceo/finalize
 * endpoint the (removed) timer-driven flow always relied on eventually
 * happening automatically server-side (see team.service.ts's
 * getFinalizationStatus self-heal, which still exists as the fallback for a
 * CEO who never taps anything at all) — nothing new on the server, just
 * called explicitly and immediately now instead of implicitly and only once
 * the deadline passes. Invalidates (rather than setQueryData-ing) the
 * status query on success: this endpoint returns the Team, not the full
 * FinalizationStatus shape saveFinalizeDraft/useStartCategoryTimer return,
 * so a refetch is simpler and just as fast for a one-off click.
 */
export function useFinalizeTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category: HeatCategory }) => {
      const { data } = await apiClient.post('/participant/ceo/finalize', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finalization-status'] });
    },
  });
}
