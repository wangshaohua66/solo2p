import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Settlement, SettlementStatus, DashboardSummary, SettlementPeriod, Paged, Brand, Platform } from '@/types';
import { royaltyAPI } from '@/api';

interface RoyaltyState {
  settlements: Settlement[];
  total: number;
  loading: boolean;
  currentSettlement: Settlement | null;
  dashboard: DashboardSummary | null;
  dashboardLoading: boolean;
  filter: {
    artist_id: string;
    status: SettlementStatus | '';
    brand: Brand | '';
    page: number;
    page_size: number;
  };
  dashboardFilter: {
    start_date: string;
    end_date: string;
    brand: Brand | '';
  };
  comparison: {
    base_id: string;
    compared_ids: string[];
    total_revenue: Record<string, number>;
    diff_map: Record<string, number>;
    platform_diff: Record<string, Record<Platform, number>>;
  } | null;
}

const initialState: RoyaltyState = {
  settlements: [],
  total: 0,
  loading: false,
  currentSettlement: null,
  dashboard: null,
  dashboardLoading: false,
  filter: {
    artist_id: '',
    status: '',
    brand: '',
    page: 1,
    page_size: 20,
  },
  dashboardFilter: {
    start_date: '',
    end_date: '',
    brand: '',
  },
  comparison: null,
};

export const fetchSettlements = createAsyncThunk(
  'royalty/fetchSettlements',
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as { royalty: RoyaltyState };
    const { filter } = state.royalty;
    const res = await royaltyAPI.settlements({
      artist_id: filter.artist_id || undefined,
      status: filter.status || undefined,
      brand: filter.brand || undefined,
      page: filter.page,
      page_size: filter.page_size,
    });
    return res.data as Paged<Settlement>;
  }
);

export const fetchSettlementDetail = createAsyncThunk(
  'royalty/fetchSettlementDetail',
  async (id: string) => {
    const res = await royaltyAPI.getSettlement(id);
    return res.data as Settlement;
  }
);

export const generateSettlement = createAsyncThunk(
  'royalty/generateSettlement',
  async (params: { artist_id: string; period: SettlementPeriod; ref_date?: string }) => {
    const res = await royaltyAPI.generateSettlement(params.artist_id, params.period, params.ref_date);
    return res.data as Settlement;
  }
);

export const fetchDashboard = createAsyncThunk(
  'royalty/fetchDashboard',
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as { royalty: RoyaltyState };
    const { dashboardFilter } = state.royalty;
    const res = await royaltyAPI.dashboard({
      start_date: dashboardFilter.start_date || undefined,
      end_date: dashboardFilter.end_date || undefined,
      brand: dashboardFilter.brand || undefined,
    });
    return res.data as DashboardSummary;
  }
);

export const compareSettlements = createAsyncThunk(
  'royalty/compareSettlements',
  async (ids: string[]) => {
    const res = await royaltyAPI.compareSettlements(ids);
    return res.data;
  }
);

const royaltySlice = createSlice({
  name: 'royalty',
  initialState,
  reducers: {
    setFilter(state, action: PayloadAction<Partial<RoyaltyState['filter']>>) {
      state.filter = { ...state.filter, ...action.payload };
    },
    setDashboardFilter(state, action: PayloadAction<Partial<RoyaltyState['dashboardFilter']>>) {
      state.dashboardFilter = { ...state.dashboardFilter, ...action.payload };
    },
    setCurrentSettlement(state, action: PayloadAction<Settlement | null>) {
      state.currentSettlement = action.payload;
    },
    updateSettlementStatus(state, action: PayloadAction<{ id: string; status: SettlementStatus }>) {
      const s = state.settlements.find((x) => x.id === action.payload.id);
      if (s) s.status = action.payload.status;
      if (state.currentSettlement?.id === action.payload.id) {
        state.currentSettlement.status = action.payload.status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettlements.pending, (state) => { state.loading = true; })
      .addCase(fetchSettlements.fulfilled, (state, action) => {
        state.settlements = action.payload.data;
        state.total = action.payload.total;
        state.loading = false;
      })
      .addCase(fetchSettlements.rejected, (state) => { state.loading = false; })
      .addCase(fetchSettlementDetail.fulfilled, (state, action) => {
        state.currentSettlement = action.payload;
      })
      .addCase(generateSettlement.fulfilled, (state, action) => {
        state.settlements.unshift(action.payload);
        state.currentSettlement = action.payload;
      })
      .addCase(fetchDashboard.pending, (state) => { state.dashboardLoading = true; })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.dashboard = action.payload;
        state.dashboardLoading = false;
      })
      .addCase(fetchDashboard.rejected, (state) => { state.dashboardLoading = false; })
      .addCase(compareSettlements.fulfilled, (state, action) => {
        state.comparison = action.payload;
      });
  },
});

export const { setFilter, setDashboardFilter, setCurrentSettlement, updateSettlementStatus } = royaltySlice.actions;
export const royaltyReducer = royaltySlice.reducer;
