import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PriceChangeLog } from '@/types'
import { api } from '@/api'

export interface PriceLogQueryParams {
  startDate?: string
  endDate?: string
  performanceId?: string
  ticketType?: string
  operatorId?: string
}

interface PriceLogState {
  logs: PriceChangeLog[]
  loading: boolean
}

const initialState: PriceLogState = {
  logs: [],
  loading: false
}

export const fetchPriceLogs = createAsyncThunk(
  'priceLog/fetchPriceLogs',
  async (params: PriceLogQueryParams = {}) => {
    const response = await api.get('/price-logs', { params })
    return response.data
  }
)

const priceLogSlice = createSlice({
  name: 'priceLog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPriceLogs.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchPriceLogs.fulfilled, (state, action) => {
        state.loading = false
        state.logs = action.payload.logs || action.payload || []
      })
      .addCase(fetchPriceLogs.rejected, (state) => {
        state.loading = false
      })
  }
})

export default priceLogSlice.reducer
