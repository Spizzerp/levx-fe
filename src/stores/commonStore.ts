import { create } from 'zustand'

type CommonState = {
  isInitialized: boolean
  setInitialized: (value: boolean) => void
}

export const useCommonStore = create<CommonState>((set) => ({
  isInitialized: false,
  setInitialized: (value) => set({ isInitialized: value }),
}))
