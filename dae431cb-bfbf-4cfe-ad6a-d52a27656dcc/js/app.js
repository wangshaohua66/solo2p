(function(global) {
  'use strict';

  const $ = global.jQuery;

  function showToast(message, type) {
    const toastId = 'toast_' + Date.now();
    const bgMap = { success: 'bg-success', error: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info' };
    const iconMap = { success: 'bi-check-circle-fill', error: 'bi-exclamation-triangle-fill', warning: 'bi-exclamation-circle-fill', info: 'bi-info-circle-fill' };
    $('#toastContainer').append(`
      <div id="${toastId}" class="toast align-items-center border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body"><i class="bi ${iconMap[type||'info']} me-2"></i>${message}</div>
          <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`);
    const el = document.getElementById(toastId);
    if (bgMap[type]) el.classList.add(bgMap[type], 'text-white');
    bootstrap.Toast.getOrCreateInstance(el, { delay: 3000 }).show();
    setTimeout(() => el.remove(), 3500);
  }

  function showModal(title, bodyHtml, footerHtml) {
    $('#genericModalTitle').text(title);
    $('#genericModalBody').html(bodyHtml);
    $('#genericModalFooter').html(footerHtml || '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>');
    bootstrap.Modal.getOrCreateInstance('#genericModal').show();
  }

  function downloadCSV(rows, headers, filename) {
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(headers.map((_, i) => {
      let v = r[i] ?? '';
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function statusBadge(status) {
    const map = {
      sealed: '<span class="badge-status badge-sealed">未拆封</span>',
      built: '<span class="badge-status badge-built">已散件</span>',
      moced: '<span class="badge-status badge-moced">已MOC化</span>'
    };
    return map[status] || status;
  }

  function initTheme() {
    const saved = localStorage.getItem('bv_theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', saved);
    const icon = $('#themeToggle i');
    icon.attr('class', saved === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill');
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-bs-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    localStorage.setItem('bv_theme', next);
    const icon = $('#themeToggle i');
    icon.attr('class', next === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill');
  }

  const PART_COLORS = ['红色','蓝色','黄色','绿色','白色','黑色','灰色','橙色','紫色','粉色','棕色','透明','米色','金色','银色'];
  const PART_CATEGORIES = ['砖类','板类','斜坡','圆柱','特殊件','人仔','车轮','窗户/门','装饰件','技术件'];
  const PART_SHAPES = ['方形','圆形','异形','弧形','带孔','带凸点','带夹口','连接件'];

  function randomPart(i) {
    const nums = ['3001','3002','3003','3004','3005','3020','3021','3022','3023','3622','3710','3795','3839','3941','4070'];
    const shapes = ['🧱','🔴','🟡','🟢','🔵','⬛','🟪','🟧'];
    return {
      partNumber: nums[i % nums.length] + (i > nums.length ? i : ''),
      name: `零件 ${nums[i % nums.length]} - ${PART_CATEGORIES[i % PART_CATEGORIES.length]}`,
      color: PART_COLORS[i % PART_COLORS.length],
      category: PART_CATEGORIES[i % PART_CATEGORIES.length],
      shape: PART_SHAPES[i % PART_SHAPES.length],
      quantity: Math.floor(Math.random() * 100) + 1,
      unitPrice: +(Math.random() * 10 + 0.1).toFixed(2),
      location: `抽屉 ${(i % 6) + 1}-${Math.floor(i / 6) + 1}`,
      imageUrl: shapes[i % shapes.length],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async function seedData() {
    const pc = await BV.store.count('parts');
    if (pc === 0) {
      const parts = [];
      for (let i = 0; i < 120; i++) parts.push(randomPart(i));
      await BV.store.bulkAdd('parts', parts);
    }
    const sc = await BV.store.count('sets');
    if (sc === 0) {
      const sampleSets = [
        { setNumber: '10255-1', name: '城市广场', status: 'built', pieceCount: 4002, purchasePrice: 1899, purchaseDate: '2023-05-12', notes: '十周年纪念款', imageUrl: '🏛️' },
        { setNumber: '10271-1', name: '菲亚特 500', status: 'sealed', pieceCount: 960, purchasePrice: 699, purchaseDate: '2024-01-05', notes: '未拆收藏', imageUrl: '🚗' },
        { setNumber: '21309-1', name: 'NASA 阿波罗土星五号', status: 'built', pieceCount: 1969, purchasePrice: 899, purchaseDate: '2022-09-20', notes: '', imageUrl: '🚀' },
        { setNumber: '71040-1', name: '迪士尼乐园城堡', status: 'moced', pieceCount: 4080, purchasePrice: 2499, purchaseDate: '2021-11-11', notes: '已改造为MOC', imageUrl: '🏰' },
        { setNumber: '75192-1', name: '千年隼', status: 'sealed', pieceCount: 7541, purchasePrice: 5499, purchaseDate: '2024-03-15', notes: '镇宅收藏', imageUrl: '🛸' },
        { setNumber: '10220-1', name: '大众 T1 露营车', status: 'built', pieceCount: 1334, purchasePrice: 899, purchaseDate: '2020-07-08', notes: '', imageUrl: '🚐' }
      ];
      await BV.store.bulkAdd('sets', sampleSets);
    }
    const mc = await BV.store.count('mocs');
    if (mc === 0) {
      const mocs = [
        { id: BV.uuid(), name: '模块化书店', description: '参考街景系列的三层书店 MOC，带完整内饰', progress: 85, colorPalette: JSON.stringify(['#8B4513','#DEB887','#696969','#F5F5F5']), createdAt: '2024-02-01T10:00:00Z' },
        { id: BV.uuid(), name: '未来都市塔', description: '赛博朋克风格的高层建筑 MOC', progress: 40, colorPalette: JSON.stringify(['#1B2A34','#00FFFF','#FF1493','#FFD700']), createdAt: '2024-06-10T10:00:00Z' }
      ];
      await BV.store.bulkAdd('mocs', mocs);
      const timelines = [
        { mocId: mocs[0].id, title: '开始设计', date: '2024-02-01', description: '完成初步设计图和零件清单', imageUrl: '📐' },
        { mocId: mocs[0].id, title: '一层完成', date: '2024-02-15', description: '书店一楼主体结构完成', imageUrl: '🧱' },
        { mocId: mocs[0].id, title: '内饰搭建', date: '2024-04-20', description: '书架、收银台、咖啡角内饰完成', imageUrl: '📚' },
        { mocId: mocs[1].id, title: '概念阶段', date: '2024-06-10', description: '确定赛博朋克主题与配色', imageUrl: '✨' }
      ];
      await BV.store.bulkAdd('mocTimelines', timelines);
      const logs = [
        { mocId: mocs[0].id, date: '2024-03-10', content: '调整了窗户结构，改用 1x2 透明件提升采光' },
        { mocId: mocs[0].id, date: '2024-05-01', content: '屋顶增加了水塔细节，使用 2x2 圆柱件' }
      ];
      await BV.store.bulkAdd('mocModLogs', logs);
    }
    const ac = await BV.store.count('auctions');
    if (ac === 0) {
      const now = Date.now();
      const auctions = [
        { platform: 'bricklink', itemId: 'BL-10255', title: '10255 城市广场 全新未拆', url: '#', status: 'watching', currentPrice: 1650, targetPrice: 1500, endTime: new Date(now + 86400000 * 3).toISOString(), notified: false },
        { platform: 'ebay', itemId: 'EB-75192', title: 'LEGO Star Wars Millennium Falcon 75192 UCS', url: '#', status: 'watching', currentPrice: 4800, targetPrice: 4500, endTime: new Date(now + 86400000 * 1).toISOString(), notified: false },
        { platform: 'bricklink', itemId: 'BL-3001', title: '3001 红色砖 x100 全新', url: '#', status: 'won', currentPrice: 85, targetPrice: 100, endTime: new Date(now - 86400000 * 2).toISOString(), notified: true }
      ];
      await BV.store.bulkAdd('auctions', auctions);
      const prices = auctions.slice(0,2).flatMap((a, idx) => {
        return Array.from({length: 6}, (_, i) => ({
          auctionId: a.id,
          price: a.currentPrice - (5 - i) * (idx === 0 ? 20 : 50),
          recordedAt: new Date(now - 86400000 * (5 - i)).toISOString()
        }));
      });
      await BV.store.bulkAdd('auctionPrices', prices);
    }
    const ec = await BV.store.count('events');
    if (ec === 0) {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const events = [
        { type: 'lug', title: '本地 LUG 月度聚会', startDate: new Date(y, m, 15).toISOString().slice(0,10), endDate: new Date(y, m, 15).toISOString().slice(0,10), location: '市中心创意空间 3F', description: '每月一次的乐高玩家聚会，欢迎带作品参展', url: '#' },
        { type: 'brickfair', title: 'BRICKFAIR 2026 上海站', startDate: new Date(y, m+1, 8).toISOString().slice(0,10), endDate: new Date(y, m+1, 10).toISOString().slice(0,10), location: '上海国际会展中心', description: '年度大型乐高展会，AFOL 专区', url: '#' },
        { type: 'lug', title: '儿童公益拼搭活动', startDate: new Date(y, m, 22).toISOString().slice(0,10), endDate: new Date(y, m, 22).toISOString().slice(0,10), location: '市立图书馆', description: '为儿童组织的拼搭公益活动，招募志愿者', url: '#' }
      ];
      await BV.store.bulkAdd('events', events);
    }
  }

  async function renderDashboard() {
    const [partCount, setCount, mocCount, auctions, parts] = await Promise.all([
      BV.store.count('parts'),
      BV.store.count('sets'),
      BV.store.count('mocs'),
      BV.store.getAll('auctions'),
      BV.store.getAll('parts')
    ]);
    const totalValue = parts.reduce((s, p) => s + (p.quantity || 0) * (p.unitPrice || 0), 0);
    const watching = auctions.filter(a => a.status === 'watching').length;

    $('.stat-parts').text(partCount.toLocaleString());
    $('.stat-sets').text(setCount);
    $('.stat-mocs').text(mocCount);
    $('.stat-total').text('¥' + totalValue.toFixed(0));
    $('.stat-watching').text(watching);

    const upcoming = (await BV.store.getAll('events'))
      .filter(e => new Date(e.startDate) >= new Date(new Date().setHours(0,0,0,0)))
      .sort((a,b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 4);

    const list = $('#upcomingEventsList');
    list.empty();
    if (upcoming.length === 0) {
      list.html('<li class="list-group-item text-muted">暂无近期活动</li>');
    } else {
      upcoming.forEach(e => {
        const cls = e.type === 'lug' ? 'event-lug' : 'event-brickfair';
        const icon = e.type === 'lug' ? '👥' : '🎪';
        list.append(`<li class="list-group-item d-flex justify-content-between align-items-center">
          <div><strong>${icon} ${e.title}</strong><div class="small text-muted">${e.startDate} · ${e.location}</div></div>
          <span class="${cls}" style="padding:2px 8px;border-radius:4px;font-size:11px">${e.type === 'lug' ? 'LUG' : 'BRICKFAIR'}</span>
        </li>`);
      });
    }
  }

  let inventoryDT = null;
  async function renderInventory() {
    const parts = await BV.store.getAll('parts');

    const colorSelect = $('#filterColor');
    const catSelect = $('#filterCategory');
    const shapeSelect = $('#filterShape');
    PART_COLORS.forEach(c => colorSelect.append(`<option value="${c}">${c}</option>`));
    PART_CATEGORIES.forEach(c => catSelect.append(`<option value="${c}">${c}</option>`));
    PART_SHAPES.forEach(c => shapeSelect.append(`<option value="${c}">${c}</option>`));

    $('#searchPart').autocomplete({
      source: parts.map(p => p.partNumber).filter((v,i,a)=>a.indexOf(v)===i),
      minLength: 1
    });

    const data = parts.map(p => [
      `<input type="checkbox" class="part-check" data-id="${p.id}">`,
      `<span class="part-thumb">${p.imageUrl || '🧱'}</span>`,
      p.partNumber,
      p.name || '-',
      p.color || '-',
      p.category || '-',
      p.shape || '-',
      p.quantity || 0,
      '¥' + (p.unitPrice || 0).toFixed(2),
      p.location || '-',
      `<button class="btn btn-sm btn-outline-lego-red btn-edit-part" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
       <button class="btn btn-sm btn-outline-danger btn-delete-part" data-id="${p.id}"><i class="bi bi-trash"></i></button>`
    ]);

    if (inventoryDT) { inventoryDT.destroy(); inventoryDT = null; }
    inventoryDT = BVTable('#inventoryTable', {
      data,
      columns: [
        { title: '<input type="checkbox" id="checkAllParts">', orderable: false, width: '40px', className: 'select-checkbox' },
        { title: '图', orderable: false, width: '60px' },
        { title: '零件号' },
        { title: '名称' },
        { title: '颜色' },
        { title: '类别' },
        { title: '形状' },
        { title: '数量' },
        { title: '单价' },
        { title: '位置' },
        { title: '操作', orderable: false, width: '100px' }
      ],
      columnDefs: [{ targets: [0, 1, 10], searchable: false }]
    });

    $('#checkAllParts').on('change', function() {
      $('.part-check').prop('checked', $(this).prop('checked'));
    });

    $('#btnApplyFilter').on('click', () => {
      const kw = $('#searchPart').val();
      const col = $('#filterColor').val();
      const cat = $('#filterCategory').val();
      const shp = $('#filterShape').val();
      inventoryDT.columns(2).search(kw);
      inventoryDT.columns(4).search(col);
      inventoryDT.columns(5).search(cat);
      inventoryDT.columns(6).search(shp);
      inventoryDT.draw();
    });

    $('#btnResetFilter').on('click', () => {
      $('#searchPart').val(''); $('#filterColor').val(''); $('#filterCategory').val(''); $('#filterShape').val('');
      inventoryDT.search('').columns().search('').draw();
    });

    $('#btnExportSelected').on('click', () => {
      const n = inventoryDT.exportSelectedCSV('零件库存');
      showToast(n ? `已导出 ${n} 条记录` : '请先勾选要导出的行', n ? 'success' : 'warning');
    });

    $('#btnAddPart').on('click', () => partFormModal());
    $(document).off('click', '.btn-edit-part').on('click', '.btn-edit-part', (e) => partFormModal($(e.currentTarget).data('id')));
    $(document).off('click', '.btn-delete-part').on('click', '.btn-delete-part', async (e) => {
      if (!confirm('确定删除该零件记录？')) return;
      await BV.store.delete('parts', $(e.currentTarget).data('id'));
      showToast('已删除', 'success');
      renderInventory();
    });
  }

  function partFormModal(id) {
    const isEdit = !!id;
    BV.store.get('parts', id).then(part => {
      const p = part || {};
      const body = `
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">零件号</label><input class="form-control" id="pf_partNumber" value="${p.partNumber||''}"></div>
          <div class="col-md-6"><label class="form-label">名称</label><input class="form-control" id="pf_name" value="${p.name||''}"></div>
          <div class="col-md-4"><label class="form-label">颜色</label><select class="form-select" id="pf_color">${PART_COLORS.map(c=>`<option ${p.color===c?'selected':''}>${c}</option>`).join('')}<option value="">其他</option></select></div>
          <div class="col-md-4"><label class="form-label">类别</label><select class="form-select" id="pf_category">${PART_CATEGORIES.map(c=>`<option ${p.category===c?'selected':''}>${c}</option>`).join('')}<option value="">其他</option></select></div>
          <div class="col-md-4"><label class="form-label">形状</label><select class="form-select" id="pf_shape">${PART_SHAPES.map(c=>`<option ${p.shape===c?'selected':''}>${c}</option>`).join('')}<option value="">其他</option></select></div>
          <div class="col-md-4"><label class="form-label">数量</label><input type="number" class="form-control" id="pf_quantity" value="${p.quantity||0}"></div>
          <div class="col-md-4"><label class="form-label">单价(¥)</label><input type="number" step="0.01" class="form-control" id="pf_unitPrice" value="${p.unitPrice||0}"></div>
          <div class="col-md-4"><label class="form-label">位置</label><input class="form-control" id="pf_location" value="${p.location||''}"></div>
          <div class="col-12"><label class="form-label">图标 (emoji)</label><input class="form-control" id="pf_imageUrl" value="${p.imageUrl||'🧱'}" maxlength="4"></div>
        </div>`;
      const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        <button type="button" class="btn btn-lego-red" id="pf_save">保存</button>`;
      showModal(isEdit ? '编辑零件' : '新增零件', body, footer);
      $('#pf_save').on('click', async () => {
        const data = {
          partNumber: $('#pf_partNumber').val().trim(),
          name: $('#pf_name').val().trim(),
          color: $('#pf_color').val(),
          category: $('#pf_category').val(),
          shape: $('#pf_shape').val(),
          quantity: +$('#pf_quantity').val() || 0,
          unitPrice: +$('#pf_unitPrice').val() || 0,
          location: $('#pf_location').val().trim(),
          imageUrl: $('#pf_imageUrl').val().trim() || '🧱'
        };
        if (!data.partNumber) { showToast('请填写零件号', 'error'); return; }
        if (isEdit) { data.id = id; await BV.store.put('parts', data); }
        else await BV.store.add('parts', data);
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('保存成功', 'success');
        renderInventory();
      });
    });
  }

  async function renderSets() {
    const sets = await BV.store.getAll('sets');
    const grid = $('#setsGrid');
    grid.empty();
    if (sets.length === 0) {
      grid.html('<div class="col-12 text-center text-muted py-5">暂无套装，点击右上角添加</div>');
    } else {
      sets.forEach(s => {
        grid.append(`<div class="col-md-6 col-lg-4">
          <div class="set-card h-100" data-id="${s.id}">
            <div class="set-cover">${s.imageUrl || '📦'}</div>
            <div class="set-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="set-number">#${s.setNumber}</div>
                ${statusBadge(s.status)}
              </div>
              <div class="set-name">${s.name}</div>
              <div class="d-flex justify-content-between mt-2 text-muted small">
                <span>${s.pieceCount || 0} 件</span>
                <span>¥${s.purchasePrice || 0}</span>
              </div>
              <div class="mt-3 d-flex gap-2">
                <button class="btn btn-sm btn-outline-lego-red flex-fill btn-set-edit" data-id="${s.id}"><i class="bi bi-pencil"></i> 编辑</button>
                ${s.status !== 'built' ? `<button class="btn btn-sm btn-lego-red flex-fill btn-set-break" data-id="${s.id}">散件入库</button>` : ''}
              </div>
            </div>
          </div>
        </div>`);
      });
    }
    $('#btnAddSet').on('click', () => setFormModal());
    $(document).off('click', '.btn-set-edit').on('click', '.btn-set-edit', (e) => { e.stopPropagation(); setFormModal($(e.currentTarget).data('id')); });
    $(document).off('click', '.btn-set-break').on('click', '.btn-set-break', async (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      if (!confirm('确认将该套装标记为已散件并加入库存？')) return;
      const s = await BV.store.get('sets', id);
      s.status = 'built';
      await BV.store.put('sets', s);
      showToast('已标记为已散件', 'success');
      renderSets();
    });
    $(document).off('click', '.set-card').on('click', '.set-card', (e) => {
      if ($(e.target).closest('button').length) return;
      setFormModal($(e.currentTarget).data('id'));
    });
  }

  function setFormModal(id) {
    const isEdit = !!id;
    BV.store.get('sets', id).then(set => {
      const s = set || {};
      const body = `
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Set 编号</label><input class="form-control" id="sf_setNumber" value="${s.setNumber||''}" placeholder="如 10255-1"></div>
          <div class="col-md-6"><label class="form-label">图标</label><input class="form-control" id="sf_imageUrl" value="${s.imageUrl||'📦'}" maxlength="4"></div>
          <div class="col-12"><label class="form-label">套装名称</label><input class="form-control" id="sf_name" value="${s.name||''}"></div>
          <div class="col-md-4"><label class="form-label">状态</label><select class="form-select" id="sf_status">
            <option value="sealed" ${s.status==='sealed'?'selected':''}>未拆封</option>
            <option value="built" ${s.status==='built'?'selected':''}>已散件</option>
            <option value="moced" ${s.status==='moced'?'selected':''}>已MOC化</option>
          </select></div>
          <div class="col-md-4"><label class="form-label">零件数</label><input type="number" class="form-control" id="sf_pieceCount" value="${s.pieceCount||0}"></div>
          <div class="col-md-4"><label class="form-label">购入价格(¥)</label><input type="number" step="0.01" class="form-control" id="sf_purchasePrice" value="${s.purchasePrice||0}"></div>
          <div class="col-md-6"><label class="form-label">购入日期</label><input type="date" class="form-control" id="sf_purchaseDate" value="${s.purchaseDate||''}"></div>
          <div class="col-12"><label class="form-label">备注</label><textarea class="form-control" id="sf_notes" rows="3">${s.notes||''}</textarea></div>
        </div>`;
      const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        <button type="button" class="btn btn-lego-red" id="sf_save">保存</button>`;
      showModal(isEdit ? '编辑套装' : '新增套装', body, footer);
      $('#sf_save').on('click', async () => {
        const data = {
          setNumber: $('#sf_setNumber').val().trim(),
          name: $('#sf_name').val().trim(),
          status: $('#sf_status').val(),
          pieceCount: +$('#sf_pieceCount').val() || 0,
          purchasePrice: +$('#sf_purchasePrice').val() || 0,
          purchaseDate: $('#sf_purchaseDate').val(),
          notes: $('#sf_notes').val(),
          imageUrl: $('#sf_imageUrl').val().trim() || '📦'
        };
        if (!data.setNumber) { showToast('请填写 Set 编号', 'error'); return; }
        if (isEdit) { data.id = id; await BV.store.put('sets', data); }
        else await BV.store.add('sets', data);
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('保存成功', 'success');
        renderSets();
      });
    });
  }

  let currentMocId = null;
  async function renderMoc() {
    const mocs = await BV.store.getAll('mocs');
    const list = $('#mocList');
    list.empty();
    if (mocs.length === 0) {
      list.html('<div class="text-center text-muted py-5">暂无 MOC 作品，点击添加</div>');
    } else {
      mocs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      mocs.forEach(m => {
        const palette = JSON.parse(m.colorPalette || '[]');
        list.append(`<a href="#" class="list-group-item list-group-item-action moc-item" data-id="${m.id}">
          <div class="d-flex w-100 justify-content-between align-items-center">
            <h6 class="mb-1">🎨 ${m.name}</h6>
            <span class="badge rounded-pill bg-lego-red">${m.progress}%</span>
          </div>
          <p class="mb-1 small text-muted">${m.description || ''}</p>
          <div class="d-flex gap-1 mt-2">
            ${palette.map(c => `<span class="color-swatch" style="background:${c};width:20px;height:20px"></span>`).join('')}
          </div>
          <div class="mt-2 progress" style="height:4px"><div class="progress-bar" style="width:${m.progress}%"></div></div>
        </a>`);
      });
    }

    $('#btnAddMoc').on('click', () => mocFormModal());
    $(document).off('click', '.moc-item').on('click', '.moc-item', async (e) => {
      e.preventDefault();
      currentMocId = $(e.currentTarget).data('id');
      renderMocDetail(currentMocId);
    });

    if (currentMocId) renderMocDetail(currentMocId);
  }

  async function renderMocDetail(id) {
    const moc = await BV.store.get('mocs', id);
    if (!moc) return;
    const [timelines, logs] = await Promise.all([
      BV.store.getByIndex('mocTimelines', 'mocId', id),
      BV.store.getByIndex('mocModLogs', 'mocId', id)
    ]);
    const palette = JSON.parse(moc.colorPalette || '[]');
    timelines.sort((a,b) => new Date(a.date) - new Date(b.date));
    logs.sort((a,b) => new Date(b.date) - new Date(a.date));

    $('#mocDetailName').text(moc.name);
    $('#mocDetailDesc').text(moc.description || '');
    $('#mocDetailProgress').css('width', moc.progress + '%').text(moc.progress + '%');
    $('#mocPalette').html(palette.map(c => `<span class="color-swatch" style="background:${c}"></span>`).join(''));

    $('#mocTimeline').html(timelines.length ? timelines.map(t => `
      <div class="timeline-item">
        <div class="timeline-date">${t.date}</div>
        <div class="timeline-title">${t.imageUrl || '📍'} ${t.title}</div>
        <div class="small text-muted">${t.description || ''}</div>
      </div>`).join('') : '<div class="text-muted small">暂无时间线记录</div>');

    $('#mocModLogs').html(logs.length ? logs.map(l => `
      <div class="border-bottom py-2">
        <div class="small text-muted">${l.date}</div>
        <div>${l.content}</div>
      </div>`).join('') : '<div class="text-muted small">暂无改造日志</div>');

    $('#btnEditMoc').off('click').on('click', () => mocFormModal(id));
    $('#btnAddTimeline').off('click').on('click', () => timelineModal(id));
    $('#btnAddLog').off('click').on('click', () => logModal(id));
    $('#mocDetail').show();
  }

  function mocFormModal(id) {
    const isEdit = !!id;
    BV.store.get('mocs', id).then(m => {
      const moc = m || {};
      const palette = JSON.parse(moc.colorPalette || '["#E3000B","#FFD700","#0055BF","#237841"]');
      const body = `
        <div class="row g-3">
          <div class="col-12"><label class="form-label">作品名称</label><input class="form-control" id="mf_name" value="${moc.name||''}"></div>
          <div class="col-12"><label class="form-label">描述</label><textarea class="form-control" id="mf_description" rows="3">${moc.description||''}</textarea></div>
          <div class="col-md-6"><label class="form-label">进度 (%)</label><input type="number" min="0" max="100" class="form-control" id="mf_progress" value="${moc.progress||0}"></div>
          <div class="col-12">
            <label class="form-label">配色方案（用逗号分隔 HEX 色值）</label>
            <input class="form-control" id="mf_palette" value="${palette.join(',')}">
            <div class="mt-2 d-flex gap-2" id="mf_preview"></div>
          </div>
        </div>`;
      const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        ${isEdit ? `<button type="button" class="btn btn-danger me-auto" id="mf_delete">删除</button>` : ''}
        <button type="button" class="btn btn-lego-red" id="mf_save">保存</button>`;
      showModal(isEdit ? '编辑 MOC' : '新增 MOC', body, footer);
      const updatePreview = () => {
        const colors = $('#mf_palette').val().split(',').map(c => c.trim()).filter(Boolean);
        $('#mf_preview').html(colors.map(c => `<span class="color-swatch" style="background:${c}"></span>`).join(''));
      };
      updatePreview();
      $('#mf_palette').on('input', updatePreview);
      $('#mf_save').on('click', async () => {
        const data = {
          name: $('#mf_name').val().trim(),
          description: $('#mf_description').val(),
          progress: Math.min(100, Math.max(0, +$('#mf_progress').val() || 0)),
          colorPalette: JSON.stringify($('#mf_palette').val().split(',').map(c => c.trim()).filter(Boolean))
        };
        if (!data.name) { showToast('请填写作品名称', 'error'); return; }
        if (isEdit) { data.id = id; await BV.store.put('mocs', data); }
        else { const r = await BV.store.add('mocs', data); currentMocId = r; }
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('保存成功', 'success');
        renderMoc();
      });
      if (isEdit) $('#mf_delete').on('click', async () => {
        if (!confirm('确定删除该 MOC？相关时间线和日志也将被删除')) return;
        await BV.store.delete('mocs', id);
        const [ts, ls, ps] = await Promise.all([
          BV.store.getByIndex('mocTimelines', 'mocId', id),
          BV.store.getByIndex('mocModLogs', 'mocId', id),
          BV.store.getByIndex('mocParts', 'mocId', id)
        ]);
        for (const t of ts) await BV.store.delete('mocTimelines', t.id);
        for (const l of ls) await BV.store.delete('mocModLogs', l.id);
        for (const p of ps) await BV.store.delete('mocParts', p.id);
        currentMocId = null;
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('已删除', 'success');
        renderMoc();
      });
    });
  }

  function timelineModal(mocId) {
    const body = `
      <div class="row g-3">
        <div class="col-md-6"><label class="form-label">日期</label><input type="date" class="form-control" id="tl_date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="col-md-6"><label class="form-label">图标</label><input class="form-control" id="tl_icon" value="📍" maxlength="4"></div>
        <div class="col-12"><label class="form-label">标题</label><input class="form-control" id="tl_title"></div>
        <div class="col-12"><label class="form-label">描述</label><textarea class="form-control" id="tl_desc" rows="2"></textarea></div>
      </div>`;
    const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
      <button type="button" class="btn btn-lego-red" id="tl_save">保存</button>`;
    showModal('添加里程碑', body, footer);
    $('#tl_save').on('click', async () => {
      await BV.store.add('mocTimelines', {
        mocId, date: $('#tl_date').val(), title: $('#tl_title').val().trim(),
        description: $('#tl_desc').val(), imageUrl: $('#tl_icon').val().trim()
      });
      bootstrap.Modal.getInstance('#genericModal').hide();
      showToast('已添加', 'success');
      renderMocDetail(mocId);
    });
  }

  function logModal(mocId) {
    const body = `
      <div class="row g-3">
        <div class="col-12"><label class="form-label">日期</label><input type="date" class="form-control" id="lg_date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="col-12"><label class="form-label">改造内容</label><textarea class="form-control" id="lg_content" rows="4"></textarea></div>
      </div>`;
    const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
      <button type="button" class="btn btn-lego-red" id="lg_save">保存</button>`;
    showModal('添加改造日志', body, footer);
    $('#lg_save').on('click', async () => {
      await BV.store.add('mocModLogs', { mocId, date: $('#lg_date').val(), content: $('#lg_content').val() });
      bootstrap.Modal.getInstance('#genericModal').hide();
      showToast('已添加', 'success');
      renderMocDetail(mocId);
    });
  }

  let auctionCharts = {};
  async function renderAuction() {
    const auctions = await BV.store.getAll('auctions');
    const now = new Date();
    const list = $('#auctionList');
    list.empty();
    if (auctions.length === 0) {
      list.html('<div class="text-center text-muted py-5">暂无追踪条目，点击添加</div>');
    } else {
      auctions.sort((a,b) => new Date(a.endTime) - new Date(b.endTime));
      auctions.forEach(a => {
        const overdue = new Date(a.endTime) < now && a.status === 'watching';
        const statusMap = { watching: '关注中', won: '已拍下', lost: '未中', ended: '已结束' };
        const platMap = { bricklink: '🔴 BrickLink', ebay: '🟢 eBay', vinted: '🟡 Vinted' };
        list.append(`<div class="card mb-3 auction-card ${overdue?'overdue':''}" data-id="${a.id}">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <span class="badge rounded-pill bg-secondary me-2">${platMap[a.platform] || a.platform}</span>
                <strong>${a.title}</strong>
              </div>
              <span class="badge-status badge-${a.status==='watching'?'sealed':a.status==='won'?'built':'moced'}">${statusMap[a.status]||a.status}</span>
            </div>
            <div class="row small text-muted mb-2">
              <div class="col-auto">当前价: <strong class="text-lego-red">¥${a.currentPrice}</strong></div>
              <div class="col-auto">目标价: ¥${a.targetPrice}</div>
              <div class="col-auto">结拍: ${new Date(a.endTime).toLocaleString('zh-CN')}</div>
              ${overdue ? '<div class="col-auto text-danger fw-bold">⚠ 已逾期</div>' : ''}
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-lego-red btn-auction-chart" data-id="${a.id}"><i class="bi bi-graph-up"></i> 价格走势</button>
              <button class="btn btn-sm btn-outline-secondary btn-auction-edit" data-id="${a.id}"><i class="bi bi-pencil"></i> 编辑</button>
              <button class="btn btn-sm btn-outline-danger btn-auction-del" data-id="${a.id}"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>`);
      });
    }
    $('#btnAddAuction').on('click', () => auctionModal());
    $(document).off('click', '.btn-auction-edit').on('click', '.btn-auction-edit', e => auctionModal($(e.currentTarget).data('id')));
    $(document).off('click', '.btn-auction-del').on('click', '.btn-auction-del', async e => {
      if (!confirm('确认删除？')) return;
      const id = $(e.currentTarget).data('id');
      await BV.store.delete('auctions', id);
      const prices = await BV.store.getByIndex('auctionPrices', 'auctionId', id);
      for (const p of prices) await BV.store.delete('auctionPrices', p.id);
      showToast('已删除', 'success'); renderAuction();
    });
    $(document).off('click', '.btn-auction-chart').on('click', '.btn-auction-chart', e => showAuctionChart($(e.currentTarget).data('id')));
  }

  async function showAuctionChart(id) {
    const [auction, prices] = await Promise.all([
      BV.store.get('auctions', id),
      BV.store.getByIndex('auctionPrices', 'auctionId', id)
    ]);
    prices.sort((a,b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const labels = prices.map(p => new Date(p.recordedAt).toLocaleDateString('zh-CN'));
    const values = prices.map(p => p.price);
    const body = `<div style="height:300px"><canvas id="aucChart"></canvas></div>`;
    showModal(auction.title + ' - 价格走势', body);
    setTimeout(() => {
      if (auctionCharts.detail) auctionCharts.detail.destroy();
      auctionCharts.detail = BVChart.line('aucChart', {
        labels, values, label: '价格 (¥)'
      }, {
        scales: { y: { ticks: { callback: v => '¥' + v } } }
      });
    }, 200);
  }

  function auctionModal(id) {
    const isEdit = !!id;
    BV.store.get('auctions', id).then(a => {
      const auc = a || {};
      const body = `
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label">平台</label><select class="form-select" id="af_platform">
            ${['bricklink','ebay','vinted'].map(p=>`<option ${auc.platform===p?'selected':''}>${p}</option>`).join('')}
          </select></div>
          <div class="col-md-4"><label class="form-label">商品ID</label><input class="form-control" id="af_itemId" value="${auc.itemId||''}"></div>
          <div class="col-md-4"><label class="form-label">状态</label><select class="form-select" id="af_status">
            ${['watching','won','lost','ended'].map(p=>`<option ${auc.status===p?'selected':''}>${p}</option>`).join('')}
          </select></div>
          <div class="col-12"><label class="form-label">标题</label><input class="form-control" id="af_title" value="${auc.title||''}"></div>
          <div class="col-12"><label class="form-label">链接</label><input class="form-control" id="af_url" value="${auc.url||''}"></div>
          <div class="col-md-4"><label class="form-label">当前价(¥)</label><input type="number" step="0.01" class="form-control" id="af_currentPrice" value="${auc.currentPrice||0}"></div>
          <div class="col-md-4"><label class="form-label">目标价(¥)</label><input type="number" step="0.01" class="form-control" id="af_targetPrice" value="${auc.targetPrice||0}"></div>
          <div class="col-md-4"><label class="form-label">结拍时间</label><input type="datetime-local" class="form-control" id="af_endTime" value="${auc.endTime?new Date(auc.endTime).toISOString().slice(0,16):''}"></div>
        </div>`;
      const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        <button type="button" class="btn btn-lego-red" id="af_save">保存</button>`;
      showModal(isEdit ? '编辑拍卖' : '新增拍卖', body, footer);
      $('#af_save').on('click', async () => {
        const data = {
          platform: $('#af_platform').val(), itemId: $('#af_itemId').val().trim(),
          status: $('#af_status').val(), title: $('#af_title').val().trim(),
          url: $('#af_url').val().trim(), currentPrice: +$('#af_currentPrice').val() || 0,
          targetPrice: +$('#af_targetPrice').val() || 0,
          endTime: $('#af_endTime').val() ? new Date($('#af_endTime').val()).toISOString() : new Date().toISOString(),
          notified: !!auc.notified
        };
        if (!data.title) { showToast('请填写标题', 'error'); return; }
        if (isEdit) {
          data.id = id;
          await BV.store.put('auctions', data);
          if (data.currentPrice !== auc.currentPrice) {
            await BV.store.add('auctionPrices', { auctionId: id, price: data.currentPrice, recordedAt: new Date().toISOString() });
          }
        } else {
          const r = await BV.store.add('auctions', data);
          await BV.store.add('auctionPrices', { auctionId: r, price: data.currentPrice, recordedAt: new Date().toISOString() });
        }
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('保存成功', 'success');
        renderAuction();
      });
    });
  }

  let valCharts = {};
  async function renderValuation() {
    if (valCharts.c1) valCharts.c1.destroy();
    if (valCharts.c2) valCharts.c2.destroy();
    if (valCharts.c3) valCharts.c3.destroy();

    const [parts, sets] = await Promise.all([BV.store.getAll('parts'), BV.store.getAll('sets')]);

    const colorCount = {};
    parts.forEach(p => { colorCount[p.color||'未知'] = (colorCount[p.color||'未知']||0) + (p.quantity||0); });
    valCharts.c1 = BVChart.pie('colorPieChart', {
      labels: Object.keys(colorCount),
      values: Object.values(colorCount)
    });

    const catCount = {};
    parts.forEach(p => { catCount[p.category||'未知'] = (catCount[p.category||'未知']||0) + (p.quantity||0); });
    valCharts.c2 = BVChart.bar('categoryBarChart', {
      labels: Object.keys(catCount),
      values: Object.values(catCount),
      label: '零件数量'
    });

    const yearCount = {};
    sets.forEach(s => {
      if (s.purchaseDate) {
        const y = s.purchaseDate.slice(0,4);
        yearCount[y] = (yearCount[y]||0) + (s.purchasePrice||0);
      }
    });
    const sortedYears = Object.keys(yearCount).sort();
    valCharts.c3 = BVChart.line('yearLineChart', {
      labels: sortedYears,
      values: sortedYears.map(y => yearCount[y]),
      label: '年度投入 (¥)'
    }, {
      scales: { y: { ticks: { callback: v => '¥' + v } } }
    });

    const totalPartValue = parts.reduce((s,p) => s + (p.quantity||0)*(p.unitPrice||0), 0);
    const totalSetValue = sets.reduce((s,x) => s + (x.purchasePrice||0), 0);
    $('#totalPartValue').text('¥' + totalPartValue.toFixed(0));
    $('#totalSetValue').text('¥' + totalSetValue.toFixed(0));
    $('#totalValue').text('¥' + (totalPartValue + totalSetValue).toFixed(0));
    $('#totalPieces').text(parts.reduce((s,p)=>s+(p.quantity||0),0).toLocaleString());
  }

  let calDate = new Date();
  async function renderLug() {
    const events = await BV.store.getAll('events');
    renderCalendar(events);
    $('#btnAddEvent').on('click', () => eventModal());
    $('#calPrev').on('click', () => { calDate.setMonth(calDate.getMonth()-1); renderCalendar(events); });
    $('#calNext').on('click', () => { calDate.setMonth(calDate.getMonth()+1); renderCalendar(events); });
    $('#btnExportICS').on('click', () => exportICS(events));
    $(document).off('click', '.event-dot').on('click', '.event-dot', (e) => { eventModal($(e.currentTarget).data('id')); e.stopPropagation(); });
  }

  function renderCalendar(events) {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    $('#calTitle').text(`${y} 年 ${m+1} 月`);
    const first = new Date(y, m, 1);
    const last = new Date(y, m+1, 0);
    const startDay = first.getDay();
    const daysInMonth = last.getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    const weekdays = ['日','一','二','三','四','五','六'];
    let html = weekdays.map(d => `<div class="calendar-header">${d}</div>`).join('');

    const prevLast = new Date(y, m, 0).getDate();
    for (let i = 0; i < startDay; i++) {
      html += `<div class="calendar-day other-month"><div class="calendar-date">${prevLast - startDay + i + 1}</div></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cur = new Date(y, m, d); cur.setHours(0,0,0,0);
      const dayEvents = events.filter(e => {
        const s = new Date(e.startDate), en = new Date(e.endDate || e.startDate);
        return cur >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && cur <= new Date(en.getFullYear(), en.getMonth(), en.getDate());
      });
      const isToday = cur.getTime() === today.getTime();
      html += `<div class="calendar-day ${isToday?'today':''}">
        <div class="calendar-date">${d}</div>
        ${dayEvents.slice(0,3).map(e => `<div class="event-dot event-${e.type}" data-id="${e.id}" title="${e.title}">${e.title}</div>`).join('')}
        ${dayEvents.length > 3 ? `<div class="small text-muted">+${dayEvents.length-3} 更多</div>` : ''}
      </div>`;
    }
    const total = startDay + daysInMonth;
    const trail = (7 - total % 7) % 7;
    for (let i = 1; i <= trail; i++) {
      html += `<div class="calendar-day other-month"><div class="calendar-date">${i}</div></div>`;
    }
    $('#calendarGrid').html(html);
  }

  function eventModal(id) {
    const isEdit = !!id;
    BV.store.get('events', id).then(ev => {
      const e = ev || {};
      const body = `
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">类型</label><select class="form-select" id="ef_type">
            <option value="lug" ${e.type==='lug'?'selected':''}>LUG 聚会</option>
            <option value="brickfair" ${e.type==='brickfair'?'selected':''}>BRICKFAIR 展会</option>
          </select></div>
          <div class="col-md-6"><label class="form-label">标题</label><input class="form-control" id="ef_title" value="${e.title||''}"></div>
          <div class="col-md-6"><label class="form-label">开始日期</label><input type="date" class="form-control" id="ef_start" value="${e.startDate||''}"></div>
          <div class="col-md-6"><label class="form-label">结束日期</label><input type="date" class="form-control" id="ef_end" value="${e.endDate||''}"></div>
          <div class="col-12"><label class="form-label">地点</label><input class="form-control" id="ef_loc" value="${e.location||''}"></div>
          <div class="col-12"><label class="form-label">链接</label><input class="form-control" id="ef_url" value="${e.url||''}"></div>
          <div class="col-12"><label class="form-label">描述</label><textarea class="form-control" id="ef_desc" rows="3">${e.description||''}</textarea></div>
        </div>`;
      const footer = `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
        ${isEdit ? `<button type="button" class="btn btn-danger me-auto" id="ef_delete">删除</button>` : ''}
        <button type="button" class="btn btn-lego-red" id="ef_save">保存</button>`;
      showModal(isEdit ? '编辑活动' : '新增活动', body, footer);
      $('#ef_save').on('click', async () => {
        const data = {
          type: $('#ef_type').val(), title: $('#ef_title').val().trim(),
          startDate: $('#ef_start').val(), endDate: $('#ef_end').val() || $('#ef_start').val(),
          location: $('#ef_loc').val(), url: $('#ef_url').val(), description: $('#ef_desc').val()
        };
        if (!data.title || !data.startDate) { showToast('请填写标题和日期', 'error'); return; }
        if (isEdit) { data.id = id; await BV.store.put('events', data); }
        else await BV.store.add('events', data);
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('保存成功', 'success'); renderLug();
      });
      if (isEdit) $('#ef_delete').on('click', async () => {
        if (!confirm('确定删除？')) return;
        await BV.store.delete('events', id);
        bootstrap.Modal.getInstance('#genericModal').hide();
        showToast('已删除', 'success'); renderLug();
      });
    });
  }

  function exportICS(events) {
    const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BrickVault//CN'];
    events.forEach(e => {
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + BV.uuid() + '@brickvault');
      lines.push('SUMMARY:' + e.title);
      lines.push('DTSTART;VALUE=DATE:' + e.startDate.replace(/-/g,''));
      lines.push('DTEND;VALUE=DATE:' + (e.endDate || e.startDate).replace(/-/g,''));
      if (e.location) lines.push('LOCATION:' + e.location);
      if (e.description) lines.push('DESCRIPTION:' + e.description);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'brickvault-events.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('已导出 ICS 文件', 'success');
  }

  async function renderImport() {
    const zone = $('#importZone');
    const fileInput = $('#importFile');
    let lastResult = null;

    const handleFiles = async (files) => {
      const f = files[0];
      if (!f) return;
      try {
        const result = await BVImport.importFile(f);
        lastResult = result;
        $('#importSummary').html(`
          <div class="alert alert-info">
            <i class="bi bi-file-earmark-check"></i> 已解析 <strong>${f.name}</strong>
            <span class="ms-3">格式: <strong>${result.type.toUpperCase()}</strong></span>
            <span class="ms-3">记录: <strong>${result.rows.length}</strong> 条</span>
            <span class="ms-3">字段: <strong>${result.headers.length}</strong> 个</span>
          </div>
          <h6>字段映射预览（前 5 条）</h6>
          <div class="table-responsive">
            <table class="table table-sm">
              <thead><tr>${result.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
              <tbody>${result.rows.slice(0,5).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>`);
        $('#btnDoImport').prop('disabled', false);
      } catch (err) {
        showToast('解析失败: ' + err.message, 'error');
      }
    };

    zone.on('dragover', e => { e.preventDefault(); zone.addClass('dragover'); });
    zone.on('dragleave', () => zone.removeClass('dragover'));
    zone.on('drop', e => {
      e.preventDefault();
      zone.removeClass('dragover');
      handleFiles(e.originalEvent.dataTransfer.files);
    });
    zone.on('click', () => fileInput.click());
    fileInput.on('change', e => handleFiles(e.target.files));

    $('#btnDoImport').on('click', async () => {
      if (!lastResult) return;
      try {
        const n = await BV.store.bulkAdd('parts', lastResult.mapped);
        showToast(`成功导入 ${n} 条零件记录`, 'success');
        lastResult = null;
        $('#importSummary').empty();
        $('#btnDoImport').prop('disabled', true);
      } catch (err) {
        showToast('导入失败: ' + err.message, 'error');
      }
    });

    $('#btnExportAll').on('click', async () => {
      const parts = await BV.store.getAll('parts');
      const headers = ['partNumber','name','color','category','shape','quantity','unitPrice','location'];
      const rows = parts.map(p => headers.map(h => p[h] ?? ''));
      downloadCSV(rows, headers, 'brickvault-parts');
      showToast('已导出全部零件', 'success');
    });

    $('#btnSeedDemo').on('click', async () => {
      if (!confirm('将填充演示数据，是否继续？')) return;
      await seedData();
      showToast('演示数据已加载', 'success');
    });
  }

  async function init() {
    initTheme();
    await BV.store.init();
    await seedData();

    BVRouter.init('viewContainer');

    BVRouter.on('dashboard', renderDashboard);
    BVRouter.on('inventory', renderInventory);
    BVRouter.on('sets', renderSets);
    BVRouter.on('moc', renderMoc);
    BVRouter.on('auction', renderAuction);
    BVRouter.on('valuation', renderValuation);
    BVRouter.on('lug', renderLug);
    BVRouter.on('import', renderImport);

    $('#themeToggle').on('click', toggleTheme);
    $('#sidebarToggle').on('click', () => $('#sidebar').toggleClass('open'));
    $(document).on('click', '.main-content', () => {
      if (window.innerWidth < 992) $('#sidebar').removeClass('open');
    });
  }

  $(document).ready(init);

  global.BVApp = { showToast, showModal, downloadCSV };
})(window);
