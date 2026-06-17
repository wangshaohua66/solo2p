import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Performance, PerformanceStatus } from '@/types'
import { api } from '@/api'

interface PerformanceState {
  performances: Performance[]
  currentPerformance: Performance | null
  loading: boolean
  calendarEvents: any[]
}

const initialState: PerformanceState = {
  performances: [],
  currentPerformance: null,
  loading: false,
  calendarEvents: []
}

export const fetchPerformances = createAsyncThunk(
  'performance/fetchPerformances',
  async (params?: { status?: string; venueId?: string; startDate?: string; endDate?: string }) => {
    const response = await api.get('/performances', { params })
    return response.data
  }
)

export const fetchPerformance = createAsyncThunk(
  'performance/fetchPerformance',
  async (id: string) => {
    const response = await api.get(`/performances/${id}`)
    return response.data
  }
)

export const createPerformance = createAsyncThunk(
  'performance/createPerformance',
  async (data: Partial<Performance>) => {
    const response = await api.post('/performances', data)
    return response.data
  }
)

export const approvePerformance = createAsyncThunk(
  'performance/approvePerformance',
  async (params: { id: string; startTime: string; endTime: string }) => {
    const response = await api.post(`/performances/${params.id}/approve`, params)
    return response.data
  }
)

export const rejectPerformance = createAsyncThunk(
  'performance/rejectPerformance',
  async (params: { id: string; reason: string }) => {
    const response = await api.post(`/performances/${params.id}/reject`, params)
    return response.data
  }
)

export const negotiatePerformance = createAsyncThunk(
  'performance/negotiatePerformance',
  async (params: { id: string; suggestedDates: string[]; note?: string }) => {
    const response = await api.post(`/performances/${params.id}/negotiate`, params)
    return response.data
  }
)

const performanceSlice = createSlice({
  name: 'performance',
  initialState,
  reducers: {
    setCurrentPerformance: (state, action: PayloadAction<Performance | null>) => {
      state.currentPerformance = action.payload
    },
    updatePerformanceStatus: (state, action: PayloadAction<{ id: string; status: PerformanceStatus }>) => {
      const { id, status } = action.payload
      const perf = state.performances.find((p) => p.id === id)
      if (perf) perf.status = status
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPerformances.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchPerformances.fulfilled, (state, action) => {
        state.loading = false
        state.performances = action.payload.performances
        state.calendarEvents = action.payload.events || []
      })
      .addCase(fetchPerformance.fulfilled, (state, action) => {
        state.currentPerformance = action.payload.performance
      })
      .addCase(createPerformance.fulfilled, (state, action) => {
        state.performances.push(action.payload.performance)
      })
  }
})

export const { setCurrentPerformance, updatePerformanceStatus } = performanceSlice.actions
export default performanceSlice.reducer
