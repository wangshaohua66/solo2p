(function (global) {
    'use strict';

    const Reports = {
        charts: {},
        mode: 'week',

        init: function () {
            this.bindEvents();
            this.subscribeEvents();
        },

        subscribeEvents: function () {
            const self = this;
            App.bus.subscribe('state:changed', function () {
                if ($('#reportsPane').hasClass('show')) {
                    self.generateReport();
                }
            });
        },

        bindEvents: function () {
            const self = this;
            $('#reportWeekBtn').on('click', function () {
                self.mode = 'week';
                $(this).addClass('active');
                $('#reportMonthBtn').removeClass('active');
            });
            $('#reportMonthBtn').on('click', function () {
                self.mode = 'month';
                $(this).addClass('active');
                $('#reportWeekBtn').removeClass('active');
            });
            $('#generateReportBtn').on('click', function () {
                self.generateReport();
            });

            $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
                if (e.target.id === 'reportsTab') {
                    self.generateReport();
                }
            });
        },

        getDateRange: function () {
            const now = new Date();
            if (this.mode === 'week') {
                return {
                    start: Utils.getStartOfWeek(now),
                    end: Utils.getEndOfWeek(now),
                    label: Utils.formatDate(Utils.getStartOfWeek(now)) + ' ~ ' + Utils.formatDate(Utils.getEndOfWeek(now))
                };
            } else {
                return {
                    start: Utils.getStartOfMonth(now),
                    end: Utils.getEndOfMonth(now),
                    label: Utils.formatDate(Utils.getStartOfMonth(now), 'YYYY年MM月')
                };
            }
        },

        generateReport: function () {
            const range = this.getDateRange();
            const branchFilter = $('#reportBranch').val();

            let shifts = App.state.shifts;
            let appointments = App.state.appointments.filter(function (a) {
                return a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
            });
            let waitlist = App.state.waitlist;

            if (branchFilter) {
                shifts = shifts.filter(function (s) { return s.branchId === branchFilter; });
                appointments = appointments.filter(function (a) { return a.branchId === branchFilter; });
                waitlist = waitlist.filter(function (w) { return w.branchId === branchFilter; });
            }

            const inRange = function (dateStr) {
                const d = Utils.parseDate(dateStr);
                return d >= range.start && d <= range.end;
            };

            shifts = shifts.filter(function (s) { return inRange(s.date); });
            appointments = appointments.filter(function (a) { return inRange(a.date); });
            waitlist = waitlist.filter(function (w) { return inRange(w.date); });

            this.renderUtilizationChart(shifts, appointments);
            this.renderSaturationChart(appointments);
            this.renderHeatmap(appointments);
            this.renderConversionChart(appointments, waitlist);
            this.renderShiftChangeChart(range);
        },

        renderUtilizationChart: function (shifts, appointments) {
            const self = this;
            const ctx = document.getElementById('utilizationChart');
            if (!ctx) return;

            const vets = Utils.unique(shifts.map(function (s) { return s.userId; }));
            const labels = vets.map(function (uid) {
                const u = App.getUserById(uid);
                return u ? u.name : uid;
            });

            const utilization = vets.map(function (uid) {
                const vetShifts = shifts.filter(function (s) { return s.userId === uid; });
                const totalSlots = vetShifts.length;
                if (totalSlots === 0) return 0;
                const vetApts = appointments.filter(function (a) { return a.vetId === uid; });
                const workingSlots = Utils.unique(vetShifts.map(function (s) { return s.date + '_' + s.slotId; })).length;
                const aptCount = vetApts.length;
                const capacity = workingSlots * 8;
                return capacity > 0 ? Math.round(aptCount / capacity * 100) : 0;
            });

            this.destroyChart('utilization');
            this.charts.utilization = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '利用率 (%)',
                        data: utilization,
                        backgroundColor: 'rgba(13, 110, 253, 0.7)',
                        borderColor: 'rgb(13, 110, 253)',
                        borderWidth: 1
                    }]
                },
                options: self._getChartOptions('兽医利用率')
            });
        },

        renderSaturationChart: function (appointments) {
            const self = this;
            const ctx = document.getElementById('saturationChart');
            if (!ctx) return;

            const byDate = Utils.groupBy(appointments, 'date');
            const sortedDates = Object.keys(byDate).sort();
            const labels = sortedDates.map(function (d) { return Utils.formatDate(Utils.parseDate(d), 'MM/DD'); });
            const counts = sortedDates.map(function (d) { return byDate[d].length; });

            this.destroyChart('saturation');
            this.charts.saturation = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '预约数量',
                        data: counts,
                        fill: true,
                        backgroundColor: 'rgba(25, 135, 84, 0.2)',
                        borderColor: 'rgb(25, 135, 84)',
                        tension: 0.3
                    }]
                },
                options: self._getChartOptions('预约饱和度趋势')
            });
        },

        renderHeatmap: function (appointments) {
            const $container = $('#heatmapContainer');
            const days = Utils.CONSTANTS.DAYS_OF_WEEK;
            const timeSlots = Utils.CONSTANTS.TIME_SLOTS;

            const heatData = {};
            appointments.forEach(function (a) {
                const dayIdx = Utils.getDayOfWeek(Utils.parseDate(a.date));
                const slot = Utils.getTimeSlotByTime(a.time);
                if (!slot) return;
                const key = dayIdx + '_' + slot.id;
                heatData[key] = (heatData[key] || 0) + 1;
            });

            const maxVal = Math.max(1, ...Object.values(heatData));

            let html = '<div class="table-responsive"><table class="table table-sm table-bordered text-center heatmap-table">';
            html += '<thead><tr><th>时段</th>';
            days.forEach(function (d) { html += '<th>' + d + '</th>'; });
            html += '</tr></thead><tbody>';

            timeSlots.forEach(function (slot) {
                html += '<tr>';
                html += '<td class="fw-bold">' + slot.label + '<br><span class="text-muted small">' + slot.start + '-' + slot.end + '</span></td>';
                for (let d = 0; d < 7; d++) {
                    const key = d + '_' + slot.id;
                    const val = heatData[key] || 0;
                    const intensity = val / maxVal;
                    let bgColor = 'rgba(13, 110, 253, 0.05)';
                    if (intensity > 0.8) bgColor = 'rgba(220, 53, 69, 0.85)';
                    else if (intensity > 0.6) bgColor = 'rgba(253, 126, 20, 0.75)';
                    else if (intensity > 0.4) bgColor = 'rgba(255, 193, 7, 0.65)';
                    else if (intensity > 0.2) bgColor = 'rgba(25, 135, 84, 0.5)';
                    else if (intensity > 0) bgColor = 'rgba(13, 110, 253, 0.3)';
                    html += '<td style="background-color:' + bgColor + '; color: ' + (intensity > 0.4 ? '#fff' : 'inherit') + ';" title="预约数: ' + val + '">';
                    html += val > 0 ? val : '-';
                    html += '</td>';
                }
                html += '</tr>';
            });
            html += '</tbody></table></div>';

            html += '<div class="d-flex gap-3 mt-3 small text-muted justify-content-center">';
            html += '<span><span style="display:inline-block;width:16px;height:16px;background:rgba(13, 110, 253, 0.05);border:1px solid #495057;"></span> 空闲</span>';
            html += '<span><span style="display:inline-block;width:16px;height:16px;background:rgba(13, 110, 253, 0.3);"></span> 较少</span>';
            html += '<span><span style="display:inline-block;width:16px;height:16px;background:rgba(25, 135, 84, 0.5);"></span> 一般</span>';
            html += '<span><span style="display:inline-block;width:16px;height:16px;background:rgba(255, 193, 7, 0.65);"></span> 较多</span>';
            html += '<span><span style="display:inline-block;width:16px;height:16px;background:rgba(253, 126, 20, 0.75);"></span> 繁忙</span>';
            html += '<span><span style="display:inline-block;width:16px;height:16px;background:rgba(220, 53, 69, 0.85);"></span> 极忙</span>';
            html += '</div>';

            $container.html(html);
        },

        renderConversionChart: function (appointments, waitlist) {
            const self = this;
            const ctx = document.getElementById('conversionChart');
            if (!ctx) return;

            const totalWaitlist = waitlist.length;
            const promoted = appointments.filter(function (a) { return a.promotedFromWaitlist; }).length;
            const lost = Math.max(0, totalWaitlist - promoted);

            this.destroyChart('conversion');
            this.charts.conversion = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['候补成功转化', '候补流失'],
                    datasets: [{
                        data: [promoted, lost],
                        backgroundColor: ['rgba(25, 135, 84, 0.8)', 'rgba(220, 53, 69, 0.8)'],
                        borderColor: ['rgb(25, 135, 84)', 'rgb(220, 53, 69)'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#dee2e6' }, position: 'bottom' },
                        title: { display: true, text: '候补转化率', color: '#fff' }
                    }
                }
            });
        },

        renderShiftChangeChart: function (range) {
            const self = this;
            const ctx = document.getElementById('shiftChangeChart');
            if (!ctx) return;

            const inRange = function (dateStr) {
                const d = Utils.parseDate(dateStr);
                return d >= range.start && d <= range.end;
            };

            const allReqs = App.state.swapRequests.filter(function (r) {
                return inRange(r.originalDate) || inRange(r.targetDate);
            });

            const approved = allReqs.filter(function (r) { return r.status === 'approved'; }).length;
            const rejected = allReqs.filter(function (r) { return r.status === 'rejected'; }).length;
            const pending = allReqs.filter(function (r) { return r.status === 'pending'; }).length;

            this.destroyChart('shiftChange');
            this.charts.shiftChange = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['已通过', '已驳回', '待审批'],
                    datasets: [{
                        label: '换班次数',
                        data: [approved, rejected, pending],
                        backgroundColor: [
                            'rgba(25, 135, 84, 0.8)',
                            'rgba(220, 53, 69, 0.8)',
                            'rgba(255, 193, 7, 0.8)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: self._getChartOptions('换班频率分析')
            });
        },

        _getChartOptions: function (title) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#dee2e6' }, position: 'top' },
                    title: { display: true, text: title, color: '#fff', font: { size: 14 } }
                },
                scales: {
                    x: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(73, 80, 87, 0.3)' } },
                    y: { ticks: { color: '#adb5bd' }, grid: { color: 'rgba(73, 80, 87, 0.3)' } }
                }
            };
        },

        destroyChart: function (name) {
            if (this.charts[name]) {
                this.charts[name].destroy();
                delete this.charts[name];
            }
        }
    };

    global.Reports = Reports;

    $(function () {
        Reports.init();
    });

})(window);
