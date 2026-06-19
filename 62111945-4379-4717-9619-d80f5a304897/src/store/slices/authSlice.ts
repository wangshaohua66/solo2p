import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { UserInfo, UserRole } from '@/types'

interface AuthState {
  token: string | null
  userInfo: UserInfo | null
  role: UserRole | null
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  userInfo: null,
  role: (localStorage.getItem('role') as UserRole) || null
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload
      localStorage.setItem('token', action.payload)
    },
    setUserInfo: (state, action: PayloadAction<UserInfo>) => {
      state.userInfo = action.payload
      state.role = action.payload.role
      localStorage.setItem('role', action.payload.role)
    },
    setRole: (state, action: PayloadAction<UserRole>) => {
      state.role = action.payload
      localStorage.setItem('role', action.payload)
    },
    logout: (state) => {
      state.token = null
      state.userInfo = null
      state.role = null
      localStorage.removeItem('token')
      localStorage.removeItem('role')
    }
  }
})

export const { setToken, setUserInfo, setRole, logout } = authSlice.actions
export default authSlice.reducer
