import type { Member, PageResult, MemberRole, WatchlistEntry } from '@/types';
import { mockMembers, mockWatchlist } from '@/mocks';
import { delay } from '@/api/index';

export async function listMembers(
  params?: Record<string, unknown>,
): Promise<PageResult<Member>> {
  await delay(300);
  return Promise.resolve({
    content: mockMembers,
    totalElements: mockMembers.length,
    totalPages: 1,
    size: 20,
    number: 0,
  });
}

export async function createMember(
  data: Partial<Member>,
): Promise<Member> {
  await delay(300);
  const newMember: Member = {
    id: Date.now(),
    username: data.username ?? '',
    realName: data.realName ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    role: data.role ?? 'STUDENT',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return Promise.resolve(newMember);
}

export async function updateMember(
  id: number,
  data: Partial<Member>,
): Promise<Member> {
  await delay(300);
  const existing = mockMembers.find((m) => m.id === id);
  return Promise.resolve({
    ...(existing ?? mockMembers[0]),
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  } as Member);
}

export async function updateRole(
  id: number,
  role: MemberRole,
): Promise<Member> {
  await delay(300);
  const existing = mockMembers.find((m) => m.id === id);
  return Promise.resolve({
    ...(existing ?? mockMembers[0]),
    id,
    role,
    updatedAt: new Date().toISOString(),
  } as Member);
}

export async function listWatchlist(): Promise<WatchlistEntry[]> {
  await delay(300);
  return Promise.resolve(mockWatchlist);
}

export async function addToWatchlist(
  id: number,
  reason: string,
): Promise<WatchlistEntry> {
  await delay(300);
  const existing = mockMembers.find((m) => m.id === id);
  return Promise.resolve({
    id: Date.now(),
    memberId: id,
    memberName: existing?.realName ?? '',
    reason,
    incidentId: null,
    watchUntil: new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  });
}

export async function removeFromWatchlist(id: number): Promise<void> {
  await delay(300);
  return Promise.resolve();
}
