const { getStore } = require('../../db/store');
const logger = require('../utils/logger');
const config = require('../../config/config');

class CollusionAnalyzer {
  constructor() {
    this.store = getStore();
    this.riskTypes = {
      HIGH_WIN_RATE: 'high_win_rate',
      PRICE_DEVIATION: 'price_deviation',
      RELATED_BIDDERS: 'related_bidders',
      SIMILAR_SCHEME: 'similar_scheme',
      FREQUENT_BIDDING: 'frequent_bidding',
    };
  }

  analyzeAll(year) {
    const currentYear = year || new Date().getFullYear().toString();
    logger.info(`开始年度串标风险分析，年份: ${currentYear}`, 'Collusion');

    const riskEvents = [];

    riskEvents.push(...this.analyzeWinRate(currentYear));
    riskEvents.push(...this.analyzePriceDeviation(currentYear));
    riskEvents.push(...this.analyzeBidderRelations());
    riskEvents.push(...this.analyzeFrequentBidding(currentYear));

    logger.info(`风险分析完成，共发现 ${riskEvents.length} 个风险事件`, 'Collusion');

    for (const event of riskEvents) {
      this.store.insertRiskEvent(event);
    }

    return riskEvents;
  }

  analyzeWinRate(year) {
    const risks = [];
    const { db } = this.store;

    const purchasers = db.prepare(`
      SELECT DISTINCT p.purchaser
      FROM projects p
      WHERE p.purchaser IS NOT NULL
        AND p.purchaser != ''
        AND strftime('%Y', p.publish_date) = ?
    `).all(year);

    logger.info(`分析 ${purchasers.length} 个采购人的中标率`, 'Collusion');

    for (const { purchaser } of purchasers) {
      const totalProjects = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM projects p
        JOIN bid_results br ON p.project_no = br.project_no
        WHERE p.purchaser = ?
          AND br.is_winner = 1
          AND strftime('%Y', p.publish_date) = ?
      `).get(purchaser, year).cnt;

      if (totalProjects < 5) continue;

      const winnerStats = db.prepare(`
        SELECT br.bidder_name, COUNT(*) as win_count
        FROM bid_results br
        JOIN projects p ON br.project_no = p.project_no
        WHERE p.purchaser = ?
          AND br.is_winner = 1
          AND strftime('%Y', p.publish_date) = ?
        GROUP BY br.bidder_name
        ORDER BY win_count DESC
      `).all(purchaser, year);

      for (const stat of winnerStats) {
        const winRate = stat.win_count / totalProjects;

        if (winRate >= config.analysis.winRateThreshold) {
          const score = this._calculateWinRateScore(winRate, totalProjects);

          if (score >= config.analysis.riskThreshold) {
            const project = db.prepare(`
              SELECT p.*
              FROM projects p
              JOIN bid_results br ON p.project_no = br.project_no
              WHERE p.purchaser = ?
                AND br.bidder_name = ?
                AND br.is_winner = 1
                AND strftime('%Y', p.publish_date) = ?
              ORDER BY p.publish_date DESC
              LIMIT 1
            `).get(purchaser, stat.bidder_name, year);

            risks.push({
              projectId: project?.id,
              projectNo: project?.project_no,
              projectName: project?.project_name,
              riskType: this.riskTypes.HIGH_WIN_RATE,
              riskScore: score,
              riskDetails: {
                purchaser,
                bidderName: stat.bidder_name,
                winCount: stat.win_count,
                totalProjects,
                winRate: winRate.toFixed(4),
                description: `投标人 ${stat.bidder_name} 在采购人 ${purchaser} 处年度中标率达 ${(winRate * 100).toFixed(2)}% (${stat.win_count}/${totalProjects})`,
              },
              status: 'pending',
            });

            logger.risk(`高中标率风险: ${stat.bidder_name} - ${purchaser} - 中标率 ${(winRate * 100).toFixed(2)}%`, 'Collusion');
          }
        }
      }
    }

    return risks;
  }

  _calculateWinRateScore(winRate, totalProjects) {
    let baseScore = 0;

    if (winRate >= 0.9) baseScore = 95;
    else if (winRate >= 0.8) baseScore = 85;
    else if (winRate >= 0.7) baseScore = 75;
    else if (winRate >= 0.6) baseScore = 65;
    else baseScore = 50;

    const sampleBonus = Math.min(totalProjects * 0.5, 10);

    return Math.min(baseScore + sampleBonus, 100);
  }

  analyzePriceDeviation(year) {
    const risks = [];
    const { db } = this.store;

    const winningBids = db.prepare(`
      SELECT br.*, p.project_name, p.purchaser, p.budget
      FROM bid_results br
      JOIN projects p ON br.project_no = p.project_no
      WHERE br.is_winner = 1
        AND p.budget IS NOT NULL
        AND p.budget > 0
        AND br.win_amount IS NOT NULL
        AND br.win_amount > 0
        AND strftime('%Y', p.publish_date) = ?
    `).all(year);

    logger.info(`分析 ${winningBids.length} 个中标项目的价格偏离度`, 'Collusion');

    for (const bid of winningBids) {
      const deviation = bid.win_amount / bid.budget;

      if (deviation >= config.analysis.priceDeviationThreshold) {
        const score = this._calculatePriceDeviationScore(deviation, bid.budget);

        if (score >= config.analysis.riskThreshold) {
          risks.push({
            projectId: bid.project_id,
            projectNo: bid.project_no,
            projectName: bid.project_name,
            riskType: this.riskTypes.PRICE_DEVIATION,
            riskScore: score,
            riskDetails: {
              purchaser: bid.purchaser,
              budget: bid.budget,
              winAmount: bid.win_amount,
              deviationRate: deviation.toFixed(4),
              description: `中标价 ${bid.win_amount} 元，预算 ${bid.budget} 元，偏离度 ${(deviation * 100).toFixed(2)}%，价格异常接近预算上限`,
            },
            status: 'pending',
          });

          logger.risk(`价格偏离风险: ${bid.project_name || bid.project_no} - 偏离度 ${(deviation * 100).toFixed(2)}%`, 'Collusion');
        }
      }
    }

    return risks;
  }

  _calculatePriceDeviationScore(deviation, budget) {
    let baseScore = 0;

    if (deviation >= 0.99) baseScore = 95;
    else if (deviation >= 0.97) baseScore = 85;
    else if (deviation >= 0.95) baseScore = 75;
    else if (deviation >= 0.93) baseScore = 65;
    else baseScore = 50;

    const budgetBonus = budget > 1000000 ? 5 : 0;

    return Math.min(baseScore + budgetBonus, 100);
  }

  analyzeBidderRelations() {
    const risks = [];
    const { db } = this.store;

    const samePhoneGroups = db.prepare(`
      SELECT phone, COUNT(*) as cnt, GROUP_CONCAT(name) as bidders
      FROM bidders
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING cnt >= 2
      ORDER BY cnt DESC
    `).all();

    for (const group of samePhoneGroups) {
      const bidders = group.bidders.split(',');
      if (bidders.length < config.analysis.relatedBidderThreshold) continue;

      const relatedProjects = this._findProjectsWithRelatedBidders(bidders);

      for (const project of relatedProjects) {
        const score = this._calculateRelationScore(bidders.length, relatedProjects.length);

        if (score >= config.analysis.riskThreshold) {
          risks.push({
            projectId: project.id,
            projectNo: project.project_no,
            projectName: project.project_name,
            riskType: this.riskTypes.RELATED_BIDDERS,
            riskScore: score,
            riskDetails: {
              relationType: 'same_phone',
              relationValue: group.phone,
              relatedBidders: bidders,
              relatedProjectsCount: relatedProjects.length,
              description: `发现 ${bidders.length} 家投标人使用相同联系电话 ${group.phone}，涉嫌关联投标`,
            },
            status: 'pending',
          });

          logger.risk(`关联投标人风险: ${project.project_no} - ${bidders.length} 家投标人同电话`, 'Collusion');
        }
      }
    }

    const sameAddressGroups = db.prepare(`
      SELECT address, COUNT(*) as cnt, GROUP_CONCAT(name) as bidders
      FROM bidders
      WHERE address IS NOT NULL AND address != ''
      GROUP BY address
      HAVING cnt >= 2
      ORDER BY cnt DESC
    `).all();

    for (const group of sameAddressGroups) {
      const bidders = group.bidders.split(',');
      if (bidders.length < config.analysis.relatedBidderThreshold) continue;

      const relatedProjects = this._findProjectsWithRelatedBidders(bidders);

      for (const project of relatedProjects) {
        const score = this._calculateRelationScore(bidders.length, relatedProjects.length);

        if (score >= config.analysis.riskThreshold) {
          const existing = risks.find(r =>
            r.projectNo === project.project_no && r.riskType === this.riskTypes.RELATED_BIDDERS
          );

          if (!existing) {
            risks.push({
              projectId: project.id,
              projectNo: project.project_no,
              projectName: project.project_name,
              riskType: this.riskTypes.RELATED_BIDDERS,
              riskScore: score,
              riskDetails: {
                relationType: 'same_address',
                relationValue: group.address,
                relatedBidders: bidders,
                relatedProjectsCount: relatedProjects.length,
                description: `发现 ${bidders.length} 家投标人使用相同注册地址 ${group.address}，涉嫌关联投标`,
              },
              status: 'pending',
            });

            logger.risk(`关联投标人风险: ${project.project_no} - ${bidders.length} 家投标人同地址`, 'Collusion');
          }
        }
      }
    }

    return risks;
  }

  _findProjectsWithRelatedBidders(bidderNames) {
    const { db } = this.store;
    const placeholders = bidderNames.map(() => '?').join(', ');

    return db.prepare(`
      SELECT p.*, COUNT(DISTINCT br.bidder_name) as bidder_count
      FROM projects p
      JOIN bid_results br ON p.project_no = br.project_no
      WHERE br.bidder_name IN (${placeholders})
      GROUP BY p.project_no
      HAVING bidder_count >= 2
      ORDER BY p.publish_date DESC
      LIMIT 20
    `).all(...bidderNames);
  }

  _calculateRelationScore(bidderCount, projectCount) {
    let baseScore = 50;

    if (bidderCount >= 5) baseScore = 90;
    else if (bidderCount >= 4) baseScore = 80;
    else if (bidderCount >= 3) baseScore = 70;
    else baseScore = 60;

    const projectBonus = Math.min(projectCount * 2, 15);

    return Math.min(baseScore + projectBonus, 100);
  }

  analyzeFrequentBidding(year) {
    const risks = [];
    const { db } = this.store;

    const frequentBidders = db.prepare(`
      SELECT br.bidder_name, COUNT(DISTINCT br.project_no) as bid_count,
             SUM(CASE WHEN br.is_winner = 1 THEN 1 ELSE 0 END) as win_count
      FROM bid_results br
      JOIN projects p ON br.project_no = p.project_no
      WHERE strftime('%Y', p.publish_date) = ?
      GROUP BY br.bidder_name
      HAVING bid_count >= 20
      ORDER BY bid_count DESC
      LIMIT 100
    `).all(year);

    logger.info(`分析 ${frequentBidders.length} 个高频投标人`, 'Collusion');

    for (const bidder of frequentBidders) {
      const winRate = bidder.win_count / bidder.bid_count;

      if (bidder.bid_count >= 50 && winRate > 0.3) {
        const score = this._calculateFrequentScore(bidder.bid_count, winRate);

        if (score >= config.analysis.riskThreshold) {
          const project = db.prepare(`
            SELECT p.*
            FROM projects p
            JOIN bid_results br ON p.project_no = br.project_no
            WHERE br.bidder_name = ?
              AND strftime('%Y', p.publish_date) = ?
            ORDER BY p.publish_date DESC
            LIMIT 1
          `).get(bidder.bidder_name, year);

          risks.push({
            projectId: project?.id,
            projectNo: project?.project_no,
            projectName: project?.project_name,
            riskType: this.riskTypes.FREQUENT_BIDDING,
            riskScore: score,
            riskDetails: {
              bidderName: bidder.bidder_name,
              bidCount: bidder.bid_count,
              winCount: bidder.win_count,
              winRate: winRate.toFixed(4),
              description: `投标人 ${bidder.bidder_name} 年度参与投标 ${bidder.bid_count} 次，中标 ${bidder.win_count} 次，投标频率异常`,
            },
            status: 'pending',
          });

          logger.risk(`高频投标风险: ${bidder.bidder_name} - 投标 ${bidder.bid_count} 次`, 'Collusion');
        }
      }
    }

    return risks;
  }

  _calculateFrequentScore(bidCount, winRate) {
    let baseScore = 50;

    if (bidCount >= 100) baseScore = 90;
    else if (bidCount >= 80) baseScore = 80;
    else if (bidCount >= 60) baseScore = 70;
    else if (bidCount >= 40) baseScore = 60;
    else baseScore = 50;

    const winRateBonus = Math.floor(winRate * 20);

    return Math.min(baseScore + winRateBonus, 100);
  }

  analyzeProject(projectNo) {
    const { db } = this.store;
    const project = db.prepare('SELECT * FROM projects WHERE project_no = ?').get(projectNo);

    if (!project) {
      return null;
    }

    const bidders = db.prepare('SELECT * FROM bid_results WHERE project_no = ? ORDER BY rank').all(projectNo);
    const risks = [];

    if (project.budget && bidders.length > 0) {
      const winner = bidders.find(b => b.is_winner);
      if (winner && winner.win_amount) {
        const deviation = winner.win_amount / project.budget;
        if (deviation >= config.analysis.priceDeviationThreshold) {
          risks.push({
            type: this.riskTypes.PRICE_DEVIATION,
            score: this._calculatePriceDeviationScore(deviation, project.budget),
            details: { deviation, budget: project.budget, winAmount: winner.win_amount },
          });
        }
      }
    }

    if (bidders.length >= 2) {
      const similarity = this._analyzeBidSimilarity(bidders);
      if (similarity.score >= config.analysis.riskThreshold) {
        risks.push({
          type: this.riskTypes.SIMILAR_SCHEME,
          score: similarity.score,
          details: similarity.details,
        });
      }
    }

    const totalScore = risks.length > 0
      ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length
      : 0;

    return {
      projectNo,
      projectName: project.project_name,
      totalScore,
      risks,
    };
  }

  _analyzeBidSimilarity(bidders) {
    if (bidders.length < 2) {
      return { score: 0, details: {} };
    }

    const amounts = bidders.map(b => b.bid_amount).filter(a => a && a > 0);
    if (amounts.length < 2) {
      return { score: 0, details: {} };
    }

    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avg;

    let score = 0;
    if (cv < 0.01) score = 90;
    else if (cv < 0.02) score = 80;
    else if (cv < 0.05) score = 60;
    else if (cv < 0.1) score = 40;

    return {
      score,
      details: {
        bidderCount: amounts.length,
        avgAmount: avg,
        standardDeviation: stdDev,
        coefficientOfVariation: cv,
      },
    };
  }

  getBidderRelationGraph(minRelations = 2) {
    const { db } = this.store;

    const phoneRelations = db.prepare(`
      SELECT phone, GROUP_CONCAT(DISTINCT name) as bidders, COUNT(*) as cnt
      FROM bidders
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING cnt >= ?
      ORDER BY cnt DESC
    `).all(minRelations);

    const addressRelations = db.prepare(`
      SELECT address, GROUP_CONCAT(DISTINCT name) as bidders, COUNT(*) as cnt
      FROM bidders
      WHERE address IS NOT NULL AND address != ''
      GROUP BY address
      HAVING cnt >= ?
      ORDER BY cnt DESC
    `).all(minRelations);

    const nodes = new Set();
    const edges = [];

    for (const group of phoneRelations) {
      const bidders = group.bidders.split(',');
      bidders.forEach(b => nodes.add(b));

      for (let i = 0; i < bidders.length; i++) {
        for (let j = i + 1; j < bidders.length; j++) {
          edges.push({
            source: bidders[i],
            target: bidders[j],
            type: 'same_phone',
            value: group.phone,
          });
        }
      }
    }

    for (const group of addressRelations) {
      const bidders = group.bidders.split(',');
      bidders.forEach(b => nodes.add(b));

      for (let i = 0; i < bidders.length; i++) {
        for (let j = i + 1; j < bidders.length; j++) {
          edges.push({
            source: bidders[i],
            target: bidders[j],
            type: 'same_address',
            value: group.address,
          });
        }
      }
    }

    return {
      nodes: [...nodes].map(name => ({ name, group: 1 })),
      edges,
    };
  }

  getStats() {
    const { db } = this.store;

    const totalProjects = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
    const totalBidders = db.prepare('SELECT COUNT(*) as cnt FROM bidders').get().cnt;
    const highRiskCount = db.prepare('SELECT COUNT(*) as cnt FROM risk_events WHERE risk_score >= ?').get(config.analysis.highRiskThreshold).cnt;
    const totalRiskCount = db.prepare('SELECT COUNT(*) as cnt FROM risk_events').get().cnt;

    return {
      totalProjects,
      totalBidders,
      highRiskCount,
      totalRiskCount,
    };
  }
}

let analyzerInstance = null;

function getCollusionAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new CollusionAnalyzer();
  }
  return analyzerInstance;
}

module.exports = {
  CollusionAnalyzer,
  getCollusionAnalyzer,
};
