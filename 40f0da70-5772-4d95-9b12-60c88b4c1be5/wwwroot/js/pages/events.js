(function ($) {
  'use strict';

  var filters = { status: '', range: '' };

  function renderCard(ev) {
    var start = new Date(ev.startTime);
    var monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    var participants = (ev.participants || []).slice(0, 5);
    var extra = Math.max(0, (ev.participants || []).length - 5);
    var until = CampHub.ui.dayUntil(ev.startTime);
    var days = Math.ceil((start.getTime() - Date.now()) / 86400000);
    var cls = 'ch-countdown' + (days <= 2 ? ' hot' : days <= 7 ? ' soon' : '');
    var creator = ev.creator ? ev.creator.nickname : '未知';

    return `
      <div class="ch-event-card animate-item" onclick="location.href='/Event/Details/${ev.id}'">
        <div class="ch-event-cover">
          <div class="ch-event-status">${CampHub.ui.eventStatusBadge(ev.status)}</div>
          <div class="ch-event-date-badge">
            <span class="mon">${monthNames[start.getMonth()]}</span>
            <span class="day">${start.getDate()}</span>
          </div>
        </div>
        <div class="ch-event-body">
          <h4>${CampHub.util.escapeHtml(ev.title)}</h4>
          <div class="ch-event-meta">
            <span><i class="bi bi-geo-alt"></i>${CampHub.util.escapeHtml(ev.destination)}</span>
            <span><i class="bi bi-clock"></i>${CampHub.ui.formatLocalDate(ev.startTime)} - ${CampHub.ui.formatLocalDate(ev.endTime)}</span>
            <span><i class="bi bi-person-badge"></i>${CampHub.util.escapeHtml(creator)}</span>
          </div>
          <div class="ch-event-participants">
            <div class="ch-avatar-stack">
              ${participants.map(p => CampHub.ui.avatar(p.user || {}, 30)).join('')}
              ${extra > 0 ? `<div style="width:30px;height:30px;border-radius:50%;background:var(--ch-bg);display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:600;border:2px solid white;">+${extra}</div>` : ''}
            </div>
            <span class="${cls}">${until}</span>
          </div>
        </div>
      </div>`;
  }

  function load() {
    var $grid = $('#eventGrid');
    $grid.html(`<div class="ch-loading-overlay position-absolute w-100 h-100 d-flex align-items-center justify-content-center"><div class="spinner-border text-ch-primary"></div></div>`);
    CampHub.ajax.get('/event/list', { status: filters.status, range: filters.range, pageSize: 60 }).then(function (list) {
      if (!list || !list.length) {
        $grid.html('<div class="col-12">' + CampHub.ui.emptyState('还没有活动记录，发起第一个活动吧！', 'bi-calendar-plus') + '</div>');
        return;
      }
      $grid.html(list.map(renderCard).join(''));
    }).catch(function (err) {
      $grid.html('<div class="col-12">' + CampHub.ui.emptyState('加载失败：' + (err.message || ''), 'bi-exclamation-triangle') + '</div>');
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;

    $('.ch-filter-bar').on('click', '.ch-pill[data-status]', function () {
      $('.ch-pill[data-status]').removeClass('active');
      $(this).addClass('active');
      filters.status = $(this).data('status') || '';
      load();
    });
    $('.ch-filter-bar').on('click', '.ch-pill[data-range]', function () {
      $('.ch-pill[data-range]').removeClass('active');
      $(this).addClass('active');
      filters.range = $(this).data('range') || '';
      load();
    });

    load();
  });
})(jQuery);
