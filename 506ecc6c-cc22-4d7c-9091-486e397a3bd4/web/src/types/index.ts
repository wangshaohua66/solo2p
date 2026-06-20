export type WorkStatus = 'demo' | 'arranging' | 'mixing' | 'mastering' | 'reviewing' | 'released';
export type WorkType = 'album' | 'single' | 'ep';
export type Brand = 'brand_a' | 'brand_b' | 'brand_c';
export type ContributorRole = 'lyricist' | 'composer' | 'arranger' | 'producer' | 'performer';
export type AuthType = 'original' | 'adapt' | 'sample' | 'cover' | 'remix';
export type AuthStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type UserRole = 'artist' | 'producer' | 'copyright' | 'finance' | 'admin';

export interface Work {
  id: string;
  title: string;
  type: WorkType;
  brand: Brand;
  status: WorkStatus;
  isrc: string;
  iswc: string;
  duration: number;
  genre: string;
  release_date?: string;
  created_at: string;
  updated_at: string;
  versions?: WorkVersion[];
  contributors?: Contributor[];
  auth_chain?: AuthLink[];
}

export interface WorkVersion {
  id: string;
  work_id: string;
  version: string;
  status: WorkStatus;
  file_url: string;
  file_size: number;
  audio_fingerprint: string;
  created_at: string;
  created_by: string;
  note: string;
}

export interface Contributor {
  id: string;
  work_id: string;
  artist_id: string;
  artist_name: string;
  role: ContributorRole;
  royalty_rule_id: string;
}

export interface AuthLink {
  id: string;
  work_id: string;
  parent_work_id?: string | null;
  parent_title: string;
  auth_type: AuthType;
  license_type: string;
  auth_status: AuthStatus;
  auth_doc_url: string;
  auth_date?: string;
  expire_date?: string;
  fee: number;
  note: string;
}

export interface Artist {
  id: string;
  name: string;
  brand: Brand;
  signature: string;
  contact: string;
  join_date: string;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  real_name: string;
  email: string;
  phone: string;
  role: UserRole;
  artist_id?: string | null;
  created_at: string;
  last_login?: string;
}

export type RoyaltyRuleType = 'fixed' | 'tiered' | 'guarantee';
export type SettlementPeriod = 'monthly' | 'quarterly' | 'yearly';
export type SettlementStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'rejected';
export type Platform = 'netease' | 'qqmusic' | 'kugou' | 'kuwo' | 'spotify' | 'apple_music';

export const PlatformNames: Record<Platform, string> = {
  netease: '网易云音乐',
  qqmusic: 'QQ音乐',
  kugou: '酷狗音乐',
  kuwo: '酷我音乐',
  spotify: 'Spotify',
  apple_music: 'Apple Music',
};

export const BrandNames: Record<Brand, string> = {
  brand_a: '星河音乐',
  brand_b: '回声厂牌',
  brand_c: '独立之声',
};

export const WorkStatusNames: Record<WorkStatus, string> = {
  demo: 'Demo 创作',
  arranging: '编曲制作',
  mixing: '混音处理',
  mastering: '母带制作',
  reviewing: '审核中',
  released: '已发行',
};

export const WorkTypeNames: Record<WorkType, string> = {
  album: '专辑',
  single: '单曲',
  ep: 'EP',
};

export const RoleNames: Record<ContributorRole, string> = {
  lyricist: '作词',
  composer: '作曲',
  arranger: '编曲',
  producer: '制作人',
  performer: '演唱者',
};

export const UserRoleNames: Record<UserRole, string> = {
  artist: '艺人',
  producer: '制作人',
  copyright: '版权专员',
  finance: '财务',
  admin: '管理员',
};

export interface RoyaltyRule {
  id: string;
  name: string;
  work_id?: string | null;
  artist_id?: string | null;
  contributor_role: ContributorRole;
  rule_type: RoyaltyRuleType;
  fixed_rate?: number | null;
  tiered_rates: { threshold: number; rate: number }[];
  guaranteed?: number | null;
  period: SettlementPeriod;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
}

export interface PlatformData {
  id: string;
  work_id: string;
  platform: Platform;
  data_date: string;
  play_count: number;
  download_count: number;
  favorite_count: number;
  share_count: number;
  comment_count: number;
  revenue: number;
  unit_price: number;
  created_at: string;
}

export interface SettlementDetail {
  id: string;
  settlement_id: string;
  work_id: string;
  work_title: string;
  platform: Platform;
  contributor_id: string;
  contributor_name: string;
  contributor_role: ContributorRole;
  total_revenue: number;
  platform_revenue: number;
  contributor_share: number;
  share_rate: number;
  rule_type: RoyaltyRuleType;
}

export interface Settlement {
  id: string;
  period: SettlementPeriod;
  period_start: string;
  period_end: string;
  artist_id: string;
  artist_name: string;
  brand: Brand;
  total_revenue: number;
  platform_breakdown: Record<string, number>;
  work_breakdown: Record<string, number>;
  contributor_breakdown: Record<string, number>;
  status: SettlementStatus;
  details?: SettlementDetail[];
  remark: string;
  created_at: string;
  approved_at?: string;
  paid_at?: string;
}

export const SettlementStatusNames: Record<SettlementStatus, string> = {
  draft: '草稿',
  pending: '待审核',
  approved: '已审核',
  paid: '已发放',
  rejected: '已驳回',
};

export const PeriodNames: Record<SettlementPeriod, string> = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
};

export type PiracyStatus = 'suspected' | 'confirmed' | 'processing' | 'resolved' | 'dismissed';

export const PiracyStatusNames: Record<PiracyStatus, string> = {
  suspected: '疑似',
  confirmed: '确认侵权',
  processing: '维权中',
  resolved: '已处理',
  dismissed: '已驳回',
};

export interface PiracyRecord {
  id: string;
  work_id: string;
  work_title: string;
  work_fingerprint: string;
  suspect_title: string;
  suspect_artist: string;
  suspect_platform: string;
  suspect_url: string;
  suspect_fingerprint: string;
  match_score: number;
  match_threshold: number;
  status: PiracyStatus;
  note: string;
  discovered_at: string;
  resolved_at?: string;
}

export interface DashboardSummary {
  period_range: [string, string];
  total_revenue: number;
  revenue_trend: { date: string; revenue: number }[];
  play_ranking: { rank: number; work_id: string; work_title: string; play_count: number; revenue: number }[];
  platform_share: { platform: Platform; name: string; revenue: number; share: number }[];
  artist_ranking: { rank: number; artist_id: string; artist_name: string; revenue: number; play_count: number }[];
  release_stats: { album_count: number; single_count: number; ep_count: number; total_count: number };
}

export interface Paged<T> {
  total: number;
  page: number;
  page_size: number;
  data: T[];
}

export interface RightsLetter {
  id: string;
  piracy_id: string;
  work_id: string;
  work_title: string;
  copyright_owner: string;
  infringer: string;
  infringing_url: string;
  platform: string;
  template_type: string;
  content: string;
  generated_at: string;
  generated_by: string;
}
