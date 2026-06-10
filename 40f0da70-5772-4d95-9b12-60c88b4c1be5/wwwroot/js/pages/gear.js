(function ($) {
  'use strict';

  var filters = { status: '', category: '', owner: '', keyword: '' };
  var lendGearId = null, returnGearId = null;
  var currentUser = CampHub.auth.getUser();

  function renderGearCard(g) {
    var isOwner = currentUser && g.ownerId === currentUser.id;
    var isBorrower = currentUser && g.currentBorrowerId === currentUser.id;
    var statusBadge = CampHub.ui.gearStatusBadge(g.status);

    var actions = '';
    if (isOwner) {
      if (g.status === '在库')
        actions += `<button class="btn btn-sm btn-outline-primary lend-btn" data-id="${g.id}"><i class="bi bi-arrow-right-circle me-1"></i>借出</button>`;
      if (g.status === '借出')
        actions += `<button class="btn btn-sm btn-accent return-btn" data-id="${g.id}"><i class="bi bi-arrow-counterclockwise me-1"></i>确认归还</button>`;
      actions += `<a href="/Gear/Details/${g.id}" class="btn btn-sm btn-outline-secondary"><i class="bi bi-three-dots"></i></a>`;
    } else if (isBorrower) {
      actions += `<button class="btn btn-sm btn-accent return-btn" data-id="${g.id}"><i class="bi bi-check2-circle me-1"></i>我已归还</button>`;
    } else if (g.status === '在库') {
      actions += `<button class="btn btn-sm btn-outline-primary request-btn" data-id="${g.id}"><i class="bi bi-hand-thumbs-up me-1"></i>申请借用</button>`;
    }

    var wearLevel = Math.round(g.wearLevel || 0);
    var ownerHtml = '';
    if (g.owner) {
      ownerHtml = `<div class="ch-gear-owner">
        ${CampHub.ui.avatar(g.owner, 26)}
        <span>${CampHub.util.escapeHtml(g.owner.nickname)}</span>
      </div>`;
    }

    var borrowerHtml = '';
    if (g.status === '借出' && g.currentBorrower && g.dueDate) {
      var due = new Date(g.dueDate);
      var daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
      borrowerHtml = `<div class="w-100 mt-2 small text-warning">
        <i class="bi bi-hourglass-split me-1"></i>借予：${CampHub.util.escapeHtml(g.currentBorrower.nickname)} · ${daysLeft >= 0 ? '还有' + daysLeft + '天' : '逾期' + (-daysLeft) + '天'}
      </div>`;
    }

    return `
      <div class="ch-gear-card animate-item" data-id="${g.id}" data-status="${g.status}" data-category="${g.category}">
        <div class="ch-gear-img-wrap">
          <img src="${g.imageUrl || 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=' + encodeURIComponent(g.category + ' camping gear product photo neutral studio background') + '&image_size=square'}"
               alt="${CampHub.util.escapeHtml(g.name)}" loading="lazy" />
          <div class="ch-gear-status-bar">
            ${statusBadge}
            <span class="badge bg-dark bg-opacity-50">${CampHub.util.escapeHtml(g.category)}</span>
          </div>
          ${g.needsMaintenance ? '<div class="ch-gear-maintain"><i class="bi bi-wrench me-1"></i>需保养</div>' : ''}
          ${wearLevel > 0 ? `<div class="ch-gear-wear">损耗 ${wearLevel}%</div>` : ''}
        </div>
        <div class="ch-gear-info">
          <h5>${CampHub.util.escapeHtml(g.name)}</h5>
          ${borrowerHtml}
          <p class="ch-gear-desc">${CampHub.util.escapeHtml(g.description || '暂无描述')}</p>
          <div class="ch-gear-footer">
            ${ownerHtml}
            <div class="ch-gear-actions">${actions}</div>
          </div>
        </div>
      </div>`;
  }

  function applyFilters() {
    var $grid = $('#gearGrid');
    $grid.children('.ch-loading-overlay').remove();
    var $items = $grid.children('.ch-gear-card');

    var count = 0;
    $items.each(function () {
      var $el = $(this);
      var ok = true;
      if (filters.status && $el.data('status') !== filters.status) ok = false;
      if (filters.category && $el.data('category') !== filters.category) ok = false;

      if (ok) { $el.show(); count++; }
      else $el.hide();
    });

    var kw = (filters.keyword || '').trim().toLowerCase();
    if (kw) {
      count = 0;
      $items.filter(':visible').each(function () {
        var txt = $(this).text().toLowerCase();
        if (txt.indexOf(kw) >= 0) { count++; }
        else $(this).hide();
      });
    }

    if (filters.owner === '__me__' && currentUser) {
      count = 0;
      $items.filter(':visible').each(function (_, el) {
        var found = false;
        gears.forEach(function (g) { if (g.id === el.dataset.id && g.ownerId === currentUser.id) found = true; });
        if (found) count++; else $(el).hide();
      });
    }

    $('#gearCountLabel').text(`共 ${count} 件装备`);
  }

  var gears = [];
  function loadGears() {
    var $grid = $('#gearGrid');
    $grid.html(`<div class="ch-loading-overlay position-absolute w-100 h-100 d-flex align-items-center justify-content-center"><div class="spinner-border text-ch-primary"></div></div>`);
    CampHub.ajax.get('/gear', { pageSize: 100 }).then(function (list) {
      gears = list || [];
      if (!gears.length) {
        $grid.html('<div class="col-12">' + CampHub.ui.emptyState('还没有装备登记，点击上方"添加装备"开始登记', 'bi-box-seam') + '</div>');
        $('#gearCountLabel').text('0 件装备');
        return;
      }
      $grid.html(gears.map(renderGearCard).join(''));
      applyFilters();
    }).catch(function (err) {
      $grid.html('<div class="col-12">' + CampHub.ui.emptyState('加载失败：' + (err.message || ''), 'bi-exclamation-triangle') + '</div>');
    });
  }

  function initFilterHandlers() {
    $('#gearFilters').on('click', '.ch-pill[data-status]', function () {
      $('#gearFilters .ch-pill[data-status]').removeClass('active');
      $(this).addClass('active');
      filters.status = $(this).data('status') || '';
      applyFilters();
    });
    $('#gearFilters').on('click', '.ch-pill[data-category]', function () {
      $('#gearFilters .ch-pill[data-category]').removeClass('active');
      $(this).addClass('active');
      filters.category = $(this).data('category') || '';
      applyFilters();
    });
    $('#gearFilters').on('click', '.ch-pill[data-owner]', function () {
      $('#gearFilters .ch-pill[data-owner]').removeClass('active');
      $(this).addClass('active');
      filters.owner = $(this).data('owner') || '';
      applyFilters();
    });
    $('#gearSearch').on('input', CampHub.util.debounce(function () {
      filters.keyword = $(this).val();
      applyFilters();
    }, 200));
  }

  function initLendModal() {
    $(document).on('click', '.lend-btn, .request-btn', function () {
      lendGearId = $(this).data('id');
      var gear = gears.find(function (g) { return g.id === lendGearId; });
      if (!gear) return;
      var msg = `装备：<strong>${CampHub.util.escapeHtml(gear.name)}</strong> (${gear.category})<br/>
                 所有者：${gear.owner ? CampHub.util.escapeHtml(gear.owner.nickname) : '未知'}<br/>
                 当前状态：${CampHub.ui.gearStatusBadge(gear.status)}`;
      $('#lendGearInfo').html(msg);

      var minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      var maxDate = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
      $('#lendDueDate').attr({ min: minDate, max: maxDate }).val(minDate);
      $('#lendNotes').val('');

      var $borrower = $('#lendBorrowerId').empty().append('<option value="">-- 选择借用人 --</option>');
      CampHub.ajax.get('/stats/credit-rank', { top: 30 }).then(function (ranks) {
        (ranks || []).forEach(function (r) {
          if (r.user.id !== gear.ownerId) {
            $borrower.append(`<option value="${r.user.id}" data-credit="${r.score}">
              ${CampHub.util.escapeHtml(r.user.nickname)} (信用分 ${r.score})
            </option>`);
          }
        });
      }).catch(function () {
        for (var i = 1; i <= 6; i++) {
          $borrower.append(`<option value="user_demo_${i}" data-credit="${95 - i * 3}">用户${i} (信用分 ${95 - i * 3})</option>`);
        }
      });

      $('#lendCreditInfo').text('请选择借用人...');
      $('#lendModal').modal('show');
    });

    $('#lendBorrowerId').on('change', function () {
      var score = parseInt($(this).find('option:selected').data('credit') || 0, 10);
      var cls = score >= 90 ? 'ch-credit-excellent' : score >= 75 ? 'ch-credit-good' : score >= 60 ? 'ch-credit-warn' : 'ch-credit-danger';
      var msg = score >= 60
        ? `<span class="ch-credit-badge ${cls}"><i class="bi bi-shield-check"></i>信用分 ${score}（${score >= 90 ? '非常可靠' : score >= 75 ? '良好' : '一般'}）</span>`
        : `<span class="ch-credit-badge ch-credit-danger"><i class="bi bi-exclamation-triangle"></i>信用分 ${score}，低于60分，已失去优先借出权</span>`;
      $('#lendCreditInfo').html(msg);
    });

    $('#confirmLendBtn').on('click', function () {
      var borrowerId = $('#lendBorrowerId').val();
      if (!borrowerId) { CampHub.ui.toast('请选择借用人', 'warning'); return; }
      var due = $('#lendDueDate').val();
      if (!due) { CampHub.ui.toast('请选择预计归还日期', 'warning'); return; }

      var $btn = $(this).prop('disabled', true).find('i').addClass('spinner-border spinner-border-sm me-1').end();
      CampHub.ajax.post(`/gear/${lendGearId}/lend`, {
        borrowerId: borrowerId,
        dueDate: new Date(due + 'T23:59:59Z').toISOString(),
        notes: $('#lendNotes').val()
      }).then(function () {
        CampHub.ui.toast('借出成功', 'success');
        $('#lendModal').modal('hide');
        loadGears();
      }).catch(function (err) {
        CampHub.ui.toast(err.message || '借出失败', 'error');
      }).always(function () {
        $btn.prop('disabled', false).find('i.spinner-border').remove();
      });
    });
  }

  function initReturnModal() {
    $(document).on('click', '.return-btn', function () {
      returnGearId = $(this).data('id');
      var gear = gears.find(function (g) { return g.id === returnGearId; });
      if (!gear) return;
      var borrowerName = gear.currentBorrower ? gear.currentBorrower.nickname : '借用人';
      $('#returnGearInfo').html(`
        <strong>${CampHub.util.escapeHtml(gear.name)}</strong><br/>
        借用人：${CampHub.util.escapeHtml(borrowerName)}<br/>
        请根据归还实际情况选择状态，系统会自动调整信用分。
      `);
      $('#returnWearLevel').val(Math.round(gear.wearLevel || 0)).trigger('input');
      $('#returnModal').modal('show');
    });

    $('#returnWearLevel').on('input', function () {
      $('#returnWearValue').text($(this).val() + '%');
    });

    $('#confirmReturnBtn').on('click', function () {
      var $btn = $(this).prop('disabled', true);
      CampHub.ajax.post(`/gear/${returnGearId}/return`, {
        condition: $('#returnCondition').val(),
        newWearLevel: parseInt($('#returnWearLevel').val(), 10) || 0
      }).then(function (rec) {
        CampHub.ui.toast(rec && rec.message ? rec.message : '归还确认成功', 'success');
        if (currentUser && rec && rec.creditChange !== undefined) {
          if (rec.borrowerId === currentUser.id) {
            currentUser.creditScore = (currentUser.creditScore || 100) + rec.creditChange;
            CampHub.auth.setToken(CampHub.auth.getToken(), CampHub.auth.getRefreshToken(), currentUser);
          }
        }
        $('#returnModal').modal('hide');
        loadGears();
      }).catch(function (err) {
        CampHub.ui.toast(err.message || '操作失败', 'error');
      }).always(function () { $btn.prop('disabled', false); });
    });
  }

  function initQuickUploader() {
    var $files = $('#quickUploadFiles');
    var $preview = $('#quickUploadPreview');
    var $progress = $('#quickUploadProgress');
    var pendingFiles = [];

    $files.on('change', async function () {
      pendingFiles = [];
      $preview.empty();
      for (var i = 0; i < this.files.length; i++) {
        var f = this.files[i];
        try { f = await CampHub.image.compressIfNeeded(f, 5); } catch {}
        pendingFiles.push(f);
        var url = await CampHub.image.dataUrlFromFile(f);
        $preview.append(`<img src="${url}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid var(--ch-bg);" />`);
      }
    });

    $('#quickUploadBtn').on('click', function () {
      if (!pendingFiles.length) { CampHub.ui.toast('请选择照片', 'warning'); return; }
      var eventId = $('#quickUploadEventId').val();
      var fd = new FormData();
      pendingFiles.forEach(function (f) { fd.append('files', f); });
      if (eventId) fd.append('eventId', eventId);
      $progress.removeClass('d-none').find('.progress-bar').css('width', '20%');
      CampHub.ajax.post('/photo/upload', fd, { contentType: false }).then(function (res) {
        $progress.find('.progress-bar').css('width', '100%');
        CampHub.ui.toast('上传成功 ' + (res ? res.length : 0) + ' 张', 'success');
        setTimeout(function () {
          $('#uploadModal').modal('hide');
          $progress.find('.progress-bar').css('width', '0%').parent().addClass('d-none');
          $preview.empty();
          $files.val('');
        }, 700);
      }).catch(function (err) {
        $progress.addClass('d-none');
        CampHub.ui.toast(err.message || '上传失败', 'error');
      });
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    initFilterHandlers();
    initLendModal();
    initReturnModal();
    initQuickUploader();
    loadGears();
  });
})(jQuery);
