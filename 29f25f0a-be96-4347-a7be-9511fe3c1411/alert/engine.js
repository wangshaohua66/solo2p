const { alerts, rateSnapshots, spaceStatus, surchargeChanges, taskLogs } = require('../store/db');
const { alertConfig } = require('../config/carriers');
const logger = require('../utils/logger');

class AlertEngine {
  constructor(options = {}) {
    this.config = { ...alertConfig, ...options };
  }

  runAllChecks() {
    logger.info('开始执行预警检查');
    
    const results = {
      priceAlerts: 0,
      spaceAlerts: 0,
      surchargeAlerts: 0,
      loginAlerts: 0,
      totalAlerts: 0
    };

    const priceResults = this.checkPriceFluctuations();
    results.priceAlerts = priceResults.created;
    
    const spaceResults = this.checkSpaceAvailability();
    results.spaceAlerts = spaceResults.created;
    
    const surchargeResults = this.checkSurchargeChanges();
    results.surchargeAlerts = surchargeResults.created;
    
    const loginResults = this.checkLoginFailures();
    results.loginAlerts = loginResults.created;
    
    results.totalAlerts = results.priceAlerts + results.spaceAlerts + results.surchargeAlerts + results.loginAlerts;
    
    logger.info(`预警检查完成，新增 ${results.totalAlerts} 条预警`);
    return results;
  }

  checkPriceFluctuations() {
    logger.debug('检查运价波动');
    let createdCount = 0;

    const latestRates = rateSnapshots.getAllLatest(500);
    const checkedRoutes = new Set();

    for (const rate of latestRates) {
      const routeKey = `${rate.carrier_id}:${rate.port_from}:${rate.port_to}:${rate.container_type}`;
      
      if (checkedRoutes.has(routeKey)) continue;
      checkedRoutes.add(routeKey);

      const avgData = rateSnapshots.getAverageByRoute(
        rate.port_from,
        rate.port_to,
        rate.container_type,
        this.config.checkPeriodDays
      );

      if (avgData && avgData.avg_rate && avgData.count >= 3) {
        const threshold = this._getPriceThreshold(rate.container_type);
        const changePercent = (rate.total_rate - avgData.avg_rate) / avgData.avg_rate;

        if (changePercent >= threshold) {
          const severity = changePercent >= this.config.surgePriceMultiplier - 1 ? 'critical' : 'warning';
          
          const existing = alerts.checkExists(
            'price_surge',
            rate.carrier_id,
            rate.port_from,
            rate.port_to,
            rate.container_type
          );

          if (!existing) {
            const alertId = alerts.create({
              alert_type: 'price_surge',
              severity,
              carrier_id: rate.carrier_id,
              carrier_name: rate.carrier_name,
              port_from: rate.port_from,
              port_to: rate.port_to,
              container_type: rate.container_type,
              title: `运价上涨预警: ${rate.carrier_name} ${rate.port_from}-${rate.port_to}`,
              message: `${rate.container_type} 箱型运价较30日均值上涨 ${(changePercent * 100).toFixed(1)}%，当前 ${rate.total_rate} ${rate.currency}，30日均值 ${avgData.avg_rate.toFixed(2)} ${rate.currency}`,
              previous_value: avgData.avg_rate,
              current_value: rate.total_rate,
              threshold: threshold,
              status: 'active',
              metadata: JSON.stringify({ avg_count: avgData.count })
            });
            
            createdCount++;
            logger.warn(`运价预警: ${rate.carrier_name} ${rate.port_from}->${rate.port_to} ${rate.container_type} 涨幅 ${(changePercent * 100).toFixed(1)}%`);
          }
        }
      }
    }

    return { created: createdCount };
  }

  checkSpaceAvailability() {
    logger.debug('检查舱位可用性');
    let createdCount = 0;

    const allCarriers = new Set();
    const latestRates = rateSnapshots.getAllLatest(100);
    
    for (const rate of latestRates) {
      allCarriers.add(rate.carrier_id);
    }

    const routes = new Set();
    for (const rate of latestRates) {
      routes.add(`${rate.port_from}:${rate.port_to}:${rate.container_type}`);
    }

    for (const routeKey of routes) {
      const [portFrom, portTo, containerType] = routeKey.split(':');
      const spaces = spaceStatus.getByRoute(portFrom, portTo, containerType);

      for (const space of spaces) {
        const threshold = this._getSpaceThreshold(containerType);
        
        if (space.available_count !== null && space.available_count < threshold) {
          const existing = alerts.checkExists(
            'space_shortage',
            space.carrier_id,
            portFrom,
            portTo,
            containerType
          );

          if (!existing) {
            const severity = space.available_count === 0 ? 'critical' : 'warning';
            
            alerts.create({
              alert_type: 'space_shortage',
              severity,
              carrier_id: space.carrier_id,
              carrier_name: space.carrier_name,
              port_from: portFrom,
              port_to: portTo,
              container_type: containerType,
              title: `舱位紧张预警: ${space.carrier_name} ${portFrom}-${portTo}`,
              message: `${containerType} 箱型可用舱位 ${space.available_count} TEU，低于安全阈值 ${threshold} TEU`,
              previous_value: null,
              current_value: space.available_count,
              threshold,
              status: 'active',
              metadata: JSON.stringify({ status: space.status })
            });
            
            createdCount++;
            logger.warn(`舱位预警: ${space.carrier_name} ${portFrom}->${portTo} ${containerType} 可用 ${space.available_count}`);
          }
        }
      }
    }

    return { created: createdCount };
  }

  checkSurchargeChanges() {
    logger.debug('检查附加费变更');
    let createdCount = 0;

    const recentChanges = surchargeChanges.getRecent(7);

    for (const change of recentChanges) {
      if (change.change_type === 'increase' || change.previous_amount !== null) {
        const existing = alerts.checkExists(
          'surcharge_change',
          change.carrier_id,
          null,
          null,
          null
        );

        if (!existing) {
          const amount = change.new_amount || 0;
          const prev = change.previous_amount || 0;
          const changePct = prev > 0 ? ((amount - prev) / prev * 100) : 0;
          
          alerts.create({
            alert_type: 'surcharge_change',
            severity: changePct > 20 ? 'warning' : 'info',
            carrier_id: change.carrier_id,
            carrier_name: change.carrier_name,
            port_from: null,
            port_to: null,
            container_type: null,
            title: `附加费变更: ${change.carrier_name} ${change.surcharge_name}`,
            message: `${change.surcharge_name} (${change.surcharge_code}) 调整为 ${amount} ${change.currency}，生效日期: ${change.effective_date || '未知'}`,
            previous_value: prev,
            current_value: amount,
            threshold: null,
            status: 'active',
            metadata: JSON.stringify({ change_type: change.change_type, effective_date: change.effective_date })
          });
          
          createdCount++;
          logger.info(`附加费预警: ${change.carrier_name} ${change.surcharge_name}`);
        }
      }
    }

    return { created: createdCount };
  }

  checkLoginFailures() {
    logger.debug('检查登录失败情况');
    let createdCount = 0;

    const stats = taskLogs.getStatsByCarrier();
    
    for (const stat of stats) {
      if (stat.failed_count > 0) {
        const recentLogs = taskLogs.getByCarrier(stat.carrier_id, 10);
        const failedLogs = recentLogs.filter(log => log.status === 'failed' && log.error_message);
        
        for (const log of failedLogs) {
          const errorMsg = log.error_message || '';
          const needsCaptcha = errorMsg.includes('验证码') || 
                              errorMsg.includes('captcha') || 
                              errorMsg.includes('CAPTCHA') ||
                              errorMsg.includes('verification');
          
          const existing = alerts.checkExists(
            needsCaptcha ? 'captcha_required' : 'login_failure',
            stat.carrier_id,
            null,
            null,
            null
          );

          if (!existing) {
            const alertType = needsCaptcha ? 'captcha_required' : 'login_failure';
            const severity = needsCaptcha ? 'warning' : 'info';
            const title = needsCaptcha 
              ? `需要验证码: ${stat.carrier_name}`
              : `登录失败: ${stat.carrier_name}`;
            const message = needsCaptcha
              ? `${stat.carrier_name} 登录需要验证码验证，请配置 OCR 回调接口或手动处理`
              : `${stat.carrier_name} 最近24小时登录失败 ${stat.failed_count} 次，请检查凭据或网络连接`;
            
            alerts.create({
              alert_type: alertType,
              severity,
              carrier_id: stat.carrier_id,
              carrier_name: stat.carrier_name,
              port_from: null,
              port_to: null,
              container_type: null,
              title,
              message,
              previous_value: null,
              current_value: stat.failed_count,
              threshold: 1,
              status: 'active',
              metadata: JSON.stringify({ 
                last_error: errorMsg,
                failed_count: stat.failed_count,
                success_count: stat.success_count,
                last_run: stat.last_run,
                needs_captcha: needsCaptcha
              })
            });
            
            createdCount++;
            logger.warn(`登录预警: ${title}`);
          }
        }
      }
    }

    return { created: createdCount };
  }

  _getPriceThreshold(containerType) {
    const defaults = this.config.defaultThresholds;
    if (defaults[containerType] && defaults[containerType].priceIncrease) {
      return defaults[containerType].priceIncrease;
    }
    return this.config.priceIncreaseThreshold;
  }

  _getSpaceThreshold(containerType) {
    const defaults = this.config.defaultThresholds;
    if (defaults[containerType] && defaults[containerType].spaceMin) {
      return defaults[containerType].spaceMin;
    }
    return this.config.spaceAvailabilityThreshold;
  }

  getActiveAlerts(limit = 50) {
    return alerts.getActive(limit);
  }

  getAlertsByType(type, limit = 50) {
    return alerts.getByType(type, limit);
  }

  getRecentAlerts(days = 7) {
    return alerts.getRecent(days);
  }

  resolveAlert(id) {
    return alerts.resolve(id);
  }
}

module.exports = AlertEngine;
