(function ($) {
  'use strict';

  function renderEventCard(ev) {
    var statusLabel = CampHub.ui.eventStatusBadge(ev.status);
    var start = new Date(ev.startTime);
    var monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    var mon = monthNames[start.getMonth()];
    var day = start.getDate();

    var participants = (ev.participants || []).slice(0, 5);
    var extraCount = Math.max(0, (ev.participants || []).length - 5);

    var until = CampHub.ui.dayUntil(ev.startTime);
    var countdownClass = 'ch-countdown';
    var days = Math.ceil((start.getTime() - Date.now()) / 86400000);
    if (days <= 2) countdownClass += ' hot';
    else if (days <= 7) countdownClass += ' soon';

    var creator = ev.creator ? ev.creator.nickname : '未知';

    return `
      <div class="ch-event-card" data-id="${ev.id}" onclick="location.href='/Event/Details/${ev.id}'">
        <div class="ch-event-cover">
          <div class="ch-event-status">${statusLabel}</div>
          <div class="ch-event-date-badge">
            <span class="mon">${mon}</span>
            <span class="day">${day}</span>
          </div>
        </div>
        <div class="ch-event-body">
          <h4 title="${CampHub.util.escapeHtml(ev.title)}">${CampHub.util.escapeHtml(ev.title)}</h4>
          <div class="ch-event-meta">
            <span><i class="bi bi-geo-alt"></i>${CampHub.util.escapeHtml(ev.destination)}</span>
            <span><i class="bi bi-clock"></i>${CampHub.ui.formatLocalDate(ev.startTime)} - ${CampHub.ui.formatLocalDate(ev.endTime)}</span>
            <span><i class="bi bi-person-badge"></i>组织者：${CampHub.util.escapeHtml(creator)}</span>
          </div>
          <div class="ch-event-participants">
            <div class="ch-avatar-stack">
              ${participants.map(function (p) {
                var u = p.user || {};
                return CampHub.ui.avatar(u, 30);
              }).join('')}
              ${extraCount > 0 ? `<div class="ch-avatar-stack-more" style="width:30px;height:30px;border-radius:50%;background:var(--ch-bg);color:var(--ch-text-muted);display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:600;border:2px solid white;">+${extraCount}</div>` : ''}
            </div>
            <span class="${countdownClass}">${until}</span>
          </div>
        </div>
      </div>`;
  }

  function loadOverview() {
    CampHub.ajax.get('/home/overview').then(function (s) {
      $('#statEvents').text(s.totalEvents || 0);
      $('#statGear').text(s.totalGear || 0);
      $('#statPending').text(s.pendingReturns || 0);
      $('#statCredit').text(s.myCreditScore || 0);
    }).catch(function () {});
  }

  function loadUpcoming() {
    var $t = $('#upcomingEvents');
    CampHub.ajax.get('/home/upcoming', { limit: 6 }).then(function (list) {
      if (!list || !list.length) {
        $t.html(CampHub.ui.emptyState('还没有即将开始的活动，点击右上角发起一个吧！', 'bi-calendar-x'));
        return;
      }
      $t.html(list.map(renderEventCard).join(''));
    }).catch(function () {
      $t.html(CampHub.ui.emptyState('加载失败', 'bi-exclamation-triangle'));
    });
  }

  function loadOngoing() {
    var $t = $('#ongoingEvents');
    CampHub.ajax.get('/event/list', { range: 'past', pageSize: 4 }).then(function (list) {
      if (!list || !list.length) {
        $t.html(CampHub.ui.emptyState('历史活动将在这里沉淀', 'bi-album'));
        return;
      }
      $t.html(list.slice(0, 4).map(renderEventCard).join(''));
    }).catch(function () {});
  }

  function initGreeting() {
    var user = CampHub.auth.getUser();
    var h = new Date().getHours();
    var greet = h < 6 ? '深夜好' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好';
    $('#welcomeGreeting').text(greet + '，' + (user && user.nickname ? user.nickname : '露营人') + '！');

    var tips = [
      '今天是整理装备的好日子',
      '检查充电宝是否充满电了吗',
      '别忘了看天气和风向',
      '建议提前一周发布装备清单',
      '记得留好紧急联络方式'
    ];
    $('#todayTip').text(tips[Math.floor(Math.random() * tips.length)]);

    var huangliList = [
      ['宜：晨间咖啡仪式感', '忌：迟到'],
      ['宜：天幕下的下午茶', '忌：忘记带充电宝'],
      ['宜：星空下的篝火', '忌：装备清单遗漏'],
      ['宜：搭帐篷比赛', '忌：钉子不够用'],
      ['宜：清晨的第一缕阳光', '忌：太晚出发']
    ];
    $('#huangli').text(huangliList[Math.floor(Math.random() * huangliList.length)].join(' / '));
  }

  function initQuickUploader() {
    var $files = $('#quickUploadFiles');
    var $preview = $('#quickUploadPreview');
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
      if (!pendingFiles.length) {
        CampHub.ui.toast('请先选择照片', 'warning');
        return;
      }
      var eventId = $('#quickUploadEventId').val();
      var fd = new FormData();
      pendingFiles.forEach(function (f) { fd.append('files', f); });
      if (eventId) fd.append('eventId', eventId);
      var $p = $('#quickUploadProgress').removeClass('d-none').find('.progress-bar');
      $p.css('width', '15%');
      CampHub.ajax.post('/photo/upload', fd, { contentType: false }).then(function (res) {
        $p.css('width', '100%');
        CampHub.ui.toast('成功上传 ' + (res ? res.length : 0) + ' 张', 'success');
        setTimeout(function () { $('#uploadModal').modal('hide'); $p.css('width', '0%'); $preview.empty(); $files.val(''); }, 800);
      }).catch(function (err) {
        $p.css('width', '0%').parent().addClass('d-none');
        CampHub.ui.toast(err.message || '上传失败', 'error');
      });
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    initGreeting();
    loadOverview();
    loadUpcoming();
    loadOngoing();
    initQuickUploader();
  });
})(jQuery);
