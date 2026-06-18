(function(window, $) {
  var BASE_URL = 'http://localhost:3001/api';
  var TOKEN_KEY = 'auction_jwt_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function buildHeaders(hasBody) {
    var headers = {};
    var token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  function handleResponse(xhr) {
    if (xhr.status === 401) {
      removeToken();
      window.AuctionApp.auth.showLogin();
      return $.Deferred().reject({ code: 401, message: '登录已过期，请重新登录' });
    }

    var data;
    try {
      data = JSON.parse(xhr.responseText);
    } catch (e) {
      data = { code: xhr.status, message: '服务器响应异常' };
    }

    if (xhr.status >= 200 && xhr.status < 300) {
      if (data.code && data.code !== 0 && data.code !== 200) {
        window.AuctionApp.utils.showToast(data.message || '操作失败', 'danger');
        return $.Deferred().reject(data);
      }
      return $.Deferred().resolve(data);
    }

    window.AuctionApp.utils.showToast(data.message || '请求失败', 'danger');
    return $.Deferred().reject(data);
  }

  function request(method, path, data) {
    var hasBody = data !== undefined && data !== null;
    var options = {
      method: method,
      url: BASE_URL + path,
      headers: buildHeaders(hasBody),
      dataType: 'json'
    };
    if (hasBody) {
      options.data = JSON.stringify(data);
    }
    return $.ajax(options).then(
      function(resp) { return $.Deferred().resolve(resp); },
      function(xhr) { return handleResponse(xhr); }
    );
  }

  function get(path, params) {
    if (params) {
      var qs = $.param(params);
      path = path + (path.indexOf('?') > -1 ? '&' : '?') + qs;
    }
    return request('GET', path);
  }

  function post(path, data) {
    return request('POST', path, data);
  }

  function put(path, data) {
    return request('PUT', path, data);
  }

  function del(path) {
    return request('DELETE', path);
  }

  function upload(path, formData) {
    var token = getToken();
    return $.ajax({
      url: BASE_URL + path,
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      data: formData,
      processData: false,
      contentType: false,
      dataType: 'json'
    }).then(
      function(resp) { return $.Deferred().resolve(resp); },
      function(xhr) { return handleResponse(xhr); }
    );
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.api = {
    get: get,
    post: post,
    put: put,
    delete: del,
    upload: upload,
    getToken: getToken,
    setToken: setToken,
    removeToken: removeToken,
    BASE_URL: BASE_URL
  };
})(window, jQuery);
