(function ($) {
  'use strict';

  var participants = [];

  function renderParticipants() {
    var roles = ['组织者', '厨师', '司机', '摄影', '医疗', '采购员', '参与者'];
    var $wrap = $('#participantList').empty();
    if (!participants.length) {
      $wrap.html('<div class="text-muted small mb-2">默认活动创建者即为组织者，可添加其他参与者并分配角色</div>');
      return;
    }
    participants.forEach(function (p, idx) {
      $wrap.append(`
        <div class="d-flex align-items-center gap-2 mb-2 p-2 bg-ch-primary-50 rounded-2">
          <input type="text" class="form-control participant-name flex-grow-1" placeholder="好友昵称/备注" value="${CampHub.util.escapeHtml(p.name || '')}" />
          <select class="form-select participant-role" style="width:auto;min-width:130px;">
            ${roles.map(r => `<option ${p.role === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-outline-danger btn-sm p-remove" data-idx="${idx}">
            <i class="bi bi-x"></i>
          </button>
        </div>`);
    });
  }

  function initParticipants() {
    $('#addParticipantBtn').on('click', function () {
      participants.push({ userId: '', name: '', role: '参与者' });
      renderParticipants();
    });

    $('#participantList').on('click', '.p-remove', function () {
      participants.splice(parseInt($(this).data('idx'), 10), 1);
      renderParticipants();
    }).on('change input', '.participant-name, .participant-role', function () {
      var $row = $(this).closest('.d-flex');
      var idx = $('#participantList .p-remove').index($row.find('.p-remove'));
      if (idx >= 0 && participants[idx]) {
        participants[idx].name = $row.find('.participant-name').val();
        participants[idx].role = $row.find('.participant-role').val();
      }
    });
  }

  function setDefaultTimes() {
    var now = new Date();
    now.setHours(now.getHours() + 48); now.setMinutes(0); now.setSeconds(0);
    var end = new Date(now.getTime() + 2 * 86400000);
    var fmt = function (d) { return d.toISOString().slice(0, 16); };
    $('input[name=startTime]').val(fmt(now));
    $('input[name=endTime]').val(fmt(end));
  }

  function initForm() {
    setDefaultTimes();
    $('#eventCreateForm').validate({
      rules: {
        title: { required: true, minlength: 2 },
        destination: { required: true },
        startTime: { required: true },
        endTime: { required: true }
      },
      submitHandler: function (form) {
        var $btn = $('#eventCreateBtn').prop('disabled', true).find('i').addClass('spinner-border spinner-border-sm').end();
        var data = {
          title: form.title.value.trim(),
          destination: form.destination.value.trim(),
          description: form.description.value,
          maxParticipants: parseInt(form.maxParticipants.value, 10) || 12,
          startTime: new Date(form.startTime.value).toISOString(),
          endTime: new Date(form.endTime.value).toISOString(),
          participants: participants
            .filter(p => p.name)
            .map(p => ({ userId: 'u_' + btoa(unescape(encodeURIComponent(p.name))).slice(0, 16), role: p.role }))
        };
        if (data.endTime <= data.startTime) {
          CampHub.ui.toast('结束时间必须晚于开始时间', 'error');
          $btn.prop('disabled', false).find('i.spinner-border').removeClass('spinner-border spinner-border-sm').addClass('bi-rocket-takeoff');
          return false;
        }
        CampHub.ajax.post('/event', data).then(function (ev) {
          CampHub.ui.toast('活动创建成功！已为你推荐装备清单', 'success');
          setTimeout(function () { window.location.href = '/Event/Details/' + ev.id; }, 700);
        }).catch(function (err) {
          CampHub.ui.toast(err.message || '创建失败', 'error');
          $btn.prop('disabled', false).find('i.spinner-border').removeClass('spinner-border spinner-border-sm').addClass('bi-rocket-takeoff');
        });
        return false;
      }
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    initParticipants();
    initForm();
  });
})(jQuery);
