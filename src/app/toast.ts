import { create } from 'zustand'

interface ToastState {
  msg: string
  show(msg: string): void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useToast = create<ToastState>()((set) => ({
  msg: '',
  show(msg) {
    clearTimeout(timer)
    set({ msg })
    timer = setTimeout(() => set({ msg: '' }), 2000)
  },
}))
