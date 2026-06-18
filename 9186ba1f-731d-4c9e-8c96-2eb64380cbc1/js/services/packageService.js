const PackageService = (function() {
    const PACKAGE_TYPES = {
        STANDARD: 'standard',
        SEASONAL: 'seasonal',
        MEMBER: 'member'
    };

    const DISCOUNT_RATES = {
        standard: 0.9,
        seasonal: 0.85,
        member: 0.8
    };

    function calculatePackagePrice(packageId, customItems = null) {
        const pkg = DataStore.findById('packages', packageId);
        if (!pkg) {
            throw new Error('套餐不存在');
        }

        let items = customItems || (DataStore.indexes.packageItems.byPackageId.get(packageId) || []);
        let totalLaborFee = 0;
        let totalMaterialFee = 0;

        items.forEach(item => {
            const qty = item.quantity || 1;
            totalLaborFee += (item.laborFee || 0) * qty;
            totalMaterialFee += (item.materialFee || 0) * qty;
        });

        const discountRate = pkg.discountRate || DISCOUNT_RATES[pkg.type] || 1;
        const originalPrice = totalLaborFee + totalMaterialFee;
        const discountAmount = originalPrice * (1 - discountRate);
        const actualPrice = originalPrice - discountAmount;

        return {
            packageId: pkg.id,
            packageName: pkg.name,
            packageType: pkg.type,
            packageTypeText: Helpers.getPackageTypeText(pkg.type),
            discountRate: discountRate,
            discountText: (discountRate * 10).toFixed(1) + '折',
            originalPrice: parseFloat(originalPrice.toFixed(2)),
            totalLaborFee: parseFloat(totalLaborFee.toFixed(2)),
            totalMaterialFee: parseFloat(totalMaterialFee.toFixed(2)),
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            actualPrice: parseFloat(actualPrice.toFixed(2)),
            items: items.map(item => ({
                ...item,
                originalSubtotal: (item.laborFee + item.materialFee) * (item.quantity || 1),
                discountedSubtotal: ((item.laborFee + item.materialFee) * (item.quantity || 1)) * discountRate
            }))
        };
    }

    function getPackageDetail(packageId) {
        const pkg = DataStore.findById('packages', packageId);
        if (!pkg) return null;

        const items = DataStore.indexes.packageItems.byPackageId.get(packageId) || [];
        const priceInfo = calculatePackagePrice(packageId);

        return {
            ...pkg,
            typeText: Helpers.getPackageTypeText(pkg.type),
            items: items,
            priceInfo: priceInfo
        };
    }

    function findAll(filters = {}) {
        let packages = DataStore.findAll('packages', filters);
        return packages.map(pkg => ({
            ...pkg,
            typeText: Helpers.getPackageTypeText(pkg.type),
            items: DataStore.indexes.packageItems.byPackageId.get(pkg.id) || [],
            priceInfo: calculatePackagePrice(pkg.id)
        }));
    }

    function findByType(type) {
        return DataStore.findByIndex('packages', 'byType', type) || [];
    }

    function findById(id) {
        return DataStore.findById('packages', id);
    }

    function splitPackage(packageId, customItems) {
        const pkg = DataStore.findById('packages', packageId);
        if (!pkg) {
            throw new Error('套餐不存在');
        }

        const packageItems = DataStore.indexes.packageItems.byPackageId.get(packageId) || [];
        const mergedItems = [];

        packageItems.forEach(baseItem => {
            const custom = customItems.find(ci => ci.itemId === baseItem.itemId || ci.id === baseItem.id);
            if (custom && custom.included !== false) {
                mergedItems.push({
                    ...baseItem,
                    quantity: custom.quantity || baseItem.quantity || 1,
                    discount: custom.discount !== undefined ? custom.discount : 1
                });
            }
        });

        customItems.forEach(custom => {
            if (!custom.itemId && !custom.id) {
                mergedItems.push({
                    ...custom,
                    quantity: custom.quantity || 1,
                    discount: custom.discount !== undefined ? custom.discount : 1
                });
            }
        });

        return calculatePackagePrice(packageId, mergedItems);
    }

    function applyPackageToOrder(orderId, packageId, customItems = null) {
        const order = DataStore.findById('orders', orderId);
        if (!order) {
            throw new Error('工单不存在');
        }

        if (order.status === 'completed') {
            throw new Error('已完工单无法应用套餐');
        }

        const priceInfo = calculatePackagePrice(packageId, customItems);

        priceInfo.items.forEach(item => {
            DataStore.create('order_items', {
                orderId: orderId,
                category: item.category,
                itemId: item.id || item.itemId,
                itemName: item.name || item.itemName,
                laborFee: parseFloat(item.laborFee || 0),
                materialFee: parseFloat(item.materialFee || 0),
                quantity: item.quantity || 1,
                discount: priceInfo.discountRate,
                subtotal: parseFloat((item.discountedSubtotal || item.subtotal || 0).toFixed(2))
            });
        });

        const allItems = DataStore.indexes.orderItems.byOrderId.get(orderId) || [];
        const amounts = OrderService.calculateAmount(allItems);
        DataStore.update('orders', orderId, amounts);

        return OrderService.findById(orderId);
    }

    function createPackage(packageData, items) {
        const existing = DataStore.findAll('packages', { name: packageData.name });
        if (existing.length > 0) {
            throw new Error('套餐名称已存在');
        }

        const pkg = DataStore.create('packages', {
            ...packageData,
            discountRate: packageData.discountRate || DISCOUNT_RATES[packageData.type] || 1
        });

        items.forEach(item => {
            DataStore.create('package_items', {
                packageId: pkg.id,
                category: item.category,
                itemId: item.id,
                itemName: item.name,
                laborFee: parseFloat(item.laborFee || 0),
                materialFee: parseFloat(item.materialFee || 0)
            });
        });

        return getPackageDetail(pkg.id);
    }

    function updatePackage(id, packageData, items = null) {
        const pkg = DataStore.update('packages', id, {
            ...packageData,
            discountRate: packageData.discountRate || DISCOUNT_RATES[packageData.type] || undefined
        });

        if (items) {
            const existingItems = DataStore.indexes.packageItems.byPackageId.get(id) || [];
            existingItems.forEach(item => {
                DataStore.remove('package_items', item.id);
            });

            items.forEach(item => {
                DataStore.create('package_items', {
                    packageId: id,
                    category: item.category,
                    itemId: item.id,
                    itemName: item.name,
                    laborFee: parseFloat(item.laborFee || 0),
                    materialFee: parseFloat(item.materialFee || 0)
                });
            });
        }

        return getPackageDetail(id);
    }

    function removePackage(id) {
        const existingItems = DataStore.indexes.packageItems.byPackageId.get(id) || [];
        existingItems.forEach(item => {
            DataStore.remove('package_items', item.id);
        });
        return DataStore.remove('packages', id);
    }

    function getDefaultPackages() {
        const serviceItems = Helpers.getServiceItems();

        return [
            {
                id: 'pkg_001',
                name: '小保养套餐',
                type: 'standard',
                discountRate: 0.9,
                description: '适用于5000公里常规保养，包含机油机滤更换及全车检查',
                isActive: true,
                items: [
                    serviceItems.maintenance[0],
                    serviceItems.maintenance[1],
                    serviceItems.maintenance[11]
                ]
            },
            {
                id: 'pkg_002',
                name: '大保养套餐',
                type: 'standard',
                discountRate: 0.9,
                description: '适用于20000公里深度保养，包含全车油水更换及滤芯更换',
                isActive: true,
                items: [
                    serviceItems.maintenance[0],
                    serviceItems.maintenance[1],
                    serviceItems.maintenance[2],
                    serviceItems.maintenance[3],
                    serviceItems.maintenance[4],
                    serviceItems.maintenance[5],
                    serviceItems.maintenance[6],
                    serviceItems.maintenance[11]
                ]
            },
            {
                id: 'pkg_003',
                name: '夏季空调检测套餐',
                type: 'seasonal',
                discountRate: 0.85,
                description: '夏季专属，包含空调系统全面检测、清洗、消毒',
                isActive: true,
                items: [
                    serviceItems.maintenance[3],
                    serviceItems.repair[9],
                    serviceItems.repair[22],
                    serviceItems.beauty[7]
                ]
            },
            {
                id: 'pkg_004',
                name: '冬季防冻检测套餐',
                type: 'seasonal',
                discountRate: 0.85,
                description: '冬季专属，包含防冻液更换、电瓶检测、轮胎检查',
                isActive: true,
                items: [
                    serviceItems.maintenance[8],
                    serviceItems.repair[6],
                    serviceItems.repair[2],
                    serviceItems.repair[4]
                ]
            },
            {
                id: 'pkg_005',
                name: '会员尊享小保养',
                type: 'member',
                discountRate: 0.8,
                description: '会员专享优惠，包含机油三滤更换',
                isActive: true,
                items: [
                    serviceItems.maintenance[0],
                    serviceItems.maintenance[1],
                    serviceItems.maintenance[2],
                    serviceItems.maintenance[3]
                ]
            },
            {
                id: 'pkg_006',
                name: '会员尊享美容套餐',
                type: 'member',
                discountRate: 0.8,
                description: '会员专享，包含精洗、打蜡、内饰清洁、消毒',
                isActive: true,
                items: [
                    serviceItems.beauty[1],
                    serviceItems.beauty[2],
                    serviceItems.beauty[6],
                    serviceItems.beauty[7]
                ]
            },
            {
                id: 'pkg_007',
                name: '刹车系统检测套餐',
                type: 'standard',
                discountRate: 0.9,
                description: '全面检测刹车系统，包含刹车片、刹车盘检查更换',
                isActive: true,
                items: [
                    serviceItems.repair[0],
                    serviceItems.repair[1],
                    serviceItems.maintenance[6],
                    serviceItems.maintenance[11]
                ]
            },
            {
                id: 'pkg_008',
                name: '轮胎养护套餐',
                type: 'standard',
                discountRate: 0.9,
                description: '轮胎全面养护，包含动平衡、四轮定位',
                isActive: true,
                items: [
                    serviceItems.repair[3],
                    serviceItems.repair[4],
                    serviceItems.repair[5],
                    serviceItems.maintenance[11]
                ]
            }
        ];
    }

    return {
        PACKAGE_TYPES,
        DISCOUNT_RATES,
        calculatePackagePrice,
        getPackageDetail,
        findAll,
        findByType,
        findById,
        splitPackage,
        applyPackageToOrder,
        createPackage,
        updatePackage,
        removePackage,
        getDefaultPackages
    };
})();
