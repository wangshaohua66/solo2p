const API_BASE = '/api';

function getToken() { return localStorage.getItem('token') || ''; }
function getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
}
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    parent.location.href = '/index.html';
}

async function api(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (res.status === 401) {
        logout();
        throw new Error('Unauthorized');
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `请求失败: ${res.status}`);
        return data;
    }
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    return res;
}

function fmtDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

function fmtDateTime(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return `${fmtDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}

function fmtMoney(n) {
    return '¥' + (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function confirmDialog(msg) {
    return new Promise(resolve => {
        if (confirm(msg)) resolve(true);
        else resolve(false);
    });
}

function toast(msg, type = 'info') {
    const colors = { info: '#0dcaf0', success: '#198754', warning: '#ffc107', danger: '#dc3545' };
    const el = $(`<div style="position:fixed;top:24px;right:24px;z-index:9999;background:${colors[type]};color:#fff;padding:12px 24px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);min-width:200px;max-width:400px;">${msg}</div>`);
    $('body').append(el);
    setTimeout(() => el.fadeOut(() => el.remove()), 2500);
}

function emptyPlaceholder(text) {
    return `<div class="text-center text-muted py-5"><i class="bi bi-inbox" style="font-size:48px;"></i><p class="mt-3 mb-0">${text || '暂无数据'}</p></div>`;
}
