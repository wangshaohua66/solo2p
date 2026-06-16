const MaerskAdapter = require('./maersk');
const CoscoAdapter = require('./cosco');
const CmaAdapter = require('./cma');
const HapagLloydAdapter = require('./hapag');
const MscAdapter = require('./msc');
const FreightosAdapter = require('./freightos');
const XenetaAdapter = require('./xeneta');
const BaseAdapter = require('./base');

const adapterMap = {
  maersk: MaerskAdapter,
  cosco: CoscoAdapter,
  cma: CmaAdapter,
  hapag: HapagLloydAdapter,
  msc: MscAdapter,
  freightos: FreightosAdapter,
  xeneta: XenetaAdapter
};

function createAdapter(carrierConfig) {
  const AdapterClass = adapterMap[carrierConfig.id] || BaseAdapter;
  return new AdapterClass(carrierConfig);
}

function getAdapterClass(carrierId) {
  return adapterMap[carrierId] || BaseAdapter;
}

function getAvailableAdapters() {
  return Object.keys(adapterMap);
}

module.exports = {
  createAdapter,
  getAdapterClass,
  getAvailableAdapters,
  MaerskAdapter,
  CoscoAdapter,
  CmaAdapter,
  HapagLloydAdapter,
  MscAdapter,
  FreightosAdapter,
  XenetaAdapter,
  BaseAdapter
};
