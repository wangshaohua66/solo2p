(function ($) {
  'use strict';

  var gearId = $('#gearDetailRoot').data('id');
  var gear = null;
  var borrowHistory = [];

  function renderDetail() {
    var $root = $('#gearDetailRoot');
    var statusBadge = CampHub.ui.gearStatusBadge(gear.status);
    var owner = gear.owner || { nickname: '未知' };
    var borrower = gear.currentBorrower;
    var wearPercent = Math.min(100, Math.max(0, (gear.wearLevel || 0)));
    var wearColor = wearPercent >= 70 ? 'var(--ch-danger)' : wearPercent >= 40 ? 'var(--ch-accent)' : 'var(--ch-success)';

    var actions = '';
    var curUser = CampHub.auth.getUser();
    var isOwner = curUser && gear.ownerId === curUser.id;

    if (isOwner && gear.status === '在库') {
      actions += `<button class="btn btn-accent" id="lendBtn" data-bs-toggle="modal" data-bs-target="#lendModal">
          <i class="bi bi-arrow-up-circle me-1"></i>借出</button>`;
      actions += `<button class="btn btn-outline-secondary ms-2" id="editGearBtn"><i class="bi bi-pencil me-1"></i>编辑</button>`;
    }
    if (isOwner && gear.status === '借出') {
      actions += `<button class="btn btn-outline-primary" id="returnBtn" data-bs-toggle="modal" data-bs-target="#returnModal">
          <i class="bi bi-arrow-down-circle me-1"></i>登记归还</button>`;
    }
    if (isOwner && (gear.status === '维修中' || gear.status === '在库')) {
      actions += `<button class="btn btn-outline-primary ms-2" id="recordMaintBtn"><i class="bi bi-gear-wide-connected me-1"></i>记录保养</button>`;
    }

    var maintenanceInfo = '';
    if (gear.needsMaintenance) {
      maintenanceInfo = `<div class="alert alert-warning mt-3 mb-0" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <strong>保养提醒：</strong>已使用 ${gear.usesSinceMaintenance || 0} 次，超过保养阈值 ${gear.nextMaintenanceAfterUses} 次，建议尽快保养。
      </div>`;
    } else {
      var remaining = (gear.nextMaintenanceAfterUses || 20) - (gear.usesSinceMaintenance || 0);
      maintenanceInfo = `<div class="text-muted small mt-2">
        <i class="bi bi-check-circle me-1 text-success"></i>
        距下次保养还剩 <strong class="text-ch-primary">${remaining}</strong> 次使用
        （上次保养后已用 ${gear.usesSinceMaintenance || 0} / ${gear.nextMaintenanceAfterUses} 次）
      </div>`;
    }

    var borrowerInfo = '';
    if (borrower && gear.status === '借出') {
      var dueText = gear.dueDate ? CampHub.ui.formatLocalDate(gear.dueDate) : '未知';
      borrowerInfo = `<div class="card p-3 bg-ch-primary-50 mt-3">
        <div class="d-flex align-items-center gap-3">
          ${CampHub.ui.avatar(borrower, 44)}
          <div style="flex:1;min-width:0;">
            <div class="fw-bold">借用人：${CampHub.util.escapeHtml(borrower.nickname)}</div>
            <div class="small text-muted">预计归还：${dueText}</div>
          </div>
          ${CampHub.ui.creditBadge(borrower.creditScore || 0)}
        </div>
      </div>`;
    }

    $root.html(`
      <div class="row g-4">
        <div class="col-lg-5">
          <div class="card ch-gear-detail-img overflow-hidden">
            <img src="${gear.imageUrl || ('https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent(gear.category + ' camping gear product photo on white background') + '&image_size=portrait_4_3')}"
                 alt="${CampHub.util.escapeHtml(gear.name)}" class="w-100" style="object-fit:cover;aspect-ratio:4/3;" />
            <div class="position-absolute top-3 start-3">
              ${statusBadge}
              ${gear.needsMaintenance ? '<span class="badge rounded-pill bg-warning text-dark ms-2"><i class="bi bi-exclamation-triangle me-1"></i>待保养</span>' : ''}
            </div>
          </div>
          <div class="card mt-3 p-3">
            <h6 class="fw-bold mb-2"><i class="bi bi-bar-chart-line me-2 text-ch-primary"></i>损耗情况</h6>
            <div class="d-flex justify-content-between mb-1 small">
              <span class="text-muted">损耗程度</span>
              <span class="fw-bold">${wearPercent}%</span>
            </div>
            <div class="ch-progress" style="height:10px;">
              <div class="ch-progress-bar" style="width:${wearPercent}%;background:${wearColor};"></div>
            </div>
            <div class="d-flex justify-content-between mt-3 small text-muted">
              <span>累计使用 <strong class="text-dark">${gear.usageCount || 0}</strong> 次</span>
              <span>上次保养：${gear.lastMaintenanceDate ? CampHub.ui.formatLocalDate(gear.lastMaintenanceDate) : '无记录'}</span>
            </div>
            ${maintenanceInfo}
          </div>
        </div>
        <div class="col-lg-7">
          <div class="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h2 class="mb-1">${CampHub.util.escapeHtml(gear.name)}</h2>
              <div class="d-flex align-items-center gap-2 text-muted small">
                <span class="badge bg-ch-primary-50 text-ch-primary">${gear.category}</span>
                <span><i class="bi bi-person-circle me-1"></i>${CampHub.util.escapeHtml(owner.nickname)}</span>
                <span><i class="bi bi-tags me-1"></i>￥${gear.purchasePrice?.toFixed?.(0) || '-'}</span>
              </div>
            </div>
            <div>${actions}</div>
          </div>
          ${borrowerInfo}
          <div class="card p-4 mt-3">
            <h6 class="fw-bold mb-2"><i class="bi bi-info-circle me-2 text-ch-primary"></i>装备描述</h6>
            <p class="text-muted mb-0" style="white-space:pre-wrap;line-height:1.75;">
              ${CampHub.util.escapeHtml(gear.description || '暂无详细描述')}
            </p>
          </div>
          <div class="card p-4 mt-3">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h6 class="mb-0"><i class="bi bi-clock-history me-2 text-ch-primary"></i>借还记录</h6>
              <span class="badge rounded-pill bg-light text-muted">共 ${borrowHistory.length} 条</span>
            </div>
            <div id="borrowHistoryList" class="ch-borrow-history"></div>
          </div>
        </div>
      </div>`);

    renderBorrowHistory();
    bindActions();
  }

  function renderBorrowHistory() {
    var $list = $('#borrowHistoryList');
    if (!borrowHistory.length) {
      $list.html(CampHub.ui.emptyState('暂无借还记录', 'bi-clock-history'));
      return;
    }
    $list.html(borrowHistory.map(function (r) {
      var status = r.actualReturnDate
        ? '<span class="badge rounded-pill bg-success">已归还</span>'
        : '<span class="badge rounded-pill bg-warning text-dark">借出中</span>';
      var borrower = r.borrower || { nickname: '未知' };
      return `<div class="d-flex align-items-center gap-3 py-2 border-bottom" style="border-style:dashed !important;">
        ${CampHub.ui.avatar(borrower, 38)}
        <div style="flex:1;min-width:0;">
          <div class="d-flex align-items-center gap-2">
            <span class="fw-bold text-truncate">${CampHub.util.escapeHtml(borrower.nickname)}</span>
            ${status}
          </div>
          <div class="small text-muted">
            ${CampHub.ui.formatLocalDate(r.borrowDate)} → ${r.actualReturnDate ? CampHub.ui.formatLocalDate(r.actualReturnDate) : '未归还'}
          </div>
          ${r.notes ? `<div class="small text-muted mt-1"><i class="bi bi-chat-quote me-1"></i>${CampHub.util.escapeHtml(r.notes)}</div>` : ''}
        </div>
        <div class="text-end" style="min-width:60px;">
          ${r.creditChange ? `<div class="small ${r.creditChange > 0 ? 'text-success' : 'text-danger'} fw-bold">${r.creditChange > 0 ? '+' : ''}${r.creditChange}</div>` : ''}
          <div class="small text-muted">信用分</div>
        </div>
      </div>`;
    }).join(''));
  }

  function bindActions() {
    $('#lendBtn').on('click', function () {
      $('#lendGearId').val(gear.id);
      $('#lendModalLabel').text('借出「' + gear.name + '」');
    });

    $('#returnBtn').on('click', function () {
      $('#returnGearId').val(gear.id);
      $('#returnModalLabel').text('归还「' + gear.name + '」');
    });

    $('#recordMaintBtn').on('click', function () {
      CampHub.ui.confirm('确定记录一次保养？保养后使用次数将重新计算。').then(function (ok) {
        if (!ok) return;
        CampHub.ajax.post(`/gear/${gear.id}/maintenance`).then(function (g) {
          CampHub.ui.toast('保养记录成功', 'success');
          gear = g;
          renderDetail();
        }).catch(function (err) { CampHub.ui.toast(err.message || '失败', 'error'); });
      });
    });
  }

  function loadBorrowHistory() {
    CampHub.ajax.get(`/gear/${gearId}/borrow-records`, { limit: 20 }).then(function (list) {
      borrowHistory = list || [];
      if (gear) renderBorrowHistory();
    }).catch(function () {});
  }

  function loadDetail() {
    CampHub.ajax.get(`/gear/${gearId}`).then(function (g) {
      gear = g;
      renderDetail();
    }).catch(function () {
      $('#gearDetailRoot').html(CampHub.ui.emptyState('装备不存在或已删除', 'bi-box-x'));
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    if (!gearId) { $('#gearDetailRoot').html(CampHub.ui.emptyState('缺少装备ID', 'bi-exclamation-triangle')); return; }
    loadDetail();
    loadBorrowHistory();
  });
})(jQuery);
