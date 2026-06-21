const API_BASE = '/api';

const roleNameMap = {
    1: '超级管理员',
    2: '考务管理员',
    3: '考评员',
    4: '考生'
};

function getToken() {
    return localStorage.getItem('token') || '';
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
}

function getUserInfo() {
    const userInfo = localStorage.getItem('userInfo');
    return userInfo ? JSON.parse(userInfo) : null;
}

function setUserInfo(userInfo) {
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
}

function checkLogin() {
    const token = getToken();
    if (!token) {
        if (window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
        }
        return false;
    }
    if (window.location.pathname === '/login.html') {
        window.location.href = '/index.html';
    }
    return true;
}

function logout() {
    removeToken();
    window.location.href = '/login.html';
}

function ajax(options) {
    const defaults = {
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        headers: {}
    };
    
    const settings = $.extend({}, defaults, options);
    const token = getToken();
    
    if (token) {
        settings.headers['Authorization'] = 'Bearer ' + token;
    }
    
    if (settings.data && settings.contentType === 'application/json' && typeof settings.data !== 'string') {
        settings.data = JSON.stringify(settings.data);
    }
    
    settings.beforeSend = function(xhr) {
        Object.keys(settings.headers).forEach(function(key) {
            xhr.setRequestHeader(key, settings.headers[key]);
        });
        if (options.beforeSend) {
            return options.beforeSend.apply(this, arguments);
        }
    };
    
    settings.error = function(xhr, status, error) {
        if (xhr.status === 401) {
            removeToken();
            window.location.href = '/login.html';
            return;
        }
        if (options.error) {
            options.error.apply(this, arguments);
        } else {
            const message = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : '请求失败，请稍后重试';
            showError(message);
        }
    };
    
    return $.ajax(settings);
}

function padZero(num) {
    return num < 10 ? '0' + num : num;
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + padZero(d.getMonth() + 1) + '-' + padZero(d.getDate());
}

function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + padZero(d.getMonth() + 1) + '-' + padZero(d.getDate()) + ' ' + 
           padZero(d.getHours()) + ':' + padZero(d.getMinutes()) + ':' + padZero(d.getSeconds());
}

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '!',
        info: 'i'
    };
    
    const $toast = $('<div class="toast ' + type + '">' +
        '<div class="toast-icon">' + icons[type] + '</div>' +
        '<div class="toast-message">' + message + '</div>' +
        '</div>');
    
    let $container = $('.toast-container');
    if ($container.length === 0) {
        $container = $('<div class="toast-container"></div>');
        $('body').append($container);
    }
    
    $container.append($toast);
    
    setTimeout(function() {
        $toast.css({
            opacity: '0',
            transform: 'translateX(100%)',
            transition: 'all 0.3s ease'
        });
        setTimeout(function() {
            $toast.remove();
        }, 300);
    }, duration);
}

function showSuccess(message, duration) {
    showToast(message, 'success', duration);
}

function showError(message, duration) {
    showToast(message, 'error', duration);
}

function showWarning(message, duration) {
    showToast(message, 'warning', duration);
}

function showInfo(message, duration) {
    showToast(message, 'info', duration);
}

function renderNavbar(activeMenu) {
    const userInfo = getUserInfo();
    if (!userInfo) return;
    
    const roleId = userInfo.role_id || 4;
    const userName = userInfo.name || userInfo.username || '';
    const roleName = roleNameMap[roleId] || '考生';
    const initial = userName.charAt(0).toUpperCase();
    
    const menus = [
        { id: 'index', name: '首页', url: '/index.html', roles: [1, 2, 3, 4] },
        { id: 'exam', name: '考期管理', url: '/exam.html', roles: [1, 2] },
        { id: 'question', name: '题库中心', url: '/question.html', roles: [1, 2, 3] },
        { id: 'score', name: '成绩管理', url: '/score.html', roles: [1, 2, 3, 4] },
        { id: 'certificate', name: '证书管理', url: '/certificate.html', roles: [1, 2, 4] },
        { id: 'statistics', name: '统计看板', url: '/statistics.html', roles: [1, 2] }
    ];
    
    const allowedMenus = menus.filter(function(menu) {
        return menu.roles.indexOf(roleId) !== -1;
    });
    
    const navHtml = [
        '<nav class="navbar navbar-expand-lg navbar-light">',
        '<div class="container-fluid">',
        '<a class="navbar-brand" href="/index.html">职业技能鉴定管理系统</a>',
        '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">',
        '<span class="navbar-toggler-icon"></span>',
        '</button>',
        '<div class="collapse navbar-collapse" id="navbarNav">',
        '<ul class="navbar-nav me-auto">'
    ];
    
    allowedMenus.forEach(function(menu) {
        const activeClass = activeMenu === menu.id ? ' active' : '';
        navHtml.push('<li class="nav-item">',
            '<a class="nav-link' + activeClass + '" href="' + menu.url + '">' + menu.name + '</a>',
            '</li>');
    });
    
    navHtml.push(
        '</ul>',
        '<ul class="navbar-nav">',
        '<li class="nav-item dropdown">',
        '<a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">',
        '<div class="nav-user-avatar">' + initial + '</div>',
        '<div class="d-none d-lg-block">',
        '<div class="nav-user-name">' + userName + '</div>',
        '<div class="nav-user-role">' + roleName + '</div>',
        '</div>',
        '</a>',
        '<ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">',
        '<li><a class="dropdown-item" href="/profile.html">个人中心</a></li>',
        '<li><hr class="dropdown-divider"></li>',
        '<li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="logout()">退出登录</a></li>',
        '</ul>',
        '</li>',
        '</ul>',
        '</div>',
        '</div>',
        '</nav>'
    );
    
    $('#navbar-container').html(navHtml.join(''));
}

function showLoading() {
    const $loading = $('<div class="loading-overlay" id="loading-overlay">' +
        '<div class="loading-spinner"></div>' +
        '</div>');
    $('body').append($loading);
}

function hideLoading() {
    const $loading = $('#loading-overlay');
    $loading.addClass('hidden');
    setTimeout(function() {
        $loading.remove();
    }, 500);
}

function confirmDialog(message, callback) {
    const $modal = $('<div class="modal fade" tabindex="-1" id="confirm-dialog">' +
        '<div class="modal-dialog modal-dialog-centered">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<h5 class="modal-title">确认操作</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
        '</div>' +
        '<div class="modal-body">' +
        '<p>' + message + '</p>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">取消</button>' +
        '<button type="button" class="btn btn-primary" id="confirm-ok">确定</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>');
    
    $('body').append($modal);
    
    const modal = new bootstrap.Modal($modal[0]);
    modal.show();
    
    $('#confirm-ok').on('click', function() {
        modal.hide();
        $modal.on('hidden.bs.modal', function() {
            $modal.remove();
            if (callback) callback();
        });
    });
    
    $modal.on('hidden.bs.modal', function() {
        $modal.remove();
    });
}

function formatCurrency(num) {
    if (isNaN(num)) return '0.00';
    return parseFloat(num).toFixed(2);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

$(document).ready(function() {
    checkLogin();
    
    $('body').on('click', '.btn-logout', function() {
        logout();
    });
    
    $(document).ajaxStart(function() {
        if ($('.loading-overlay').length === 0) {
            showLoading();
        }
    });
    
    $(document).ajaxStop(function() {
        hideLoading();
    });
    
    $(window).on('load', function() {
        setTimeout(function() {
            hideLoading();
        }, 300);
    });
});
