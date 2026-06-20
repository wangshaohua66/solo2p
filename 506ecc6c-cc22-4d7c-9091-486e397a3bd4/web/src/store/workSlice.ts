import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Work, Artist, Paged, Brand, WorkStatus, WorkType } from '@/types';
import { workAPI, artistAPI } from '@/api';

interface WorkState {
  list: Work[];
  total: number;
  loading: boolean;
  currentWork: Work | null;
  artists: Artist[];
  filter: {
    brand: Brand | '';
    status: WorkStatus | '';
    type: WorkType | '';
    keyword: string;
    page: number;
    page_size: number;
  };
}

const initialState: WorkState = {
  list: [],
  total: 0,
  loading: false,
  currentWork: null,
  artists: [],
  filter: {
    brand: '',
    status: '',
    type: '',
    keyword: '',
    page: 1,
    page_size: 20,
  },
};

export const fetchWorks = createAsyncThunk(
  'work/fetchWorks',
  async (_, thunkAPI) => {
    const state = thunkAPI.getState() as { work: WorkState };
    const { filter } = state.work;
    const res = await workAPI.list({
      brand: filter.brand || undefined,
      status: filter.status || undefined,
      type: filter.type || undefined,
      keyword: filter.keyword || undefined,
      page: filter.page,
      page_size: filter.page_size,
    });
    return res.data as Paged<Work>;
  }
);

export const fetchWorkDetail = createAsyncThunk(
  'work/fetchWorkDetail',
  async (id: string) => {
    const res = await workAPI.get(id);
    return res.data as Work;
  }
);

export const fetchArtists = createAsyncThunk(
  'work/fetchArtists',
  async (brand: Brand | undefined = undefined) => {
    const res = await artistAPI.list({ brand: brand || undefined, page_size: 100 });
    return (res.data as Paged<Artist>).data;
  }
);

const workSlice = createSlice({
  name: 'work',
  initialState,
  reducers: {
    setFilter(state, action: PayloadAction<Partial<WorkState['filter']>>) {
      state.filter = { ...state.filter, ...action.payload };
    },
    setCurrentWork(state, action: PayloadAction<Work | null>) {
      state.currentWork = action.payload;
    },
    updateWorkStatus(state, action: PayloadAction<{ id: string; status: WorkStatus }>) {
      const w = state.list.find((x) => x.id === action.payload.id);
      if (w) w.status = action.payload.status;
      if (state.currentWork?.id === action.payload.id) {
        state.currentWork.status = action.payload.status;
      }
    },
    addVersion(state, action: PayloadAction<{ workId: string; version: any }>) {
      if (state.currentWork?.id === action.payload.workId) {
        state.currentWork.versions?.push(action.payload.version);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorks.pending, (state) => { state.loading = true; })
      .addCase(fetchWorks.fulfilled, (state, action) => {
        state.list = action.payload.data;
        state.total = action.payload.total;
        state.loading = false;
      })
      .addCase(fetchWorks.rejected, (state) => { state.loading = false; })
      .addCase(fetchWorkDetail.fulfilled, (state, action) => {
        state.currentWork = action.payload;
      })
      .addCase(fetchArtists.fulfilled, (state, action) => {
        state.artists = action.payload;
      });
  },
});

export const { setFilter, setCurrentWork, updateWorkStatus, addVersion } = workSlice.actions;
export const workReducer = workSlice.reducer;
