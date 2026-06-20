const MBTIPage = require('./MBTI');
const BigFivePage = require('./BigFive');
const HollandPage = require('./Holland');
const SCL90Page = require('./SCL90');
const PF16Page = require('./PF16');
const DISCPage = require('./DISC');
const EQPage = require('./EQ');
const RavenIQPage = require('./RavenIQ');

const SCALE_MAP = {
  MBTI: MBTIPage,
  BIG5: BigFivePage,
  HOLLAND: HollandPage,
  SCL90: SCL90Page,
  PF16: PF16Page,
  DISC: DISCPage,
  EQ: EQPage,
  IQ: RavenIQPage
};

function createScalePage(browser, scaleCode) {
  const Cls = SCALE_MAP[scaleCode];
  if (!Cls) {
    throw new Error(`未找到量表页面对象: ${scaleCode}`);
  }
  return new Cls(browser);
}

module.exports = {
  createScalePage,
  SCALE_MAP,
  MBTIPage,
  BigFivePage,
  HollandPage,
  SCL90Page,
  PF16Page,
  DISCPage,
  EQPage,
  RavenIQPage
};
