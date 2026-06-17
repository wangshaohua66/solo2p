const OrderService = (function() {
    const ORDER_STATUS = {
        PENDING: 'pending',
        REPAIRING: 'repairing',
        SETTLEMENT: 'settlement',
        COMPLETED: 'completed'
    };

    const STATUS_TRANSITIONS = {
        'pending': ['repairing'],
        'repairing': ['settlement'],
        'settlement': ['completed'],
        'completed': []
    };

    function calculateAmount(items) {
        let totalLaborFee = 0;
        let totalMaterialFee = 0;
        let discountAmount = 0;

        items.forEach(item => {
            const qty = item.quantity || 1;
            const discount = item.discount !== undefined ? item.discount : 1;

            const laborFee = (item.laborFee || 0) * qty;
            const materialFee = (item.materialFee || 0) * qty;
            const itemTotal = (laborFee + materialFee) * discount;

            totalLaborFee += laborFee;
            totalMaterialFee += materialFee;
            discountAmount += (laborFee + materialFee) - itemTotal;
        });

        const totalAmount = totalLaborFee + totalMaterialFee;
        const actualAmount = totalAmount - discountAmount;

        return {
            totalLaborFee: parseFloat(totalLaborFee.toFixed(2)),
            totalMaterialFee: parseFloat(totalMaterialFee.toFixed(2)),
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            actualAmount: parseFloat(actualAmount.toFixed(2))
        };
    }

    function create(orderData, items, operator = '系统') {
        const startTime = performance.now();

        if (!orderData.vehicleId) {
            throw new Error('请选择车辆');
        }

        if (!items || items.length === 0) {
            throw new Error('请至少选择一个服务项目');
        }

        const amounts = calculateAmount(items);
        const storeId = DataStore.getCurrentStore();

        const order = DataStore.create('orders', {
            ...orderData,
            storeId,
            status: ORDER_STATUS.PENDING,
            ...amounts,
            operator
        });

        items.forEach(item => {
            const qty = item.quantity || 1;
            const discount = item.discount !== undefined ? item.discount : 1;
            const laborFee = (item.laborFee || 0) * qty;
            const materialFee = (item.materialFee || 0) * qty;
            const subtotal = (laborFee + materialFee) * discount;

            DataStore.create('order_items', {
                orderId: order.id,
                category: item.category,
                itemId: item.id,
                itemName: item.name,
                laborFee: parseFloat(item.laborFee || 0),
                materialFee: parseFloat(item.materialFee || 0),
                quantity: qty,
                discount: discount,
                subtotal: parseFloat(subtotal.toFixed(2))
            });
        });

        DataStore.addStatusHistory(order.id, ORDER_STATUS.PENDING, operator);

        const elapsed = performance.now() - startTime;
        if (elapsed > 500) {
            console.warn('Order save took', elapsed, 'ms, exceeds 500ms limit');
        }

        return order;
    }

    function updateStatus(orderId, newStatus, operator = '系统', remark = '') {
        const order = DataStore.findById('orders', orderId);
        if (!order) {
            throw new Error('工单不存在');
        }

        const allowedTransitions = STATUS_TRANSITIONS[order.status] || [];
        if (!allowedTransitions.includes(newStatus)) {
            throw new Error('无法从当前状态变更为: ' + Helpers.getStatusText(newStatus));
        }

        const updatedOrder = DataStore.update('orders', orderId, {
            status: newStatus,
            operator
        });

        DataStore.addStatusHistory(orderId, newStatus, operator);

        if (newStatus === ORDER_STATUS.COMPLETED && order.memberId) {
            const pointsEarned = Math.floor(order.actualAmount / 10);
            MemberService.addPoints(order.memberId, pointsEarned, orderId);

            if (order.paymentMethod === 'prepaid') {
                MemberService.deductBalance(order.memberId, order.actualAmount, orderId);
            } else if (order.paymentMethod === 'count') {
                MemberService.deductCount(order.memberId, 1, orderId);
            }

            MemberService.addTransaction(order.memberId, {
                type: 'consume',
                amount: order.actualAmount,
                points: pointsEarned,
                orderId: orderId,
                remark: '消费'
            });
        }

        $(document).trigger('orderStatusChanged', { orderId, newStatus, order: updatedOrder });

        return updatedOrder;
    }

    function getStatusHistory(orderId) {
        return DataStore.getStatusHistory(orderId).map(h => ({
            ...h,
            statusText: Helpers.getStatusText(h.status),
            statusClass: Helpers.getStatusClass(h.status),
            formattedTime: Helpers.formatDateTime(h.timestamp)
        }));
    }

    function findById(orderId) {
        const order = DataStore.findById('orders', orderId);
        if (!order) return null;

        const items = DataStore.indexes.orderItems.byOrderId.get(orderId) || [];
        const vehicle = DataStore.findById('vehicles', order.vehicleId);
        const member = order.memberId ? DataStore.findById('members', order.memberId) : null;

        return {
            ...order,
            items: items,
            vehicle: vehicle,
            member: member,
            statusText: Helpers.getStatusText(order.status),
            statusClass: Helpers.getStatusClass(order.status)
        };
    }

    function findAll(filters = {}) {
        let orders = DataStore.findAll('orders', filters);

        if (filters.startDate) {
            orders = orders.filter(o => new Date(o.createdAt) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            orders = orders.filter(o => new Date(o.createdAt) <= endDate);
        }
        if (filters.storeId) {
            orders = orders.filter(o => o.storeId === filters.storeId);
        }

        return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function findByStatus(status, storeId = null) {
        let orders = DataStore.findByIndex('orders', 'byStatus', status) || [];
        if (storeId) {
            orders = orders.filter(o => o.storeId === storeId);
        }
        return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function findByVehicleId(vehicleId) {
        return DataStore.findByIndex('orders', 'byVehicleId', vehicleId) || [];
    }

    function findByMemberId(memberId) {
        return DataStore.findByIndex('orders', 'byMemberId', memberId) || [];
    }

    function getOrderItems(orderId) {
        return DataStore.indexes.orderItems.byOrderId.get(orderId) || [];
    }

    function getStatusCounts(storeId = null) {
        const counts = {};
        Object.values(ORDER_STATUS).forEach(status => {
            const orders = DataStore.findByIndex('orders', 'byStatus', status) || [];
            counts[status] = storeId ?
                orders.filter(o => o.storeId === storeId).length :
                orders.length;
        });
        return counts;
    }

    function generatePrintHtml(orderId) {
        const order = findById(orderId);
        if (!order) return '';

        const store = Helpers.getStores().find(s => s.id === order.storeId);
        const statusHistory = getStatusHistory(orderId);

        const itemsHtml = order.items.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${Helpers.getServiceCategoryText(item.category)}</td>
                <td>${item.itemName}</td>
                <td>${item.quantity}</td>
                <td>¥${item.laborFee.toFixed(2)}</td>
                <td>¥${item.materialFee.toFixed(2)}</td>
                <td>${(item.discount * 10).toFixed(1)}折</td>
                <td>¥${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>工单 - ${order.id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; font-size: 14px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { color: #666; }
        .section { margin-bottom: 15px; }
        .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .info-item { display: flex; }
        .info-label { width: 80px; color: #666; }
        .info-value { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        th { background: #f5f5f5; }
        .summary { text-align: right; margin-top: 15px; font-size: 16px; }
        .summary div { margin: 5px 0; }
        .summary .total { font-size: 20px; font-weight: bold; color: #dc3545; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; }
        .status-history { margin-top: 20px; }
        .status-item { display: flex; margin: 5px 0; }
        .status-time { width: 150px; color: #666; }
        .status-name { width: 100px; }
        .status-operator { color: #666; }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${store ? store.name : '汽车快修门店'}</h1>
        <p>维修工单</p>
    </div>

    <div class="section">
        <div class="section-title">基本信息</div>
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">工单编号:</span>
                <span class="info-value">${order.id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">创建时间:</span>
                <span class="info-value">${Helpers.formatDateTime(order.createdAt)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">车牌号:</span>
                <span class="info-value">${order.vehicle ? order.vehicle.plateNo : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">车型:</span>
                <span class="info-value">${order.vehicle ? (order.vehicle.brand + ' ' + order.vehicle.series + ' ' + order.vehicle.model) : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">车主:</span>
                <span class="info-value">${order.vehicle ? order.vehicle.ownerName : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">联系电话:</span>
                <span class="info-value">${order.vehicle ? order.vehicle.ownerPhone : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">当前里程:</span>
                <span class="info-value">${order.vehicle ? order.vehicle.mileage + ' 公里' : '-'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">工单状态:</span>
                <span class="info-value">${order.statusText}</span>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">服务项目</div>
        <table>
            <thead>
                <tr>
                    <th width="5%">序号</th>
                    <th width="10%">类别</th>
                    <th width="30%">项目名称</th>
                    <th width="5%">数量</th>
                    <th width="12%">工时费</th>
                    <th width="12%">材料费</th>
                    <th width="8%">折扣</th>
                    <th width="15%">小计</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        <div class="summary">
            <div>工时费合计: ¥${order.totalLaborFee.toFixed(2)}</div>
            <div>材料费合计: ¥${order.totalMaterialFee.toFixed(2)}</div>
            <div>优惠金额: ¥${order.discountAmount.toFixed(2)}</div>
            <div class="total">应收金额: ¥${order.actualAmount.toFixed(2)}</div>
        </div>
    </div>

    <div class="section status-history">
        <div class="section-title">状态流转</div>
        ${statusHistory.map(h => `
            <div class="status-item">
                <span class="status-time">${h.formattedTime}</span>
                <span class="status-name">${h.statusText}</span>
                <span class="status-operator">操作人: ${h.operator}</span>
            </div>
        `).join('')}
    </div>

    <div class="footer">
        <div>
            <div>接待人: ${order.operator}</div>
            <div style="margin-top: 40px; border-top: 1px solid #ccc; width: 120px; text-align: center;">客户签字</div>
        </div>
        <div style="text-align: right;">
            <div>${store ? ('地址: ' + store.address) : ''}</div>
            <div>${store ? ('电话: ' + store.phone) : ''}</div>
            <div style="margin-top: 40px; border-top: 1px solid #ccc; width: 120px; text-align: center;">经办人签字</div>
        </div>
    </div>

    <div class="no-print" style="text-align: center; margin-top: 30px;">
        <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">打印工单</button>
    </div>
</body>
</html>`;
    }

    function addItems(orderId, items) {
        const order = DataStore.findById('orders', orderId);
        if (!order) {
            throw new Error('工单不存在');
        }
        if (order.status === ORDER_STATUS.COMPLETED) {
            throw new Error('已完工单无法添加项目');
        }

        items.forEach(item => {
            const qty = item.quantity || 1;
            const discount = item.discount !== undefined ? item.discount : 1;
            const laborFee = (item.laborFee || 0) * qty;
            const materialFee = (item.materialFee || 0) * qty;
            const subtotal = (laborFee + materialFee) * discount;

            DataStore.create('order_items', {
                orderId: orderId,
                category: item.category,
                itemId: item.id,
                itemName: item.name,
                laborFee: parseFloat(item.laborFee || 0),
                materialFee: parseFloat(item.materialFee || 0),
                quantity: qty,
                discount: discount,
                subtotal: parseFloat(subtotal.toFixed(2))
            });
        });

        const allItems = DataStore.indexes.orderItems.byOrderId.get(orderId) || [];
        const amounts = calculateAmount(allItems);
        DataStore.update('orders', orderId, amounts);

        return findById(orderId);
    }

    function removeItem(itemId) {
        const item = DataStore.findById('order_items', itemId);
        if (!item) return false;

        const order = DataStore.findById('orders', item.orderId);
        if (order && order.status === ORDER_STATUS.COMPLETED) {
            throw new Error('已完工单无法删除项目');
        }

        DataStore.remove('order_items', itemId);

        const remainingItems = DataStore.indexes.orderItems.byOrderId.get(item.orderId) || [];
        if (remainingItems.length > 0) {
            const amounts = calculateAmount(remainingItems);
            DataStore.update('orders', item.orderId, amounts);
        }

        return true;
    }

    function updateItem(itemId, updates) {
        const item = DataStore.findById('order_items', itemId);
        if (!item) return null;

        const order = DataStore.findById('orders', item.orderId);
        if (order && order.status === ORDER_STATUS.COMPLETED) {
            throw new Error('已完工单无法修改项目');
        }

        const updatedItem = DataStore.update('order_items', itemId, updates);
        const allItems = DataStore.indexes.orderItems.byOrderId.get(item.orderId) || [];
        const amounts = calculateAmount(allItems);
        DataStore.update('orders', item.orderId, amounts);

        return updatedItem;
    }

    return {
        ORDER_STATUS,
        STATUS_TRANSITIONS,
        calculateAmount,
        create,
        updateStatus,
        getStatusHistory,
        findById,
        findAll,
        findByStatus,
        findByVehicleId,
        findByMemberId,
        getOrderItems,
        getStatusCounts,
        generatePrintHtml,
        addItems,
        removeItem,
        updateItem
    };
})();
