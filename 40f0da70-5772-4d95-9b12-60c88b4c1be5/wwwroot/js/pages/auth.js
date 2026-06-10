(function ($) {
  'use strict';

  var returnUrl = window._returnUrl || '/';
  var isRegister = !!window._isRegister;

  $('body').on('click', '.toggle-pw', function () {
    var target = $('#' + $(this).data('target'));
    var icon = $(this).find('i');
    if (target.attr('type') === 'password') {
      target.attr('type', 'text');
      icon.removeClass('bi-eye').addClass('bi-eye-slash');
    } else {
      target.attr('type', 'password');
      icon.removeClass('bi-eye-slash').addClass('bi-eye');
    }
  });

  $('#loginForm').validate({
    rules: {
      email: { required: true, email: true },
      password: { required: true, minlength: 6 }
    },
    messages: {
      email: { required: '请输入邮箱', email: '请输入正确的邮箱格式' },
      password: { required: '请输入密码', minlength: '密码至少6位' }
    },
    errorPlacement: function (e, el) {
      $(el).closest('.mb-3').find('label.error').text(e.text());
    },
    submitHandler: function (form) {
      var $btn = $('#loginBtn');
      var $err = $('#loginError');
      $err.addClass('d-none');
      $btn.prop('disabled', true).find('.btn-label').html('<span class="spinner-border spinner-border-sm me-2"></span>登录中...');

      var data = {
        email: form.email.value.trim().toLowerCase(),
        password: form.password.value
      };

      CampHub.ajax.post('/account/login', data).then(function (auth) {
        CampHub.auth.setToken(auth.accessToken, auth.refreshToken, auth.user);
        CampHub.ui.toast('登录成功，欢迎回来！', 'success');
        setTimeout(function () { window.location.href = returnUrl; }, 500);
      }).catch(function (err) {
        $err.removeClass('d-none').text(err.message || '登录失败');
        $btn.prop('disabled', false).find('.btn-label').text('登 录');
      });
      return false;
    }
  });

  $('#registerForm').validate({
    rules: {
      nickname: { required: true, minlength: 2, maxlength: 20 },
      email: { required: true, email: true },
      password: { required: true, minlength: 6 },
      confirmPassword: { required: true, equalTo: '#password' },
      agree: { required: true }
    },
    messages: {
      nickname: { required: '请输入昵称', minlength: '昵称至少2字' },
      email: { required: '请输入邮箱', email: '邮箱格式不正确' },
      password: { required: '请输入密码', minlength: '密码至少6位' },
      confirmPassword: { required: '请确认密码', equalTo: '两次输入的密码不一致' },
      agree: { required: '请先同意服务条款' }
    },
    errorPlacement: function (e, el) {
      $(el).closest('.mb-3, .form-check').find('label.error').text(e.text());
    },
    submitHandler: function (form) {
      var $btn = $('#registerBtn');
      var $err = $('#registerError');
      $err.addClass('d-none');
      $btn.prop('disabled', true).find('.btn-label').html('<span class="spinner-border spinner-border-sm me-2"></span>创建中...');

      var data = {
        email: form.email.value.trim().toLowerCase(),
        password: form.password.value,
        nickname: form.nickname.value.trim(),
        confirmPassword: form.confirmPassword.value
      };

      CampHub.ajax.post('/account/register', data).then(function (auth) {
        CampHub.auth.setToken(auth.accessToken, auth.refreshToken, auth.user);
        CampHub.ui.toast('注册成功！初始信用分 100', 'success');
        setTimeout(function () { window.location.href = returnUrl; }, 500);
      }).catch(function (err) {
        $err.removeClass('d-none').text(err.message || '注册失败');
        $btn.prop('disabled', false).find('.btn-label').text('注 册 并 登 录');
      });
      return false;
    }
  });

  var demoUsers = {
    organizer: { email: 'organizer@camphub.demo', nickname: '露营团长', creditScore: 118 },
    participant: { email: 'camper@camphub.demo', nickname: '逍遥客', creditScore: 95 }
  };

  $('[data-demo]').on('click', function () {
    var type = $(this).data('demo');
    var demo = demoUsers[type];
    if (!demo) return;
    var fakeJwt = btoa(JSON.stringify({ sub: 'demo_' + type, email: demo.email, nbf: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 7200 }));
    var fakeUser = { id: 'demo_' + type, email: demo.email, nickname: demo.nickname, avatarUrl: '', creditScore: demo.creditScore };
    CampHub.auth.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + fakeJwt + '.demo', 'DEMO_REFRESH_' + type, fakeUser);
    CampHub.ui.toast('演示模式：欢迎，' + demo.nickname, 'success');
    setTimeout(function () { window.location.href = returnUrl; }, 400);
  });
})(jQuery);
