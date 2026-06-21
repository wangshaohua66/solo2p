const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function checkLogin() {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function setAuthHeader() {
    const token = getToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function apiRequest(url, method = 'GET', data = null) {
    const options = {
        method: method,
        headers: setAuthHeader()
    };
    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }
    return fetch(API_BASE + url, options)
        .then(response => {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return Promise.reject('未登录或登录已过期');
            }
            return response.json();
        })
        .then(result => {
            if (result.code === 0) {
                return result.data;
            } else {
                return Promise.reject(result.message || '请求失败');
            }
        });
}

function showAlert(message, type = 'info') {
    const alertDiv = $('<div class="alert alert-' + type + ' alert-dismissible fade show" role="alert"></div>');
    alertDiv.html(`
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `);
    $('.alert-container').prepend(alertDiv);
    setTimeout(() => {
        alertDiv.alert('close');
    }, 3000);
}

function renderNavbar() {
    const user = getUser();
    if (!user) return;

    const roleNames = {
        'admin': '系统管理员',
        'manager': '考务管理员',
        'examiner': '考评员',
        'examinee': '考生'
    };

    const roleName = roleNames[user.role] || user.role;

    const navHtml = `
        <nav class="navbar navbar-expand-lg fixed-top">
            <div class="container-fluid">
                <a class="navbar-brand" href="dashboard.html">
                    <i class="bi bi-mortarboard-fill"></i>
                    <span>职业技能鉴定管理系统</span>
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav me-auto">
                        <li class="nav-item">
                            <a class="nav-link active" href="dashboard.html">
                                <i class="bi bi-speedometer2"></i> 首页
                            </a>
                        </li>
                        ${user.role !== 'examinee' ? `
                        <li class="nav-item dropdown">
                            <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
                                <i class="bi bi-calendar-event"></i> 考期管理
                            </a>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="exam-list.html">考期列表</a></li>
                                <li><a class="dropdown-item" href="exam-create.html">申报考期</a></li>
                                <li><a class="dropdown-item" href="schedule.html">考场安排</a></li>
                            </ul>
                        </li>
                        <li class="nav-item dropdown">
                            <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
                                <i class="bi bi-people"></i> 人员管理
                            </a>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="examinee-list.html">考生管理</a></li>
                                <li><a class="dropdown-item" href="examiner-list.html">考评员管理</a></li>
                                <li><a class="dropdown-item" href="institution-list.html">机构管理</a></li>
                            </ul>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="score-list.html">
                                <i class="bi bi-file-earmark-check"></i> 成绩管理
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="certificate-list.html">
                                <i class="bi bi-award"></i> 证书管理
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="statistics.html">
                                <i class="bi bi-bar-chart"></i> 统计分析
                            </a>
                        </li>
                        ` : `
                        <li class="nav-item">
                            <a class="nav-link" href="my-exams.html">
                                <i class="bi bi-calendar-check"></i> 我的考试
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="my-scores.html">
                                <i class="bi bi-file-earmark-text"></i> 我的成绩
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="my-certificates.html">
                                <i class="bi bi-award"></i> 我的证书
                            </a>
                        </li>
                        `}
                    </ul>
                    <ul class="navbar-nav">
                        <li class="nav-item dropdown">
                            <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
                                <i class="bi bi-person-circle"></i>
                                ${user.realName}
                                <span class="badge bg-light text-primary ms-1">${roleName}</span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item" href="profile.html">
                                    <i class="bi bi-person"></i> 个人信息
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item" href="#" onclick="logout(); return false;">
                                    <i class="bi bi-box-arrow-right"></i> 退出登录
                                </a></li>
                            </ul>
                        </li>
                    </ul>
                </div>
                <div class="alert-container"></div>
            </div>
        </nav>
    `;

    $('body').prepend(navHtml);
}

function logout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showLoading(btn) {
    const originalText = $(btn).html();
    $(btn).data('original-text', originalText);
    $(btn).prop('disabled', true);
    $(btn).html('<span class="loading-spinner"></span> 处理中...');
}

function hideLoading(btn) {
    const originalText = $(btn).data('original-text');
    $(btn).prop('disabled', false);
    $(btn).html(originalText);
}
