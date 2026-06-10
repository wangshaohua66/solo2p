const API_BASE = '/api/v1';

const state = {
    repos: [],
    stats: [],
    alerts: [],
    contributors: [],
    heatmapData: [],
    heatmapRepo: '',
    allHeatmapData: {},
    currentTab: 'overview',
    theme: getPreferredTheme()
};

function getPreferredTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function init() {
    applyTheme();
    setupEventListeners();
    loadAllData();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.textContent = state.theme === 'dark' ? '☀️' : '🌓';
        toggleBtn.title = state.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式';
    }
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        state.theme = e.matches ? 'dark' : 'light';
        applyTheme();
    }
});

function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('refreshBtn').addEventListener('click', loadAllData);

    document.getElementById('repoSearch').addEventListener('input', renderRepos);
    document.getElementById('healthFilter').addEventListener('change', renderRepos);

    document.getElementById('contributorSearch').addEventListener('input', renderContributors);
    document.getElementById('rankingLimit').addEventListener('change', loadContributors);

    document.getElementById('alertLevelFilter').addEventListener('change', renderAlerts);
    document.getElementById('alertTypeFilter').addEventListener('change', renderAlerts);

    const heatmapSelector = document.getElementById('heatmapRepoSelector');
    if (heatmapSelector) {
        heatmapSelector.addEventListener('change', (e) => {
            state.heatmapRepo = e.target.value;
            renderHeatmap();
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function switchTab(tabName) {
    state.currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName);
    });

    if (tabName === 'repos' && state.repos.length === 0) loadRepos();
    if (tabName === 'contributors' && state.contributors.length === 0) loadContributors();
    if (tabName === 'alerts' && state.alerts.length === 0) loadAlerts();
}

async function fetchJSON(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

async function loadAllData() {
    updateLastUpdate();
    await Promise.all([
        loadStats(),
        loadRepos(),
        loadAlerts(),
        loadHeatmap()
    ]);
    populateHeatmapSelector();
}

function populateHeatmapSelector() {
    const selector = document.getElementById('heatmapRepoSelector');
    if (!selector) return;

    const currentValue = selector.value;
    selector.innerHTML = '<option value="">全部仓库</option>';

    state.repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo.name;
        option.textContent = repo.name;
        selector.appendChild(option);
    });

    if (currentValue && state.repos.some(r => r.name === currentValue)) {
        selector.value = currentValue;
    }
}

function updateLastUpdate() {
    const now = new Date();
    document.getElementById('lastUpdate').textContent =
        `更新于 ${now.toLocaleTimeString('zh-CN')}`;
}

async function loadStats() {
    const data = await fetchJSON(`${API_BASE}/stats`);
    if (data) {
        state.stats = Array.isArray(data) ? data : [];
        updateStatsOverview();
        renderCharts();
    }
}

async function loadRepos() {
    const data = await fetchJSON(`${API_BASE}/repos`);
    if (data) {
        state.repos = (Array.isArray(data) ? data : []).map(repo => ({
            name: repo.name,
            path: repo.path,
            mode: repo.mode,
            owner: repo.owner,
            head_branch: repo.head_branch,
            head_commit: repo.head_commit,
            last_commit: repo.last_commit,
            first_commit: repo.first_commit,
            commit_count: repo.commit_count,
            contributors: repo.contributors,
            files_count: repo.files_count,
            lines_of_code: repo.lines_of_code,
            added_at: repo.added_at,
            updated_at: repo.updated_at,
            disabled: repo.disabled,
            health_level: repo.health_level,
            health_score: repo.health_score,
            silent_days: repo.silent_days
        }));
        renderRepos();
    }
}

async function loadAlerts() {
    const data = await fetchJSON(`${API_BASE}/alerts`);
    if (data) {
        state.alerts = Array.isArray(data) ? data : [];
        renderAlerts();
    }
}

async function loadContributors() {
    const limit = document.getElementById('rankingLimit').value;
    const data = await fetchJSON(`${API_BASE}/contributors/ranking?limit=${limit}`);
    if (data) {
        state.contributors = Array.isArray(data) ? data : [];
        renderContributors();
    }
}

async function loadHeatmap() {
    state.allHeatmapData = {};
    state.heatmapData = [];

    const reposToLoad = state.repos.length > 0 ? state.repos : await fetchJSON(`${API_BASE}/repos`);
    if (!Array.isArray(reposToLoad) || reposToLoad.length === 0) {
        return;
    }

    const combinedData = {};

    for (const repo of reposToLoad) {
        const repoName = repo.name || repo.Name;
        if (!repoName) continue;

        try {
            const heatmap = await fetchJSON(`${API_BASE}/repos/${repoName}/heatmap?days=90`);
            if (heatmap && Array.isArray(heatmap)) {
                state.allHeatmapData[repoName] = heatmap;

                heatmap.forEach(d => {
                    const date = d.date || d.Date;
                    const count = d.count || d.Count || 0;
                    if (date) {
                        const key = new Date(date).toISOString().split('T')[0];
                        combinedData[key] = (combinedData[key] || 0) + count;
                    }
                });
            }
        } catch (e) {
            console.error(`Failed to load heatmap for ${repoName}:`, e);
        }
    }

    state.heatmapData = Object.entries(combinedData).map(([date, count]) => ({
        date,
        count
    })).sort((a, b) => a.date.localeCompare(b.date));

    renderHeatmap();
}

function updateStatsOverview() {
    const stats = state.stats;
    let good = 0, warning = 0, critical = 0, totalCommits = 0;

    stats.forEach(s => {
        const level = s.health_level || s.HealthLevel || 'good';
        if (level === 'good') good++;
        else if (level === 'warning') warning++;
        else if (level === 'critical') critical++;
        totalCommits += s.total_commits || s.TotalCommits || 0;
    });

    document.getElementById('totalRepos').textContent = stats.length;
    document.getElementById('goodRepos').textContent = good;
    document.getElementById('warningRepos').textContent = warning;
    document.getElementById('criticalRepos').textContent = critical;
    document.getElementById('totalCommits').textContent = formatNumber(totalCommits);
    document.getElementById('activeAlerts').textContent = state.alerts.filter(a => !a.Resolved).length;
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatRelative(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
    return `${Math.floor(diffDays / 365)} 年前`;
}

function renderCharts() {
    renderHealthChart();
    renderAlertsChart();
}

function renderHealthChart() {
    const canvas = document.getElementById('healthChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    let good = 0, warning = 0, critical = 0;
    state.stats.forEach(s => {
        const level = s.health_level || s.HealthLevel || 'good';
        if (level === 'good') good++;
        else if (level === 'warning') warning++;
        else if (level === 'critical') critical++;
    });

    const total = good + warning + critical;
    if (total === 0) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
        return;
    }

    const barWidth = width * 0.6;
    const barHeight = 40;
    const x = (width - barWidth) / 2;
    const y = (height - barHeight) / 2;

    const segments = [
        { value: good, color: '#10b981', label: '健康' },
        { value: warning, color: '#f59e0b', label: '警告' },
        { value: critical, color: '#ef4444', label: '严重' }
    ];

    let currentX = x;
    segments.forEach(seg => {
        const segWidth = (seg.value / total) * barWidth;
        if (segWidth > 0) {
            ctx.fillStyle = seg.color;
            ctx.beginPath();
            const radius = 8;
            const left = currentX;
            const right = currentX + segWidth;
            const top = y;
            const bottom = y + barHeight;

            ctx.moveTo(left + radius, top);
            ctx.lineTo(right - radius, top);
            ctx.quadraticCurveTo(right, top, right, top + radius);
            ctx.lineTo(right, bottom - radius);
            ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
            ctx.lineTo(left + radius, bottom);
            ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
            ctx.lineTo(left, top + radius);
            ctx.quadraticCurveTo(left, top, left + radius, top);
            ctx.closePath();
            ctx.fill();

            if (segWidth > 40) {
                ctx.fillStyle = 'white';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(seg.value, currentX + segWidth / 2, y + barHeight / 2 + 5);
            }

            currentX += segWidth;
        }
    });

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
    ctx.font = '12px sans-serif';
    let legendX = x;
    segments.forEach(seg => {
        if (seg.value > 0) {
            ctx.fillStyle = seg.color;
            ctx.fillRect(legendX, y + barHeight + 15, 12, 12);
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
            ctx.fillText(`${seg.label} (${seg.value})`, legendX + 18, y + barHeight + 25);
            legendX += 100;
        }
    });
}

function renderAlertsChart() {
    const canvas = document.getElementById('alertsChart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    const typeMap = {};
    state.alerts.forEach(a => {
        if (!a.Resolved) {
            const type = a.Type || a.type || 'unknown';
            typeMap[type] = (typeMap[type] || 0) + 1;
        }
    });

    const entries = Object.entries(typeMap);
    if (entries.length === 0) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无告警', width / 2, height / 2);
        return;
    }

    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
    const total = entries.reduce((sum, [, v]) => sum + v, 0);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    let startAngle = -Math.PI / 2;
    entries.forEach(([type, value], i) => {
        const sliceAngle = (value / total) * Math.PI * 2;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        const midAngle = startAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(midAngle) * (radius + 25);
        const labelY = centerY + Math.sin(midAngle) * (radius + 25);

        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${type}: ${value}`, labelX, labelY);

        startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card');
    ctx.fill();

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(total, centerX, centerY + 8);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
    ctx.fillText('活跃告警', centerX, centerY + 28);
}

function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '';

    let data = [];
    let title = '';

    if (state.heatmapRepo && state.allHeatmapData[state.heatmapRepo]) {
        data = state.allHeatmapData[state.heatmapRepo];
        title = ` - ${state.heatmapRepo}`;
    } else {
        data = state.heatmapData;
        title = ' - 全部仓库';
    }

    const header = document.querySelector('#heatmapContainer ~ h3, h3');
    if (header && header.textContent.includes('热力图')) {
        header.textContent = `贡献热力图${title} (近90天)`;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-text">暂无热力图数据</div>
                <div class="empty-state-hint">运行 gitmon scan 扫描仓库后查看</div>
            </div>
        `;
        return;
    }

    const heatmap = document.createElement('div');
    heatmap.className = 'heatmap';

    const monthLabels = document.createElement('div');
    monthLabels.className = 'heatmap-month-labels';

    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    for (let i = 0; i < 12; i++) {
        const label = document.createElement('div');
        label.className = 'heatmap-month-label';
        label.textContent = months[i];
        monthLabels.appendChild(label);
    }
    heatmap.appendChild(monthLabels);

    const body = document.createElement('div');
    body.className = 'heatmap-body';

    const dayLabels = document.createElement('div');
    dayLabels.className = 'heatmap-day-labels';
    ['一', '', '三', '', '五', '', '日'].forEach(day => {
        const label = document.createElement('div');
        label.className = 'heatmap-day-label';
        label.textContent = day;
        dayLabels.appendChild(label);
    });
    body.appendChild(dayLabels);

    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';

    const today = new Date();
    const days = 90;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);

    const commitsByDay = {};
    if (Array.isArray(data)) {
        data.forEach(d => {
            const date = d.Date || d.date;
            const count = d.Count || d.count || 0;
            if (date) {
                const key = new Date(date).toISOString().split('T')[0];
                commitsByDay[key] = count;
            }
        });
    }

    let maxCount = 1;
    Object.values(commitsByDay).forEach(c => {
        maxCount = Math.max(maxCount, c);
    });

    for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const key = date.toISOString().split('T')[0];
        const count = commitsByDay[key] || 0;

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';

        let level = 0;
        if (count > 0) {
            level = Math.ceil((count / maxCount) * 5);
            level = Math.max(1, Math.min(5, level));
            cell.dataset.level = level;
        }

        cell.title = `${date.toLocaleDateString('zh-CN')}: ${count} 次提交`;

        cell.addEventListener('mouseenter', (e) => showTooltip(e, cell.title));
        cell.addEventListener('mouseleave', hideTooltip);

        grid.appendChild(cell);
    }

    body.appendChild(grid);
    heatmap.appendChild(body);
    container.appendChild(heatmap);

    const legend = document.createElement('div');
    legend.style.cssText = 'display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 1rem; font-size: 12px; color: var(--text-muted);';
    legend.innerHTML = `
        <span>少</span>
        <div class="heatmap-cell"></div>
        <div class="heatmap-cell" data-level="1"></div>
        <div class="heatmap-cell" data-level="2"></div>
        <div class="heatmap-cell" data-level="3"></div>
        <div class="heatmap-cell" data-level="4"></div>
        <div class="heatmap-cell" data-level="5"></div>
        <span>多</span>
    `;
    container.appendChild(legend);
}

function showTooltip(e, text) {
    hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.id = 'heatmap-tooltip';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);

    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 + window.scrollX + 'px';
    tooltip.style.top = rect.top + window.scrollY + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('heatmap-tooltip');
    if (tooltip) tooltip.remove();
}

function renderRepos() {
    const grid = document.getElementById('reposGrid');
    const search = document.getElementById('repoSearch').value.toLowerCase();
    const healthFilter = document.getElementById('healthFilter').value;

    let repos = state.repos.filter(repo => {
        const name = (repo.name || '').toLowerCase();
        const matchesSearch = name.includes(search);

        const health = repo.health_level || 'good';
        const matchesHealth = !healthFilter || health === healthFilter;

        return matchesSearch && matchesHealth;
    });

    if (repos.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">暂无仓库数据</div>
                <div class="empty-state-hint">先在配置文件中添加仓库，然后运行 gitmon scan</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = repos.map(repo => {
        const name = repo.name || 'unknown';
        const health = repo.health_level || 'good';
        const path = repo.path || '';
        const commits = repo.commit_count || 0;
        const contributors = repo.contributors || 0;
        const files = repo.files_count || 0;
        const lastCommit = repo.last_commit;
        const score = repo.health_score || 0;

        const healthText = { good: '健康', warning: '警告', critical: '严重' }[health] || health;

        return `
            <div class="repo-card ${health}" onclick="openRepoDetail('${name}')">
                <div class="repo-header">
                    <div class="repo-name">${escapeHtml(name)}</div>
                    <span class="health-badge ${health}">${healthText}</span>
                </div>
                <div class="repo-path">${escapeHtml(path)}</div>
                <div class="repo-stats">
                    <div class="repo-stat">
                        <div class="repo-stat-value">${formatNumber(commits)}</div>
                        <div class="repo-stat-label">提交</div>
                    </div>
                    <div class="repo-stat">
                        <div class="repo-stat-value">${contributors}</div>
                        <div class="repo-stat-label">贡献者</div>
                    </div>
                    <div class="repo-stat">
                        <div class="repo-stat-value">${formatNumber(files)}</div>
                        <div class="repo-stat-label">文件</div>
                    </div>
                </div>
                <div class="repo-meta">
                    <span>健康分: ${score}</span>
                    <span>${formatRelative(lastCommit)}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function openRepoDetail(repoName) {
    const [repo, stats, files, techdebt] = await Promise.all([
        fetchJSON(`${API_BASE}/repos/${repoName}`),
        fetchJSON(`${API_BASE}/repos/${repoName}/commits?limit=10`),
        fetchJSON(`${API_BASE}/repos/${repoName}/files?limit=10`),
        fetchJSON(`${API_BASE}/repos/${repoName}/techdebt`)
    ]);

    const modal = document.getElementById('repoModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    const repoData = repo?.repo || repo;
    const name = repoData?.name || repoName;
    const health = repoData?.health_level || 'good';
    const healthText = { good: '健康', warning: '警告', critical: '严重' }[health] || health;

    title.textContent = `${name} - 仓库详情`;

    const repoStats = repo?.stats || {};
    const totalCommits = repoStats?.total_commits || 0;
    const contributorCount = repoStats?.contributors || 0;
    const fileCount = repoStats?.total_files || 0;
    const healthScore = repoStats?.health_score || 0;
    const silentDays = repoStats?.silent_days || 0;
    const lastCommit = repoStats?.last_commit;

    body.innerHTML = `
        <div class="detail-section">
            <h3>基本信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">健康状态</div>
                    <div class="detail-value text-${health}">${healthText}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">健康分数</div>
                    <div class="detail-value">${healthScore}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">总提交</div>
                    <div class="detail-value">${formatNumber(totalCommits)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">贡献者</div>
                    <div class="detail-value">${contributorCount}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">文件数</div>
                    <div class="detail-value">${formatNumber(fileCount)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">静默天数</div>
                    <div class="detail-value">${silentDays} 天</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>路径</h3>
            <div style="font-family: monospace; padding: 0.75rem; background: var(--bg-secondary); border-radius: 0.5rem;">
                ${escapeHtml(repoData?.path || '')}
            </div>
        </div>

        <div class="detail-section">
            <h3>最近提交</h3>
            ${stats && stats.length > 0 ? `
                <table class="files-table">
                    <thead>
                        <tr>
                            <th>提交</th>
                            <th>作者</th>
                            <th>消息</th>
                            <th>时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map(commit => `
                            <tr>
                                <td style="font-family: monospace;">${(commit.Hash || commit.hash || '').substring(0, 7)}</td>
                                <td>${escapeHtml(commit.Author || commit.author || '')}</td>
                                <td>${escapeHtml(commit.Message || commit.message || '').substring(0, 50)}</td>
                                <td>${formatRelative(commit.Date || commit.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="empty-state"><div class="empty-state-text">暂无提交记录</div></div>'}
        </div>

        <div class="detail-section">
            <h3>高风险文件 (Top 10)</h3>
            ${files && files.length > 0 ? `
                <table class="files-table">
                    <thead>
                        <tr>
                            <th>文件</th>
                            <th>修改次数</th>
                            <th>复杂度</th>
                            <th>风险分</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${files.map(file => {
                            const risk = file.RiskScore || file.riskScore || 0;
                            const riskClass = risk >= 0.7 ? 'high' : risk >= 0.4 ? 'medium' : 'low';
                            return `
                                <tr>
                                    <td style="font-family: monospace; font-size: 0.8125rem;">${escapeHtml(file.Path || file.path || '')}</td>
                                    <td>${file.ChurnCount || file.churnCount || 0}</td>
                                    <td>${(file.Complexity || file.complexity || 0).toFixed(1)}</td>
                                    <td><span class="risk-score risk-${riskClass}">${(risk * 100).toFixed(0)}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            ` : '<div class="empty-state"><div class="empty-state-text">暂无文件数据</div></div>'}
        </div>

        <div class="detail-section">
            <h3>技术债</h3>
            ${techdebt && techdebt.length > 0 ? `
                <table class="files-table">
                    <thead>
                        <tr>
                            <th>类型</th>
                            <th>文件</th>
                            <th>内容</th>
                            <th>责任人</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${techdebt.map(item => `
                            <tr>
                                <td><span class="alert-level warning">${escapeHtml(item.Type || item.type || '')}</span></td>
                                <td style="font-family: monospace; font-size: 0.8125rem;">${escapeHtml(item.File || item.file || '')}</td>
                                <td>${escapeHtml(item.Message || item.message || '').substring(0, 60)}</td>
                                <td>${escapeHtml(item.Author || item.author || '')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<div class="empty-state"><div class="empty-state-text">暂无技术债</div></div>'}
        </div>

        <div class="detail-section">
            <h3>最后提交</h3>
            <div>${formatDate(lastCommit)} (${formatRelative(lastCommit)})</div>
        </div>
    `;

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('repoModal').classList.remove('active');
}

function renderContributors() {
    const container = document.getElementById('contributorsRanking');
    const search = document.getElementById('contributorSearch').value.toLowerCase();

    let contributors = state.contributors.filter(c => {
        const name = (c.Name || c.name || '').toLowerCase();
        const email = (c.Email || c.email || '').toLowerCase();
        return name.includes(search) || email.includes(search);
    });

    if (contributors.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <div class="empty-state-text">暂无贡献者数据</div>
                <div class="empty-state-hint">运行 gitmon scan 扫描仓库后查看</div>
            </div>
        `;
        return;
    }

    container.innerHTML = contributors.map((c, i) => {
        const name = c.Name || c.name || 'Unknown';
        const email = c.Email || c.email || '';
        const commits = c.TotalCommits || c.totalCommits || 0;
        const repos = c.Repos || c.repos || 0;
        const linesAdded = c.LinesAdded || c.linesAdded || 0;
        const linesDeleted = c.LinesDeleted || c.linesDeleted || 0;

        const initial = name.charAt(0).toUpperCase();
        const rankClass = i < 3 ? `top-${i + 1}` : '';

        return `
            <div class="ranking-item">
                <div class="rank-number ${rankClass}">${i + 1}</div>
                <div class="contributor-avatar">${initial}</div>
                <div class="contributor-info">
                    <div class="contributor-name">${escapeHtml(name)}</div>
                    <div class="contributor-email">${escapeHtml(email)}</div>
                </div>
                <div class="contributor-stats">
                    <div class="contributor-stat">
                        <div class="contributor-stat-value">${formatNumber(commits)}</div>
                        <div class="contributor-stat-label">提交</div>
                    </div>
                    <div class="contributor-stat">
                        <div class="contributor-stat-value">${repos}</div>
                        <div class="contributor-stat-label">仓库</div>
                    </div>
                    <div class="contributor-stat">
                        <div class="contributor-stat-value text-good">+${formatNumber(linesAdded)}</div>
                        <div class="contributor-stat-label">新增</div>
                    </div>
                    <div class="contributor-stat">
                        <div class="contributor-stat-value text-critical">-${formatNumber(linesDeleted)}</div>
                        <div class="contributor-stat-label">删除</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAlerts() {
    const container = document.getElementById('alertsList');
    const levelFilter = document.getElementById('alertLevelFilter').value;
    const typeFilter = document.getElementById('alertTypeFilter').value;

    let alerts = state.alerts.filter(a => {
        if (a.Resolved) return false;

        const level = a.Level || a.level || 'warning';
        const type = a.Type || a.type || '';

        const matchesLevel = !levelFilter || level === levelFilter;
        const matchesType = !typeFilter || type === typeFilter;

        return matchesLevel && matchesType;
    });

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div class="empty-state-text">暂无活跃告警</div>
                <div class="empty-state-hint">所有系统运行正常</div>
            </div>
        `;
        return;
    }

    const iconMap = {
        silent_repo: '🔇',
        high_complexity: '⚡',
        tech_debt: '💳',
        low_contributors: '👥'
    };

    const typeTextMap = {
        silent_repo: '静默仓库',
        high_complexity: '高复杂度',
        tech_debt: '技术债',
        low_contributors: '贡献者不足'
    };

    container.innerHTML = alerts.map(alert => {
        const id = alert.ID || alert.id || '';
        const level = alert.Level || alert.level || 'warning';
        const type = alert.Type || alert.type || 'unknown';
        const title = alert.Title || alert.title || '';
        const message = alert.Message || alert.message || '';
        const repoName = alert.RepoName || alert.repoName || '';
        const createdAt = alert.CreatedAt || alert.createdAt;

        const icon = iconMap[type] || '⚠️';
        const typeText = typeTextMap[type] || type;
        const levelText = { critical: '严重', warning: '警告', info: '信息' }[level] || level;

        return `
            <div class="alert-card ${level}">
                <div class="alert-icon">${icon}</div>
                <div class="alert-content">
                    <div class="alert-title">${escapeHtml(title)}</div>
                    <div class="alert-message">${escapeHtml(message)}</div>
                    <div class="alert-meta">
                        <span class="alert-level ${level}">${levelText}</span>
                        <span>${typeText}</span>
                        ${repoName ? `<span>仓库: ${escapeHtml(repoName)}</span>` : ''}
                        <span>${formatRelative(createdAt)}</span>
                    </div>
                </div>
                <div class="alert-actions">
                    <button class="btn-resolve" onclick="resolveAlert('${id}')">标记解决</button>
                </div>
            </div>
        `;
    }).join('');
}

async function resolveAlert(id) {
    try {
        const response = await fetch(`${API_BASE}/alerts/${id}/resolve`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            await loadAlerts();
            updateStatsOverview();
        }
    } catch (error) {
        console.error('Resolve alert error:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.openRepoDetail = openRepoDetail;
window.closeModal = closeModal;
window.resolveAlert = resolveAlert;

document.addEventListener('DOMContentLoaded', init);
