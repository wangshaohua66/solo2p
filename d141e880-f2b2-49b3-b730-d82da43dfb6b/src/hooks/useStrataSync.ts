import { useMemo } from 'react';
import { Stratum, ComparisonResult, AlignedStratum, StratumDifference } from '@/types';
import { useSiteStore } from '@/stores/siteStore';
import { useArtifactStore } from '@/stores/artifactStore';

const PERIOD_ORDER = [
  '旧石器时代',
  '新石器时代',
  '青铜时代',
  '铁器时代',
  '汉代',
  '唐代',
  '宋代',
  '明代',
  '清代',
  '近现代',
  '未知',
];

export const useStrataSync = (siteIds: string[], alignBy: 'period' | 'depth' | 'layer' = 'period') => {
  const alignmentMethod = alignBy;
  const getSiteById = useSiteStore((state) => state.getSiteById);
  const getStrataByGrid = useArtifactStore((state) => state.getStrataByGrid);
  const grids = useSiteStore((state) => state.grids);
  const strata = useArtifactStore((state) => state.strata);

  const results = useMemo(() => {
    if (siteIds.length < 2) return [];

    const siteResults: ComparisonResult[] = [];

    for (const siteId of siteIds) {
      const site = getSiteById(siteId);
      if (!site) continue;

      const siteGrids = grids.filter((g) => g.siteId === siteId);
      const allStrata: Stratum[] = [];

      for (const grid of siteGrids) {
        const gridStrata = getStrataByGrid(grid.id);
        allStrata.push(...gridStrata);
      }

      const uniqueStrata = allStrata.reduce((acc, curr) => {
        const existing = acc.find((s) => s.layerIndex === curr.layerIndex && s.period === curr.period);
        if (!existing) {
          acc.push(curr);
        }
        return acc;
      }, [] as Stratum[]);

      const sortedStrata = uniqueStrata.sort((a, b) => {
        if (alignmentMethod === 'period') {
          return PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period);
        } else if (alignmentMethod === 'depth') {
          return a.depthTop - b.depthTop;
        } else {
          return a.layerIndex - b.layerIndex;
        }
      });

      const alignmentOffsets: Record<string, number> = {};
      sortedStrata.forEach((s, index) => {
        alignmentOffsets[s.id] = index * 0.5;
      });

      const differences: string[] = [];
      const periodGroups = sortedStrata.reduce((acc, s) => {
        acc[s.period] = (acc[s.period] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      for (const [period, count] of Object.entries(periodGroups)) {
        if (count > 1) {
          differences.push(`年代"${period}"存在${count}层叠压，可能存在分期争议`);
        }
      }

      const totalThickness = sortedStrata.reduce((sum, s) => sum + s.thickness, 0);
      const consistencyScore = Math.max(
        0,
        100 - differences.length * 15 - (totalThickness > 10 ? 10 : 0)
      );

      siteResults.push({
        siteId,
        siteName: site.name,
        strata: sortedStrata,
        alignmentOffsets,
        consistencyScore,
        differences,
      });
    }

    if (siteResults.length >= 2 && alignmentMethod === 'period') {
      const referencePeriods = new Set(siteResults[0].strata.map((s) => s.period));
      for (let i = 1; i < siteResults.length; i++) {
        const currentPeriods = new Set(siteResults[i].strata.map((s) => s.period));
        const missingPeriods = [...referencePeriods].filter((p) => !currentPeriods.has(p));
        const extraPeriods = [...currentPeriods].filter((p) => !referencePeriods.has(p));

        if (missingPeriods.length > 0) {
          siteResults[i].differences.push(
            `缺失年代层: ${missingPeriods.join(', ')}`
          );
          siteResults[i].consistencyScore -= missingPeriods.length * 10;
        }
        if (extraPeriods.length > 0) {
          siteResults[i].differences.push(
            `多出年代层: ${extraPeriods.join(', ')}`
          );
          siteResults[i].consistencyScore -= extraPeriods.length * 5;
        }
      }
    }

    return siteResults.map((r) => ({
      ...r,
      consistencyScore: Math.max(0, Math.min(100, r.consistencyScore)),
    }));
  }, [siteIds, alignmentMethod, grids, strata, getSiteById, getStrataByGrid]);

  const overallConsistency = useMemo(() => {
    if (results.length === 0) return 0;
    return Math.round(
      results.reduce((sum, r) => sum + r.consistencyScore, 0) / results.length
    );
  }, [results]);

  const alignedStrataComparison = useMemo(() => {
    if (results.length < 2) return [];

    const allPeriods = new Set<string>();
    results.forEach((r) => {
      r.strata.forEach((s) => allPeriods.add(s.period));
    });

    const comparison = [...allPeriods].map((period) => {
      const row: { period: string; sites: Record<string, Stratum | null> } = {
        period,
        sites: {},
      };
      results.forEach((r) => {
        const stratum = r.strata.find((s) => s.period === period) || null;
        row.sites[r.siteId] = stratum;
      });
      return row;
    });

    return comparison.sort(
      (a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
    );
  }, [results]);

  const alignedStrata = useMemo((): AlignedStratum[] => {
    return alignedStrataComparison.map((asc) => {
      const thicknessValues = Object.values(asc.sites)
        .filter(Boolean)
        .map((s) => s!.thickness);
      const avgThickness =
        thicknessValues.length > 0
          ? thicknessValues.reduce((a, b) => a + b, 0) / thicknessValues.length
          : 0;

      const sitesWithStratum = Object.values(asc.sites).filter(Boolean).length;
      const consistency =
        siteIds.length > 0 ? (sitesWithStratum / siteIds.length) * 100 : 0;

      return {
        period: asc.period,
        sites: asc.sites,
        thickness: avgThickness,
        consistency,
      };
    });
  }, [alignedStrataComparison, siteIds.length]);

  const differences = useMemo((): StratumDifference[] => {
    const diffs: StratumDifference[] = [];

    alignedStrata.forEach((aligned) => {
      const siteStrata = Object.values(aligned.sites).filter(Boolean) as Stratum[];

      if (siteStrata.length < siteIds.length && siteStrata.length > 0) {
        const missingSites = Object.entries(aligned.sites)
          .filter(([_, s]) => !s)
          .map(([siteId]) => {
            const site = useSiteStore.getState().getSiteById(siteId);
            return site?.name || siteId;
          });

        diffs.push({
          period: aligned.period,
          type: 'missing',
          severity: missingSites.length === siteIds.length - 1 ? 'high' : 'medium',
          description: `${missingSites.join('、')} 缺失该年代地层`,
        });
      }

      if (siteStrata.length >= 2) {
        const thicknesses = siteStrata.map((s) => s.thickness);
        const maxThick = Math.max(...thicknesses);
        const minThick = Math.min(...thicknesses);
        const thicknessRatio = maxThick / minThick;

        if (thicknessRatio > 2) {
          diffs.push({
            period: aligned.period,
            type: 'thickness',
            severity: thicknessRatio > 3 ? 'high' : 'medium',
            description: `地层厚度差异显著 (${minThick}m - ${maxThick}m)`,
          });
        }

        const soilTypes = new Set(siteStrata.map((s) => s.soilType));
        if (soilTypes.size > 1) {
          diffs.push({
            period: aligned.period,
            type: 'soil',
            severity: 'low',
            description: `土质描述存在差异: ${Array.from(soilTypes).join('、')}`,
          });
        }
      }
    });

    return diffs;
  }, [alignedStrata, siteIds.length]);

  const comparisonResult = {
    results,
    overallConsistency,
    alignedStrataComparison,
    periodOrder: PERIOD_ORDER,
  };

  return {
    comparisonResult,
    alignedStrata,
    consistencyScore: overallConsistency,
    differences,
  };
};

export const useGridProgress = (siteId: string) => {
  const getGridsBySite = useSiteStore((state) => state.getGridsBySite);
  const grids = getGridsBySite(siteId);

  return useMemo(() => {
    const total = grids.length;
    const completed = grids.filter((g) => g.status === 'completed').length;
    const excavating = grids.filter((g) => g.status === 'excavating').length;
    const unexcavated = grids.filter((g) => g.status === 'unexcavated').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      excavating,
      unexcavated,
      progress,
    };
  }, [grids]);
};

export const useArtifactSearch = (
  keyword: string,
  filters?: {
    category?: string;
    siteId?: string;
    period?: string;
    condition?: string;
    startDate?: Date;
    endDate?: Date;
  }
) => {
  const searchArtifacts = useArtifactStore((state) => state.searchArtifacts);

  return useMemo(() => {
    const startTime = performance.now();
    const results = searchArtifacts({
      keyword,
      ...filters,
    });
    const duration = performance.now() - startTime;

    if (duration > 300) {
      console.warn(`Search performance warning: ${duration.toFixed(2)}ms for ${results.length} results`);
    }

    return { searchResults: results, searchTime: duration };
  }, [searchArtifacts, keyword, filters]);
};
