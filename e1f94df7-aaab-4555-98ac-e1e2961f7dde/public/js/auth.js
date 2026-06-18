(function(window, $) {
  var api = window.AuctionApp.api;
  var utils = window.AuctionApp.utils;
  var USER_KEY = 'auction_user';
  var _currentUser = null;
  var _loginModal = null;

  function getCurrentUser() {
    if (_currentUser) return _currentUser;
    try {
      var stored = localStorage.getItem(USER_KEY);
      if (stored) _currentUser = JSON.parse(stored);
    } catch (e) {}
    return _currentUser;
  }

  function setCurrentUser(user) {
    _currentUser = user;
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  function isLoggedIn() {
    return !!api.getToken() && !!getCurrentUser();
  }

  function showLogin() {
    logout(true);
    loadLoginPage();
    var modalEl = document.getElementById('loginModal');
    if (modalEl) {
      _loginModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      _loginModal.show();
    }
  }

  function hideLogin() {
    if (_loginModal) {
      _loginModal.hide();
    }
  }

  function loadLoginPage() {
    var $content = $('#login-modal-content');
    $content.load('pages/login.html', function() {
      bindLoginEvents();
    });
  }

  function bindLoginEvents() {
    var $modal = $('#login-modal-content');

    $modal.off('click', '#btn-show-register').on('click', '#btn-show-register', function(e) {
      e.preventDefault();
      $('#login-form').hide();
      $('#register-form').fadeIn(300);
    });

    $modal.off('click', '#btn-show-login').on('click', '#btn-show-login', function(e) {
      e.preventDefault();
      $('#register-form').hide();
      $('#login-form').fadeIn(300);
    });

    $modal.off('submit', '#login-form').on('submit', '#login-form', function(e) {
      e.preventDefault();
      handleLogin($(this));
    });

    $modal.off('submit', '#register-form').on('submit', '#register-form', function(e) {
      e.preventDefault();
      handleRegister($(this));
    });
  }

  function handleLogin($form) {
    var email = $form.find('#login-email').val().trim();
    var password = $form.find('#login-password').val();

    if (!email || !password) {
      utils.showToast('请填写邮箱和密码', 'warning');
      return;
    }

    var $btn = $form.find('button[type="submit"]');
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>登录中...');

    api.post('/auth/login', { email: email, password: password })
      .then(function(res) {
        var data = res.data || res;
        api.setToken(data.token);
        setCurrentUser(data.user || { email: email });
        updateNavbar();
        hideLogin();
        utils.showToast('登录成功', 'success');
        window.AuctionApp.app.navigate(window.location.hash || '#dashboard');
      })
      .fail(function(err) {
        utils.showToast(err.message || '登录失败', 'danger');
      })
      .always(function() {
        $btn.prop('disabled', false).text('登录');
      });
  }

  function handleRegister($form) {
    var name = $form.find('#reg-name').val().trim();
    var email = $form.find('#reg-email').val().trim();
    var phone = $form.find('#reg-phone').val().trim();
    var password = $form.find('#reg-password').val();
    var role = $form.find('#reg-role').val();

    if (!name || !email || !password || !role) {
      utils.showToast('请填写所有必填项', 'warning');
      return;
    }

    var $btn = $form.find('button[type="submit"]');
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>注册中...');

    api.post('/auth/register', { name: name, email: email, phone: phone, password: password, role: role })
      .then(function(res) {
        utils.showToast('注册成功，请登录', 'success');
        $('#register-form').hide();
        $('#login-form').fadeIn(300);
        $('#login-email').val(email);
      })
      .fail(function(err) {
        utils.showToast(err.message || '注册失败', 'danger');
      })
      .always(function() {
        $btn.prop('disabled', false).text('注册');
      });
  }

  function logout(silent) {
    api.removeToken();
    setCurrentUser(null);
    updateNavbar();
    if (!silent) {
      utils.showToast('已退出登录', 'info');
      showLogin();
    }
  }

  function updateNavbar() {
    var user = getCurrentUser();
    if (user) {
      $('#user-dropdown-wrapper').show();
      $('#current-user-name').text(user.name || user.email || '用户');
    } else {
      $('#user-dropdown-wrapper').hide();
    }
  }

  function hasRole(role) {
    var user = getCurrentUser();
    return user && user.role === role;
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      showLogin();
      return false;
    }
    return true;
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.auth = {
    getCurrentUser: getCurrentUser,
    setCurrentUser: setCurrentUser,
    isLoggedIn: isLoggedIn,
    showLogin: showLogin,
    hideLogin: hideLogin,
    logout: logout,
    updateNavbar: updateNavbar,
    hasRole: hasRole,
    requireAuth: requireAuth
  };
})(window, jQuery);
