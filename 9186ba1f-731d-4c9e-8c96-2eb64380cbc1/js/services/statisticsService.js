const StatisticsService = (function() {
    function getDailyRevenue(date = null, storeId = null) {
        const startTime = performance.now();

        const targetDate = date ? new Date(date) : new Date();
        const dateStr = targetDate.toISOString().split('T')[0];

        let orders;
        if (storeId) {
            orders = DataStore.findByIndex('orders', 'byStoreAndDate', storeId + '_' + dateStr) || [];
        } else {
            orders = DataStore.findAll('orders').filter(o =>
                new Date(o.createdAt).toISOString().split('T')[0] === dateStr
            );
        }

        const completedOrders = orders.filter(o => o.status === 'completed');

        const result = {
            date: dateStr,
            orderCount: orders.length,
            completedCount: completedOrders.length,
            laborRevenue: 0,
            materialRevenue: 0,
            totalRevenue: 0,
            averageOrderAmount: 0
        };

        completedOrders.forEach(o => {
            result.laborRevenue += o.totalLaborFee;
            result.materialRevenue += o.totalMaterialFee;
            result.totalRevenue += o.actualAmount;
        });

        result.laborRevenue = parseFloat(result.laborRevenue.toFixed(2));
        result.materialRevenue = parseFloat(result.materialRevenue.toFixed(2));
        result.totalRevenue = parseFloat(result.totalRevenue.toFixed(2));
        result.averageOrderAmount = completedOrders.length > 0 ?
            parseFloat((result.totalRevenue / completedOrders.length).toFixed(2)) : 0;

        const elapsed = performance.now() - startTime;
        if (elapsed > 1000) {
            console.warn('Daily revenue calculation took', elapsed, 'ms, exceeds 1s limit');
        }

        return result;
    }

    function getRevenueTrend(startDate, endDate, storeId = null) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const daily = getDailyRevenue(new Date(d), storeId);
            days.push({
                date: Helpers.formatDate(d, 'MM-DD'),
                fullDate: Helpers.formatDate(d),
                laborRevenue: daily.laborRevenue,
                materialRevenue: daily.materialRevenue,
                totalRevenue: daily.totalRevenue,
                orderCount: daily.orderCount
            });
        }

        return days;
    }

    function getStoreComparison(startDate, endDate) {
        const stores = Helpers.getStores();
        const result = [];

        stores.forEach(store => {
            const trend = getRevenueTrend(startDate, endDate, store.id);
            const total = trend.reduce((sum, d) => sum + d.totalRevenue, 0);
            const orderCount = trend.reduce((sum, d) => sum + d.orderCount, 0);

            result.push({
                storeId: store.id,
                storeName: store.name,
                totalRevenue: parseFloat(total.toFixed(2)),
                orderCount,
                averageOrderAmount: orderCount > 0 ?
                    parseFloat((total / orderCount).toFixed(2)) : 0,
                dailyData: trend
            });
        });

        return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    function getServiceTypeRatio(startDate, endDate, storeId = null) {
        let orders = getCompletedOrdersInRange(startDate, endDate, storeId);
        const result = {
            maintenance: { count: 0, revenue: 0, label: '保养' },
            repair: { count: 0, revenue: 0, label: '维修' },
            beauty: { count: 0, revenue: 0, label: '美容' }
        };

        orders.forEach(order => {
            const items = DataStore.indexes.orderItems.byOrderId.get(order.id) || [];
            const categories = new Set(items.map(i => i.category));

            categories.forEach(cat => {
                if (result[cat]) {
                    result[cat].count++;
                    const catItems = items.filter(i => i.category === cat);
                    result[cat].revenue += catItems.reduce((sum, i) => sum + i.subtotal, 0);
                }
            });
        });

        return Object.entries(result).map(([key, value]) => ({
            type: key,
            label: value.label,
            count: value.count,
            revenue: parseFloat(value.revenue.toFixed(2)),
            percentage: 0
        })).map(item => {
            const total = result.maintenance.revenue + result.repair.revenue + result.beauty.revenue;
            item.percentage = total > 0 ? parseFloat(((item.revenue / total) * 100).toFixed(1)) : 0;
            return item;
        });
    }

    function getModelDistribution(startDate, endDate, storeId = null) {
        const orders = getCompletedOrdersInRange(startDate, endDate, storeId);
        const distribution = {};

        orders.forEach(order => {
            const vehicle = DataStore.findById('vehicles', order.vehicleId);
            if (vehicle) {
                const brand = vehicle.brand || '未知品牌';
                distribution[brand] = (distribution[brand] || 0) + 1;
            }
        });

        return Object.entries(distribution)
            .map(([brand, count]) => ({ brand, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    function getPeakHourHeatmap(startDate, endDate, storeId = null) {
        const orders = getCompletedOrdersInRange(startDate, endDate, storeId);
        const heatmap = {};

        const daysOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const hours = Array.from({ length: 12 }, (_, i) => (i + 8) + ':00');

        daysOfWeek.forEach(day => {
            heatmap[day] = {};
            hours.forEach(hour => {
                heatmap[day][hour] = 0;
            });
        });

        orders.forEach(order => {
            const date = new Date(order.createdAt);
            const day = daysOfWeek[date.getDay()];
            const hour = Math.floor(date.getHours());
            if (hour >= 8 && hour < 20) {
                const hourStr = hour + ':00';
                if (heatmap[day] && heatmap[day][hourStr] !== undefined) {
                    heatmap[day][hourStr]++;
                }
            }
        });

        let maxCount = 0;
        Object.values(heatmap).forEach(dayData => {
            Object.values(dayData).forEach(count => {
                if (count > maxCount) maxCount = count;
            });
        });

        return {
            data: heatmap,
            maxCount,
            daysOfWeek,
            hours
        };
    }

    function getTechnicianRanking(startDate, endDate, storeId = null) {
        const orders = getCompletedOrdersInRange(startDate, endDate, storeId);
        const technicians = {};

        Helpers.getTechnicians().forEach(tech => {
            technicians[tech.id] = {
                technicianId: tech.id,
                technicianName: tech.name,
                level: tech.level,
                specialty: tech.specialty,
                orderCount: 0,
                totalRevenue: 0
            };
        });

        orders.forEach(order => {
            const techId = order.technicianId || 'tech_01';
            if (technicians[techId]) {
                technicians[techId].orderCount++;
                technicians[techId].totalRevenue += order.actualAmount;
            }
        });

        return Object.values(technicians)
            .map(t => ({
                ...t,
                totalRevenue: parseFloat(t.totalRevenue.toFixed(2)),
                averageOrderAmount: t.orderCount > 0 ?
                    parseFloat((t.totalRevenue / t.orderCount).toFixed(2)) : 0
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue);
    }

    function getDashboardStats(storeId = null) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const todayRevenue = getDailyRevenue(todayStr, storeId);

        const weekRange = Helpers.getDateRange('week');
        const monthRange = Helpers.getDateRange('month');

        const weekTrend = getRevenueTrend(weekRange.start, weekRange.end, storeId);
        const monthTrend = getRevenueTrend(monthRange.start, monthRange.end, storeId);

        const weekRevenue = parseFloat(weekTrend.reduce((sum, d) => sum + d.totalRevenue, 0).toFixed(2));
        const monthRevenue = parseFloat(monthTrend.reduce((sum, d) => sum + d.totalRevenue, 0).toFixed(2));

        const statusCounts = OrderService.getStatusCounts(storeId);

        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        const lastWeekRevenue = getDailyRevenue(lastWeek, storeId).totalRevenue;
        const weekGrowth = lastWeekRevenue > 0 ?
            parseFloat((((todayRevenue.totalRevenue - lastWeekRevenue) / lastWeekRevenue) * 100).toFixed(1)) : 0;

        return {
            today: {
                revenue: todayRevenue.totalRevenue,
                orderCount: todayRevenue.orderCount,
                laborRevenue: todayRevenue.laborRevenue,
                materialRevenue: todayRevenue.materialRevenue,
                growth: weekGrowth
            },
            week: {
                revenue: weekRevenue,
                orderCount: weekTrend.reduce((sum, d) => sum + d.orderCount, 0),
                trend: weekTrend
            },
            month: {
                revenue: monthRevenue,
                orderCount: monthTrend.reduce((sum, d) => sum + d.orderCount, 0)
            },
            statusCounts: {
                pending: statusCounts.pending || 0,
                repairing: statusCounts.repairing || 0,
                settlement: statusCounts.settlement || 0,
                completed: statusCounts.completed || 0
            },
            vehicleCount: VehicleService.getCount(),
            memberCount: MemberService.getCount()
        };
    }

    function getCompletedOrdersInRange(startDate, endDate, storeId = null) {
        let orders = DataStore.findAll('orders').filter(o => o.status === 'completed');

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        orders = orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= start && orderDate <= end;
        });

        if (storeId) {
            orders = orders.filter(o => o.storeId === storeId);
        }

        return orders;
    }

    function exportToCSV(data, filename) {
        Helpers.downloadCSV(data, filename);
    }

    function getExportData(type, startDate, endDate, storeId = null) {
        const orders = getCompletedOrdersInRange(startDate, endDate, storeId);
        const result = [];

        orders.forEach(order => {
            const vehicle = DataStore.findById('vehicles', order.vehicleId);
            const items = DataStore.indexes.orderItems.byOrderId.get(order.id) || [];

            result.push({
                '工单编号': order.id,
                '日期': Helpers.formatDate(order.createdAt),
                '门店': Helpers.getStores().find(s => s.id === order.storeId)?.name || '-',
                '车牌号': vehicle?.plateNo || '-',
                '车型': vehicle ? (vehicle.brand + ' ' + vehicle.series + ' ' + vehicle.model) : '-',
                '车主': vehicle?.ownerName || '-',
                '服务项目': items.map(i => i.itemName).join('、'),
                '工时费': order.totalLaborFee.toFixed(2),
                '材料费': order.totalMaterialFee.toFixed(2),
                '优惠金额': order.discountAmount.toFixed(2),
                '实收金额': order.actualAmount.toFixed(2),
                '状态': Helpers.getStatusText(order.status),
                '操作人': order.operator
            });
        });

        return result;
    }

    return {
        getDailyRevenue,
        getRevenueTrend,
        getStoreComparison,
        getServiceTypeRatio,
        getModelDistribution,
        getPeakHourHeatmap,
        getTechnicianRanking,
        getDashboardStats,
        getCompletedOrdersInRange,
        exportToCSV,
        getExportData
    };
})();
