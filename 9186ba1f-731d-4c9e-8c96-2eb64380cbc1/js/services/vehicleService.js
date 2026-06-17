const VehicleService = (function() {
    function create(vehicleData) {
        const plateValidation = Validator.validatePlateNo(vehicleData.plateNo);
        if (!plateValidation.valid) {
            throw new Error(plateValidation.message);
        }

        const phoneValidation = Validator.validatePhone(vehicleData.ownerPhone);
        if (!phoneValidation.valid) {
            throw new Error(phoneValidation.message);
        }

        if (vehicleData.vin) {
            const vinValidation = Validator.validateVin(vehicleData.vin);
            if (!vinValidation.valid) {
                throw new Error(vinValidation.message);
            }
        }

        const mileageValidation = Validator.validateMileage(vehicleData.mileage);
        if (!mileageValidation.valid) {
            throw new Error(mileageValidation.message);
        }

        const existing = DataStore.findByIndex('vehicles', 'byPlateNo', vehicleData.plateNo.toUpperCase());
        if (existing) {
            throw new Error('该车牌号已存在');
        }

        vehicleData.plateNo = vehicleData.plateNo.toUpperCase().replace(/\s/g, '');
        if (vehicleData.vin) {
            vehicleData.vin = vehicleData.vin.toUpperCase().replace(/\s/g, '');
        }
        vehicleData.ownerPhone = vehicleData.ownerPhone.replace(/\s/g, '');
        vehicleData.mileage = parseInt(vehicleData.mileage, 10);

        const startTime = performance.now();
        const vehicle = DataStore.create('vehicles', vehicleData);
        const elapsed = performance.now() - startTime;

        if (elapsed > 500) {
            console.warn('Vehicle save took', elapsed, 'ms, exceeds 500ms limit');
        }

        return vehicle;
    }

    function update(id, vehicleData) {
        if (vehicleData.plateNo) {
            const plateValidation = Validator.validatePlateNo(vehicleData.plateNo);
            if (!plateValidation.valid) {
                throw new Error(plateValidation.message);
            }
            vehicleData.plateNo = vehicleData.plateNo.toUpperCase().replace(/\s/g, '');
        }

        if (vehicleData.ownerPhone) {
            const phoneValidation = Validator.validatePhone(vehicleData.ownerPhone);
            if (!phoneValidation.valid) {
                throw new Error(phoneValidation.message);
            }
            vehicleData.ownerPhone = vehicleData.ownerPhone.replace(/\s/g, '');
        }

        if (vehicleData.vin) {
            const vinValidation = Validator.validateVin(vehicleData.vin);
            if (!vinValidation.valid) {
                throw new Error(vinValidation.message);
            }
            vehicleData.vin = vehicleData.vin.toUpperCase().replace(/\s/g, '');
        }

        if (vehicleData.mileage !== undefined && vehicleData.mileage !== '') {
            const mileageValidation = Validator.validateMileage(vehicleData.mileage);
            if (!mileageValidation.valid) {
                throw new Error(mileageValidation.message);
            }
            vehicleData.mileage = parseInt(vehicleData.mileage, 10);
        }

        return DataStore.update('vehicles', id, vehicleData);
    }

    function remove(id) {
        const orders = DataStore.findByIndex('orders', 'byVehicleId', id);
        if (orders && orders.length > 0) {
            throw new Error('该车辆存在关联工单，无法删除');
        }
        return DataStore.remove('vehicles', id);
    }

    function findByPlateNo(plateNo) {
        const startTime = performance.now();
        plateNo = plateNo.toUpperCase().replace(/\s/g, '');
        const result = DataStore.findByIndex('vehicles', 'byPlateNo', plateNo);
        const elapsed = performance.now() - startTime;

        if (elapsed > 200) {
            console.warn('Vehicle search took', elapsed, 'ms, exceeds 200ms limit');
        }

        return result;
    }

    function search(keyword) {
        return DataStore.searchVehicles(keyword);
    }

    function findById(id) {
        return DataStore.findById('vehicles', id);
    }

    function findAll(filters = {}) {
        return DataStore.findAll('vehicles', filters);
    }

    function getLastService(vehicleId) {
        const orders = DataStore.findByIndex('orders', 'byVehicleId', vehicleId);
        if (!orders || orders.length === 0) {
            return null;
        }

        const completedOrders = orders
            .filter(o => o.status === 'completed')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (completedOrders.length === 0) {
            return null;
        }

        const lastOrder = completedOrders[0];
        const orderItems = DataStore.indexes.orderItems.byOrderId.get(lastOrder.id) || [];

        return {
            date: lastOrder.updatedAt,
            orderId: lastOrder.id,
            items: orderItems.map(item => item.itemName),
            totalAmount: lastOrder.actualAmount
        };
    }

    function getServiceHistory(vehicleId, limit = 10) {
        const orders = DataStore.findByIndex('orders', 'byVehicleId', vehicleId);
        if (!orders || orders.length === 0) {
            return [];
        }

        return orders
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit)
            .map(order => {
                const items = DataStore.indexes.orderItems.byOrderId.get(order.id) || [];
                return {
                    ...order,
                    items: items,
                    statusText: Helpers.getStatusText(order.status),
                    statusClass: Helpers.getStatusClass(order.status)
                };
            });
    }

    function getCount() {
        return DataStore.findAll('vehicles').length;
    }

    function getBrandDistribution() {
        const vehicles = DataStore.findAll('vehicles');
        const distribution = {};

        vehicles.forEach(v => {
            const brand = v.brand || '未知';
            distribution[brand] = (distribution[brand] || 0) + 1;
        });

        return Object.entries(distribution)
            .map(([brand, count]) => ({ brand, count }))
            .sort((a, b) => b.count - a.count);
    }

    return {
        create,
        update,
        remove,
        findByPlateNo,
        search,
        findById,
        findAll,
        getLastService,
        getServiceHistory,
        getCount,
        getBrandDistribution
    };
})();
