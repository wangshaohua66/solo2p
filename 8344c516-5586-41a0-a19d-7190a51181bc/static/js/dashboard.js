$(function() {
    if (!checkLogin()) return;
    renderNavbar('index');
    loadStatistics();
    initChart();
});

function loadStatistics() {
    showLoading();
    ajax({
        url: API_BASE + '/statistics/overview',
        type: 'GET',
        success: function(res) {
            if (res.code === 0) {
                const data = res.data;
                $('#todayExamCount').text(data.todayExamCount || 0);
                $('#monthCandidateCount').text(data.monthCandidateCount || 0);
                $('#pendingExamCount').text(data.pendingExamCount || 0);
                $('#warningCount').text(data.warnings ? data.warnings.length : 0);
                $('#todoPendingExams').text(data.pendingExamCount || 0);
                $('#badgePendingExams').text((data.pendingExamCount || 0) + '个待处理');

                if (data.warnings && data.warnings.length > 0) {
                    renderWarnings(data.warnings);
                }

                let expiringCount = 0;
                data.warnings.forEach(function(w) {
                    if (w.type === 'qualification') {
                        expiringCount++;
                    }
                });
                $('#todoExpiringExaminers').text(expiringCount);
            } else {
                showError(res.message || '加载统计数据失败');
            }
        },
        error: function() {
            showError('加载统计数据失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function renderWarnings(warnings) {
    if (!warnings || warnings.length === 0) return;

    const container = $('#warningList');
    container.empty();

    warnings.slice(0, 5).forEach(function(warning) {
        const levelClass = warning.level === 'danger' ? 'todo-icon-red' : 'todo-icon-orange';
        const iconClass = warning.type === 'qualification' ? 'bi-person-badge' : 'bi-exclamation-triangle';
        
        const html = `
            <div class="todo-item">
                <div class="todo-icon ${levelClass}">
                    <i class="bi ${iconClass}"></i>
                </div>
                <div class="todo-content">
                    <div class="todo-title">${escapeHtml(warning.message)}</div>
                    <p class="todo-desc">${formatDate(warning.date)}</p>
                </div>
            </div>
        `;
        container.append(html);
    });
}

function initChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;
    
    const chartCtx = ctx.getContext('2d');
    
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(22, 93, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(22, 93, 255, 0.05)');

    new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
            datasets: [{
                label: '考试场次',
                data: [12, 19, 15, 25, 22, 30],
                borderColor: '#165DFF',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#165DFF',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }, {
                label: '参考人数',
                data: [150, 230, 180, 320, 280, 380],
                borderColor: '#10B981',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                pointBackgroundColor: '#10B981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}
