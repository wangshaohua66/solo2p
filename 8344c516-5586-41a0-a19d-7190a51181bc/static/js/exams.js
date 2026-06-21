let calendar = null;
let currentExams = [];
let draggedEvent = null;

$(function() {
    if (!checkLogin()) return;
    renderNavbar('exam');
    initCalendar();
    loadExams();
    bindEvents();
});

function initCalendar() {
    const calendarEl = document.getElementById('examCalendar');
    if (!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-cn',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: '今天',
            month: '月视图',
            week: '周视图',
            day: '日视图'
        },
        editable: true,
        droppable: true,
        eventResizableFromStart: true,
        dayMaxEvents: 3,
        events: [],
        eventDrop: function(info) {
            handleEventDrop(info);
        },
        eventResize: function(info) {
            handleEventResize(info);
        },
        eventClick: function(info) {
            showExamDetail(info.event);
        },
        dateClick: function(info) {
            showCreateExamModal(info.date);
        },
        eventDidMount: function(info) {
            if (checkConflict(info.event)) {
                info.el.style.backgroundColor = '#EF4444';
                info.el.style.borderColor = '#EF4444';
            }
        }
    });

    calendar.render();
}

function loadExams() {
    showLoading();
    ajax({
        url: API_BASE + '/exams',
        type: 'GET',
        success: function(res) {
            if (res.code === 0) {
                currentExams = res.data || [];
                renderExams(currentExams);
                renderExamList(currentExams);
            } else {
                showError(res.message || '加载考期数据失败');
            }
        },
        error: function() {
            showError('加载考期数据失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function renderExams(exams) {
    if (!calendar) return;
    
    const events = exams.map(function(exam) {
        return {
            id: exam.id,
            title: exam.trade_name + ' - ' + exam.exam_type,
            start: exam.start_time,
            end: exam.end_time,
            backgroundColor: checkConflict(exam) ? '#EF4444' : '#165DFF',
            borderColor: checkConflict(exam) ? '#EF4444' : '#165DFF',
            extendedProps: exam
        };
    });

    calendar.removeAllEvents();
    calendar.addEventSource(events);
}

function renderExamList(exams) {
    const container = $('#examList');
    if (!container.length) return;

    if (exams.length === 0) {
        container.html('<tr><td colspan="8" class="text-center text-muted py-4">暂无考期数据</td></tr>');
        return;
    }

    const html = exams.map(function(exam) {
        const conflict = checkConflict(exam);
        const statusClass = conflict ? 'badge-danger' : getStatusBadgeClass(exam.status);
        const statusText = conflict ? '时间冲突' : getStatusText(exam.status);

        return `
            <tr class="${conflict ? 'error-row' : ''}">
                <td>${escapeHtml(exam.exam_code || '-')}</td>
                <td>${escapeHtml(exam.trade_name || '-')}</td>
                <td>${escapeHtml(exam.exam_type || '-')}</td>
                <td>${formatDateTime(exam.start_time)}</td>
                <td>${formatDateTime(exam.end_time)}</td>
                <td>${escapeHtml(exam.room_name || '-')}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editExam(${exam.id})">
                            <i class="bi bi-pencil"></i> 编辑
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteExam(${exam.id})">
                            <i class="bi bi-trash"></i> 删除
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    container.html(html);
}

function handleEventDrop(info) {
    const examId = info.event.id;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    const exam = currentExams.find(function(e) {
        return e.id == examId;
    });

    if (exam) {
        const tempExam = {
            ...exam,
            start_time: newStart.toISOString(),
            end_time: newEnd ? newEnd.toISOString() : exam.end_time
        };

        if (checkConflict(tempExam, examId)) {
            info.revert();
            showWarning('该时间段存在时间冲突，请调整时间');
            return;
        }

        updateExamTime(examId, newStart, newEnd, info);
    }
}

function handleEventResize(info) {
    const examId = info.event.id;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    const tempExam = {
        start_time: newStart.toISOString(),
        end_time: newEnd ? newEnd.toISOString() : null
    };

    if (checkConflict(tempExam, examId)) {
        info.revert();
        showWarning('该时间段存在时间冲突，请调整时间');
        return;
    }

    updateExamTime(examId, newStart, newEnd, info);
}

function updateExamTime(examId, start, end, info) {
    showLoading();
    ajax({
        url: API_BASE + '/exams/' + examId + '/time',
        type: 'PUT',
        data: {
            start_time: start.toISOString(),
            end_time: end ? end.toISOString() : null
        },
        success: function(res) {
            if (res.code === 0) {
                showSuccess('考期时间已更新');
                loadExams();
            } else {
                info.revert();
                showError(res.message || '更新失败');
            }
        },
        error: function() {
            info.revert();
            showError('更新失败，请稍后重试');
        },
        complete: function() {
            hideLoading();
        }
    });
}

function checkConflict(exam, excludeId) {
    const examStart = new Date(exam.start_time).getTime();
    const examEnd = exam.end_time ? new Date(exam.end_time).getTime() : examStart + 3600000;

    return currentExams.some(function(e) {
        if (excludeId && e.id == excludeId) return false;
        if (e.room_id !== exam.room_id) return false;

        const eStart = new Date(e.start_time).getTime();
        const eEnd = e.end_time ? new Date(e.end_time).getTime() : eStart + 3600000;

        return (examStart < eEnd && examEnd > eStart);
    });
}

function showCreateExamModal(date) {
    const modal = new bootstrap.Modal($('#examModal')[0]);
    $('#examForm')[0].reset();
    $('#examId').val('');
    $('#examStartTime').val(formatDateTime(date).slice(0, 16));
    modal.show();
}

function editExam(id) {
    const exam = currentExams.find(function(e) {
        return e.id == id;
    });

    if (!exam) return;

    const modal = new bootstrap.Modal($('#examModal')[0]);
    $('#examId').val(exam.id);
    $('#examCode').val(exam.exam_code || '');
    $('#examTrade').val(exam.trade_id || '');
    $('#examType').val(exam.exam_type || '');
    $('#examRoom').val(exam.room_id || '');
    $('#examStartTime').val(formatDateTime(exam.start_time).slice(0, 16));
    $('#examEndTime').val(formatDateTime(exam.end_time).slice(0, 16));
    $('#examCapacity').val(exam.capacity || '');
    modal.show();
}

function deleteExam(id) {
    confirmDialog('确定要删除该考期吗？此操作不可撤销。', function() {
        showLoading();
        ajax({
            url: API_BASE + '/exams/' + id,
            type: 'DELETE',
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('考期已删除');
                    loadExams();
                } else {
                    showError(res.message || '删除失败');
                }
            },
            error: function() {
                showError('删除失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });
}

function showExamDetail(event) {
    const exam = event.extendedProps;
    const modal = new bootstrap.Modal($('#examDetailModal')[0]);
    $('#detailExamCode').text(exam.exam_code || '-');
    $('#detailExamTrade').text(exam.trade_name || '-');
    $('#detailExamType').text(exam.exam_type || '-');
    $('#detailExamTime').text(formatDateTime(exam.start_time) + ' - ' + formatDateTime(exam.end_time));
    $('#detailExamRoom').text(exam.room_name || '-');
    $('#detailExamCapacity').text(exam.capacity || '-');
    modal.show();
}

function bindEvents() {
    $('#examForm').submit(function(e) {
        e.preventDefault();
        
        const examId = $('#examId').val();
        const data = {
            exam_code: $('#examCode').val().trim(),
            trade_id: $('#examTrade').val(),
            exam_type: $('#examType').val(),
            room_id: $('#examRoom').val(),
            start_time: $('#examStartTime').val(),
            end_time: $('#examEndTime').val(),
            capacity: $('#examCapacity').val()
        };

        const tempExam = {
            room_id: data.room_id,
            start_time: data.start_time,
            end_time: data.end_time
        };

        if (checkConflict(tempExam, examId)) {
            showWarning('该时间段存在时间冲突，请调整时间');
            return;
        }

        showLoading();
        const url = examId ? API_BASE + '/exams/' + examId : API_BASE + '/exams';
        const method = examId ? 'PUT' : 'POST';

        ajax({
            url: url,
            type: method,
            data: data,
            success: function(res) {
                if (res.code === 0) {
                    showSuccess(examId ? '考期已更新' : '考期已创建');
                    bootstrap.Modal.getInstance($('#examModal')[0]).hide();
                    loadExams();
                } else {
                    showError(res.message || '操作失败');
                }
            },
            error: function() {
                showError('操作失败，请稍后重试');
            },
            complete: function() {
                hideLoading();
            }
        });
    });

    $('#searchBtn').on('click', function() {
        const keyword = $('#searchKeyword').val().trim();
        const status = $('#statusFilter').val();
        
        const filtered = currentExams.filter(function(exam) {
            let match = true;
            if (keyword) {
                const searchText = (exam.exam_code + exam.trade_name + exam.exam_type).toLowerCase();
                match = searchText.includes(keyword.toLowerCase());
            }
            if (status && exam.status != status) {
                match = false;
            }
            return match;
        });

        renderExamList(filtered);
        renderExams(filtered);
    });
}

function getStatusBadgeClass(status) {
    const map = {
        0: 'badge-secondary',
        1: 'badge-primary',
        2: 'badge-success',
        3: 'badge-warning',
        4: 'badge-danger'
    };
    return map[status] || 'badge-secondary';
}

function getStatusText(status) {
    const map = {
        0: '草稿',
        1: '待审批',
        2: '已通过',
        3: '已完成',
        4: '已取消'
    };
    return map[status] || '未知';
}
