import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import ticketReducer from './ticketSlice'
import performanceReducer from './performanceSlice'
import venueReducer from './venueSlice'
import priceLogReducer from './priceLogSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ticket: ticketReducer,
    performance: performanceReducer,
    venue: venueReducer,
    priceLog: priceLogReducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
