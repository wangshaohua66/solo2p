import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, UserRole, PiracyRecord, PiracyStatus, Paged, RightsLetter } from '@/types';
import { authAPI, setToken as saveToken, clearToken as removeToken, monitorAPI } from '@/api';

interface AppState {
  user: User | null;
  token: string;
  authenticated: boolean;
  permissions: Record<string, string[]>;
  authLoading: boolean;
  piracies: PiracyRecord[];
  piraciesTotal: number;
  piraciesLoading: boolean;
  piracyFilter: {
    status: PiracyStatus | '';
    work_id: string;
    page: number;
    page_size: number;
  };
  currentPiracy: PiracyRecord | null;
  rightsLetter: RightsLetter | null;
  notifications: { id: string; type: 'info' | 'warning' | 'error' | 'success'; message: string }[];
}

const initialState: AppState = {
  user: null,
  token: '',
  authenticated: false,
  permissions: {},
  authLoading: false,
  piracies: [],
  piraciesTotal: 0,
  piraciesLoading: false,
  piracyFilter: {
    status: '',
    work_id: '',
    page: 1,
    page_size: 20,
  },
  currentPiracy: null,
  rightsLetter: null,
  notifications: [],
};

export const login = createAsyncThunk(
  'app/login',
  async (params: { username: string; password: string }) => {
    const res = await authAPI.login(params.username, params.password);
    return res.data;
  }
);

export const validateAuth = createAsyncThunk('app/validateAuth', async () => {
  const res = await authAPI.validate();
  return res.data;
});

export const fetchMe = createAsyncThunk('app/fetchMe', async () => {
  const res = await authAPI.me();
  return res.data as User;
});

export const fetchPiracies = createAsyncThunk(
  'app/fetchPiracies',
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as { app: AppState };
    const { piracyFilter } = state.app;
    const res = await monitorAPI.piracies({
      status: piracyFilter.status || undefined,
      work_id: piracyFilter.work_id || undefined,
      page: piracyFilter.page,
      page_size: piracyFilter.page_size,
    });
    return res.data as Paged<PiracyRecord>;
  }
);

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = '';
      state.authenticated = false;
      state.permissions = {};
      removeToken();
    },
    setPiracyFilter(state, action: PayloadAction<Partial<AppState['piracyFilter']>>) {
      state.piracyFilter = { ...state.piracyFilter, ...action.payload };
    },
    setCurrentPiracy(state, action: PayloadAction<PiracyRecord | null>) {
      state.currentPiracy = action.payload;
    },
    updatePiracyStatus(state, action: PayloadAction<{ id: string; status: PiracyStatus }>) {
      const p = state.piracies.find((x) => x.id === action.payload.id);
      if (p) p.status = action.payload.status;
      if (state.currentPiracy?.id === action.payload.id) {
        state.currentPiracy.status = action.payload.status;
      }
    },
    setRightsLetter(state, action: PayloadAction<RightsLetter | null>) {
      state.rightsLetter = action.payload;
    },
    pushNotification(state, action: PayloadAction<AppState['notifications'][number]>) {
      state.notifications.push(action.payload);
    },
    popNotification(state) {
      state.notifications.shift();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.authLoading = true; })
      .addCase(login.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.authenticated = true;
        state.authLoading = false;
        saveToken(action.payload.token);
      })
      .addCase(login.rejected, (state) => { state.authLoading = false; })
      .addCase(validateAuth.fulfilled, (state, action) => {
        if (action.payload?.valid) {
          state.authenticated = true;
          state.permissions = action.payload.permissions || {};
        }
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchPiracies.pending, (state) => { state.piraciesLoading = true; })
      .addCase(fetchPiracies.fulfilled, (state, action) => {
        state.piracies = action.payload.data;
        state.piraciesTotal = action.payload.total;
        state.piraciesLoading = false;
      })
      .addCase(fetchPiracies.rejected, (state) => { state.piraciesLoading = false; });
  },
});

export const { logout, setPiracyFilter, setCurrentPiracy, updatePiracyStatus, setRightsLetter, pushNotification, popNotification } = appSlice.actions;
export const appReducer = appSlice.reducer;

export type { UserRole };
