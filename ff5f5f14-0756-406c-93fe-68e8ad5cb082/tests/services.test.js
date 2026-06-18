const matchingService = require('../src/services/matchingService');
const expiryService = require('../src/services/expiryService');

describe('交叉配血算法测试', () => {
  test('同血型Rh+配同血型Rh+ - 配血成功', () => {
    const result = matchingService.crossMatch('A', '+', 'A', '+');
    expect(result.major).toBe('相合');
    expect(result.minor).toBe('相合');
    expect(result.final).toBe('配血成功');
  });

  test('O型血给A型患者 - 主侧相合次侧相合', () => {
    const result = matchingService.crossMatch('O', '+', 'A', '+');
    expect(result.major).toBe('相合');
    expect(result.minor).toBe('相合');
    expect(result.final).toBe('配血成功');
  });

  test('A型血给O型患者 - 主侧不相合', () => {
    const result = matchingService.crossMatch('A', '+', 'O', '+');
    expect(result.major).toBe('不相合');
    expect(result.final).toBe('配血失败');
  });

  test('Rh+给Rh-患者 - 次侧不相合', () => {
    const result = matchingService.crossMatch('A', '+', 'A', '-');
    expect(result.major).toBe('相合');
    expect(result.minor).toBe('不相合');
    expect(result.final).toBe('配血失败');
  });

  test('AB型患者可接受任何ABO血型', () => {
    const result1 = matchingService.crossMatch('A', '+', 'AB', '+');
    const result2 = matchingService.crossMatch('B', '+', 'AB', '+');
    const result3 = matchingService.crossMatch('O', '+', 'AB', '+');
    expect(result1.final).toBe('配血成功');
    expect(result2.final).toBe('配血成功');
    expect(result3.final).toBe('配血成功');
  });

  test('优先级计算 - 急诊最高', () => {
    const emergency = matchingService.calculatePriority({ urgency: '急诊', created_at: new Date().toISOString() });
    const urgent = matchingService.calculatePriority({ urgency: '紧急', created_at: new Date().toISOString() });
    const normal = matchingService.calculatePriority({ urgency: '常规', created_at: new Date().toISOString() });
    expect(emergency).toBe(100);
    expect(urgent).toBe(50);
    expect(normal).toBe(0);
  });
});

describe('效期预警服务测试', () => {
  test('效期大于7天 - 正常', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const result = expiryService.checkExpiryAndMark(future.toISOString().slice(0, 10));
    expect(result.warning_level).toBe('正常');
    expect(result.is_expired).toBe(false);
  });

  test('效期7天内 - 黄色预警', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const result = expiryService.checkExpiryAndMark(future.toISOString().slice(0, 10));
    expect(result.warning_level).toBe('黄色');
    expect(result.is_expired).toBe(false);
  });

  test('效期3天内 - 橙色预警', () => {
    const future = new Date();
    future.setDate(future.getDate() + 2);
    const result = expiryService.checkExpiryAndMark(future.toISOString().slice(0, 10));
    expect(result.warning_level).toBe('橙色');
    expect(result.is_expired).toBe(false);
  });

  test('效期1天内 - 红色预警', () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const result = expiryService.checkExpiryAndMark(future.toISOString().slice(0, 10));
    expect(result.warning_level).toBe('红色');
    expect(result.is_expired).toBe(false);
  });

  test('已过期 - 已过期', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const result = expiryService.checkExpiryAndMark(past.toISOString().slice(0, 10));
    expect(result.warning_level).toBe('已过期');
    expect(result.is_expired).toBe(true);
  });

  test('预警级别函数测试', () => {
    expect(expiryService.getWarningLevel(10)).toBe('正常');
    expect(expiryService.getWarningLevel(7)).toBe('黄色');
    expect(expiryService.getWarningLevel(5)).toBe('黄色');
    expect(expiryService.getWarningLevel(3)).toBe('橙色');
    expect(expiryService.getWarningLevel(2)).toBe('橙色');
    expect(expiryService.getWarningLevel(1)).toBe('红色');
    expect(expiryService.getWarningLevel(0)).toBe('已过期');
    expect(expiryService.getWarningLevel(-1)).toBe('已过期');
  });
});
