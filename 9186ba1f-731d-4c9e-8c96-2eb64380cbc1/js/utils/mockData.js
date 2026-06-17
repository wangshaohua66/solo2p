const MockData = (function() {
    function generateRandomPlateNo() {
        const provinces = '京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼';
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
        const province = provinces[Math.floor(Math.random() * provinces.length)];
        const letter = letters[Math.floor(Math.random() * letters.length)];
        let number = '';
        for (let i = 0; i < 5; i++) {
            number += chars[Math.floor(Math.random() * chars.length)];
        }
        return province + letter + number;
    }

    function generateVin() {
        const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
        let vin = '';
        for (let i = 0; i < 17; i++) {
            vin += chars[Math.floor(Math.random() * chars.length)];
        }
        return vin;
    }

    function generatePhone() {
        const prefixes = ['138', '139', '135', '136', '137', '150', '151', '152', '188', '189', '186', '185', '177', '176'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        let suffix = '';
        for (let i = 0; i < 8; i++) {
            suffix += Math.floor(Math.random() * 10);
        }
        return prefix + suffix;
    }

    function generateName() {
        const surnames = ['张', '王', '李', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '胡', '朱', '郭', '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹'];
        const names = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '艳', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞', '平', '刚', '桂英', '秀英', '玲', '桂兰', '玉', '萍', '梅', '华'];
        const surname = surnames[Math.floor(Math.random() * surnames.length)];
        const name = names[Math.floor(Math.random() * names.length)];
        return surname + name;
    }

    function generateVehicle() {
        const brandData = Helpers.getBrandSeriesModelData();
        const brands = Object.keys(brandData);
        const brand = brands[Math.floor(Math.random() * brands.length)];
        const seriesList = Object.keys(brandData[brand]);
        const series = seriesList[Math.floor(Math.random() * seriesList.length)];
        const models = brandData[brand][series];
        const model = models[Math.floor(Math.random() * models.length)];

        return {
            plateNo: generateRandomPlateNo(),
            vin: generateVin(),
            brand: brand,
            series: series,
            model: model,
            mileage: Math.floor(Math.random() * 100000) + 5000,
            ownerName: generateName(),
            ownerPhone: generatePhone()
        };
    }

    function generateVehicles(count = 200) {
        const vehicles = [];
        const usedPlates = new Set();
        const usedPhones = new Set();

        while (vehicles.length < count) {
            const vehicle = generateVehicle();
            if (!usedPlates.has(vehicle.plateNo) && !usedPhones.has(vehicle.ownerPhone)) {
                usedPlates.add(vehicle.plateNo);
                usedPhones.add(vehicle.ownerPhone);
                vehicle.id = 'vehicle_' + (vehicles.length + 1);
                vehicle.createdAt = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString();
                vehicle.updatedAt = vehicle.createdAt;
                vehicles.push(vehicle);
            }
        }
        return vehicles;
    }

    function generateMember(vehicle) {
        const cardTypes = ['prepaid', 'count', 'year'];
        const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)];
        const member = {
            id: 'member_' + Math.random().toString(36).substr(2, 9),
            name: vehicle.ownerName,
            phone: vehicle.ownerPhone,
            cardNo: 'VIP' + String(Math.floor(Math.random() * 100000)).padStart(6, '0'),
            cardType: cardType,
            balance: cardType === 'prepaid' ? Math.floor(Math.random() * 5000) + 500 : 0,
            remainingTimes: cardType === 'count' ? Math.floor(Math.random() * 20) + 5 : 0,
            expiryDate: cardType === 'year' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] : null,
            points: Math.floor(Math.random() * 2000),
            createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
        };
        return member;
    }

    function generateMembers(vehicles, count = 100) {
        const members = [];
        const usedPhones = new Set();
        const shuffledVehicles = [...vehicles].sort(() => Math.random() - 0.5);

        for (let i = 0; i < count && i < shuffledVehicles.length; i++) {
            const vehicle = shuffledVehicles[i];
            if (!usedPhones.has(vehicle.ownerPhone)) {
                usedPhones.add(vehicle.ownerPhone);
                members.push(generateMember(vehicle));
            }
        }
        return members;
    }

    function generateOrders(vehicles, members, count = 1000) {
        const orders = [];
        const orderItems = [];
        const statusHistory = [];
        const statuses = ['pending', 'repairing', 'settlement', 'completed'];
        const technicians = Helpers.getTechnicians();
        const stores = Helpers.getStores();
        const serviceItems = Helpers.getServiceItems();
        const paymentMethods = ['cash', 'wechat', 'alipay', 'prepaid', 'count'];

        const allItems = [
            ...serviceItems.maintenance,
            ...serviceItems.repair,
            ...serviceItems.beauty
        ];

        for (let i = 0; i < count; i++) {
            const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];
            const member = members.find(m => m.phone === vehicle.ownerPhone) || null;
            const store = stores[Math.floor(Math.random() * stores.length)];
            const statusWeight = Math.random();
            let status;
            if (statusWeight < 0.05) status = 'pending';
            else if (statusWeight < 0.15) status = 'repairing';
            else if (statusWeight < 0.25) status = 'settlement';
            else status = 'completed';

            const daysAgo = Math.floor(Math.random() * 90);
            const hoursAgo = Math.floor(Math.random() * 12) + 8;
            const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);

            const itemCount = Math.floor(Math.random() * 3) + 1;
            const orderItemsList = [];
            const usedItems = new Set();

            for (let j = 0; j < itemCount; j++) {
                let item;
                do {
                    item = allItems[Math.floor(Math.random() * allItems.length)];
                } while (usedItems.has(item.id));
                usedItems.add(item.id);

                const qty = item.defaultQty || 1;
                const discount = Math.random() > 0.7 ? 1 : (Math.random() > 0.5 ? 0.9 : 0.85);
                const category = serviceItems.maintenance.includes(item) ? 'maintenance' :
                    serviceItems.repair.includes(item) ? 'repair' : 'beauty';

                orderItemsList.push({
                    ...item,
                    category: category,
                    quantity: qty,
                    discount: discount
                });
            }

            const amounts = OrderService.calculateAmount(orderItemsList);

            const order = {
                id: 'order_' + (i + 1),
                vehicleId: vehicle.id,
                memberId: member ? member.id : null,
                storeId: store.id,
                status: status,
                technicianId: technicians[Math.floor(Math.random() * technicians.length)].id,
                paymentMethod: member ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)] : paymentMethods[Math.floor(Math.random() * 3)],
                remark: Math.random() > 0.7 ? '客户要求尽快完成' : '',
                ...amounts,
                operator: '系统',
                createdAt: createdAt.toISOString(),
                updatedAt: createdAt.toISOString()
            };

            orders.push(order);

            orderItemsList.forEach((item, index) => {
                orderItems.push({
                    id: 'order_item_' + (i * 10 + index),
                    orderId: order.id,
                    category: item.category,
                    itemId: item.id,
                    itemName: item.name,
                    laborFee: item.laborFee,
                    materialFee: item.materialFee,
                    quantity: item.quantity,
                    discount: item.discount,
                    subtotal: parseFloat(((item.laborFee + item.materialFee) * item.quantity * item.discount).toFixed(2))
                });
            });

            const statusSequence = statuses.slice(0, statuses.indexOf(status) + 1);
            statusSequence.forEach((s, idx) => {
                const timeOffset = idx * 30 * 60 * 1000;
                statusHistory.push({
                    id: 'history_' + (i * 10 + idx),
                    orderId: order.id,
                    status: s,
                    operator: technicians[Math.floor(Math.random() * technicians.length)].name,
                    timestamp: new Date(createdAt.getTime() + timeOffset).toISOString()
                });
            });
        }

        return { orders, orderItems, statusHistory };
    }

    function generateAll() {
        const vehicles = generateVehicles(200);
        const members = generateMembers(vehicles, 100);
        const { orders, orderItems, statusHistory } = generateOrders(vehicles, members, 1000);

        const defaultPackages = PackageService.getDefaultPackages();
        const packages = defaultPackages.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type,
            discountRate: p.discountRate,
            description: p.description,
            isActive: p.isActive,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }));

        const packageItems = [];
        defaultPackages.forEach(pkg => {
            pkg.items.forEach((item, idx) => {
                const category = item.id.startsWith('mt') ? 'maintenance' :
                    item.id.startsWith('rp') ? 'repair' : 'beauty';
                packageItems.push({
                    id: 'pkg_item_' + pkg.id + '_' + idx,
                    packageId: pkg.id,
                    category: category,
                    itemId: item.id,
                    itemName: item.name,
                    laborFee: item.laborFee,
                    materialFee: item.materialFee
                });
            });
        });

        return {
            stores: Helpers.getStores(),
            vehicles: vehicles,
            members: members,
            orders: orders,
            order_items: orderItems,
            packages: packages,
            package_items: packageItems,
            status_history: statusHistory,
            technicians: Helpers.getTechnicians(),
            service_items: Helpers.getServiceItems()
        };
    }

    function init() {
        if (!DataStore.hasData()) {
            Helpers.showLoading(true, '正在初始化数据...');
            setTimeout(() => {
                const data = generateAll();
                DataStore.loadInitialData(data);
                Helpers.showLoading(false);
                Helpers.showToast('数据初始化成功', 'success');
            }, 500);
        }
    }

    return {
        generateAll,
        generateMockData: generateAll,
        init,
        generateVehicles,
        generateMembers,
        generateOrders,
        generateRandomPlateNo,
        generateVin,
        generatePhone,
        generateName
    };
})();
