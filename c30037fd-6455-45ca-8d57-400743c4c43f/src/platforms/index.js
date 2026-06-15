'use strict';

const NMPACollector = require('./nmpaCollector');
const ProvincialSamplingCollector = require('./provincialSamplingCollector');
const ProvincialProcurementCollector = require('./provincialProcurementCollector');
const ADRMonitorCollector = require('./adrMonitorCollector');
const JiangsuApprovalCollector = require('./jiangsuApprovalCollector');
const ZhejiangApprovalCollector = require('./zhejiangApprovalCollector');
const ShanghaiApprovalCollector = require('./shanghaiApprovalCollector');
const AnhuiApprovalCollector = require('./anhuiApprovalCollector');
const BasePlatformCollector = require('./basePlatform');

const PLATFORM_CLASS_MAP = {
  nmpa: NMPACollector,
  provincial_sampling: ProvincialSamplingCollector,
  provincial_procurement: ProvincialProcurementCollector,
  adr_monitor: ADRMonitorCollector,
  east_jiangsu_approval: JiangsuApprovalCollector,
  east_zhejiang_approval: ZhejiangApprovalCollector,
  east_shanghai_approval: ShanghaiApprovalCollector,
  east_anhui_approval: AnhuiApprovalCollector,
};

function createCollector(platformKey, config, options = {}) {
  const Cls = PLATFORM_CLASS_MAP[platformKey] || BasePlatformCollector;
  return new Cls(config, options);
}

function createCollectorFromEntry(entry, options = {}) {
  const { key, ...cfg } = entry;
  return createCollector(key, cfg, options);
}

module.exports = {
  createCollector,
  createCollectorFromEntry,
  PLATFORM_CLASS_MAP,
};
