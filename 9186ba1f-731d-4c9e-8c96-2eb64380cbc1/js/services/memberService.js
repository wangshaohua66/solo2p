const MemberService = (function() {
    const CARD_TYPES = {
        PREPAID: 'prepaid',
        COUNT: 'count',
        YEAR: 'year'
    };

    const POINTS_RATE = 1;

    function create(memberData) {
        const phoneValidation = Validator.validatePhone(memberData.phone);
        if (!phoneValidation.valid) {
            throw new Error(phoneValidation.message);
        }

        const existing = DataStore.findByIndex('members', 'byPhone', memberData.phone);
        if (existing) {
            throw new Error('该手机号已注册会员');
        }

        memberData.phone = memberData.phone.replace(/\s/g, '');
        memberData.balance = parseFloat(memberData.balance || 0);
        memberData.remainingTimes = parseInt(memberData.remainingTimes || 0, 10);
        memberData.points = parseInt(memberData.points || 0, 10);

        if (memberData.cardType === CARD_TYPES.PREPAID && memberData.balance <= 0) {
            throw new Error('储值卡余额必须大于0');
        }
        if (memberData.cardType === CARD_TYPES.COUNT && memberData.remainingTimes <= 0) {
            throw new Error('次卡次数必须大于0');
        }
        if (memberData.cardType === CARD_TYPES.YEAR && !memberData.expiryDate) {
            memberData.expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
        }

        return DataStore.create('members', memberData);
    }

    function update(id, memberData) {
        if (memberData.phone) {
            const phoneValidation = Validator.validatePhone(memberData.phone);
            if (!phoneValidation.valid) {
                throw new Error(phoneValidation.message);
            }
            memberData.phone = memberData.phone.replace(/\s/g, '');
        }

        if (memberData.balance !== undefined) {
            memberData.balance = parseFloat(memberData.balance);
        }
        if (memberData.remainingTimes !== undefined) {
            memberData.remainingTimes = parseInt(memberData.remainingTimes, 10);
        }
        if (memberData.points !== undefined) {
            memberData.points = parseInt(memberData.points, 10);
        }

        return DataStore.update('members', id, memberData);
    }

    function remove(id) {
        const orders = DataStore.findByIndex('orders', 'byMemberId', id);
        if (orders && orders.length > 0) {
            throw new Error('该会员存在消费记录，无法删除');
        }
        const transactions = DataStore.findAll('member_transactions', { memberId: id });
        transactions.forEach(t => {
            DataStore.remove('member_transactions', t.id);
        });
        return DataStore.remove('members', id);
    }

    function findById(id) {
        return DataStore.findById('members', id);
    }

    function findByPhone(phone) {
        phone = phone.replace(/\s/g, '');
        return DataStore.findByIndex('members', 'byPhone', phone);
    }

    function findAll(filters = {}) {
        return DataStore.findAll('members', filters);
    }

    function search(keyword) {
        keyword = keyword.toLowerCase();
        return DataStore.findAll('members').filter(m =>
            m.name.includes(keyword) ||
            m.phone.includes(keyword) ||
            (m.cardNo && m.cardNo.toLowerCase().includes(keyword))
        );
    }

    function deductBalance(memberId, amount, orderId = null) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }
        if (member.cardType !== CARD_TYPES.PREPAID) {
            throw new Error('该会员卡类型不支持储值消费');
        }

        const amountNum = parseFloat(amount);
        if (member.balance < amountNum) {
            throw new Error('储值卡余额不足，当前余额: ¥' + member.balance.toFixed(2));
        }

        const newBalance = parseFloat((member.balance - amountNum).toFixed(2));
        const updated = DataStore.update('members', memberId, { balance: newBalance });

        if (newBalance < 100) {
            Helpers.showToast('储值卡余额不足100元，请及时充值', 'warning');
        }

        return updated;
    }

    function rechargeBalance(memberId, amount) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }
        if (member.cardType !== CARD_TYPES.PREPAID) {
            throw new Error('该会员卡类型不支持储值充值');
        }

        const amountNum = parseFloat(amount);
        const amountValidation = Validator.validateAmount(amountNum);
        if (!amountValidation.valid) {
            throw new Error(amountValidation.message);
        }

        const newBalance = parseFloat((member.balance + amountNum).toFixed(2));
        const updated = DataStore.update('members', memberId, { balance: newBalance });

        addTransaction(memberId, {
            type: 'recharge',
            amount: amountNum,
            points: 0,
            remark: '储值充值'
        });

        return updated;
    }

    function deductCount(memberId, count, orderId = null) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }
        if (member.cardType !== CARD_TYPES.COUNT) {
            throw new Error('该会员卡类型不支持次卡消费');
        }

        const countNum = parseInt(count, 10);
        if (member.remainingTimes < countNum) {
            throw new Error('次卡次数不足，剩余次数: ' + member.remainingTimes);
        }

        const newCount = member.remainingTimes - countNum;
        const updated = DataStore.update('members', memberId, { remainingTimes: newCount });

        if (newCount < 3) {
            Helpers.showToast('次卡剩余次数不足3次，请及时续费', 'warning');
        }

        return updated;
    }

    function rechargeCount(memberId, count) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }
        if (member.cardType !== CARD_TYPES.COUNT) {
            throw new Error('该会员卡类型不支持次卡充值');
        }

        const countNum = parseInt(count, 10);
        if (countNum <= 0) {
            throw new Error('充值次数必须大于0');
        }

        const newCount = member.remainingTimes + countNum;
        const updated = DataStore.update('members', memberId, { remainingTimes: newCount });

        addTransaction(memberId, {
            type: 'recharge',
            amount: 0,
            points: 0,
            remark: '次卡充值 ' + countNum + ' 次'
        });

        return updated;
    }

    function checkYearCardValidity(memberId) {
        const member = DataStore.findById('members', memberId);
        if (!member) return { valid: false, message: '会员不存在' };
        if (member.cardType !== CARD_TYPES.YEAR) {
            return { valid: true, isYearCard: false };
        }

        const expiryDate = new Date(member.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (expiryDate < today) {
            return { valid: false, isYearCard: true, daysUntilExpiry, message: '年卡已过期' };
        }

        if (daysUntilExpiry <= 30) {
            Helpers.showToast('年卡将在 ' + daysUntilExpiry + ' 天后过期，请及时续费', 'warning');
        }

        return { valid: true, isYearCard: true, daysUntilExpiry };
    }

    function renewYearCard(memberId, years = 1) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }
        if (member.cardType !== CARD_TYPES.YEAR) {
            throw new Error('该会员卡类型不支持年卡续费');
        }

        let currentExpiry = member.expiryDate ? new Date(member.expiryDate) : new Date();
        if (currentExpiry < new Date()) {
            currentExpiry = new Date();
        }
        currentExpiry.setFullYear(currentExpiry.getFullYear() + years);

        const newExpiry = currentExpiry.toISOString().split('T')[0];
        const updated = DataStore.update('members', memberId, { expiryDate: newExpiry });

        addTransaction(memberId, {
            type: 'recharge',
            amount: 0,
            points: 0,
            remark: '年卡续费 ' + years + ' 年'
        });

        return updated;
    }

    function addPoints(memberId, points, orderId = null) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }

        const pointsNum = parseInt(points, 10) * POINTS_RATE;
        const newPoints = (member.points || 0) + pointsNum;

        return DataStore.update('members', memberId, { points: newPoints });
    }

    function redeemPoints(memberId, points, reward) {
        const member = DataStore.findById('members', memberId);
        if (!member) {
            throw new Error('会员不存在');
        }

        const pointsNum = parseInt(points, 10);
        if (member.points < pointsNum) {
            throw new Error('积分不足，当前积分: ' + member.points);
        }

        const newPoints = member.points - pointsNum;
        const updated = DataStore.update('members', memberId, { points: newPoints });

        addTransaction(memberId, {
            type: 'redeem',
            amount: 0,
            points: -pointsNum,
            remark: '积分兑换: ' + reward
        });

        return updated;
    }

    function addTransaction(memberId, transactionData) {
        return DataStore.create('member_transactions', {
            memberId,
            type: transactionData.type || 'consume',
            amount: parseFloat(transactionData.amount || 0),
            points: parseInt(transactionData.points || 0, 10),
            orderId: transactionData.orderId || null,
            remark: transactionData.remark || ''
        });
    }

    function getTransactions(memberId, filters = {}) {
        let transactions = DataStore.findAll('member_transactions', { memberId });

        if (filters.startDate) {
            transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            transactions = transactions.filter(t => new Date(t.createdAt) <= endDate);
        }
        if (filters.type) {
            transactions = transactions.filter(t => t.type === filters.type);
        }

        return transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function getConsumptionHistory(memberId, limit = 20) {
        const orders = DataStore.findByIndex('orders', 'byMemberId', memberId) || [];
        return orders
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit)
            .map(order => ({
                ...order,
                statusText: Helpers.getStatusText(order.status),
                statusClass: Helpers.getStatusClass(order.status),
                items: DataStore.indexes.orderItems.byOrderId.get(order.id) || []
            }));
    }

    function getAllConsumptionRecords(filters = {}) {
        const orders = DataStore.findAll('orders').filter(o => o.memberId);
        let result = orders.map(order => {
            const member = DataStore.findById('members', order.memberId);
            const items = DataStore.indexes.orderItems.byOrderId.get(order.id) || [];
            return {
                ...order,
                member,
                memberName: member?.name || '未知会员',
                memberCardNo: member?.cardNo || '-',
                memberPhone: member?.phone || '-',
                memberCardType: member?.cardType || '-',
                items: items,
                serviceItems: items.map(i => i.itemName).join('、'),
                statusText: Helpers.getStatusText(order.status)
            };
        });

        if (filters.startDate) {
            result = result.filter(r => new Date(r.createdAt) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            result = result.filter(r => new Date(r.createdAt) <= endDate);
        }
        if (filters.minAmount !== undefined && filters.minAmount !== null && filters.minAmount !== '') {
            result = result.filter(r => r.actualAmount >= parseFloat(filters.minAmount));
        }
        if (filters.maxAmount !== undefined && filters.maxAmount !== null && filters.maxAmount !== '') {
            result = result.filter(r => r.actualAmount <= parseFloat(filters.maxAmount));
        }
        if (filters.memberId) {
            result = result.filter(r => r.memberId === filters.memberId);
        }
        if (filters.cardNo) {
            result = result.filter(r => r.memberCardNo && r.memberCardNo.includes(filters.cardNo));
        }

        return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function exportConsumptionRecords(records, format = 'csv') {
        const exportData = records.map(r => ({
            '消费时间': Helpers.formatDate(r.createdAt, 'YYYY-MM-DD HH:mm'),
            '会员卡号': r.memberCardNo,
            '会员姓名': r.memberName,
            '联系电话': r.memberPhone,
            '卡类型': Helpers.getMemberCardTypeText(r.memberCardType),
            '车牌号': r.plateNo || '-',
            '服务项目': r.serviceItems,
            '工时费': (r.laborFee || 0).toFixed(2),
            '材料费': (r.materialFee || 0).toFixed(2),
            '折扣金额': r.discountAmount ? r.discountAmount.toFixed(2) : '0.00',
            '实付金额': (r.actualAmount || 0).toFixed(2),
            '工单状态': r.statusText,
            '操作人': r.createdBy || '系统'
        }));

        const timestamp = Helpers.formatDate(null, 'YYYYMMDD_HHmmss');
        const filename = `会员消费记录_${timestamp}`;

        if (format === 'excel') {
            Helpers.downloadExcel(exportData, filename);
        } else {
            Helpers.downloadCSV(exportData, filename);
        }
    }

    function getMemberStats(memberId) {
        const member = findById(memberId);
        if (!member) return null;

        const orders = DataStore.findByIndex('orders', 'byMemberId', memberId) || [];
        const completedOrders = orders.filter(o => o.status === 'completed');
        const totalSpent = completedOrders.reduce((sum, o) => sum + o.actualAmount, 0);
        const totalVisits = completedOrders.length;
        const lastVisit = completedOrders.length > 0 ?
            completedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt :
            null;

        let cardStatus = '正常';
        if (member.cardType === 'prepaid' && member.balance < 100) {
            cardStatus = '余额不足';
        } else if (member.cardType === 'count' && member.remainingTimes < 3) {
            cardStatus = '次数不足';
        } else if (member.cardType === 'year') {
            const validity = checkYearCardValidity(memberId);
            if (!validity.valid) {
                cardStatus = '已过期';
            } else if (validity.daysUntilExpiry <= 30) {
                cardStatus = '即将过期';
            }
        }

        return {
            member,
            totalSpent: parseFloat(totalSpent.toFixed(2)),
            totalVisits,
            lastVisit,
            cardStatus,
            averageSpent: totalVisits > 0 ? parseFloat((totalSpent / totalVisits).toFixed(2)) : 0
        };
    }

    function getCount() {
        return DataStore.findAll('members').length;
    }

    function getCardTypeDistribution() {
        const members = DataStore.findAll('members');
        const distribution = {};

        members.forEach(m => {
            const type = m.cardType || '未知';
            distribution[type] = (distribution[type] || 0) + 1;
        });

        return Object.entries(distribution)
            .map(([type, count]) => ({
                type,
                typeText: Helpers.getMemberCardTypeText(type),
                count
            }));
    }

    function getPointsExchangeRules() {
        return [
            { points: 500, reward: '免费普洗一次', value: 35 },
            { points: 1000, reward: '免费精洗一次', value: 100 },
            { points: 2000, reward: '机油更换券', value: 330 },
            { points: 3000, reward: '小保养套餐', value: 500 },
            { points: 5000, reward: '全车镀晶服务', value: 900 }
        ];
    }

    return {
        CARD_TYPES,
        POINTS_RATE,
        create,
        update,
        remove,
        findById,
        findByPhone,
        findAll,
        search,
        deductBalance,
        rechargeBalance,
        deductCount,
        rechargeCount,
        checkYearCardValidity,
        renewYearCard,
        addPoints,
        redeemPoints,
        addTransaction,
        getTransactions,
        getConsumptionHistory,
        getAllConsumptionRecords,
        exportConsumptionRecords,
        getMemberStats,
        getCount,
        getCardTypeDistribution,
        getPointsExchangeRules
    };
})();
