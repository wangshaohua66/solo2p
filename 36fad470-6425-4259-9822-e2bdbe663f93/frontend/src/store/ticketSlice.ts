import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Seat, Order, TicketType, TicketAvailability } from '@/types'
import { SeatStatus } from '@/types'
import { api } from '@/api'

interface TicketState {
  seats: Seat[]
  selectedSeats: Seat[]
  currentTicketType: TicketType
  loading: boolean
  currentOrder: Order | null
  lockTimeout: number
  ticketAvailability: TicketAvailability | null
}

const initialState: TicketState = {
  seats: [],
  selectedSeats: [],
  currentTicketType: 'regular' as TicketType,
  loading: false,
  currentOrder: null,
  lockTimeout: 900,
  ticketAvailability: null
}

export const fetchSeats = createAsyncThunk(
  'ticket/fetchSeats',
  async (performanceId: string) => {
    const response = await api.get(`/tickets/seats/${performanceId}`)
    return response.data
  }
)

export const lockSeats = createAsyncThunk(
  'ticket/lockSeats',
  async (params: { performanceId: string; seatIds: string[]; ticketType: TicketType }) => {
    const response = await api.post('/tickets/lock', params)
    return response.data
  }
)

export const releaseSeats = createAsyncThunk(
  'ticket/releaseSeats',
  async (lockIds: string[]) => {
    const response = await api.post('/tickets/release', { lockIds })
    return response.data
  }
)

export const createOrder = createAsyncThunk(
  'ticket/createOrder',
  async (params: {
    performanceId: string
    seatIds: string[]
    ticketType: TicketType
    salesChannel: string
  }) => {
    const response = await api.post('/tickets/order', params)
    return response.data
  }
)

export const payOrder = createAsyncThunk(
  'ticket/payOrder',
  async (params: { orderId: string; paymentChannel: string }) => {
    const response = await api.post('/tickets/pay', params)
    return response.data
  }
)

export const refundOrder = createAsyncThunk(
  'ticket/refundOrder',
  async (orderId: string) => {
    const response = await api.post(`/tickets/refund/${orderId}`)
    return response.data
  }
)

export const verifyTicket = createAsyncThunk(
  'ticket/verifyTicket',
  async (params: { qrCode?: string; orderNo?: string }) => {
    const response = await api.post('/tickets/verify', params)
    return response.data
  }
)

export const verifyBatch = createAsyncThunk(
  'ticket/verifyBatch',
  async (items: Array<{ qrCode?: string; orderNo?: string }>) => {
    const response = await api.post('/tickets/verify/batch', { items })
    return response.data
  }
)

const ticketSlice = createSlice({
  name: 'ticket',
  initialState,
  reducers: {
    toggleSeatSelection: (state, action: PayloadAction<Seat>) => {
      const seat = action.payload
      const index = state.selectedSeats.findIndex((s) => s.id === seat.id)
      if (index > -1) {
        state.selectedSeats.splice(index, 1)
      } else if (seat.status === SeatStatus.AVAILABLE) {
        state.selectedSeats.push(seat)
      }
    },
    setSelectedSeats: (state, action: PayloadAction<Seat[]>) => {
      state.selectedSeats = action.payload
    },
    clearSelectedSeats: (state) => {
      state.selectedSeats = []
    },
    setTicketType: (state, action: PayloadAction<TicketType>) => {
      state.currentTicketType = action.payload
    },
    updateSeatStatuses: (state, action: PayloadAction<{ seatIds: string[]; status: SeatStatus }>) => {
      const { seatIds, status } = action.payload
      state.seats = state.seats.map((seat) =>
        seatIds.includes(seat.id) ? { ...seat, status } : seat
      )
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSeats.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchSeats.fulfilled, (state, action) => {
        state.loading = false
        state.seats = action.payload.seats
        state.ticketAvailability = action.payload.ticketAvailability || null
      })
      .addCase(lockSeats.fulfilled, (state) => {
        state.selectedSeats.forEach((seat) => {
          const target = state.seats.find((s) => s.id === seat.id)
          if (target) target.status = SeatStatus.LOCKED
        })
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.currentOrder = action.payload.order
      })
      .addCase(payOrder.fulfilled, (state, action) => {
        state.currentOrder = action.payload.order
        state.selectedSeats = []
      })
      .addCase(refundOrder.fulfilled, (state, action) => {
        state.currentOrder = action.payload.order
      })
      .addCase(verifyTicket.fulfilled, (state, action) => {
        if (action.payload.order) {
          state.currentOrder = action.payload.order
        }
      })
  }
})

export const {
  toggleSeatSelection,
  clearSelectedSeats,
  setTicketType,
  updateSeatStatuses,
  setSelectedSeats
} = ticketSlice.actions
export default ticketSlice.reducer
