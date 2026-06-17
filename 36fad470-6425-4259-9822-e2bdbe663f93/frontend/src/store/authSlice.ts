import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, User } from '@/types'
import { api } from '@/api'

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  loading: false
}

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }) => {
    const response = await api.post('/auth/login', credentials)
    return response.data
  }
)

export const restoreAuth = createAsyncThunk('auth/restore', async () => {
  const response = await api.get('/auth/me')
  return response.data
})

export const refreshToken = createAsyncThunk('auth/refresh', async () => {
  const refreshTokenVal = localStorage.getItem('refresh_token')
  if (!refreshTokenVal) {
    throw new Error('No refresh token')
  }
  const response = await api.post('/auth/refresh', { refreshToken: refreshTokenVal })
  return response.data
})

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.exp ? Number(payload.exp) : null
  } catch {
    return null
  }
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleTokenRefresh(dispatch: (action: any) => void) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }

  const token = localStorage.getItem('access_token')
  if (!token) return

  const exp = decodeJwtExp(token)
  if (!exp) return

  const now = Math.floor(Date.now() / 1000)
  const remaining = exp - now

  if (remaining <= 0) {
    dispatch(refreshToken() as any)
  } else {
    const refreshAt = (remaining - 300) * 1000
    if (refreshAt <= 0) {
      dispatch(refreshToken() as any)
    } else {
      refreshTimer = setTimeout(() => {
        dispatch(refreshToken() as any)
      }, refreshAt)
    }
  }
}

export function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.isAuthenticated = false
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      clearRefreshTimer()
    },
    setTokens: (state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.isAuthenticated = true
      localStorage.setItem('access_token', action.payload.accessToken)
      localStorage.setItem('refresh_token', action.payload.refreshToken)
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.accessToken = action.payload.accessToken
        state.refreshToken = action.payload.refreshToken
        state.isAuthenticated = true
        localStorage.setItem('access_token', action.payload.accessToken)
        localStorage.setItem('refresh_token', action.payload.refreshToken)
        localStorage.setItem('user', JSON.stringify(action.payload.user))
      })
      .addCase(login.rejected, (state) => {
        state.loading = false
      })
      .addCase(restoreAuth.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.isAuthenticated = true
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken
        if (action.payload.refreshToken) {
          state.refreshToken = action.payload.refreshToken
          localStorage.setItem('refresh_token', action.payload.refreshToken)
        }
        localStorage.setItem('access_token', action.payload.accessToken)
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.isAuthenticated = false
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        clearRefreshTimer()
      })
  }
})

export const { logout, setTokens } = authSlice.actions
export default authSlice.reducer
