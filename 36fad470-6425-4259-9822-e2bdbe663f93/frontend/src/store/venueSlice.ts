import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Venue, SeatSection } from '@/types'
import { api } from '@/api'

interface VenueState {
  venues: Venue[]
  currentVenue: Venue | null
  loading: boolean
}

const initialState: VenueState = {
  venues: [],
  currentVenue: null,
  loading: false
}

export const fetchVenues = createAsyncThunk('venue/fetchVenues', async () => {
  const response = await api.get('/venues')
  return response.data
})

export const fetchVenue = createAsyncThunk('venue/fetchVenue', async (id: string) => {
  const response = await api.get(`/venues/${id}`)
  return response.data
})

export const saveSeatConfig = createAsyncThunk(
  'venue/saveSeatConfig',
  async (params: { venueId: string; sections: SeatSection[] }) => {
    const response = await api.put(`/venues/${params.venueId}/seat-config`, {
      sections: params.sections
    })
    return response.data
  }
)

const venueSlice = createSlice({
  name: 'venue',
  initialState,
  reducers: {
    setCurrentVenue: (state, action: PayloadAction<Venue | null>) => {
      state.currentVenue = action.payload
    },
    updateSeatSections: (state, action: PayloadAction<SeatSection[]>) => {
      if (state.currentVenue) {
        state.currentVenue.seatConfig = action.payload
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVenues.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchVenues.fulfilled, (state, action) => {
        state.loading = false
        state.venues = action.payload.venues
      })
      .addCase(fetchVenue.fulfilled, (state, action) => {
        state.currentVenue = action.payload.venue
      })
      .addCase(saveSeatConfig.fulfilled, (state, action) => {
        state.currentVenue = action.payload.venue
        const idx = state.venues.findIndex((v) => v.id === action.payload.venue.id)
        if (idx > -1) state.venues[idx] = action.payload.venue
      })
  }
})

export const { setCurrentVenue, updateSeatSections } = venueSlice.actions
export default venueSlice.reducer
