let trendChart = null;
let tradeChart = null;
let orgChart = null;
let roomChart = null;
let currentStats = [];
let currentPage = 1;
let pageSize = 10;
let roomChartType = 'bar';

$(function() {
    if (!checkLogin()) return;
    renderNavbar('statistics');
    loadFilters();
    loadStatistics();
    bindEvents();
});

function loadFilters() {
    showLoading();
    $.when(
        ajax({ url: API_BASE + '/trades', type: 'GET', async: false }),
        ajax({ url: API_BASE + '/organizations', type: 'GET', async: false })
    ).done(function(tradesRes, orgsRes) {
        if (tradesRes[0] && tradesRes[0].code === 0) {
            const trades = tradesRes[0].data || [];
            const options = trades.map(function(t) {
                return `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
            }).join('');
            $('#tradeFilter').append(options);
        }
        if (orgsRes[0] && orgsRes[0].code === 0) {
            const orgs = orgsRes[0].data || [];
            const options = orgs.map(function(o) {
                return `<option value="${o.id}">${escapeHtml(o.name)}</option>`;
            }).join('');
            $('#orgFilter').append(options);
        }
    }).always(function() {
        hideLoading();
    });
}

function loadStatistics() {
    showLoading();
    
    const params = {
        time_range: $('input[name="timeRange"]:checked').val(),
        trade_ids: $('#tradeFilter').val() || [],
        org_ids: $('#orgFilter').val() || []
    };

    ajax({
        url: API_BASE + '/statistics',
        type: 'GET',
        data: params,
        traditional: true,
        success: function(res) {
            if (res.code === 0) {
                const data = res.data;
                renderKpiCards(data.kpi);
                renderCharts(data.charts);
                currentStats = data.details || [];
                renderStatsTable(currentStats);
                renderPagination(currentStats.length);
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

function renderKpiCards(kpi) {
    if (!kpi) return;

    $('#attendanceRate').text((kpi.attendance_rate || 0).toFixed(1) + '%');
    updateTrend($('#attendanceTrend'), kpi.attendance_rate_trend);

    $('#passRate').text((kpi.pass_rate || 0).toFixed(1) + '%');
    updateTrend($('#passTrend'), kpi.pass_rate_trend);

    $('#roomUtilRate').text((kpi.room_util_rate || 0).toFixed(1) + '%');
    updateTrend($('#roomUtilTrend'), kpi.room_util_rate_trend);

    $('#examinerWorkload').text(kpi.examiner_workload || 0);
    updateTrend($('#workloadTrend'), kpi.examiner_workload_trend);
}

function updateTrend($element, value) {
    value = value || 0;
    const isUp = value >= 0;
    const iconClass = isUp ? 'bi-arrow-up' : 'bi-arrow-down';
    const textClass = isUp ? 'text-success' : 'text-danger';
    
    $element.html(`
        <i class="bi ${iconClass} ${textClass}"></i>
        <span class="${textClass}">${isUp ? '+' : ''}${value.toFixed(1)}%</span>
    `);
}

function renderCharts(charts) {
    if (!charts) return;

    renderTrendChart(charts.monthly_trend);
    renderTradeChart(charts.trade_distribution);
    renderOrgChart(charts.org_comparison);
    renderRoomChart(charts.room_utilization);
}

function renderTrendChart(data) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (trendChart) {
        trendChart.destroy();
    }

    const chartCtx = ctx.getContext('2d');
    
    const gradient1 = chartCtx.createLinearGradient(0, 0, 0, 350);
    gradient1.addColorStop(0, 'rgba(22, 93, 255, 0.4)');
    gradient1.addColorStop(1, 'rgba(22, 93, 255, 0.05)');

    const gradient2 = chartCtx.createLinearGradient(0, 0, 0, 350);
    gradient2.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    gradient2.addColorStop(1, 'rgba(16, 185, 129, 0.05)');

    trendChart = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: '参考人数',
                data: data.reference_counts || [],
                borderColor: '#165DFF',
                backgroundColor: gradient1,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#165DFF',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }, {
                label: '通过人数',
                data: data.pass_counts || [],
                borderColor: '#10B981',
                backgroundColor: gradient2,
                fill: true,
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

function renderTradeChart(data) {
    const ctx = document.getElementById('tradeChart');
    if (!ctx) return;

    if (tradeChart) {
        tradeChart.destroy();
    }

    const colors = [
        '#165DFF',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899',
        '#06B6D4',
        '#84CC16'
    ];

    tradeChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: colors.slice(0, data.labels ? data.labels.length : 0),
                borderColor: '#fff',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce(function(a, b) {
                                return a + b;
                            }, 0);
                            const percentage = ((context.raw / total) * 100).toFixed(1);
                            return context.label + ': ' + context.raw + '人 (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

function renderOrgChart(data) {
    const ctx = document.getElementById('orgChart');
    if (!ctx) return;

    if (orgChart) {
        orgChart.destroy();
    }

    const chartCtx = ctx.getContext('2d');
    
    const gradient = chartCtx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, 'rgba(22, 93, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(22, 93, 255, 0.3)');

    orgChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: '通过率',
                data: data.pass_rates || [],
                backgroundColor: gradient,
                borderColor: '#165DFF',
                borderWidth: 1,
                borderRadius: 4,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '通过率: ' + context.raw.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function renderRoomChart(data) {
    const ctx = document.getElementById('roomChart');
    if (!ctx) return;

    if (roomChart) {
        roomChart.destroy();
    }

    const chartCtx = ctx.getContext('2d');
    
    if (roomChartType === 'bar') {
        const gradient = chartCtx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.3)');

        roomChart = new Chart(chartCtx, {
            type: 'bar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: '考场利用率',
                    data: data.util_rates || [],
                    backgroundColor: gradient,
                    borderColor: '#F59E0B',
                    borderWidth: 1,
                    borderRadius: 4,
                    barThickness: 30
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '利用率: ' + context.raw.toFixed(1) + '%';
                            }
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
                        max: 100,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    } else {
        renderHeatmap(ctx, data);
    }
}

function renderHeatmap(ctx, data) {
    const chartCtx = ctx.getContext('2d');
    
    const labels = data.labels || [];
    const values = data.util_rates || [];
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    const heatmapData = [];
    for (let i = 0; i < days.length; i++) {
        for (let j = 0; j < Math.ceil(labels.length / 7); j++) {
            const idx = i * Math.ceil(labels.length / 7) + j;
            heatmapData.push({
                x: j,
                y: i,
                v: idx < values.length ? values[idx] : 0
            });
        }
    }

    roomChart = new Chart(chartCtx, {
        type: 'matrix',
        data: {
            datasets: [{
                label: '考场利用率',
                data: heatmapData,
                backgroundColor: function(ctx) {
                    const value = ctx.raw.v;
                    const alpha = value / 100;
                    return `rgba(22, 93, 255, ${alpha})`;
                },
                borderColor: '#fff',
                borderWidth: 1,
                width: function(ctx) {
                    return ctx.chart.width / (Math.ceil(labels.length / 7) + 1);
                },
                height: function(ctx) {
                    return ctx.chart.height / 8;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function() {
                            return '';
                        },
                        label: function(context) {
                            const idx = context.raw.y * Math.ceil(labels.length / 7) + context.raw.x;
                            const label = idx < labels.length ? labels[idx] : '';
                            return label + ': ' + context.raw.v.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    grid: {
                        display: false
                    },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return Math.ceil(labels.length / 7) > 1 ? '第' + (value + 1) + '周' : '';
                        }
                    }
                },
                y: {
                    type: 'linear',
                    position: 'left',
                    grid: {
                        display: false
                    },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return days[value] || '';
                        }
                    }
                }
            }
        }
    });
}

function renderStatsTable(stats) {
    const container = $('#statsTable tbody');
    if (!container.length) return;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = stats.slice(start, end);

    if (pageData.length === 0) {
        container.html('<tr><td colspan="9" class="text-center text-muted py-4">暂无数据</td></tr>');
        return;
    }

    const html = pageData.map(function(s) {
        const attendanceRate = s.plan_count > 0 ? (s.reference_count / s.plan_count * 100) : 0;
        const passRate = s.reference_count > 0 ? (s.pass_count / s.reference_count * 100) : 0;

        return `
            <tr>
                <td>${escapeHtml(s.time_period || '-')}</td>
                <td>${escapeHtml(s.trade_name || '-')}</td>
                <td>${escapeHtml(s.org_name || '-')}</td>
                <td>${s.plan_count || 0}</td>
                <td>${s.reference_count || 0}</td>
                <td>${s.pass_count || 0}</td>
                <td>${attendanceRate.toFixed(1)}%</td>
                <td>${passRate.toFixed(1)}%</td>
                <td>${(s.room_util_rate || 0).toFixed(1)}%</td>
            </tr>
        `;
    }).join('');

    container.html(html);
}

function renderPagination(total) {
    const container = $('#pagination');
    if (!container.length) return;

    const totalPages = Math.ceil(total / pageSize);
    
    if (totalPages <= 1) {
        container.html('');
        return;
    }

    let html = '';
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)" onclick="goToPage(${currentPage - 1})">上一页</a></li>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="javascript:void(0)" onclick="goToPage(${i})">${i}</a></li>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="javascript:void(0)" onclick="goToPage(${currentPage + 1})">下一页</a></li>`;
    
    container.html(html);
}

function goToPage(page) {
    currentPage = page;
    renderStatsTable(currentStats);
    renderPagination(currentStats.length);
}

function bindEvents() {
    $('#searchBtn').on('click', function() {
        currentPage = 1;
        loadStatistics();
    });

    $('#refreshTrendBtn').on('click', function() {
        loadStatistics();
    });

    $('input[name="timeRange"]').on('change', function() {
        currentPage = 1;
        loadStatistics();
    });

    $('#exportBtn').on('click', function() {
        const params = {
            time_range: $('input[name="timeRange"]:checked').val(),
            trade_ids: $('#tradeFilter').val() || [],
            org_ids: $('#orgFilter').val() || []
        };

        showLoading();
        ajax({
            url: API_BASE + '/statistics/export',
            type: 'GET',
            data: params,
            traditional: true,
            xhrFields: {
                responseType: 'blob'
            },
            success: function(blob, status, xhr) {
                const filename = xhr.getResponseHeader('Content-Disposition') || 'statistics.xlsx';
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename.replace(/attachment; filename=/, '');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showSuccess('报表导出成功');
            },
            error: function() {
                showError('导出失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });

    $('[data-view]').on('click', function() {
        $('[data-view]').removeClass('active');
        $(this).addClass('active');
        roomChartType = $(this).data('view');
        
        ajax({
            url: API_BASE + '/statistics',
            type: 'GET',
            data: {
                time_range: $('input[name="timeRange"]:checked').val(),
                trade_ids: $('#tradeFilter').val() || [],
                org_ids: $('#orgFilter').val() || []
            },
            traditional: true,
            success: function(res) {
                if (res.code === 0 && res.data && res.data.charts) {
                    renderRoomChart(res.data.charts.room_utilization);
                }
            }
        });
    });
}
