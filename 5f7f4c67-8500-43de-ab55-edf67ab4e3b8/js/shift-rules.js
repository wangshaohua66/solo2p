(function (global) {
    'use strict';

    const ShiftRules = {};
    const RULES = Utils.CONSTANTS.SHIFT_RULES;

    ShiftRules.validateShift = function (shift, allShifts, allUnavailable) {
        const errors = [];
        allShifts = allShifts || [];
        allUnavailable = allUnavailable || [];

        const sameTimeSameVet = allShifts.find(function (s) {
            return s.id !== shift.id &&
                s.userId === shift.userId &&
                s.date === shift.date &&
                s.slotId === shift.slotId;
        });
        if (sameTimeSameVet) {
            errors.push({
                code: 'DUPLICATE_SHIFT',
                message: '该兽医同一时段已有排班安排'
            });
        }

        const consecutiveResult = ShiftRules.checkConsecutiveDays(shift.userId, shift.date, allShifts);
        if (!consecutiveResult.valid) {
            errors.push({
                code: 'MAX_CONSECUTIVE_DAYS',
                message: '连续工作天数超过上限（' + RULES.MAX_CONSECUTIVE_DAYS + '天）',
                detail: consecutiveResult.detail
            });
        }

        const restResult = ShiftRules.checkMinRestInterval(shift.userId, shift.date, shift.slotId, allShifts);
        if (!restResult.valid) {
            errors.push({
                code: 'MIN_REST_INTERVAL',
                message: '休息时间不足（需间隔' + RULES.MIN_REST_HOURS + '小时）',
                detail: restResult.detail
            });
        }

        const crossBranchResult = ShiftRules.checkCrossBranchInterval(shift, allShifts);
        if (!crossBranchResult.valid) {
            errors.push({
                code: 'CROSS_BRANCH_INTERVAL',
                message: '跨分院排班间隔不足（需间隔' + RULES.CROSS_BRANCH_MIN_INTERVAL_HOURS + '小时）',
                detail: crossBranchResult.detail
            });
        }

        const unavailableResult = ShiftRules.checkUnavailablePeriod(shift, allUnavailable);
        if (!unavailableResult.valid) {
            errors.push({
                code: 'UNAVAILABLE_PERIOD',
                message: '该时段兽医标记为不可用：' + unavailableResult.reason
            });
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    };

    ShiftRules.validateSwap = function (requesterShift, targetShift, requesterId, targetId, allShifts, allUnavailable) {
        const errors = [];

        const requesterTempShifts = allShifts.filter(function (s) {
            return s.id !== requesterShift.id;
        }).concat([{
            id: requesterShift.id + '_tmp',
            userId: requesterId,
            branchId: targetShift.branchId,
            date: targetShift.date,
            slotId: targetShift.slotId
        }]);
        const requesterValidation = ShiftRules.validateShift(
            { id: requesterShift.id + '_tmp', userId: requesterId, branchId: targetShift.branchId, date: targetShift.date, slotId: targetShift.slotId },
            requesterTempShifts,
            allUnavailable
        );
        if (!requesterValidation.valid) {
            requesterValidation.errors.forEach(function (e) {
                errors.push({ side: 'requester', ...e });
            });
        }

        const targetTempShifts = allShifts.filter(function (s) {
            return s.id !== targetShift.id;
        }).concat([{
            id: targetShift.id + '_tmp',
            userId: targetId,
            branchId: requesterShift.branchId,
            date: requesterShift.date,
            slotId: requesterShift.slotId
        }]);
        const targetValidation = ShiftRules.validateShift(
            { id: targetShift.id + '_tmp', userId: targetId, branchId: requesterShift.branchId, date: requesterShift.date, slotId: requesterShift.slotId },
            targetTempShifts,
            allUnavailable
        );
        if (!targetValidation.valid) {
            targetValidation.errors.forEach(function (e) {
                errors.push({ side: 'target', ...e });
            });
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    };

    ShiftRules.checkConsecutiveDays = function (userId, dateStr, allShifts) {
        const userShifts = allShifts.filter(function (s) { return s.userId === userId; });
        const shiftDates = {};
        userShifts.forEach(function (s) {
            shiftDates[s.date] = true;
        });
        shiftDates[dateStr] = true;

        const sortedDates = Object.keys(shiftDates).sort();
        let maxStreak = 0;
        let currentStreak = 0;
        let prevDate = null;
        let streakStart = null;

        for (let i = 0; i < sortedDates.length; i++) {
            const d = sortedDates[i];
            if (prevDate === null) {
                currentStreak = 1;
                streakStart = d;
            } else {
                const diff = Utils.diffDays(Utils.parseDate(d), Utils.parseDate(prevDate));
                if (diff === 1) {
                    currentStreak++;
                } else {
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                    currentStreak = 1;
                    streakStart = d;
                }
            }
            prevDate = d;
        }
        if (currentStreak > maxStreak) maxStreak = currentStreak;

        if (maxStreak > RULES.MAX_CONSECUTIVE_DAYS) {
            return {
                valid: false,
                detail: '当前连续工作' + maxStreak + '天，从 ' + streakStart + ' 开始'
            };
        }
        return { valid: true };
    };

    ShiftRules.checkMinRestInterval = function (userId, dateStr, slotId, allShifts) {
        const slot = Utils.getTimeSlotById(slotId);
        if (!slot) return { valid: true };
        const shiftStart = moment(dateStr + ' ' + slot.start, 'YYYY-MM-DD HH:mm');

        const userShifts = allShifts.filter(function (s) { return s.userId === userId; });

        for (let i = 0; i < userShifts.length; i++) {
            const s = userShifts[i];
            const sSlot = Utils.getTimeSlotById(s.slotId);
            if (!sSlot) continue;
            const sEnd = moment(s.date + ' ' + sSlot.end, 'YYYY-MM-DD HH:mm');
            const diff = shiftStart.diff(sEnd, 'hours', true);
            if (diff > 0 && diff < RULES.MIN_REST_HOURS) {
                return {
                    valid: false,
                    detail: '与 ' + s.date + ' ' + sSlot.label + ' 仅间隔 ' + diff.toFixed(1) + ' 小时'
                };
            }
            const sStart = moment(s.date + ' ' + sSlot.start, 'YYYY-MM-DD HH:mm');
            const diff2 = sStart.diff(moment(dateStr + ' ' + slot.end, 'YYYY-MM-DD HH:mm'), 'hours', true);
            if (diff2 > 0 && diff2 < RULES.MIN_REST_HOURS) {
                return {
                    valid: false,
                    detail: '与 ' + s.date + ' ' + sSlot.label + ' 仅间隔 ' + diff2.toFixed(1) + ' 小时'
                };
            }
        }
        return { valid: true };
    };

    ShiftRules.checkCrossBranchInterval = function (shift, allShifts) {
        const slot = Utils.getTimeSlotById(shift.slotId);
        if (!slot) return { valid: true };
        const shiftStart = moment(shift.date + ' ' + slot.start, 'YYYY-MM-DD HH:mm');
        const shiftEnd = moment(shift.date + ' ' + slot.end, 'YYYY-MM-DD HH:mm');

        const userShifts = allShifts.filter(function (s) {
            return s.userId === shift.userId && s.id !== shift.id;
        });

        for (let i = 0; i < userShifts.length; i++) {
            const s = userShifts[i];
            if (s.branchId === shift.branchId) continue;
            const sSlot = Utils.getTimeSlotById(s.slotId);
            if (!sSlot) continue;
            const sStart = moment(s.date + ' ' + sSlot.start, 'YYYY-MM-DD HH:mm');
            const sEnd = moment(s.date + ' ' + sSlot.end, 'YYYY-MM-DD HH:mm');

            const diffAfter = sStart.diff(shiftEnd, 'hours', true);
            if (diffAfter > 0 && diffAfter < RULES.CROSS_BRANCH_MIN_INTERVAL_HOURS) {
                return {
                    valid: false,
                    detail: '与 ' + s.branchId + ' 的 ' + s.date + ' ' + sSlot.label + ' 仅间隔 ' + diffAfter.toFixed(1) + ' 小时'
                };
            }
            const diffBefore = shiftStart.diff(sEnd, 'hours', true);
            if (diffBefore > 0 && diffBefore < RULES.CROSS_BRANCH_MIN_INTERVAL_HOURS) {
                return {
                    valid: false,
                    detail: '与 ' + s.branchId + ' 的 ' + s.date + ' ' + sSlot.label + ' 仅间隔 ' + diffBefore.toFixed(1) + ' 小时'
                };
            }
        }
        return { valid: true };
    };

    ShiftRules.checkUnavailablePeriod = function (shift, allUnavailable) {
        const userId = shift.userId;
        const shiftDate = shift.date;

        const userUnavailable = allUnavailable.filter(function (u) { return u.userId === userId; });
        for (let i = 0; i < userUnavailable.length; i++) {
            const u = userUnavailable[i];
            if (shiftDate >= u.startDate && shiftDate <= u.endDate) {
                return {
                    valid: false,
                    reason: (u.typeLabel || u.type) + (u.notes ? ' - ' + u.notes : '')
                };
            }
        }
        return { valid: true };
    };

    ShiftRules.validateAppointment = function (appointment, allAppointments, allShifts, allUnavailable) {
        const errors = [];
        allAppointments = allAppointments || [];
        allShifts = allShifts || [];

        const vetShift = allShifts.find(function (s) {
            return s.userId === appointment.vetId &&
                s.date === appointment.date &&
                ShiftRules.isTimeInSlot(appointment.time, s.slotId);
        });
        if (!vetShift) {
            errors.push({
                code: 'NO_VET_SHIFT',
                message: '该兽医此时段无排班安排'
            });
        }

        const slotAppointments = allAppointments.filter(function (a) {
            return a.id !== appointment.id &&
                a.vetId === appointment.vetId &&
                a.date === appointment.date &&
                a.time === appointment.time &&
                a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
        });

        const vet = (App && App.state && App.state.users) ?
            App.state.users.find(function (u) { return u.id === appointment.vetId; }) : null;
        const qual = vet ? Utils.getQualificationById(vet.qualification) : null;
        const maxPerSlot = qual ? qual.maxAppointmentsPerSlot : RULES.MAX_APPOINTMENTS_PER_SLOT;

        if (slotAppointments.length >= maxPerSlot) {
            errors.push({
                code: 'SLOT_FULL',
                message: '该时段预约已满（上限' + maxPerSlot + '个）'
            });
        }

        const duplicate = allAppointments.find(function (a) {
            return a.id !== appointment.id &&
                a.ownerName === appointment.ownerName &&
                a.phone === appointment.phone &&
                a.date === appointment.date &&
                a.status !== Utils.CONSTANTS.APPOINTMENT_STATUS.CANCELLED;
        });
        if (duplicate) {
            errors.push({
                code: 'DUPLICATE_APPOINTMENT',
                message: '该客户当日已有预约（' + duplicate.time + ' ' + duplicate.petName + '）'
            });
        }

        if (vetShift) {
            const unavailableCheck = ShiftRules.checkUnavailablePeriod(
                { userId: appointment.vetId, date: appointment.date },
                allUnavailable
            );
            if (!unavailableCheck.valid) {
                errors.push({
                    code: 'VET_UNAVAILABLE',
                    message: '该兽医此时段不可用：' + unavailableCheck.reason
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            isFull: errors.some(function (e) { return e.code === 'SLOT_FULL'; })
        };
    };

    ShiftRules.isTimeInSlot = function (time, slotId) {
        const slot = Utils.getTimeSlotById(slotId);
        if (!slot) return false;
        const slotStart = parseInt(slot.start.replace(':', ''));
        const slotEnd = parseInt(slot.end.replace(':', ''));
        const t = parseInt(time.replace(':', ''));
        return t >= slotStart && t < slotEnd;
    };

    ShiftRules.checkQualificationMatch = function (vetQualificationId, appointmentType) {
        if (!vetQualificationId) return { valid: true };
        const qual = Utils.getQualificationById(vetQualificationId);
        if (!qual) return { valid: true };

        if (appointmentType === 'surgery' && qual.id === 'associate_vet') {
            return {
                valid: false,
                message: '助理兽医师无法独立进行手术'
            };
        }
        return { valid: true };
    };

    global.ShiftRules = ShiftRules;

})(window);
