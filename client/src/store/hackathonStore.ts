import { create } from 'zustand';
import type { HackathonStatePayload } from '../types/api';

type HackathonStoreState = {
  state: HackathonStatePayload | null;
  setState: (state: HackathonStatePayload) => void;
};

export const useHackathonStore = create<HackathonStoreState>((set) => ({
  state: null,
  setState: (state) => set({ state }),
}));
