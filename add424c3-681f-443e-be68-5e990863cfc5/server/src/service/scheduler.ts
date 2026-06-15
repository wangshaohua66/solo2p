import { Disorder, RoadSection, ConstructionTeam, WorkOrder, TrackPoint, TeamRecommendation } from '@/types';

const TYPE_SCORE: Record<string, number> = {
  crack: 60,
  pothole: 90,
  bridge_jump: 85,
  rutting: 50,
  other: 40
};

const SEVERITY_SCORE: Record<string, number> = {
  mild: 30,
  moderate: 60,
  severe: 85,
  critical: 100
};

const ROAD_LEVEL_SCORE: Record<string, number> = {
  '国道': 100,
  '省道': 80,
  '县道': 60,
  '乡道': 40
};

const TYPE_WEIGHT = 0.30;
const SEVERITY_WEIGHT = 0.35;
const ROAD_LEVEL_WEIGHT = 0.35;

export function calculatePriorityScore(disorder: Disorder, roadSection?: RoadSection): number {
  const typeScore = TYPE_SCORE[disorder.type] || 40;
  const severityScore = SEVERITY_SCORE[disorder.severity] || 30;
  const roadLevelScore = roadSection ? (ROAD_LEVEL_SCORE[roadSection.level] || 40) : 40;

  const score = typeScore * TYPE_WEIGHT + severityScore * SEVERITY_WEIGHT + roadLevelScore * ROAD_LEVEL_WEIGHT;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function calculateDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function recommendTeams(
  disorder: Disorder,
  teams: ConstructionTeam[],
  workOrders: WorkOrder[]
): TeamRecommendation[] {
  const teamBaseLocation = { lat: 39.9042, lng: 116.4074 };

  const scoredTeams = teams.map(team => {
    const activeOrders = workOrders.filter(
      wo => wo.teamId === team.id && ['assigned', 'repairing', 'accepting'].includes(wo.status)
    );
    const loadRatio = activeOrders.length / Math.max(1, team.memberCount / 4);
    const loadScore = Math.max(0, 100 - loadRatio * 50);

    const distance = calculateDistance(
      disorder.location.lng,
      disorder.location.lat,
      teamBaseLocation.lng,
      teamBaseLocation.lat
    );
    const maxDistance = 50000;
    const distanceScore = Math.max(0, 100 - (distance / maxDistance) * 100);

    const hasSkill = team.skills.includes(disorder.type);
    const skillScore = hasSkill ? 100 : (team.skills.length >= 4 ? 60 : 30);

    const matchScore = loadScore * 0.4 + distanceScore * 0.35 + skillScore * 0.25;

    const reasons: string[] = [];
    if (loadScore >= 80) reasons.push('施工负载低');
    else if (loadScore >= 50) reasons.push('施工负载适中');
    else reasons.push('施工负载较高');

    if (distance < 5000) reasons.push('距离病害点近');
    else if (distance < 20000) reasons.push('距离适中');
    else reasons.push('距离较远');

    if (hasSkill) reasons.push('专业匹配度高');
    else reasons.push('可处理但非专长');

    const estimatedDuration = Math.round((TYPE_SCORE[disorder.type] || 40) / 10 + (SEVERITY_SCORE[disorder.severity] || 30) / 10);

    return {
      teamId: team.id,
      teamName: team.name,
      matchScore: Math.round(matchScore),
      reason: reasons.join('、'),
      estimatedDuration
    };
  });

  return scoredTeams.sort((a, b) => b.matchScore - a.matchScore);
}

export interface TimeoutAlert {
  workOrderId: string;
  disorderId: string;
  title: string;
  alertType: 'assign_timeout' | 'repair_timeout';
  message: string;
  overdueHours: number;
  createdAt: string;
}

export function checkTimeoutWorkOrders(workOrders: WorkOrder[]): TimeoutAlert[] {
  const alerts: TimeoutAlert[] = [];
  const now = Date.now();
  const ASSIGN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
  const REPAIR_TIMEOUT_MS = 72 * 60 * 60 * 1000;

  for (const wo of workOrders) {
    const createdAt = new Date(wo.createdAt).getTime();

    if (wo.status === 'pending') {
      const elapsed = now - createdAt;
      if (elapsed > ASSIGN_TIMEOUT_MS) {
        alerts.push({
          workOrderId: wo.id,
          disorderId: wo.disorderId,
          title: wo.title,
          alertType: 'assign_timeout',
          message: `工单派单超时，已超过24小时未接收`,
          overdueHours: Math.round((elapsed - ASSIGN_TIMEOUT_MS) / 3600000),
          createdAt: new Date(now).toISOString()
        });
      }
    }

    if (wo.status === 'assigned' || wo.status === 'repairing') {
      const elapsed = now - createdAt;
      if (elapsed > REPAIR_TIMEOUT_MS) {
        alerts.push({
          workOrderId: wo.id,
          disorderId: wo.disorderId,
          title: wo.title,
          alertType: 'repair_timeout',
          message: `工单修复超时，已超过72小时未完成`,
          overdueHours: Math.round((elapsed - REPAIR_TIMEOUT_MS) / 3600000),
          createdAt: new Date(now).toISOString()
        });
      }
    }
  }

  return alerts;
}

export function calculateCoverage(
  tracks: TrackPoint[],
  roadSections: RoadSection[]
): {
  coveredSectionIds: string[];
  totalLength: number;
  coveredLength: number;
  coverageRate: number;
} {
  const totalLength = roadSections.reduce((sum, rs) => sum + rs.length, 0);

  const coveredSectionIds: string[] = [];
  const sectionCoverage = new Map<string, number>();

  for (const rs of roadSections) {
    sectionCoverage.set(rs.id, 0);
  }

  for (const track of tracks) {
    for (const rs of roadSections) {
      const sectionCenter = {
        lat: 39.9042 + (parseInt(rs.id.replace('road-', '')) % 5) * 0.01,
        lng: 116.4074 + (parseInt(rs.id.replace('road-', '')) % 5) * 0.01
      };
      const dist = calculateDistance(
        track.lng,
        track.lat,
        sectionCenter.lng,
        sectionCenter.lat
      );

      if (dist < 500) {
        const current = sectionCoverage.get(rs.id) || 0;
        sectionCoverage.set(rs.id, current + 1);
        if (!coveredSectionIds.includes(rs.id)) {
          coveredSectionIds.push(rs.id);
        }
      }
    }
  }

  let coveredLength = 0;
  for (const [sectionId, pointCount] of sectionCoverage.entries()) {
    if (pointCount > 0) {
      const rs = roadSections.find(r => r.id === sectionId);
      if (rs) {
        const coverageRatio = Math.min(1, pointCount / 50);
        coveredLength += rs.length * coverageRatio;
      }
    }
  }

  const coverageRate = totalLength > 0 ? coveredLength / totalLength : 0;

  return {
    coveredSectionIds,
    totalLength,
    coveredLength: Math.round(coveredLength * 100) / 100,
    coverageRate: Math.round(coverageRate * 10000) / 100
  };
}
