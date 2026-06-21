(function(global) {
    'use strict';

    var App = global.App || (global.App = {});

    var MEMBER_LEVELS = {
        normal:   { name: '普通会员',  discount: 1.0,  pointRate: 1.0,  color: '#6c757d' },
        silver:   { name: '银卡会员',  discount: 0.95, pointRate: 1.2,  color: '#6c757d' },
        gold:     { name: '金卡会员',  discount: 0.88, pointRate: 1.5,  color: '#ffc107' },
        diamond:  { name: '钻石会员',  discount: 0.82, pointRate: 2.0,  color: '#00bcd4' }
    };

    function getMemberLevel(level) {
        return MEMBER_LEVELS[level] || MEMBER_LEVELS.normal;
    }

    function getServiceTypeById(id) {
        var list = App.store.getServiceTypes();
        return list.find(function(t) { return t.id === id; });
    }

    function getPackageById(id) {
        var list = App.store.getPackages();
        return list.find(function(p) { return p.id === id; });
    }

    function estimatePriceByPet(serviceTypeId, pet) {
        var st = getServiceTypeById(serviceTypeId);
        if (!st) return { min: 0, max: 0, base: 0 };
        var weight = pet ? (pet.weight || 5) : 5;
        var range = st.priceMax - st.priceMin;
        var wfactor = Math.min(1, Math.max(0, (weight - 3) / 30));
        var base = Math.round(st.priceMin + range * wfactor);
        return {
            min: st.priceMin,
            max: st.priceMax,
            base: base
        };
    }

    function calculateService(serviceTypeId, pet, priceOverride) {
        var st = getServiceTypeById(serviceTypeId);
        if (!st) return null;
        var priceInfo = estimatePriceByPet(serviceTypeId, pet);
        var price = priceOverride || priceInfo.base;
        return {
            typeId: serviceTypeId,
            typeName: st.name,
            category: st.category,
            color: st.color,
            baseDuration: st.duration,
            duration: st.duration + (pet && pet.weight > 25 ? 15 : 0),
            unitPrice: price,
            quantity: 1,
            subtotal: price
        };
    }

    function calculatePackage(packageId, pet) {
        var pkg = getPackageById(packageId);
        if (!pkg) return null;
        var items = [];
        var subtotal = 0;
        var totalDuration = 0;
        pkg.services.forEach(function(sid) {
            var item = calculateService(sid, pet);
            if (item) {
                items.push(item);
                subtotal += item.subtotal;
                totalDuration += item.duration;
            }
        });
        var discountAmount = Math.round(subtotal * (1 - pkg.discount));
        var total = subtotal - discountAmount;
        return {
            packageId: packageId,
            packageName: pkg.name,
            packageDesc: pkg.desc,
            items: items,
            subtotal: subtotal,
            discount: pkg.discount,
            discountAmount: discountAmount,
            total: total,
            duration: totalDuration
        };
    }

    function calculateCheckout(items, packageResult, customer) {
        var subtotal = 0;
        var totalDuration = 0;
        var processedItems = [];

        if (packageResult) {
            subtotal += packageResult.total;
            totalDuration += packageResult.duration;
            packageResult.items.forEach(function(it) {
                processedItems.push({
                    type: 'package-item',
                    parentName: packageResult.packageName,
                    name: it.typeName,
                    category: it.category,
                    color: it.color,
                    duration: it.duration,
                    price: it.unitPrice,
                    quantity: 1,
                    subtotal: it.subtotal
                });
            });
        }

        if (items && items.length) {
            items.forEach(function(it) {
                var sv = calculateService(it.typeId, it.pet, it.price);
                if (sv) {
                    if (it.adjust && it.adjust !== 0) {
                        sv.unitPrice = Math.max(0, sv.unitPrice + it.adjust);
                        sv.subtotal = sv.unitPrice * sv.quantity;
                    }
                    subtotal += sv.subtotal;
                    totalDuration += sv.duration;
                    processedItems.push({
                        type: 'single',
                        name: sv.typeName,
                        category: sv.category,
                        color: sv.color,
                        duration: sv.duration,
                        price: sv.unitPrice,
                        quantity: sv.quantity,
                        subtotal: sv.subtotal
                    });
                }
            });
        }

        var levelInfo = customer ? getMemberLevel(customer.memberLevel) : getMemberLevel('normal');
        var memberDiscount = 1;
        var memberDiscountAmount = 0;
        if (customer) {
            memberDiscount = levelInfo.discount;
            memberDiscountAmount = Math.round(subtotal * (1 - memberDiscount));
        }

        var afterMemberDiscount = subtotal - memberDiscountAmount;

        var manualDiscountAmount = 0;
        var finalTotal = afterMemberDiscount - manualDiscountAmount;
        finalTotal = Math.max(0, finalTotal);

        var pointsEarned = Math.floor(finalTotal * levelInfo.pointRate / 10);

        return {
            items: processedItems,
            packageApplied: packageResult ? {
                id: packageResult.packageId,
                name: packageResult.packageName,
                subtotal: packageResult.subtotal,
                discountAmount: packageResult.discountAmount
            } : null,
            subtotal: subtotal,
            memberLevel: customer ? customer.memberLevel : 'normal',
            memberLevelName: levelInfo.name,
            memberDiscount: memberDiscount,
            memberDiscountAmount: memberDiscountAmount,
            afterMemberDiscount: afterMemberDiscount,
            manualDiscountAmount: manualDiscountAmount,
            finalTotal: Math.round(finalTotal * 100) / 100,
            duration: totalDuration,
            pointsEarned: pointsEarned,
            pointRate: levelInfo.pointRate,
            levelColor: levelInfo.color
        };
    }

    function applyPayment(customer, finalTotal, useBalance, usePoints) {
        var usePointsVal = usePoints || 0;
        var balance = customer ? Number(customer.balance) : 0;
        var points = customer ? Number(customer.points) : 0;

        var result = {
            total: finalTotal,
            pointsUsed: 0,
            pointsDeducted: 0,
            balanceUsed: 0,
            remainingToPay: finalTotal
        };

        if (usePoints && usePointsVal > 0 && points > 0) {
            var availablePoints = Math.min(usePointsVal, points);
            var pointValue = availablePoints * 0.01;
            if (pointValue >= result.remainingToPay) {
                var useAllPoints = Math.ceil(result.remainingToPay / 0.01);
                result.pointsUsed = useAllPoints;
                result.pointsDeducted = Math.ceil(result.remainingToPay / 0.01);
                result.remainingToPay = 0;
            } else {
                result.pointsUsed = availablePoints;
                result.pointsDeducted = availablePoints;
                result.remainingToPay = Math.round((result.remainingToPay - pointValue) * 100) / 100;
            }
        }

        if (useBalance && balance > 0 && result.remainingToPay > 0) {
            if (balance >= result.remainingToPay) {
                result.balanceUsed = result.remainingToPay;
                result.remainingToPay = 0;
            } else {
                result.balanceUsed = balance;
                result.remainingToPay = Math.round((result.remainingToPay - balance) * 100) / 100;
            }
        }

        return result;
    }

    function recommendPackages(pet, historyServices) {
        if (!pet) return [];
        var allPkgs = App.store.getPackages({ petType: pet.species, breed: pet.breed });
        var recentTypes = {};
        (historyServices || []).forEach(function(s) {
            recentTypes[s.type] = (recentTypes[s.type] || 0) + 1;
        });

        var score = function(pkg) {
            var s = 0;
            if (pkg.breed && pkg.breed.length) {
                var matchBreed = pkg.breed.some(function(b) {
                    return pet.breed && pet.breed.toLowerCase().indexOf(b.toLowerCase()) >= 0;
                });
                if (matchBreed) s += 50;
            }
            if (pkg.petType && pkg.petType.indexOf(pet.species) >= 0) s += 20;
            pkg.services.forEach(function(sid) {
                if (recentTypes[sid]) s += recentTypes[sid] * 10;
            });
            return s;
        };

        allPkgs.sort(function(a, b) { return score(b) - score(a); });
        return allPkgs.slice(0, 3).map(function(pkg) {
            var calc = calculatePackage(pkg.id, pet);
            return {
                id: pkg.id,
                name: pkg.name,
                desc: pkg.desc,
                services: pkg.services.map(function(sid) {
                    var st = getServiceTypeById(sid);
                    return st ? st.name : sid;
                }),
                originalPrice: calc ? calc.subtotal : 0,
                discountPrice: calc ? calc.total : 0,
                discount: pkg.discount,
                duration: calc ? calc.duration : 0,
                score: score(pkg)
            };
        });
    }

    function estimateWaitTime(services, groomers, currentStoreId, dateStr) {
        var groomerLoad = {};
        groomers.forEach(function(g) {
            if (g.storeId !== currentStoreId) return;
            groomerLoad[g.id] = { groomer: g, tasks: [], minutesWorked: 0 };
        });

        var now = new Date();
        var today = dateStr || now.toISOString().slice(0, 10);

        (services || []).forEach(function(s) {
            if (!groomerLoad[s.groomerId]) return;
            if (s.status === 'completed') return;
            var sDate = s.startTime.split(' ')[0];
            if (sDate !== today) return;
            groomerLoad[s.groomerId].tasks.push(s);
            groomerLoad[s.groomerId].minutesWorked += s.duration || 60;
        });

        Object.keys(groomerLoad).forEach(function(gid) {
            var info = groomerLoad[gid];
            info.loadRate = Math.min(100, Math.round(info.minutesWorked / 480 * 100));
            info.freeMinutes = Math.max(0, 480 - info.minutesWorked);
            info.avgWait = info.minutesWorked > 0 ? Math.round(info.minutesWorked / info.tasks.length) : 0;
        });

        var avgLoad = 0;
        var totalFree = 0;
        var arr = Object.values(groomerLoad);
        arr.forEach(function(g) { avgLoad += g.loadRate; totalFree += g.freeMinutes; });
        if (arr.length) { avgLoad = Math.round(avgLoad / arr.length); }

        var queueLength = arr.reduce(function(sum, g) { return sum + g.tasks.filter(function(t) { return t.status === 'pending'; }).length; }, 0);
        var estWait = queueLength > 0 && arr.length ? Math.round(queueLength * 60 / arr.length) : 0;

        return {
            groomers: groomerLoad,
            avgLoad: avgLoad,
            totalFreeMinutes: totalFree,
            queueLength: queueLength,
            estimatedWaitMinutes: estWait
        };
    }

    function formatMinutes(min) {
        if (min < 60) return min + '分钟';
        var h = Math.floor(min / 60);
        var m = min % 60;
        return h + '小时' + (m > 0 ? m + '分钟' : '');
    }

    function formatMoney(n) {
        return '¥' + (Number(n) || 0).toFixed(2);
    }

    function getLevelBadge(level) {
        var info = getMemberLevel(level);
        return '<span class="badge" style="background-color:' + info.color + ';">' + info.name + '</span>';
    }

    App.calculator = {
        getMemberLevel: getMemberLevel,
        MEMBER_LEVELS: MEMBER_LEVELS,
        estimatePriceByPet: estimatePriceByPet,
        calculateService: calculateService,
        calculatePackage: calculatePackage,
        calculateCheckout: calculateCheckout,
        applyPayment: applyPayment,
        recommendPackages: recommendPackages,
        estimateWaitTime: estimateWaitTime,
        formatMinutes: formatMinutes,
        formatMoney: formatMoney,
        getLevelBadge: getLevelBadge
    };

})(typeof window !== 'undefined' ? window : this);
