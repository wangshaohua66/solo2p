(function (global) {
  'use strict';

  const API_BASE = '/api';
  const TOKEN_KEY = 'camphub_token';
  const REFRESH_KEY = 'camphub_refresh';
  const USER_KEY = 'camphub_user';
  const COMPRESS_THRESHOLD_MB = 5;

  let _refreshInProgress = null;

  const CampHub = {
    COMPRESS_THRESHOLD_MB,

    auth: {
      getToken() {
        return localStorage.getItem(TOKEN_KEY) || '';
      },
      setToken(token, refreshToken, user) {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      },
      getRefreshToken() {
        return localStorage.getItem(REFRESH_KEY) || '';
      },
      getUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
        catch { return null; }
      },
      isLoggedIn() {
        return !!this.getToken();
      },
      logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
        CampHub.ajax.post('/account/logout').finally(() => {
          window.location.href = '/Account/Login';
        });
      },
      requireLogin() {
        if (!this.isLoggedIn()) {
          this.redirectToLogin();
          return false;
        }
        return true;
      },
      redirectToLogin(returnUrl) {
        const url = returnUrl || encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/Account/Login?returnUrl=' + url;
      }
    },

    ajax: {
      request(method, url, data, opts = {}) {
        const fullUrl = url.startsWith('http') ? url
          : url.startsWith('/api') || url.startsWith('/Account')
            ? url : API_BASE + url;

        const headers = Object.assign({}, opts.headers || {});
        const token = CampHub.auth.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const settings = {
          url: fullUrl, method: method.toUpperCase(),
          headers, timeout: opts.timeout || 30000,
          xhrFields: { withCredentials: true }
        };

        if (opts.contentType === false) {
          settings.processData = false;
          settings.contentType = false;
          settings.data = data;
        } else if (data instanceof FormData) {
          settings.processData = false;
          settings.contentType = false;
          settings.data = data;
        } else if (data !== undefined && data !== null) {
          settings.contentType = 'application/json; charset=utf-8';
          settings.dataType = opts.dataType || 'json';
          settings.data = typeof data === 'string' ? data : JSON.stringify(data);
        } else {
          settings.dataType = opts.dataType || 'json';
        }

        return $.ajax(settings).then(
          (res) => CampHub.ajax._handleResponse(res, method, url, data, opts),
          (xhr) => CampHub.ajax._handleError(xhr, method, url, data, opts)
        );
      },

      _handleResponse(res, method, url, data, opts) {
        if (res && typeof res === 'object' && 'success' in res) {
          if (!res.success) {
            const err = new Error(res.message || '请求失败');
            err.data = res.data;
            err.apiError = true;
            return Promise.reject(err);
          }
          return opts.raw ? res : res.data;
        }
        return res;
      },

      async _handleError(xhr, method, url, data, opts) {
        if (xhr.status === 401 && !opts._retried) {
          try {
            await CampHub.ajax._refreshTokenFlow();
            opts._retried = true;
            return CampHub.ajax.request(method, url, data, opts);
          } catch {
            CampHub.auth.redirectToLogin();
            return Promise.reject(new Error('登录已过期'));
          }
        }

        let msg = xhr.statusText || '网络错误';
        if (xhr.responseJSON && xhr.responseJSON.message) msg = xhr.responseJSON.message;
        else if (xhr.responseText) {
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed.message) msg = parsed.message;
          } catch {}
        }
        const err = new Error(msg);
        err.status = xhr.status;
        err.response = xhr.responseJSON || xhr.responseText;
        return Promise.reject(err);
      },

      async _refreshTokenFlow() {
        if (_refreshInProgress) return _refreshInProgress;
        _refreshInProgress = (async () => {
          const rt = CampHub.auth.getRefreshToken();
          if (!rt) throw new Error('no refresh token');
          const res = await $.ajax({
            url: API_BASE + '/account/refresh',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ refreshToken: rt }),
            xhrFields: { withCredentials: true }
          });
          if (res && res.success && res.data) {
            CampHub.auth.setToken(res.data.accessToken,
              res.data.refreshToken, res.data.user);
          } else {
            throw new Error('refresh failed');
          }
        })();
        try { await _refreshInProgress; }
        finally { _refreshInProgress = null; }
      },

      get(url, data, opts) {
        if (data && typeof data === 'object') {
          const qs = $.param(data);
          if (qs) url += (url.includes('?') ? '&' : '?') + qs;
        }
        return this.request('GET', url, undefined, opts);
      },
      post(url, data, opts) { return this.request('POST', url, data, opts); },
      put(url, data, opts) { return this.request('PUT', url, data, opts); },
      delete(url, data, opts) { return this.request('DELETE', url, data, opts); }
    },

    image: {
      async compressIfNeeded(file, maxMB) {
        const threshold = (maxMB || COMPRESS_THRESHOLD_MB) * 1024 * 1024;
        if (file.size <= threshold) return file;

        const maxWidth = 1920;
        const maxHeight = 1920;
        const quality = 0.8;

        const bitmap = await CampHub.image._loadImage(file);
        let { width, height } = bitmap;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);

        return await new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('压缩失败'));
            const newFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'),
              { type: 'image/jpeg', lastModified: Date.now() });
            resolve(newFile);
          }, 'image/jpeg', quality);
        });
      },

      _loadImage(file) {
        return new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
          img.src = url;
        });
      },

      dataUrlFromFile(file) {
        return new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(file);
        });
      }
    },

    ui: {
      toast(message, type = 'info') {
        const colors = {
          success: 'bg-success',
          error: 'bg-danger',
          info: 'bg-primary',
          warning: 'bg-warning text-dark'
        };
        const el = $(`
          <div class="position-fixed top-0 end-0 p-3" style="z-index:9999">
            <div class="toast align-items-center text-white ${colors[type] || colors.info} border-0 show"
                 role="alert" style="min-width:260px; opacity:1;">
              <div class="d-flex">
                <div class="toast-body fw-medium">${CampHub.util.escapeHtml(message)}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto"
                        data-bs-dismiss="toast"></button>
              </div>
            </div>
          </div>`).appendTo(document.body);
        setTimeout(() => el.fadeOut(300, () => el.remove()), 3500);
        el.find('[data-bs-dismiss]').on('click', () => el.remove());
      },

      confirm(message, title = '确认操作') {
        return new Promise((resolve) => {
          const html = `
            <div class="modal fade show" tabindex="-1" style="display:block;background:rgba(0,0,0,0.5)">
              <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                  <div class="modal-header border-0">
                    <h6 class="modal-title fw-bold">${CampHub.util.escapeHtml(title)}</h6>
                    <button type="button" class="btn-close ch-cancel"></button>
                  </div>
                  <div class="modal-body py-3">${CampHub.util.escapeHtml(message)}</div>
                  <div class="modal-footer border-0">
                    <button type="button" class="btn btn-outline-secondary ch-cancel">取消</button>
                    <button type="button" class="btn btn-primary ch-ok">确认</button>
                  </div>
                </div>
              </div>
            </div>`;
          const $modal = $(html).appendTo(document.body);
          const close = (result) => { $modal.remove(); resolve(result); };
          $modal.find('.ch-cancel').on('click', () => close(false));
          $modal.find('.ch-ok').on('click', () => close(true));
          $modal.on('click', (e) => { if (e.target === $modal[0]) close(false); });
        });
      },

      formatLocalDate(isoDate) {
        if (!isoDate) return '';
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit'
        });
      },

      formatLocalDateTime(isoDate) {
        if (!isoDate) return '';
        const d = new Date(isoDate);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
      },

      dayUntil(isoDate) {
        if (!isoDate) return '';
        const target = new Date(isoDate).getTime();
        const now = Date.now();
        const days = Math.ceil((target - now) / 86400000);
        if (days < 0) return `已结束${-days}天`;
        if (days === 0) return '今天';
        if (days === 1) return '明天';
        return `还有${days}天`;
      },

      gearStatusBadge(status) {
        const map = {
          '在库': ['success', 'bg-success'],
          '借出': ['warning', 'bg-warning text-dark'],
          '维修中': ['danger', 'bg-danger'],
          '报废': ['secondary', 'bg-secondary']
        };
        const [cls, bg] = map[status] || ['secondary', 'bg-secondary'];
        return `<span class="badge rounded-pill ${bg}">${status}</span>`;
      },

      eventStatusBadge(status) {
        const map = {
          '筹备': ['info', 'bg-info text-dark'],
          '进行': ['success', 'bg-success'],
          '结束': ['secondary', 'bg-secondary'],
          '归档': ['dark', 'bg-dark']
        };
        const [cls, bg] = map[status] || ['secondary', 'bg-secondary'];
        return `<span class="badge rounded-pill ${bg}">${status}</span>`;
      },

      avatar(user, size = 36) {
        const u = user || {};
        const name = (u.nickname || u.email || '?').charAt(0).toUpperCase();
        const color = CampHub.util.pickColor(u.id || u.email || name);
        if (u.avatarUrl) {
          return `<img src="${u.avatarUrl}" alt="${u.nickname}"
                   class="rounded-circle" style="width:${size}px;height:${size}px;object-fit:cover;">`;
        }
        return `<div class="rounded-circle d-inline-flex align-items-center justify-content-center
                        text-white fw-bold"
                    style="width:${size}px;height:${size}px;background:${color};font-size:${size/2.4}px;">
                  ${name}
                </div>`;
      },

      stars(value, max = 5) {
        const full = Math.max(0, Math.min(max, Math.round(value || 0)));
        let s = '';
        for (let i = 0; i < max; i++) {
          s += `<i class="bi bi-star${i < full ? '-fill' : ''} text-warning me-1"></i>`;
        }
        return s;
      },

      loadingOverlay(container) {
        return $(`
          <div class="ch-loading-overlay position-absolute top-0 start-0 w-100 h-100
                      d-flex align-items-center justify-content-center"
               style="background:rgba(255,255,255,0.75); z-index:10;">
            <div class="spinner-border text-primary" style="width:2.5rem;height:2.5rem"></div>
          </div>`).appendTo(container || document.body);
      },

      emptyState(message, icon = 'bi-inbox') {
        return `<div class="text-center py-5 text-muted">
          <i class="bi ${icon} fs-1 d-block mb-3 opacity-50"></i>
          <p>${CampHub.util.escapeHtml(message)}</p>
        </div>`;
      }
    },

    util: {
      escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, c => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;',
          '"': '&quot;', "'": '&#39;'
        }[c]));
      },
      pickColor(seed) {
        const colors = [
          '#2D5A27', '#3E7B34', '#5A9C47',
          '#E8833A', '#D95F1F', '#B5442C',
          '#4A6FA5', '#3B85A1', '#685B9F',
          '#A66375', '#7A5235', '#2F6C6F'
        ];
        let h = 0;
        const s = String(seed || 'x');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return colors[h % colors.length];
      },
      debounce(fn, wait = 300) {
        let t; return function () {
          const args = arguments, ctx = this;
          clearTimeout(t);
          t = setTimeout(() => fn.apply(ctx, args), wait);
        };
      },
      query(name, url) {
        const u = url ? new URL(url) : new URL(window.location.href);
        return u.searchParams.get(name);
      },
      humanSize(bytes) {
        if (!bytes) return '0 B';
        const u = ['B','KB','MB','GB'];
        let i = 0, n = bytes;
        while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
        return n.toFixed(n >= 10 || i === 0 ? 0 : 1) + ' ' + u[i];
      },
      uuid() {
        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      }
    }
  };

  $(document).ajaxSend(function (e, xhr, settings) {
    const token = CampHub.auth.getToken();
    if (token && !settings.headers?.Authorization) {
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    }
  });

  $(() => {
    $('#logout-btn, [data-action=logout]').on('click', (e) => {
      e.preventDefault();
      CampHub.auth.logout();
    });

    const $user = $('#nav-user-info');
    if ($user.length) {
      const user = CampHub.auth.getUser();
      if (user) {
        $user.html(`${CampHub.ui.avatar(user, 36)}
                   <div class="ms-2 lh-sm">
                     <div class="fw-bold text-white small">${CampHub.util.escapeHtml(user.nickname)}</div>
                     <div class="text-white-50" style="font-size:11px;">信用分 ${user.creditScore}</div>
                   </div>`);
      }
    }

    $('[data-toggle="tooltip"]').tooltip && $('[data-toggle="tooltip"]').tooltip({ boundary: 'viewport' });
  });

  global.CampHub = CampHub;
})(window);
