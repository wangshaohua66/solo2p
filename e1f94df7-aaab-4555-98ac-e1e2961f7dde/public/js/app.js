(function(window, $) {
  var auth = window.AuctionApp.auth;
  var utils = window.AuctionApp.utils;
  var ROUTES = {
    '#dashboard': { page: 'dashboard', module: 'dashboard', title: '看板' },
    '#auctions':  { page: 'auctions',  module: 'auctions',  title: '拍卖会' },
    '#lots':      { page: 'lots',      module: 'lots',      title: '拍品' },
    '#settlements': { page: 'settlements', module: 'settlements', title: '结算' },
    '#catalogs':  { page: 'catalogs',  module: 'catalogs',  title: '图录' }
  };
  var _currentPage = null;
  var _particleCanvas = null;
  var _particleCtx = null;
  var _particles = [];
  var _animFrameId = null;

  function navigate(hash) {
    if (hash && hash !== window.location.hash) {
      window.location.hash = hash;
      return;
    }
    hash = hash || window.location.hash || '#dashboard';
    var route = ROUTES[hash];
    if (!route) {
      hash = '#dashboard';
      route = ROUTES[hash];
    }

    if (!auth.requireAuth()) return;

    utils.showLoading();
    var pageFile = 'pages/' + route.page + '.html';

    $.get(pageFile)
      .done(function(html) {
        $('#page-container').html(html);
        setActiveNav(hash);
        _currentPage = route.page;
        document.title = route.title + ' - 拍卖行管理系统';
        initPageModule(route.module);
      })
      .fail(function() {
        $('#page-container').html(
          '<div class="text-center py-5"><h3>页面加载失败</h3><p class="text-muted">请刷新重试</p></div>'
        );
      })
      .always(function() {
        utils.hideLoading();
      });
  }

  function initPageModule(moduleName) {
    var mod = window.AuctionApp[moduleName];
    if (mod && typeof mod.init === 'function') {
      mod.init();
    }
  }

  function setActiveNav(hash) {
    $('.navbar .nav-link').removeClass('active');
    $('.navbar .nav-link[data-page="' + (ROUTES[hash] ? ROUTES[hash].page : 'dashboard') + '"]').addClass('active');
  }

  function getCurrentPage() {
    return _currentPage;
  }

  function initParticles() {
    _particleCanvas = document.getElementById('particle-canvas');
    if (!_particleCanvas) return;
    _particleCtx = _particleCanvas.getContext('2d');
    resizeParticleCanvas();
    $(window).on('resize', resizeParticleCanvas);
  }

  function resizeParticleCanvas() {
    if (!_particleCanvas) return;
    _particleCanvas.width = window.innerWidth;
    _particleCanvas.height = window.innerHeight;
  }

  function triggerHammerCelebration(x, y) {
    if (!_particleCtx) initParticles();
    var colors = ['#c9a96e', '#e8d5b7', '#ffd700', '#8b6914', '#f5f0e8', '#d4af37'];
    for (var i = 0; i < 80; i++) {
      var angle = (Math.PI * 2 * i) / 80 + (Math.random() - 0.5) * 0.5;
      var speed = 3 + Math.random() * 8;
      _particles.push({
        x: x || window.innerWidth / 2,
        y: y || window.innerHeight / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        gravity: 0.12 + Math.random() * 0.05
      });
    }
    if (!_animFrameId) {
      animateParticles();
    }
  }

  function animateParticles() {
    if (!_particleCtx || !_particleCanvas) return;
    _particleCtx.clearRect(0, 0, _particleCanvas.width, _particleCanvas.height);

    for (var i = _particles.length - 1; i >= 0; i--) {
      var p = _particles[i];
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.life -= p.decay;
      p.vx *= 0.99;

      if (p.life <= 0) {
        _particles.splice(i, 1);
        continue;
      }

      _particleCtx.save();
      _particleCtx.globalAlpha = p.life;
      _particleCtx.fillStyle = p.color;
      _particleCtx.beginPath();
      _particleCtx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
      _particleCtx.fill();

      _particleCtx.shadowColor = p.color;
      _particleCtx.shadowBlur = 6;
      _particleCtx.fill();
      _particleCtx.restore();
    }

    if (_particles.length > 0) {
      _animFrameId = requestAnimationFrame(animateParticles);
    } else {
      _animFrameId = null;
    }
  }

  function flipNumber($el, newValue, prefix) {
    prefix = prefix || '';
    $el.addClass('flip-out');
    setTimeout(function() {
      $el.text(prefix + newValue).removeClass('flip-out').addClass('flip-in');
      setTimeout(function() {
        $el.removeClass('flip-in');
      }, 50);
    }, 150);
  }

  function init() {
    initParticles();

    $(window).on('hashchange', function() {
      navigate(window.location.hash);
    });

    $('.navbar').on('click', '.nav-link', function() {
      var $navbar = $('#navbarNav');
      if ($navbar.hasClass('show')) {
        var bsCollapse = bootstrap.Collapse.getInstance($navbar[0]);
        if (bsCollapse) bsCollapse.hide();
      }
    });

    $(document).on('click', '#btn-logout', function(e) {
      e.preventDefault();
      auth.logout();
    });

    $(document).on('click', '#btn-profile', function(e) {
      e.preventDefault();
      var user = auth.getCurrentUser();
      if (user) {
        utils.showToast('用户: ' + (user.name || user.email) + ' | 角色: ' + utils.getRoleLabel(user.role), 'info');
      }
    });

    auth.updateNavbar();

    if (auth.isLoggedIn()) {
      navigate(window.location.hash || '#dashboard');
    } else {
      auth.showLogin();
    }
  }

  $(document).ready(init);

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.app = {
    navigate: navigate,
    getCurrentPage: getCurrentPage,
    triggerHammerCelebration: triggerHammerCelebration,
    flipNumber: flipNumber
  };
})(window, jQuery);
