import api from '@/api/index';
import type { Member, PageResult, MemberRole, WatchlistEntry } from '@/types';

export async function listMembers(
  params?: Record<string, unknown>,
): Promise<PageResult<Member>> {
  const { data } = await api.get<PageResult<Member>>('/members', { params });
  return data;
}

export async function getMember(id: number): Promise<Member> {
  const { data } = await api.get<Member>(`/members/${id}`);
  return data;
}

export async function createMember(
  data: Partial<Member>,
): Promise<Member> {
  const resp = await api.post<Member>('/members', data);
  return resp.data;
}

export async function updateMember(
  id: number,
  data: Partial<Member>,
): Promise<Member> {
  const resp = await api.put<Member>(`/members/${id}`, data);
  return resp.data;
}

export async function updateRole(
  id: number,
  role: MemberRole,
): Promise<Member> {
  const resp = await api.put<Member>(`/members/${id}`, { role });
  return resp.data;
}

export async function listWatchlist(): Promise<WatchlistEntry[]> {
  const { data } = await api.get<WatchlistEntry[]>('/members/watchlist');
  return data;
}

export async function addToWatchlist(
  id: number,
  reason: string,
  days?: number,
): Promise<WatchlistEntry> {
  const resp = await api.post<WatchlistEntry>(`/members/${id}/watchlist`, {
    reason,
    days,
  });
  return resp.data;
}

export async function removeFromWatchlist(id: number): Promise<void> {
  await api.delete(`/members/${id}/watchlist`);
}
