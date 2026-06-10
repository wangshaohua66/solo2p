(function ($) {
  'use strict';

  var state = { filter: 'all', eventId: '', timeRange: '', page: 1, pageSize: 48, items: [], hasMore: true };
  var lightboxIndex = 0;

  function renderPhotos() {
    var $grid = $('#photoGrid');
    var items = state.items;
    if (!items.length) {
      $grid.html(CampHub.ui.emptyState('还没有照片，点击右上角上传第一张吧！', 'bi-camera'));
      $('#photoMoreWrap').addClass('d-none');
      return;
    }
    $grid.html(items.map(function (p, idx) {
      var time = p.takenAt ? CampHub.ui.formatLocalDateTime(p.takenAt) : '';
      var user = p.uploader || { nickname: '' };
      return `<div class="ch-photo-item animate-item" data-idx="${idx}" data-file="${p.fileUrl}">
        <img src="${p.thumbUrl || p.fileUrl}" alt="" loading="lazy" />
        <div class="ch-photo-overlay">
          <div class="ch-photo-meta-row">
            <div><i class="bi bi-calendar3 me-1"></i>${time || '未知'}</div>
            <div>${p.gpsLat ? '<i class="bi bi-geo-alt me-1"></i>GPS' : ''}</div>
          </div>
          <div class="mt-1 small"><i class="bi bi-person-circle me-1"></i>${CampHub.util.escapeHtml(user.nickname)}</div>
        </div>
      </div>`;
    }).join(''));
    $('#photoMoreWrap').toggleClass('d-none', !state.hasMore || items.length < state.pageSize);
  }

  function loadMore() {
    var query = { page: state.page, pageSize: state.pageSize, eventIdFilter: state.eventId };
    if (state.timeRange) {
      var days = parseInt(state.timeRange, 10);
      if (days > 0) query.from = new Date(Date.now() - days * 86400000).toISOString();
    }
    var endpoint = state.filter === 'mine' ? '/photo/mine' : '/photo/all';
    var $grid = $('#photoGrid');
    if (state.page === 1) {
      $grid.html(`<div class="ch-loading-overlay position-absolute w-100 h-100 d-flex align-items-center justify-content-center"><div class="spinner-border text-ch-primary"></div></div>`);
    }
    CampHub.ajax.get(endpoint, query).then(function (list) {
      list = list || [];
      state.hasMore = list.length === state.pageSize;
      state.items = state.page === 1 ? list : state.items.concat(list);
      renderPhotos();
    }).catch(function () {
      if (state.page === 1) $grid.html(CampHub.ui.emptyState('加载失败', 'bi-exclamation-triangle'));
    });
  }

  function loadEventOptions() {
    CampHub.ajax.get('/event/list', { pageSize: 50 }).then(function (list) {
      var $sel = $('#photoEventFilter');
      (list || []).forEach(function (e) {
        $sel.append(`<option value="${e.id}">${CampHub.util.escapeHtml(e.title)}</option>`);
      });
    }).catch(function () {});
  }

  function initLightbox() {
    var $lb = $('#photoLightbox');
    $('#photoGrid').on('click', '.ch-photo-item', function () {
      lightboxIndex = parseInt($(this).data('idx'), 10);
      showLightbox();
    });
    $('#lightboxClose, .ch-photo-lightbox').on('click', function (e) {
      if (e.target === this || e.currentTarget === $('#lightboxClose')[0]) $lb.removeClass('show');
    });
    $('#lightboxPrev').on('click', function (e) { e.stopPropagation(); lightboxIndex = (lightboxIndex - 1 + state.items.length) % state.items.length; showLightbox(); });
    $('#lightboxNext').on('click', function (e) { e.stopPropagation(); lightboxIndex = (lightboxIndex + 1) % state.items.length; showLightbox(); });
    $(document).on('keydown', function (e) {
      if (!$lb.hasClass('show')) return;
      if (e.key === 'Escape') $lb.removeClass('show');
      if (e.key === 'ArrowLeft') { lightboxIndex = (lightboxIndex - 1 + state.items.length) % state.items.length; showLightbox(); }
      if (e.key === 'ArrowRight') { lightboxIndex = (lightboxIndex + 1) % state.items.length; showLightbox(); }
    });
    function showLightbox() {
      var p = state.items[lightboxIndex];
      if (!p) return;
      $('#lightboxImage').attr('src', p.fileUrl);
      var user = (p.uploader || {}).nickname || '';
      var time = p.takenAt ? CampHub.ui.formatLocalDateTime(p.takenAt) : '';
      var gps = (p.gpsLat && p.gpsLng) ? `📍${Math.round(p.gpsLat*10000)/10000}, ${Math.round(p.gpsLng*10000)/10000}` : '无GPS';
      $('#lightboxMeta').html(`<span><i class="bi bi-person-circle me-1"></i>${user}</span><span><i class="bi bi-clock me-1"></i>${time}</span><span><i class="bi bi-geo-alt me-1"></i>${gps}</span>`);
      $lb.addClass('show');
    }
  }

  function loadTrackIfAny() {
    if (!state.eventId) { $('#photoTrackSection').addClass('d-none'); return; }
    CampHub.ajax.get(`/photo/track/${state.eventId}`).then(function (pts) {
      if (!pts || !pts.length) { $('#photoTrackSection').addClass('d-none'); return; }
      $('#photoTrackSection').removeClass('d-none');
      $('#photoTrackPoints').html(pts.slice(0, 20).map(function (pt, i) {
        var t = CampHub.ui.formatLocalDateTime(pt.takenAt);
        return `<a href="${pt.thumbUrl}" target="_blank" class="d-inline-block me-1 mb-1" title="${t}">
          <img src="${pt.thumbUrl}" class="rounded" style="width:56px;height:56px;object-fit:cover;border:2px solid var(--ch-bg);" />
        </a>`;
      }).join('') + (pts.length > 20 ? `<span class="small text-muted align-top ms-2">共 ${pts.length} 个轨迹点</span>` : ''));
    }).catch(function () { $('#photoTrackSection').addClass('d-none'); });
  }

  var pendingFiles = [];
  function initQuickUploader() {
    var $files = $('#quickUploadFiles');
    var $preview = $('#quickUploadPreview');
    var $progress = $('#quickUploadProgress');

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
        CampHub.ui.toast('上传 ' + (res ? res.length : 0) + ' 张', 'success');
        setTimeout(function () {
          $('#uploadModal').modal('hide');
          $progress.addClass('d-none').find('.progress-bar').css('width', '0%');
          $preview.empty(); $files.val('');
          state.page = 1; loadMore();
        }, 700);
      }).catch(function (err) {
        $progress.addClass('d-none');
        CampHub.ui.toast(err.message || '上传失败', 'error');
      });
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;

    $('.ch-filter-bar').on('click', '.ch-pill[data-filter]', function () {
      $('.ch-pill[data-filter]').removeClass('active');
      $(this).addClass('active');
      state.filter = $(this).data('filter');
      state.page = 1; loadMore();
    });
    $('#photoEventFilter').on('change', function () {
      state.eventId = $(this).val(); state.page = 1; loadMore(); loadTrackIfAny();
    });
    $('#photoTimeFilter').on('change', function () {
      state.timeRange = $(this).val(); state.page = 1; loadMore();
    });
    $('#reloadPhotosBtn').on('click', function () { state.page = 1; loadMore(); });
    $('#loadMorePhotosBtn').on('click', function () { state.page++; loadMore(); });

    loadEventOptions();
    initLightbox();
    initQuickUploader();
    state.page = 1; loadMore();
  });
})(jQuery);
