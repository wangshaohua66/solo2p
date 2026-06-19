import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AppState {
  collapsed: boolean
  messageCount: number
}

const initialState: AppState = {
  collapsed: false,
  messageCount: 0
}

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    toggleCollapsed: (state) => {
      state.collapsed = !state.collapsed
    },
    setMessageCount: (state, action: PayloadAction<number>) => {
      state.messageCount = action.payload
    }
  }
})

export const { toggleCollapsed, setMessageCount } = appSlice.actions
export default appSlice.reducer
