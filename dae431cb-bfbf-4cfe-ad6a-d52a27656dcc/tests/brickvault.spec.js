const { test, expect } = require('@playwright/test');
const { setTimeout } = require('timers/promises');

const BASE_URL = 'http://localhost:8765/index.html';
const WAIT_TIME = 3000;

test.describe.configure({ mode: 'serial' });

async function waitForAppReady(page) {
  await page.goto(BASE_URL + '?t=' + Date.now());
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() => window.bvReady);
    if (ready) break;
    await setTimeout(500);
  }
  await setTimeout(WAIT_TIME);
}

async function navigateTo(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await setTimeout(WAIT_TIME);
}

test.describe('BrickVault 端到端测试', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await waitForAppReady(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('01 - 应用初始化与三栏布局验证', async () => {
    console.log('=== 测试 01: 应用初始化与三栏布局 ===');

    const bvReady = await page.evaluate(() => window.bvReady);
    expect(bvReady).toBeTruthy();
    console.log('  ✅ bvReady = true');

    const hasSidebar = await page.evaluate(() => !!document.getElementById('sidebar'));
    expect(hasSidebar).toBeTruthy();
    console.log('  ✅ 左侧导航栏存在');

    const hasFilterColumn = await page.evaluate(() => !!document.getElementById('filterColumn'));
    expect(hasFilterColumn).toBeTruthy();
    console.log('  ✅ 中间筛选列存在');

    const hasMainContent = await page.evaluate(() => !!document.getElementById('mainContent'));
    expect(hasMainContent).toBeTruthy();
    console.log('  ✅ 右侧内容区存在');

    const filterClass = await page.evaluate(() => document.getElementById('filterColumn').className);
    expect(filterClass).toContain('filter-column');
    console.log('  ✅ 筛选列样式类正确');
  });

  test('02 - Dashboard 仪表盘统计数据', async () => {
    console.log('=== 测试 02: Dashboard 仪表盘 ===');
    await navigateTo(page, '#dashboard');

    const viewTitle = await page.evaluate(() => document.querySelector('.page-title')?.textContent);
    expect(viewTitle).toContain('仪表盘');
    console.log('  ✅ 仪表盘页面标题正确');

    const statParts = await page.evaluate(() => document.querySelector('.stat-parts')?.textContent);
    expect(statParts).toBeTruthy();
    expect(parseInt(statParts.replace(/,/g, ''))).toBeGreaterThan(0);
    console.log('  ✅ 零件数量统计正确:', statParts);

    const statSets = await page.evaluate(() => document.querySelector('.stat-sets')?.textContent);
    expect(statSets).toBeTruthy();
    expect(parseInt(statSets)).toBeGreaterThan(0);
    console.log('  ✅ 套装数量统计正确:', statSets);

    const statMocs = await page.evaluate(() => document.querySelector('.stat-mocs')?.textContent);
    expect(statMocs).toBeTruthy();
    expect(parseInt(statMocs)).toBeGreaterThan(0);
    console.log('  ✅ MOC 数量统计正确:', statMocs);

    const statTotal = await page.evaluate(() => document.querySelector('.stat-total')?.textContent);
    expect(statTotal).toBeTruthy();
    expect(statTotal).toContain('¥');
    console.log('  ✅ 总估值统计正确:', statTotal);
  });

  test('03 - 零件库 CRUD 操作', async () => {
    console.log('=== 测试 03: 零件库 CRUD ===');
    await navigateTo(page, '#inventory');

    const viewTitle = await page.evaluate(() => document.querySelector('.page-title')?.textContent);
    expect(viewTitle).toContain('零件库');
    console.log('  ✅ 零件库页面标题正确');

    const tableExists = await page.evaluate(() => !!document.getElementById('inventoryTable'));
    expect(tableExists).toBeTruthy();
    console.log('  ✅ 零件表存在');

    const rowCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('#inventoryTable tbody tr');
      return rows.length;
    });
    expect(rowCount).toBeGreaterThan(0);
    console.log('  ✅ 零件表有数据:', rowCount, '行');

    const hasSortable = await page.evaluate(() => {
      return typeof $('#inventoryTable tbody').sortable === 'function';
    });
    expect(hasSortable).toBeTruthy();
    console.log('  ✅ 零件表已注册 jQuery UI sortable');

    const hasDataId = await page.evaluate(() => {
      const row = document.querySelector('#inventoryTable tbody tr');
      return row && row.hasAttribute('data-id');
    });
    expect(hasDataId).toBeTruthy();
    console.log('  ✅ 零件表行有 data-id 属性');

    const rowCursor = await page.evaluate(() => {
      const row = document.querySelector('#inventoryTable tbody tr');
      return row ? getComputedStyle(row).cursor : '';
    });
    expect(rowCursor).toBe('move');
    console.log('  ✅ 零件表行光标为 move');

    console.log('  📝 测试新增零件...');
    await page.click('#btnAddPart');
    await setTimeout(1000);

    const modalVisible = await page.evaluate(() => {
      const modal = document.getElementById('genericModal');
      return modal && modal.classList.contains('show');
    });
    expect(modalVisible).toBeTruthy();
    console.log('  ✅ 新增零件模态框打开');

    await page.fill('#pf_partNumber', 'TEST-9999');
    await page.fill('#pf_name', '测试零件-Playwright');
    await page.fill('#pf_quantity', '42');
    await page.fill('#pf_unitPrice', '3.14');
    await page.fill('#pf_location', '测试位置-A1');
    console.log('  ✅ 表单已填写');

    await page.click('#pf_save');
    await setTimeout(2000);

    const modalClosed = await page.evaluate(() => {
      const modal = document.getElementById('genericModal');
      return !modal || !modal.classList.contains('show');
    });
    expect(modalClosed).toBeTruthy();
    console.log('  ✅ 新增成功后模态框关闭');

    const hasTestPart = await page.evaluate(() => {
      return document.body.textContent.includes('TEST-9999') &&
             document.body.textContent.includes('测试零件-Playwright');
    });
    expect(hasTestPart).toBeTruthy();
    console.log('  ✅ 新增零件已出现在列表中');

    console.log('  📝 测试编辑零件...');
    const editBtn = await page.evaluateHandle(() => {
      const btn = document.querySelector('.btn-edit-part');
      return btn;
    });
    if (editBtn) {
      await page.click('.btn-edit-part');
      await setTimeout(1000);

      const editModalVisible = await page.evaluate(() => {
        const modal = document.getElementById('genericModal');
        return modal && modal.classList.contains('show');
      });
      expect(editModalVisible).toBeTruthy();
      console.log('  ✅ 编辑模态框打开');

      await page.fill('#pf_name', '测试零件-已编辑');
      await page.click('#pf_save');
      await setTimeout(2000);

      const edited = await page.evaluate(() => document.body.textContent.includes('测试零件-已编辑'));
      expect(edited).toBeTruthy();
      console.log('  ✅ 编辑后名称已更新');
    }

    console.log('  📝 测试删除零件...');
    page.once('dialog', async dialog => {
      console.log('  🔔 确认对话框出现:', dialog.message());
      await dialog.accept();
    });

    const hasDeleteBtn = await page.evaluate(() => !!document.querySelector('.btn-delete-part'));
    if (hasDeleteBtn) {
      await page.click('.btn-delete-part');
      await setTimeout(2000);
      console.log('  ✅ 删除操作完成');
    }
  });

  test('04 - 套装管理 CRUD 与自动补全', async () => {
    console.log('=== 测试 04: 套装管理 CRUD 与自动补全 ===');
    await navigateTo(page, '#sets');

    const viewTitle = await page.evaluate(() => document.querySelector('.page-title')?.textContent);
    expect(viewTitle).toContain('套装');
    console.log('  ✅ 套装管理页面标题正确');

    const gridExists = await page.evaluate(() => !!document.getElementById('setsGrid'));
    expect(gridExists).toBeTruthy();
    console.log('  ✅ 套装网格存在');

    const cardCount = await page.evaluate(() => {
      return document.querySelectorAll('#setsGrid [data-id]').length;
    });
    expect(cardCount).toBeGreaterThan(0);
    console.log('  ✅ 套装卡片数量:', cardCount);

    const hasSetSortable = await page.evaluate(() => {
      return typeof $('#setsGrid').sortable === 'function' && $('#setsGrid').hasClass('ui-sortable');
    });
    expect(hasSetSortable).toBeTruthy();
    console.log('  ✅ 套装列表已注册 sortable');

    console.log('  📝 测试 Set 编号自动补全...');
    await page.click('#btnAddSet');
    await setTimeout(1000);

    const setModalVisible = await page.evaluate(() => {
      const modal = document.getElementById('genericModal');
      return modal && modal.classList.contains('show');
    });
    expect(setModalVisible).toBeTruthy();
    console.log('  ✅ 新增套装模态框打开');

    const hasLookupBtn = await page.evaluate(() => !!document.getElementById('sf_lookup'));
    expect(hasLookupBtn).toBeTruthy();
    console.log('  ✅ BrickLink 查询按钮存在');

    await page.fill('#sf_setNumber', '10255-1');
    await setTimeout(500);

    if (hasLookupBtn) {
      await page.click('#sf_lookup');
      await setTimeout(2000);

      const setName = await page.evaluate(() => document.getElementById('sf_name')?.value);
      console.log('  📋 自动补全后套装名称:', setName);
      expect(setName).toBeTruthy();
      console.log('  ✅ Set 编号自动补全功能正常');
    }

    await page.evaluate(() => {
      const modal = bootstrap.Modal.getInstance('#genericModal');
      if (modal) modal.hide();
    });
    await setTimeout(1000);
    console.log('  ✅ 套装模态框已关闭');
  });

  test('05 - MOC 档案 CRUD 与配色取色盘', async () => {
    console.log('=== 测试 05: MOC 档案 CRUD 与配色取色盘 ===');
    await navigateTo(page, '#moc');

    const viewTitle = await page.evaluate(() => document.querySelector('.page-title')?.textContent);
    expect(viewTitle).toContain('MOC');
    console.log('  ✅ MOC 档案页面标题正确');

    const listExists = await page.evaluate(() => !!document.getElementById('mocList'));
    expect(listExists).toBeTruthy();
    console.log('  ✅ MOC 列表存在');

    const mocCount = await page.evaluate(() => {
      return document.querySelectorAll('#mocList [data-id]').length;
    });
    expect(mocCount).toBeGreaterThan(0);
    console.log('  ✅ MOC 数量:', mocCount);

    const hasMocSortable = await page.evaluate(() => {
      return typeof $('#mocList').sortable === 'function' && $('#mocList').hasClass('ui-sortable');
    });
    expect(hasMocSortable).toBeTruthy();
    console.log('  ✅ MOC 列表已注册 sortable');

    console.log('  📝 测试配色取色盘...');
    await page.click('#btnAddMoc');
    await setTimeout(1000);

    const hasColorInputs = await page.evaluate(() => {
      const colors = document.querySelectorAll('#mf_colors input[type="color"]');
      return colors.length;
    });
    expect(hasColorInputs).toBeGreaterThan(0);
    console.log('  ✅ 配色取色盘 input type=color 存在，数量:', hasColorInputs);

    const hasAddColorBtn = await page.evaluate(() => !!document.getElementById('mf_addColor'));
    expect(hasAddColorBtn).toBeTruthy();
    console.log('  ✅ 添加颜色按钮存在');

    const hasColorPreview = await page.evaluate(() => !!document.getElementById('mf_preview'));
    expect(hasColorPreview).toBeTruthy();
    console.log('  ✅ 配色预览区存在');

    await page.evaluate(() => {
      const modal = bootstrap.Modal.getInstance('#genericModal');
      if (modal) modal.hide();
    });
    await setTimeout(1000);

    console.log('  📝 测试 MOC 详情页与零件消耗清单...');
    await page.click('.moc-item');
    await setTimeout(2000);

    const detailVisible = await page.evaluate(() => {
      const detail = document.getElementById('mocDetail');
      return detail && $(detail).is(':visible');
    });
    expect(detailVisible).toBeTruthy();
    console.log('  ✅ MOC 详情面板显示');

    const hasPartsTable = await page.evaluate(() => !!document.getElementById('mocPartsBody'));
    expect(hasPartsTable).toBeTruthy();
    console.log('  ✅ 零件消耗清单表格存在');

    const hasTimeline = await page.evaluate(() => !!document.getElementById('mocTimeline'));
    expect(hasTimeline).toBeTruthy();
    console.log('  ✅ 搭建时间线存在');

    const hasAddTimelineBtn = await page.evaluate(() => !!document.getElementById('btnAddTimeline'));
    expect(hasAddTimelineBtn).toBeTruthy();
    console.log('  ✅ 添加时间线按钮存在');

    const hasPhotoInput = await page.evaluate(async () => {
      $('#btnAddTimeline').click();
      await new Promise(r => setTimeout(r, 1000));
      const input = document.querySelector('#tl_photo');
      const modal = bootstrap.Modal.getInstance('#genericModal');
      if (modal) modal.hide();
      return input && input.type === 'file';
    });
    expect(hasPhotoInput).toBeTruthy();
    console.log('  ✅ 里程碑照片上传 input type=file 存在');
    await setTimeout(1000);
  });

  test('06 - 估值分析按 BrickLink 均价计算', async () => {
    console.log('=== 测试 06: 估值分析 ===');
    await navigateTo(page, '#valuation');

    const viewTitle = await page.evaluate(() => document.querySelector('.page-title')?.textContent);
    expect(viewTitle).toContain('估值');
    console.log('  ✅ 估值分析页面标题正确');

    const totalValue = await page.evaluate(() => document.getElementById('totalValue')?.textContent);
    expect(totalValue).toBeTruthy();
    expect(totalValue).toContain('¥');
    console.log('  ✅ 总估值显示:', totalValue);

    const totalPartValue = await page.evaluate(() => document.getElementById('totalPartValue')?.textContent);
    expect(totalPartValue).toBeTruthy();
    expect(totalPartValue).toContain('¥');
    console.log('  ✅ 零件估值显示:', totalPartValue);

    const totalSetValue = await page.evaluate(() => document.getElementById('totalSetValue')?.textContent);
    expect(totalSetValue).toBeTruthy();
    expect(totalSetValue).toContain('¥');
    console.log('  ✅ 套装估值显示:', totalSetValue);

    const hasPriceSourceInfo = await page.evaluate(() => !!document.getElementById('priceSourceInfo'));
    expect(hasPriceSourceInfo).toBeTruthy();
    console.log('  ✅ 价格数据源统计信息存在');

    const priceSourceText = await page.evaluate(() => document.getElementById('priceSourceInfo')?.textContent || '');
    console.log('  📋 价格数据源统计:', priceSourceText.trim());

    const hasColorChart = await page.evaluate(() => !!document.getElementById('colorChart'));
    expect(hasColorChart).toBeTruthy();
    console.log('  ✅ 颜色分布饼图存在');

    const hasCategoryChart = await page.evaluate(() => !!document.getElementById('categoryChart'));
    expect(hasCategoryChart).toBeTruthy();
    console.log('  ✅ 类别分布柱状图存在');
  });

  test('07 - 中间筛选列功能验证', async () => {
    console.log('=== 测试 07: 中间筛选列 ===');

    const filterToggleExists = await page.evaluate(() => !!document.getElementById('filterToggle'));
    expect(filterToggleExists).toBeTruthy();
    console.log('  ✅ 筛选列切换按钮存在');

    await navigateTo(page, '#inventory');
    const inventoryFilter = await page.evaluate(() => {
      const panel = document.getElementById('filterPanel');
      return panel && panel.innerHTML.includes('零件筛选') &&
             !!document.getElementById('searchPart');
    });
    expect(inventoryFilter).toBeTruthy();
    console.log('  ✅ 零件库筛选面板正确渲染');

    await navigateTo(page, '#sets');
    const setFilter = await page.evaluate(() => {
      return !!document.getElementById('searchSet') && !!document.getElementById('filterSetStatus');
    });
    expect(setFilter).toBeTruthy();
    console.log('  ✅ 套装筛选面板正确渲染');

    await navigateTo(page, '#moc');
    const mocFilter = await page.evaluate(() => {
      return !!document.getElementById('searchMoc') && !!document.getElementById('filterMocProgress');
    });
    expect(mocFilter).toBeTruthy();
    console.log('  ✅ MOC 筛选面板正确渲染');
  });

  test('08 - 路由切换完整性验证', async () => {
    console.log('=== 测试 08: 路由切换完整性 ===');

    const routes = [
      { hash: '#dashboard', titleKeyword: '仪表盘' },
      { hash: '#inventory', titleKeyword: '零件库' },
      { hash: '#sets', titleKeyword: '套装' },
      { hash: '#moc', titleKeyword: 'MOC' },
      { hash: '#auction', titleKeyword: '拍卖' },
      { hash: '#valuation', titleKeyword: '估值' },
      { hash: '#lug', titleKeyword: '活动' },
      { hash: '#import', titleKeyword: '导入' }
    ];

    for (const route of routes) {
      await navigateTo(page, route.hash);
      const title = await page.evaluate(() => document.querySelector('.page-title')?.textContent || '');
      expect(title).toContain(route.titleKeyword);
      console.log(`  ✅ 路由 ${route.hash} -> ${title.trim()}`);
    }

    console.log('  ✅ 全部 8 个路由切换验证通过');
  });
});
