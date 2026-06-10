(function ($) {
  'use strict';

  var eventId = $('#eventDetailRoot').data('id');
  var ev = null;
  var ratings = [];
  var currentUser = CampHub.auth.getUser();
  var version = 1;
  var activeTab = 'info';

  function renderHeader() {
    var $root = $('#eventDetailRoot').empty();
    var statusBadge = CampHub.ui.eventStatusBadge(ev.status);
    version = ev.version;

    var creator = ev.creator || { nickname: '未知' };
    var isOwner = currentUser && ev.creatorId === currentUser.id;
    var isParticipant = ev.participants.some(p => p.userId === (currentUser && currentUser.id));

    var actionBtns = '';
    if (!isParticipant && ev.status === '筹备')
      actionBtns += `<button class="btn btn-outline-primary btn-sm" id="joinEventBtn"><i class="bi bi-person-plus me-1"></i>报名参加</button>`;
    if (isOwner && ev.status !== '归档')
      actionBtns += `<button class="btn btn-outline-secondary btn-sm" id="editEventBtn"><i class="bi bi-pencil me-1"></i>编辑</button>`;
    if (isOwner && (ev.status === '筹备' || ev.status === '进行'))
      actionBtns += `<button class="btn btn-accent btn-sm" id="recalcRecommendBtn"><i class="bi bi-stars me-1"></i>重新推荐清单</button>`;
    if (isOwner && (ev.status === '结束' || ev.status === '进行'))
      actionBtns += `<button class="btn btn-outline-primary btn-sm" id="goRatingBtn" data-bs-toggle="modal" data-bs-target="#ratingModal"><i class="bi bi-star me-1"></i>营地评价</button>`;
    if (isParticipant && !ev.participants.some(p => p.userId === currentUser.id && p.userId === currentUser.id) && (ev.status === '结束'))
      actionBtns += `<button class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#ratingModal"><i class="bi bi-star me-1"></i>评价营地</button>`;

    var participantsHtml = ev.participants.map(p => {
      var u = p.user || {};
      return `<div class="ch-event-info-item">
        <div>${CampHub.ui.avatar(u, 36)}</div>
        <div style="min-width:0;">
          <div class="label">${CampHub.util.escapeHtml(p.role)}${p.confirmed ? ' · 已确认' : ''}</div>
          <div class="value">${CampHub.util.escapeHtml(u.nickname || '用户')}</div>
        </div>
      </div>`;
    }).join('');

    $root.html(`
      <div class="ch-event-header">
        <div class="ch-event-header-top">
          <div class="ch-event-title-wrap">
            <h2>${CampHub.util.escapeHtml(ev.title)} ${statusBadge}</h2>
            <div class="ch-event-destination">
              <i class="bi bi-geo-alt"></i>
              <span>${CampHub.util.escapeHtml(ev.destination)}</span>
              ${ev.geoLocation ? `<span class="text-muted ms-2">[${ev.geoLocation.map(n => Math.round(n*1000)/1000).join(', ')}]</span>` : ''}
            </div>
            <small class="text-muted"><i class="bi bi-person-badge me-1"></i>组织者：${CampHub.util.escapeHtml(creator.nickname)} · 创建于 ${CampHub.ui.formatLocalDate(ev.createdAt)}</small>
          </div>
          <div class="ch-event-actions">${actionBtns}</div>
        </div>
        <div class="ch-event-info-grid">
          <div class="ch-event-info-item">
            <i class="bi bi-calendar-event"></i>
            <div>
              <div class="label">活动时间</div>
              <div class="value">${CampHub.ui.formatLocalDateTime(ev.startTime)} ~ ${CampHub.ui.formatLocalDate(ev.endTime)}</div>
            </div>
          </div>
          <div class="ch-event-info-item">
            <i class="bi bi-people"></i>
            <div>
              <div class="label">参与人数</div>
              <div class="value">${ev.participants.length} / ${ev.maxParticipants} 人</div>
            </div>
          </div>
          <div class="ch-event-info-item">
            <i class="bi bi-list-check"></i>
            <div>
              <div class="label">装备清单</div>
              <div class="value">${ev.gearList.length} 项 · 已确认 ${ev.gearList.filter(g=>g.checked).length}</div>
            </div>
          </div>
          <div class="ch-event-info-item">
            <i class="bi bi-bag"></i>
            <div>
              <div class="label">采购清单</div>
              <div class="value">${ev.purchaseList.length} 项 · 已采购 ${ev.purchaseList.filter(p=>p.purchased).length}</div>
            </div>
          </div>
        </div>
        ${ev.description ? `<div class="mt-3 p-3 bg-ch-primary-50 rounded-3 small">${CampHub.util.escapeHtml(ev.description).replace(/\n/g, '<br/>')}</div>` : ''}
      </div>

      <ul class="nav nav-tabs ch-event-tabs ch-nav-tabs-scroll" role="tablist">
        <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabInfo">活动信息</button></li>
        <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabParticipants">参与人员 (${ev.participants.length})</button></li>
        <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabGear">装备清单 (${ev.gearList.length})</button></li>
        <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabPurchase">采购清单 (${ev.purchaseList.length})</button></li>
        <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabPhotos">照片墙</button></li>
        <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabRatings">营地评价</button></li>
      </ul>

      <div class="tab-content mt-3">
        <div class="tab-pane fade show active" id="tabInfo" role="tabpanel">
          <div class="card p-4">
            <h5 class="mb-3"><i class="bi bi-info-circle me-2 text-ch-primary"></i>活动简介</h5>
            <p class="text-muted mb-4">${CampHub.util.escapeHtml(ev.description || '暂无详细介绍') || '暂无详细介绍'}</p>
            <h6 class="fw-bold mb-2">活动分工</h6>
            <div class="ch-event-info-grid">${participantsHtml || '<div class="text-muted">暂无参与人员</div>'}</div>
          </div>
        </div>

        <div class="tab-pane fade" id="tabParticipants" role="tabpanel">
          <div class="card p-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <h5 class="mb-0"><i class="bi bi-people me-2 text-ch-primary"></i>参与人员 (${ev.participants.length}/${ev.maxParticipants})</h5>
              ${isOwner ? `<button class="btn btn-outline-primary btn-sm" id="addParticipantBtn2"><i class="bi bi-person-plus me-1"></i>邀请成员</button>` : ''}
            </div>
            <div class="table-responsive">
              <table class="table table-hover">
                <thead><tr><th>成员</th><th>角色</th><th>确认状态</th><th>加入时间</th></tr></thead>
                <tbody id="participantsBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="tab-pane fade" id="tabGear" role="tabpanel">
          <div class="card p-4">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 class="mb-0"><i class="bi bi-backpack2 me-2 text-ch-primary"></i>装备清单</h5>
              <div>
                <button class="btn btn-outline-secondary btn-sm me-1" id="addGearBtn"><i class="bi bi-plus me-1"></i>添加项</button>
                <button class="btn btn-accent btn-sm" id="saveGearBtn"><i class="bi bi-save me-1"></i>保存清单</button>
              </div>
            </div>
            <div id="gearListContainer"></div>
          </div>
        </div>

        <div class="tab-pane fade" id="tabPurchase" role="tabpanel">
          <div class="card p-4">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 class="mb-0"><i class="bi bi-bag me-2 text-ch-accent"></i>采购清单</h5>
              <button class="btn btn-accent btn-sm" id="addPurchaseBtn"><i class="bi bi-plus me-1"></i>添加采购项</button>
            </div>
            <div id="purchaseListContainer"></div>
          </div>
        </div>

        <div class="tab-pane fade" id="tabPhotos" role="tabpanel">
          <div class="card p-4">
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 class="mb-0"><i class="bi bi-images me-2 text-ch-primary"></i>活动照片</h5>
              <button class="btn btn-primary btn-sm" id="uploadEventPhotoBtn"><i class="bi bi-cloud-upload me-1"></i>上传照片</button>
            </div>
            <div class="ch-photo-grid" id="eventPhotosGrid"></div>
          </div>
        </div>

        <div class="tab-pane fade" id="tabRatings" role="tabpanel">
          <div class="card p-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h5 class="mb-0"><i class="bi bi-stars me-2 text-ch-accent"></i>营地评价</h5>
              <button class="btn btn-outline-primary btn-sm" id="rateBtn2" data-bs-toggle="modal" data-bs-target="#ratingModal">我要评价</button>
            </div>
            <div id="ratingsContainer"></div>
          </div>
        </div>
      </div>

      <input type="file" id="eventPhotoFileInput" accept="image/*" multiple class="d-none" />
    `);

    renderParticipantsTable();
    renderGearList();
    renderPurchaseList();
    renderPhotos();
    renderRatings();
    bindEventActions();
  }

  function renderParticipantsTable() {
    var roles = ['组织者', '厨师', '司机', '摄影', '医疗', '采购员', '参与者'];
    $('#participantsBody').html(ev.participants.map(p => {
      var u = p.user || { nickname: '用户' };
      return `<tr>
        <td data-label="成员">
          <div class="d-flex align-items-center gap-2">
            ${CampHub.ui.avatar(u, 34)}
            <div>
              <div class="fw-bold">${CampHub.util.escapeHtml(u.nickname)}</div>
              <small class="text-muted">${CampHub.util.escapeHtml(u.email || '')}</small>
            </div>
          </div>
        </td>
        <td data-label="角色"><select class="form-select form-select-sm p-role" data-user="${p.userId}" style="width:auto;">
          ${roles.map(r => `<option ${p.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select></td>
        <td data-label="状态">${p.confirmed
          ? '<span class="badge rounded-pill bg-success">已确认</span>'
          : '<span class="badge rounded-pill bg-secondary">待确认</span>'}</td>
        <td data-label="加入时间" class="small text-muted">${CampHub.ui.formatLocalDate(p.joinedAt)}</td>
      </tr>`;
    }).join(''));
    $('#participantsTable').addClass('table-card-mobile');
  }

  function renderGearList() {
    var categories = {};
    ev.gearList.forEach(function (g) {
      if (!categories[g.category]) categories[g.category] = [];
      categories[g.category].push(g);
    });
    var html = '';
    Object.keys(categories).forEach(function (cat) {
      html += `<h6 class="fw-bold text-ch-primary mt-3 mb-2 border-bottom pb-2"><i class="bi bi-folder2-open me-1"></i>${cat}</h6>
        <div class="table-responsive mb-3">
          <table class="table table-sm table-hover align-middle table-card-mobile">
            <thead><tr>
              <th style="width:40px;"></th>
              <th>名称</th>
              <th style="width:100px;">数量</th>
              <th>携带人</th>
              <th style="width:60px;">操作</th>
            </tr></thead>
            <tbody>`;
      categories[cat].forEach(function (g, i) {
        var userOptions = ev.participants.map(p =>
          `<option value="${p.userId}" ${g.broughtByUserId === p.userId ? 'selected' : ''}>${CampHub.util.escapeHtml((p.user || {}).nickname || '用户')}</option>`
        ).join('');
        html += `<tr class="${!g.checked && !g.broughtByUserId ? 'table-warning' : ''}">
          <td data-label=""><input type="checkbox" class="form-check-input gear-checked" ${g.checked ? 'checked' : ''} data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="名称"><input type="text" class="form-control form-control-sm gear-name border-0 bg-transparent" value="${CampHub.util.escapeHtml(g.name)}" data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="数量"><input type="number" class="form-control form-control-sm gear-qty" min="1" value="${g.quantity}" data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="携带人"><select class="form-select form-select-sm gear-user" data-cat="${cat}" data-idx="${i}">
            <option value="">-- 待分配 --</option>${userOptions}
          </select></td>
          <td data-label="操作"><button class="btn btn-sm btn-outline-danger gear-remove" data-cat="${cat}" data-idx="${i}"><i class="bi bi-trash"></i></button></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    });
    if (!html) html = CampHub.ui.emptyState('暂无装备项，点击"添加项"或使用系统推荐', 'bi-box');
    $('#gearListContainer').html(html);
  }

  function renderPurchaseList() {
    var byCategory = {};
    ev.purchaseList.forEach(function (p) { if (!byCategory[p.category]) byCategory[p.category] = []; byCategory[p.category].push(p); });
    var html = '';
    Object.keys(byCategory).forEach(cat => {
      html += `<h6 class="fw-bold text-ch-accent mt-3 mb-2 border-bottom pb-2"><i class="bi bi-basket me-1"></i>${cat}</h6>
        <div class="table-responsive"><table class="table table-sm align-middle table-card-mobile">
          <thead><tr><th style="width:36px;"></th><th>名称</th><th style="width:90px;">数量</th><th style="width:70px;">单位</th><th>负责人</th><th style="width:50px;"></th></tr></thead><tbody>`;
      byCategory[cat].forEach((p, i) => {
        html += `<tr class="${p.purchased ? 'table-success' : ''}">
          <td data-label=""><input type="checkbox" class="form-check-input p-purchased" ${p.purchased ? 'checked' : ''} data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="名称"><input class="form-control form-control-sm border-0 bg-transparent p-name" value="${CampHub.util.escapeHtml(p.name)}" data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="数量"><input type="number" class="form-control form-control-sm p-qty" min="1" value="${p.quantity}" data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="单位"><input class="form-control form-control-sm p-unit" value="${CampHub.util.escapeHtml(p.unit || '份')}" data-cat="${cat}" data-idx="${i}" /></td>
          <td data-label="负责人"><select class="form-select form-select-sm p-user" data-cat="${cat}" data-idx="${i}">
            <option value="">-- 未分配 --</option>
            ${ev.participants.map(p2 => `<option value="${p2.userId}" ${p.assignedToUserId === p2.userId ? 'selected' : ''}>${CampHub.util.escapeHtml((p2.user || {}).nickname || '')}</option>`).join('')}
          </select></td>
          <td data-label=""><button class="btn btn-sm btn-outline-danger p-remove" data-cat="${cat}" data-idx="${i}"><i class="bi bi-x"></i></button></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    });
    if (!html) html = CampHub.ui.emptyState('暂无采购项，点击添加', 'bi-bag-x');
    $('#purchaseListContainer').html(html);
  }

  function renderPhotos() {
    var $grid = $('#eventPhotosGrid');
    CampHub.ajax.get(`/photo/event/${eventId}`, { limit: 60 }).then(function (photos) {
      if (!photos || !photos.length) {
        $grid.parent().find('.ch-photo-grid').replaceWith('<div class="mt-3">' + CampHub.ui.emptyState('本活动还没有上传照片', 'bi-camera') + '</div>');
        return;
      }
      $grid.html(photos.map(p => `
        <div class="ch-photo-item" data-id="${p.id}" data-file="${p.fileUrl}">
          <img src="${p.thumbUrl || p.fileUrl}" alt="" loading="lazy" />
          <div class="ch-photo-overlay">
            <div class="ch-photo-meta-row">
              <div>${p.takenAt ? CampHub.ui.formatLocalDateTime(p.takenAt) : '无时间'}</div>
              <div>${p.gpsLat ? '📍GPS' : ''}</div>
            </div>
            <div class="small mt-1"><i class="bi bi-person-circle me-1"></i>${CampHub.util.escapeHtml((p.uploader || {}).nickname || '')}</div>
          </div>
        </div>`).join(''));
    }).catch(function () { $grid.html(CampHub.ui.emptyState('照片加载失败', 'bi-exclamation-triangle')); });
  }

  function renderRatings() {
    var $c = $('#ratingsContainer');
    if (!ratings.length) {
      $c.html(CampHub.ui.emptyState('还没有评价，快来第一个评价吧！', 'bi-star'));
      return;
    }
    var avg = { t: 0, s: 0, f: 0, sf: 0 };
    ratings.forEach(r => { avg.t += r.transportationScore; avg.s += r.sceneryScore; avg.f += r.facilityScore; avg.sf += r.safetyScore; });
    var n = ratings.length;
    var avgHtml = `
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3"><div class="text-center p-3 bg-ch-primary-50 rounded-3">
          <div class="fs-3 fw-bold text-ch-primary">${(avg.t/n).toFixed(1)}</div>
          <small class="text-muted">交通便利</small>
        </div></div>
        <div class="col-6 col-md-3"><div class="text-center p-3 bg-ch-primary-50 rounded-3">
          <div class="fs-3 fw-bold text-ch-primary">${(avg.s/n).toFixed(1)}</div>
          <small class="text-muted">风景指数</small>
        </div></div>
        <div class="col-6 col-md-3"><div class="text-center p-3 bg-ch-primary-50 rounded-3">
          <div class="fs-3 fw-bold text-ch-primary">${(avg.f/n).toFixed(1)}</div>
          <small class="text-muted">设施完善</small>
        </div></div>
        <div class="col-6 col-md-3"><div class="text-center p-3 bg-ch-primary-50 rounded-3">
          <div class="fs-3 fw-bold text-ch-primary">${(avg.sf/n).toFixed(1)}</div>
          <small class="text-muted">安全指数</small>
        </div></div>
      </div><hr/>`;
    $c.html(avgHtml + ratings.map(r => `
      <div class="d-flex gap-3 mb-4 pb-4 border-bottom">
        ${CampHub.ui.avatar(r.user || {}, 48)}
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="fw-bold">${CampHub.util.escapeHtml((r.user || {}).nickname || '用户')}</span>
            <span class="text-muted small">交通${CampHub.ui.stars(r.transportationScore)}</span>
            <span class="text-muted small">风景${CampHub.ui.stars(r.sceneryScore)}</span>
            <span class="text-muted small">设施${CampHub.ui.stars(r.facilityScore)}</span>
            <span class="text-muted small">安全${CampHub.ui.stars(r.safetyScore)}</span>
          </div>
          <div class="text-muted" style="white-space:pre-wrap;">${CampHub.util.escapeHtml(r.comments || '')}${r.comments ? '' : '<em class="opacity-50">无文字评价</em>'}</div>
        </div>
      </div>`).join(''));
  }

  function bindEventActions() {
    $('#joinEventBtn').on('click', function () {
      CampHub.ui.confirm('确定报名参加本次活动？').then(ok => {
        if (!ok) return;
        CampHub.ajax.post(`/event/${eventId}/join`).then(function () {
          CampHub.ui.toast('报名成功！等待组织者确认', 'success');
          setTimeout(reload, 500);
        }).catch(err => CampHub.ui.toast(err.message || '失败', 'error'));
      });
    });

    $('#recalcRecommendBtn').on('click', function () {
      var $btn = $(this).prop('disabled', true);
      CampHub.ajax.get(`/event/${eventId}/recommend`).then(function (reco) {
        CampHub.ui.confirm(`系统根据「${reco.basedOnEventTitle || '历史数据'}」（相似度 ${(reco.similarity*100).toFixed(0)}%）推荐了 ${reco.gearList.length} 项装备和 ${reco.purchaseList.length} 项采购，是否替换当前清单？`).then(ok => {
          if (!ok) return;
          ev.gearList = reco.gearList.map(g => ({
            gearId: null, name: g.name, category: g.category, quantity: g.quantity,
            broughtByUserId: null, checked: false
          }));
          ev.purchaseList = reco.purchaseList.map(p => ({
            name: p.name, category: p.category, quantity: p.quantity, unit: p.unit,
            assignedToUserId: null, purchased: false
          }));
          renderGearList();
          renderPurchaseList();
          CampHub.ui.toast('已应用推荐清单，记得点击保存哦', 'success');
        });
      }).catch(err => CampHub.ui.toast(err.message || '失败', 'error'))
        .always(() => $btn.prop('disabled', false));
    });

    $('#saveGearBtn').on('click', function () {
      collectGearFromUI();
      var dtos = ev.gearList.map(g => ({
        gearId: g.gearId, name: g.name, category: g.category, quantity: g.quantity,
        broughtByUserId: g.broughtByUserId, checked: g.checked
      }));
      CampHub.ajax.put(`/event/${eventId}/gearlist`, dtos).then(function () {
        CampHub.ui.toast('清单已保存', 'success');
        reload();
      }).catch(err => CampHub.ui.toast(err.message || '保存失败', 'error'));
    });

    $('#addGearBtn').on('click', () => {
      ev.gearList.push({ name: '新装备', category: '其他', quantity: 1, checked: false, broughtByUserId: null });
      renderGearList();
    });
    $('#addPurchaseBtn').on('click', () => {
      ev.purchaseList.push({ name: '新采购项', category: '食物', quantity: 1, unit: '份', purchased: false });
      renderPurchaseList();
    });

    $('#gearListContainer')
      .on('click', '.gear-remove', function () {
        var cat = $(this).data('cat'), idx = parseInt($(this).data('idx'), 10);
        removeItemFromCategory('gearList', cat, idx);
        renderGearList();
      });
    $('#purchaseListContainer')
      .on('click', '.p-remove', function () {
        var cat = $(this).data('cat'), idx = parseInt($(this).data('idx'), 10);
        removePurchaseFromCategory(cat, idx);
        renderPurchaseList();
      });

    $('#eventPhotosGrid').on('click', '.ch-photo-item', function () {
      var url = $(this).data('file');
      if (url) window.open(url, '_blank');
    });

    $('#uploadEventPhotoBtn').on('click', () => $('#eventPhotoFileInput').trigger('click'));
    $('#eventPhotoFileInput').on('change', async function () {
      if (!this.files || !this.files.length) return;
      var fd = new FormData();
      fd.append('eventId', eventId);
      for (var i = 0; i < this.files.length; i++) {
        var f = this.files[i];
        try { f = await CampHub.image.compressIfNeeded(f, 5); } catch {}
        fd.append('files', f);
      }
      CampHub.ajax.post('/photo/upload', fd, { contentType: false }).then(function (res) {
        CampHub.ui.toast('上传 ' + (res ? res.length : 0) + ' 张成功', 'success');
        setTimeout(renderPhotos, 500);
      }).catch(err => CampHub.ui.toast(err.message || '上传失败', 'error'));
      this.value = '';
    });

    var scoreInputs = ['transportation', 'scenery', 'facility', 'safety'];
    scoreInputs.forEach(function (k) {
      var $input = $('#' + k + 'Score');
      $input.on('input', function () {
        $('#' + k.charAt(0) + 'Val').text($(this).val() + ' / 5');
      });
    });

    $('#submitRatingBtn').on('click', function () {
      var data = {
        transportationScore: parseInt($('#transportationScore').val(), 10) || 3,
        sceneryScore: parseInt($('#sceneryScore').val(), 10) || 3,
        facilityScore: parseInt($('#facilityScore').val(), 10) || 3,
        safetyScore: parseInt($('#safetyScore').val(), 10) || 3,
        season: parseInt($('#ratingSeason').val(), 10),
        destinationTag: ev.destination,
        comments: $('#ratingComments').val()
      };
      CampHub.ajax.post(`/event/${eventId}/rate`, data).then(function () {
        CampHub.ui.toast('评价成功', 'success');
        $('#ratingModal').modal('hide');
        loadRatings();
      }).catch(err => CampHub.ui.toast(err.message || '失败', 'error'));
    });
  }

  function collectGearFromUI() {
    var $c = $('#gearListContainer');
    var byCategory = {};
    $c.find('.gear-name').each(function () {
      var cat = $(this).data('cat'), idx = parseInt($(this).data('idx'), 10);
      if (!byCategory[cat]) byCategory[cat] = {};
      if (!byCategory[cat][idx]) byCategory[cat][idx] = {};
      byCategory[cat][idx].name = $(this).val();
    });
    $c.find('.gear-qty').each(function () {
      var cat = $(this).data('cat'), idx = parseInt($(this).data('idx'), 10);
      if (!byCategory[cat]) byCategory[cat] = {};
      if (!byCategory[cat][idx]) byCategory[cat][idx] = {};
      byCategory[cat][idx].quantity = parseInt($(this).val(), 10) || 1;
    });
    $c.find('.gear-user').each(function () {
      var cat = $(this).data('cat'), idx = parseInt($(this).data('idx'), 10);
      if (!byCategory[cat]) byCategory[cat] = {};
      if (!byCategory[cat][idx]) byCategory[cat][idx] = {};
      byCategory[cat][idx].broughtByUserId = $(this).val();
    });
    $c.find('.gear-checked').each(function () {
      var cat = $(this).data('cat'), idx = parseInt($(this).data('idx'), 10);
      if (!byCategory[cat]) byCategory[cat] = {};
      if (!byCategory[cat][idx]) byCategory[cat][idx] = {};
      byCategory[cat][idx].checked = $(this).is(':checked');
    });
    var newList = [];
    Object.keys(byCategory).forEach(cat => {
      Object.keys(byCategory[cat]).forEach(idx => {
        var it = byCategory[cat][idx];
        newList.push({ category: cat, name: it.name || '(未命名)', quantity: it.quantity || 1, broughtByUserId: it.broughtByUserId || null, checked: !!it.checked });
      });
    });
    ev.gearList = newList;
  }

  function removeItemFromCategory(key, cat, idx) {
    var byCategory = {};
    ev[key].forEach(function (g) { if (!byCategory[g.category]) byCategory[g.category] = []; byCategory[g.category].push(g); });
    if (byCategory[cat] && byCategory[cat][idx]) {
      byCategory[cat].splice(idx, 1);
      var newList = [];
      Object.values(byCategory).forEach(arr => arr.forEach(x => newList.push(x)));
      ev[key] = newList;
    }
  }
  function removePurchaseFromCategory(cat, idx) {
    var byCategory = {};
    ev.purchaseList.forEach(function (g) { if (!byCategory[g.category]) byCategory[g.category] = []; byCategory[g.category].push(g); });
    if (byCategory[cat] && byCategory[cat][idx]) {
      byCategory[cat].splice(idx, 1);
      var newList = [];
      Object.values(byCategory).forEach(arr => arr.forEach(x => newList.push(x)));
      ev.purchaseList = newList;
    }
  }

  function loadRatings() {
    CampHub.ajax.get(`/event/${eventId}/ratings`).then(r => { ratings = r || []; renderRatings(); });
  }

  function reload() {
    CampHub.ajax.get(`/event/${eventId}`).then(function (data) {
      ev = data;
      renderHeader();
    }).catch(function () {});
  }

  var collabConnection = null;
  function initCollabHub() {
    if (!window.signalR || !eventId) return;
    try {
      collabConnection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/eventCollab')
        .withAutomaticReconnect([0, 1000, 3000, 5000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      collabConnection.on('UserJoined', function (u) {
        CampHub.ui.toast(`${u.nickname} 加入了协同编辑`, 'info');
      });
      collabConnection.on('UserLeft', function (u) {
        CampHub.ui.toast(`${u.nickname} 离开了`, 'info');
      });
      collabConnection.on('GearItemUpdated', function (msg) {
        if (msg.updatedBy === (CampHub.auth.getUser() || {}).id) return;
        if (!ev || !ev.gearList) return;
        var item = ev.gearList.find(function (g) { return g.key === msg.itemKey; });
        if (item && msg.payload) {
          if (typeof msg.payload.checked === 'boolean') item.checked = msg.payload.checked;
          if (typeof msg.payload.name === 'string') item.name = msg.payload.name;
          if (typeof msg.payload.quantity === 'number') item.quantity = msg.payload.quantity;
          if (typeof msg.payload.broughtByUserId !== 'undefined') item.broughtByUserId = msg.payload.broughtByUserId;
          renderGearList();
        }
      });
      collabConnection.on('PurchaseItemUpdated', function (msg) {
        if (msg.updatedBy === (CampHub.auth.getUser() || {}).id) return;
        if (!ev || !ev.purchaseList) return;
        var item = ev.purchaseList.find(function (p) { return p.key === msg.itemKey; });
        if (item && msg.payload) {
          if (typeof msg.payload.purchased === 'boolean') item.purchased = msg.payload.purchased;
          if (typeof msg.payload.name === 'string') item.name = msg.payload.name;
          if (typeof msg.payload.quantity === 'number') item.quantity = msg.payload.quantity;
          if (typeof msg.payload.unit === 'string') item.unit = msg.payload.unit;
          if (typeof msg.payload.assignedToUserId !== 'undefined') item.assignedToUserId = msg.payload.assignedToUserId;
          renderPurchaseList();
        }
      });
      collabConnection.on('ChatMessage', function (msg) {
        appendCollabMessage(msg);
      });

      collabConnection.start().then(function () {
        return collabConnection.invoke('JoinEvent', eventId);
      }).catch(function (err) {
        console.warn('SignalR 连接失败:', err);
      });
    } catch (e) {
      console.warn('SignalR 初始化失败:', e);
    }
  }

  function collabSendGearUpdate(key, payload) {
    if (!collabConnection || collabConnection.state !== signalR.HubConnectionState.Connected) return;
    try {
      collabConnection.invoke('UpdateGearItem', eventId, key, payload);
    } catch (e) {}
  }
  function collabSendPurchaseUpdate(key, payload) {
    if (!collabConnection || collabConnection.state !== signalR.HubConnectionState.Connected) return;
    try {
      collabConnection.invoke('UpdatePurchaseItem', eventId, key, payload);
    } catch (e) {}
  }
  function collabSendChat(msg) {
    if (!collabConnection || !msg) return;
    collabConnection.invoke('SendMessage', eventId, msg);
  }
  function appendCollabMessage(msg) {
    var $box = $('#collabChatBox');
    if (!$box.length) return;
    var t = msg.timestamp ? CampHub.ui.formatLocalTime(msg.timestamp) : '';
    var html = `<div class="mb-2 small">
      <span class="fw-bold text-ch-primary">${CampHub.util.escapeHtml(msg.nickname)}</span>
      <span class="text-muted ms-1">${t}</span>
      <div class="mt-1 ps-2 border-start border-2 border-ch-primary-30">${CampHub.util.escapeHtml(msg.message)}</div>
    </div>`;
    $box.append(html);
    $box.scrollTop($box[0].scrollHeight);
  }

  function bindCollabInputs() {
    $(document).on('change', '.gear-checked', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getGearItem(cat, idx);
      if (item && item.key) collabSendGearUpdate(item.key, { checked: this.checked });
    });
    $(document).on('input', '.gear-name', CampHub.util.debounce(function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getGearItem(cat, idx);
      if (item && item.key) collabSendGearUpdate(item.key, { name: this.value });
    }, 400));
    $(document).on('change', '.gear-qty', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getGearItem(cat, idx);
      if (item && item.key) collabSendGearUpdate(item.key, { quantity: parseInt(this.value, 10) || 1 });
    });
    $(document).on('change', '.gear-user', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getGearItem(cat, idx);
      if (item && item.key) collabSendGearUpdate(item.key, { broughtByUserId: this.value });
    });

    $(document).on('change', '.p-purchased', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getPurchaseItem(cat, idx);
      if (item && item.key) collabSendPurchaseUpdate(item.key, { purchased: this.checked });
    });
    $(document).on('input', '.p-name', CampHub.util.debounce(function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getPurchaseItem(cat, idx);
      if (item && item.key) collabSendPurchaseUpdate(item.key, { name: this.value });
    }, 400));
    $(document).on('change', '.p-qty', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getPurchaseItem(cat, idx);
      if (item && item.key) collabSendPurchaseUpdate(item.key, { quantity: parseInt(this.value, 10) || 1 });
    });
    $(document).on('change', '.p-unit', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getPurchaseItem(cat, idx);
      if (item && item.key) collabSendPurchaseUpdate(item.key, { unit: this.value });
    });
    $(document).on('change', '.p-user', function () {
      var cat = $(this).data('cat');
      var idx = parseInt($(this).data('idx'), 10);
      var item = getPurchaseItem(cat, idx);
      if (item && item.key) collabSendPurchaseUpdate(item.key, { assignedToUserId: this.value });
    });

    $(document).on('click', '#collabChatSend', function () {
      var $input = $('#collabChatInput');
      var txt = $input.val();
      if (!txt.trim()) return;
      collabSendChat(txt.trim());
      $input.val('');
    });
    $(document).on('keypress', '#collabChatInput', function (e) {
      if (e.key === 'Enter') { $('#collabChatSend').click(); }
    });
  }

  function getGearItem(cat, idx) {
    if (!ev || !ev.gearList) return null;
    var cats = {};
    ev.gearList.forEach(function (g) {
      if (!cats[g.category]) cats[g.category] = [];
      cats[g.category].push(g);
    });
    var arr = cats[cat] || [];
    return arr[idx] || null;
  }
  function getPurchaseItem(cat, idx) {
    if (!ev || !ev.purchaseList) return null;
    var cats = {};
    ev.purchaseList.forEach(function (p) {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    });
    var arr = cats[cat] || [];
    return arr[idx] || null;
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    if (!eventId) { $('#eventDetailRoot').html(CampHub.ui.emptyState('缺少活动ID', 'bi-exclamation-triangle')); return; }
    reload();
    loadRatings();
    initCollabHub();
    bindCollabInputs();
  });
})(jQuery);
