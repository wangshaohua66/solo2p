/* 堤防管理页 — 堤防基础信息维护 · 等级与水位参数 · 责任人管理 */
App.registerPage('levee', {
  title: '堤防管理',
  sub: '堤防基础信息维护 · 等级与水位参数 · 责任人管理',
  async render($el, App) {
    const api = App.api;
    let editingId = null;

    const DESIGN_LEVELS = ['1级', '2级', '3级', '4级', '5级'];
    const MATERIALS = ['土堤', '混凝土', '砌石', '复合材料'];
    const STATUS_OPTIONS = [
      { value: 'normal', label: '正常' },
      { value: 'maintenance', label: '维护中' },
      { value: 'hazard', label: '隐患' },
      { value: 'damaged', label: '损毁' }
    ];

    $el.html(`
      <div class="filter-bar mb-3">
        <button class="btn btn-primary btn-sm ms-auto" id="addLevee"><i class="bi bi-plus-lg"></i> 新增堤防</button>
      </div>

      <div class="panel">
        <div class="panel-head"><span class="panel-title"><i class="bi bi-diagram-3"></i>堤防列表</span><span class="small text-muted" id="leveeCount"></span></div>
        <div class="panel-body">
          <div class="table-wrap"><table class="table card-collapse" id="leveeTable">
            <thead><tr>
              <th>堤防编号</th><th>堤防名称</th><th>所属河流</th><th>长度(km)</th>
              <th>设计等级</th><th>警戒水位</th><th>状态</th><th>责任人</th><th>操作</th>
            </tr></thead>
            <tbody></tbody>
          </table></div>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" id="leveeModal">
        <div class="modal-dialog modal-dialog-centered modal-lg">
          <div class="modal-content bg-dark border border-secondary">
            <div class="modal-header border-secondary">
              <h6 class="modal-title" id="leveeModalTitle"><i class="bi bi-diagram-3"></i> 新增堤防</h6>
              <button class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="leveeForm">
                <div class="row g-2">
                  <div class="col-12 col-md-6"><label class="form-label">堤防编号 <span class="text-danger">*</span></label>
                    <input class="form-control form-control-sm" id="fCode" placeholder="例：DF-001">
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">堤防名称 <span class="text-danger">*</span></label>
                    <input class="form-control form-control-sm" id="fName" placeholder="例：城北防洪堤">
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">所属河流 <span class="text-danger">*</span></label>
                    <input class="form-control form-control-sm" id="fRiverName" placeholder="例：东江">
                  </div>
                  <div class="col-12 col-md-6"><label class="form-label">长度(km) <span class="text-danger">*</span></label>
                    <input class="form-control form-control-sm mono" id="fLengthKm" type="number" step="0.01" min="0" placeholder="例：5.20">
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">起点</label>
                    <input class="form-control form-control-sm" id="fStartPoint" placeholder="例：桩号0+000">
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">终点</label>
                    <input class="form-control form-control-sm" id="fEndPoint" placeholder="例：桩号5+200">
                  </div>
                  <div class="col-12 col-md-4"><label class="form-label">设计等级 <span class="text-danger">*</span></label>
                    <select class="form-select form-select-sm" id="fDesignLevel">
                      ${DESIGN_LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">设计水位(m)</label>
                    <input class="form-control form-control-sm mono" id="fDesignWaterLevel" type="number" step="0.01" placeholder="例：25.50">
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">保证水位(m)</label>
                    <input class="form-control form-control-sm mono" id="fGuaranteeWaterLevel" type="number" step="0.01" placeholder="例：24.80">
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">警戒水位(m) <span class="text-danger">*</span></label>
                    <input class="form-control form-control-sm mono" id="fWarningWaterLevel" type="number" step="0.01" placeholder="例：23.50">
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">材质</label>
                    <select class="form-select form-select-sm" id="fMaterial">
                      ${MATERIALS.map(m => `<option value="${m}">${m}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-6 col-md-4"><label class="form-label">状态 <span class="text-danger">*</span></label>
                    <select class="form-select form-select-sm" id="fStatus">
                      ${STATUS_OPTIONS.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-12 col-md-4"><label class="form-label">责任单位</label>
                    <input class="form-control form-control-sm" id="fResponsibleUnit" placeholder="例：城北水利所">
                  </div>
                  <div class="col-12 col-md-4"><label class="form-label">责任人</label>
                    <input class="form-control form-control-sm" id="fResponsiblePerson" placeholder="例：李明">
                  </div>
                  <div class="col-12 col-md-4"><label class="form-label">联系电话</label>
                    <input class="form-control form-control-sm" id="fContactPhone" placeholder="例：13800138000">
                  </div>
                  <div class="col-12"><label class="form-label">备注描述</label>
                    <textarea class="form-control form-control-sm" id="fDescription" rows="2" placeholder="选填"></textarea>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer border-secondary">
              <button class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">取消</button>
              <button class="btn btn-primary btn-sm" id="submitLevee"><i class="bi bi-check2-circle"></i> 保存</button>
            </div>
          </div>
        </div>
      </div>
    `);

    let modal = new bootstrap.Modal(document.getElementById('leveeModal'));

    async function renderList() {
      try {
        const rowsRaw = await api.levee.list({ pageSize: 100 });
        const rows = adaptLevees(rowsRaw);
        $('#leveeCount').text('共 ' + rows.length + ' 条');
        if (!rows.length) {
          $('#leveeTable tbody').html('<tr><td colspan="9"><div class="empty"><i class="bi bi-inbox"></i>暂无堤防数据</div></td></tr>');
          return;
        }
        $('#leveeTable tbody').html(rows.map(l => `<tr>
          <td data-label="堤防编号" class="mono">${l.code}</td>
          <td data-label="堤防名称">${l.name}</td>
          <td data-label="所属河流">${l.riverName}</td>
          <td data-label="长度(km)" class="mono">${l.lengthKm}</td>
          <td data-label="设计等级"><span class="tag info">${l.designLevel}</span></td>
          <td data-label="警戒水位" class="mono">${l.warningWaterLevel} m</td>
          <td data-label="状态">${App.statusTag(mapStatus(l.status))}</td>
          <td data-label="责任人">${l.responsiblePerson || '—'}</td>
          <td data-label="操作">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-light" data-edit="${l._id}"><i class="bi bi-pencil"></i> 编辑</button>
              <button class="btn btn-outline-danger" data-del="${l._id}"><i class="bi bi-trash"></i> 删除</button>
            </div>
          </td>
        </tr>`).join(''));
      } catch (err) {
        $('#leveeTable tbody').html('<tr><td colspan="9"><div class="empty text-danger"><i class="bi bi-exclamation-triangle"></i>' + (err.message || '加载失败') + '</div></td></tr>');
        App.toast(err.message || '加载失败', 'error');
      }
    }

    function openModal(levee) {
      editingId = levee ? levee._id : null;
      $('#leveeModalTitle').html(levee ? '<i class="bi bi-pencil"></i> 编辑堤防' : '<i class="bi bi-plus-lg"></i> 新增堤防');
      $('#fCode').val(levee ? levee.code : '');
      $('#fName').val(levee ? levee.name : '');
      $('#fRiverName').val(levee ? levee.riverName : '');
      $('#fStartPoint').val(levee ? levee.startPoint || '' : '');
      $('#fEndPoint').val(levee ? levee.endPoint || '' : '');
      $('#fLengthKm').val(levee ? levee.lengthKm : '');
      $('#fDesignLevel').val(levee ? levee.designLevel : DESIGN_LEVELS[0]);
      $('#fDesignWaterLevel').val(levee ? levee.designWaterLevel ?? '' : '');
      $('#fGuaranteeWaterLevel').val(levee ? levee.guaranteeWaterLevel ?? '' : '');
      $('#fWarningWaterLevel').val(levee ? levee.warningWaterLevel ?? '' : '');
      $('#fMaterial').val(levee ? levee.material || MATERIALS[0] : MATERIALS[0]);
      $('#fStatus').val(levee ? levee.status || 'normal' : 'normal');
      $('#fResponsibleUnit').val(levee ? levee.responsibleUnit || '' : '');
      $('#fResponsiblePerson').val(levee ? levee.responsiblePerson || '' : '');
      $('#fContactPhone').val(levee ? levee.contactPhone || '' : '');
      $('#fDescription').val(levee ? levee.description || '' : '');
      modal.show();
    }

    function collectFormData() {
      return {
        code: $('#fCode').val().trim(),
        name: $('#fName').val().trim(),
        riverName: $('#fRiverName').val().trim(),
        startPoint: $('#fStartPoint').val().trim(),
        endPoint: $('#fEndPoint').val().trim(),
        lengthKm: parseFloat($('#fLengthKm').val()),
        designLevel: $('#fDesignLevel').val(),
        designWaterLevel: parseFloatOrNull($('#fDesignWaterLevel').val()),
        guaranteeWaterLevel: parseFloatOrNull($('#fGuaranteeWaterLevel').val()),
        warningWaterLevel: parseFloat($('#fWarningWaterLevel').val()),
        material: $('#fMaterial').val(),
        status: $('#fStatus').val(),
        responsibleUnit: $('#fResponsibleUnit').val().trim(),
        responsiblePerson: $('#fResponsiblePerson').val().trim(),
        contactPhone: $('#fContactPhone').val().trim(),
        description: $('#fDescription').val().trim()
      };
    }

    function parseFloatOrNull(v) {
      if (v === '' || v == null) return null;
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    }

    function validateForm(d) {
      if (!d.code) return '请填写堤防编号';
      if (!d.name) return '请填写堤防名称';
      if (!d.riverName) return '请填写所属河流';
      if (isNaN(d.lengthKm)) return '请填写正确的长度';
      if (isNaN(d.warningWaterLevel)) return '请填写警戒水位';
      return null;
    }

    function mapStatus(s) {
      if (!s) return 'pending';
      const low = String(s).toLowerCase();
      if (low === 'normal' || low === '正常') return 'confirmed';
      if (low === 'maintenance' || low === '维护中') return 'processing';
      if (low === 'hazard' || low === '隐患') return 'warning';
      if (low === 'damaged' || low === '损毁') return 'danger';
      return low;
    }

    $('#addLevee').on('click', function () { openModal(null); });

    $('#leveeTable').on('click', '[data-edit]', async function () {
      const id = $(this).data('edit');
      try {
        const raw = await api.levee.get(id);
        const levee = adaptLevee(raw);
        openModal(levee);
      } catch (err) { App.toast(err.message || '获取数据失败', 'error'); }
    });

    $('#leveeTable').on('click', '[data-del]', async function () {
      const id = $(this).data('del');
      if (!window.confirm('确定要删除该堤防记录吗？此操作不可恢复。')) return;
      try {
        await api.levee.remove(id);
        App.toast('删除成功', 'success');
        renderList();
      } catch (err) { App.toast(err.message || '删除失败', 'error'); }
    });

    $('#submitLevee').on('click', async function () {
      const data = collectFormData();
      const err = validateForm(data);
      if (err) { App.toast(err, 'warn'); return; }
      try {
        if (editingId) {
          await api.levee.update(editingId, data);
          App.toast('更新成功', 'success');
        } else {
          await api.levee.create(data);
          App.toast('创建成功', 'success');
        }
        modal.hide();
        renderList();
      } catch (err) { App.toast(err.message || '保存失败', 'error'); }
    });

    await renderList();
  }
});

function adaptLevees(raw) {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(adaptLevee);
}

function adaptLevee(l) {
  if (!l) return null;
  return {
    _id: l.id || l.Id || l._id,
    code: l.code || l.Code || l.leveeCode || '',
    name: l.name || l.Name || l.leveeName || '',
    riverName: l.riverName || l.RiverName || '',
    startPoint: l.startPoint || l.StartPoint || '',
    endPoint: l.endPoint || l.EndPoint || '',
    lengthKm: l.lengthKm ?? l.LengthKm ?? l.length ?? 0,
    designLevel: l.designLevel || l.DesignLevel || '',
    designWaterLevel: l.designWaterLevel ?? l.DesignWaterLevel ?? null,
    guaranteeWaterLevel: l.guaranteeWaterLevel ?? l.GuaranteeWaterLevel ?? null,
    warningWaterLevel: l.warningWaterLevel ?? l.WarningWaterLevel ?? 0,
    material: l.material || l.Material || '',
    status: l.status || l.Status || 'normal',
    responsibleUnit: l.responsibleUnit || l.ResponsibleUnit || '',
    responsiblePerson: l.responsiblePerson || l.ResponsiblePerson || '',
    contactPhone: l.contactPhone || l.ContactPhone || '',
    description: l.description || l.Description || ''
  };
}
