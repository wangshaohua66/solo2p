import Router from '@koa/router';
import { v4 as uuidv4 } from 'uuid';
import { mockTrackPoints, mockRoadSections, mockCoverageStats } from '@/mock/data';
import { TrackPoint, CoverageStats } from '@/types';
import { redisClient } from '@/redis/client';
import { publish, CHANNEL_PATROL_TRACK } from '@/redis/pubsub';
import { calculateCoverage } from '@/service/scheduler';
import { validateReportTrack } from '@/validator/disorder';
import { inMemoryDisorders, inMemoryWorkOrders } from './disorder';

const router = new Router();

const inMemoryTrackPoints: Map<string, TrackPoint[]> = new Map();
const inMemoryCoverageStats: CoverageStats[] = [...mockCoverageStats];

mockTrackPoints.forEach(tp => {
  const key = 'patrol-default';
  if (!inMemoryTrackPoints.has(key)) {
    inMemoryTrackPoints.set(key, []);
  }
  inMemoryTrackPoints.get(key)!.push(tp);
});

router.post('/api/patrol/track', validateReportTrack, async (ctx) => {
  const body = ctx.request.body as any;

  const now = body.timestamp || new Date().toISOString();
  const trackPoint: TrackPoint = {
    id: `tp-${uuidv4().slice(0, 8)}`,
    inspectorId: body.inspectorId,
    inspectorName: body.inspectorName,
    lat: body.lat,
    lng: body.lng,
    timestamp: now,
    speed: body.speed,
    accuracy: body.accuracy
  };

  const patrolId = body.patrolId;
  if (!inMemoryTrackPoints.has(patrolId)) {
    inMemoryTrackPoints.set(patrolId, []);
  }
  inMemoryTrackPoints.get(patrolId)!.push(trackPoint);

  try {
    await redisClient.geoadd(
      'patrol:tracks:geo',
      body.lng,
      body.lat,
      `${patrolId}:${trackPoint.id}`
    );
  } catch (e) {
  }

  await redisClient.lpush(`patrol:tracks:${patrolId}`, JSON.stringify(trackPoint));
  await redisClient.expire(`patrol:tracks:${patrolId}`, 86400 * 7);

  await publish(CHANNEL_PATROL_TRACK, {
    patrolId,
    data: trackPoint,
    timestamp: now
  });

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: '轨迹上报成功',
    data: trackPoint,
    timestamp: Date.now()
  };
});

router.get('/api/patrol/tracks/:patrolId', async (ctx) => {
  const { patrolId } = ctx.params;

  const cachedTracks = await redisClient.lrange(`patrol:tracks:${patrolId}`, 0, -1);
  let tracks: TrackPoint[] = [];

  if (cachedTracks && cachedTracks.length > 0) {
    tracks = cachedTracks.map(t => JSON.parse(t)).reverse();
  } else {
    tracks = inMemoryTrackPoints.get(patrolId) || [];
  }

  tracks.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: {
      patrolId,
      points: tracks
    },
    timestamp: Date.now()
  };
});

router.get('/api/patrol/coverage', async (ctx) => {
  let allTracks: TrackPoint[] = [];
  for (const tracks of inMemoryTrackPoints.values()) {
    allTracks = allTracks.concat(tracks);
  }

  const coverage = calculateCoverage(allTracks, mockRoadSections);

  const today = new Date().toISOString().split('T')[0];
  let todayStats = inMemoryCoverageStats.find(s => s.date === today);
  if (!todayStats) {
    todayStats = {
      date: today,
      inspectorId: 'user-001',
      inspectorName: '张巡查',
      roadSectionIds: coverage.coveredSectionIds,
      totalMileage: coverage.totalLength,
      effectiveMileage: coverage.coveredLength,
      repeatedMileage: Math.max(0, coverage.coveredLength * 0.1),
      workHours: 8,
      pointCount: allTracks.length
    };
  }

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: {
      ...coverage,
      todayStats,
      history: inMemoryCoverageStats
    },
    timestamp: Date.now()
  };
});

router.get('/api/stats/overview', async (ctx) => {
  const totalDisorders = inMemoryDisorders.length;
  const pendingDisorders = inMemoryDisorders.filter(d => d.status === 'reported' || d.status === 'graded').length;
  const processingDisorders = inMemoryDisorders.filter(d => d.status === 'assigned' || d.status === 'repairing' || d.status === 'accepting').length;
  const completedDisorders = inMemoryDisorders.filter(d => d.status === 'closed').length;
  const totalWorkOrders = inMemoryWorkOrders.length;

  const closedWorkOrders = inMemoryWorkOrders.filter(
    wo => wo.status === 'closed' && wo.acceptedAt
  );
  let avgRepairHours = 0;
  if (closedWorkOrders.length > 0) {
    const totalHours = closedWorkOrders.reduce((sum, wo) => {
      const start = new Date(wo.createdAt).getTime();
      const end = new Date(wo.acceptedAt!).getTime();
      return sum + (end - start) / 3600000;
    }, 0);
    avgRepairHours = Math.round((totalHours / closedWorkOrders.length) * 10) / 10;
  }

  let allTracks: TrackPoint[] = [];
  for (const tracks of inMemoryTrackPoints.values()) {
    allTracks = allTracks.concat(tracks);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayTracks = allTracks.filter(t => new Date(t.timestamp).getTime() >= todayStart);
  const todayCoverage = calculateCoverage(todayTracks, mockRoadSections).coverageRate;

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const weekTracks = allTracks.filter(t => new Date(t.timestamp).getTime() >= weekStart);
  const weekCoverage = calculateCoverage(weekTracks, mockRoadSections).coverageRate;

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: {
      totalDisorders,
      pendingDisorders,
      processingDisorders,
      completedDisorders,
      totalWorkOrders,
      todayCoverage,
      weekCoverage,
      avgRepairHours
    },
    timestamp: Date.now()
  };
});

router.get('/api/stats/trend', async (ctx) => {
  const days = parseInt((ctx.query.days as string) || '7', 10);
  const result: { date: string; discovered: number; repaired: number }[] = [];

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayStart = new Date(dateStr).getTime();
    const dayEnd = dayStart + 86400000;

    const discovered = inMemoryDisorders.filter(d => {
      const t = new Date(d.createdAt).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;

    const repaired = inMemoryWorkOrders.filter(wo => {
      if (wo.status !== 'closed' || !wo.acceptedAt) return false;
      const t = new Date(wo.acceptedAt).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;

    result.push({
      date: dateStr,
      discovered,
      repaired
    });
  }

  ctx.status = 200;
  ctx.body = {
    code: 200,
    message: 'success',
    data: result,
    timestamp: Date.now()
  };
});

export default router;
export { inMemoryTrackPoints, inMemoryCoverageStats };
