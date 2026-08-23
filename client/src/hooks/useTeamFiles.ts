import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { FileCategory, FileDetail, FileMetadata, PitchDeckResponse } from '../types/api';

export function useTeamFiles() {
  return useQuery({
    queryKey: ['team-files'],
    queryFn: async () => {
      const { data } = await apiClient.get<FileMetadata[]>('/team/files');
      return data;
    },
  });
}

export function usePitchDeck() {
  return useQuery({
    queryKey: ['pitch-deck'],
    queryFn: async () => {
      const { data } = await apiClient.get<PitchDeckResponse>('/team/pitch-deck');
      return data;
    },
  });
}

// Both callers need the real filename (not just the URL) so a download can
// be saved with the correct name + extension regardless of what Cloudinary's
// own URL looks like — see DeliverablesSection.tsx's downloadFile.
export async function fetchPitchDeckVersionFile(id: string): Promise<Pick<FileDetail, 'fileUrl' | 'filename'>> {
  const { data } = await apiClient.get<FileDetail>(`/team/pitch-deck/${id}`);
  return { fileUrl: data.fileUrl, filename: data.filename };
}

export async function fetchTeamFileFile(id: string): Promise<Pick<FileDetail, 'fileUrl' | 'filename'>> {
  const { data } = await apiClient.get<FileDetail>(`/team/files/${id}`);
  return { fileUrl: data.fileUrl, filename: data.filename };
}

type UploadArgs = { file: File; onProgress?: (percent: number) => void };

function withProgress(onProgress?: (percent: number) => void) {
  if (!onProgress) return undefined;
  return (event: { loaded: number; total?: number }) => {
    if (!event.total) return;
    onProgress(Math.round((event.loaded / event.total) * 100));
  };
}

export function useUploadTeamFile(type: FileCategory) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadArgs) => {
      const form = new FormData();
      form.append('type', type);
      form.append('file', file);
      const { data } = await apiClient.post<FileMetadata>('/team/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: withProgress(onProgress),
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-files'] }),
  });
}

export function useDeleteTeamFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/team/files/${id}`);
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-files'] }),
  });
}

export function useUploadPitchDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadArgs) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<FileMetadata>('/team/pitch-deck', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: withProgress(onProgress),
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pitch-deck'] }),
  });
}

export function useReplacePitchDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file, onProgress }: UploadArgs & { id: string }) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<FileMetadata>(`/team/pitch-deck/${id}/replace`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: withProgress(onProgress),
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pitch-deck'] }),
  });
}
