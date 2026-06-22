import { formatCurrency, formatDate } from './gold-price.js';

export function groupRecordsByDate(records) {
    const map = new Map();
    records.forEach(r => {
        const d = new Date(r.createdAt || Date.now());
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!map.has(key)) map.set(key, { date: key, count: 0, amount: 0 });
        const s = map.get(key);
        s.count++;
        s.amount += r.finalPrice || 0;
    });
    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    const labels = sorted.map(s => s.date.slice(5));
    const counts = sorted.map(s => s.count);
    const amounts = sorted.map(s => +s.amount.toFixed(2));
    return { labels, counts, amounts, raw: sorted };
}

export function groupRecordsByCategory(records) {
    const catMap = {
        gold: { name: '黄金K金', color: '#F59E0B', count: 0, amount: 0 },
        platinum: { name: '铂金钯金', color: '#94A3B8', count: 0, amount: 0 },
        diamond: { name: '钻石彩宝', color: '#0EA5E9', count: 0, amount: 0 },
        jade: { name: '翡翠和田玉', color: '#10B981', count: 0, amount: 0 },
        pearl: { name: '珍珠琥珀', color: '#F472B6', count: 0, amount: 0 }
    };
    records.forEach(r => {
        const c = r.category || 'gold';
        if (catMap[c]) {
            catMap[c].count++;
            catMap[c].amount += r.finalPrice || 0;
        }
    });
    const list = Object.entries(catMap).map(([k, v]) => ({
        key: k, name: v.name, color: v.color,
        count: v.count, amount: +v.amount.toFixed(2),
        value: v.count
    }));
    return {
        pie: list.filter(x => x.count > 0).map(x => ({ name: x.name, value: x.count, itemStyle: { color: x.color } })),
        detail: list
    };
}

export function groupByStore(records) {
    const storeNames = {
        store001: '001 南京路旗舰店', store002: '002 淮海路店', store003: '003 陆家嘴店',
        store004: '004 徐家汇店', store005: '005 五角场店', store006: '006 人民广场店',
        store007: '007 静安寺店', store008: '008 南京西路店', store009: '009 浦东八佰伴店',
        store010: '010 虹桥天地店', store011: '011 日月光店', store012: '012 IAPM店',
        store013: '013 环球港店', store014: '014 合生汇店', store015: '015 嘉里中心店',
        store016: '016 国金中心店', store017: '017 K11店', store018: '018 恒隆广场店'
    };
    const map = new Map();
    records.forEach(r => {
        const sid = r.storeId || 'store001';
        if (!map.has(sid)) map.set(sid, { storeId: sid, name: storeNames[sid] || sid, count: 0, amount: 0 });
        const s = map.get(sid);
        s.count++;
        s.amount += r.finalPrice || 0;
    });
    const list = Array.from(map.values())
        .sort((a, b) => b.amount - a.amount)
        .map(x => ({ ...x, amount: +x.amount.toFixed(2) }));
    return {
        ranking: list,
        bar: {
            labels: list.map(x => x.name.split(' ')[0]),
            counts: list.map(x => x.count),
            amounts: list.map(x => x.amount)
        }
    };
}

export function groupByInspector(records) {
    const map = new Map();
    records.forEach(r => {
        const ins = r.inspector || { id: 'UNK', name: '未知' };
        const id = ins.id || 'UNK';
        const name = ins.name || '未知';
        if (!map.has(id)) map.set(id, { id, name, count: 0, amount: 0, avgPrice: 0 });
        const s = map.get(id);
        s.count++;
        s.amount += r.finalPrice || 0;
    });
    const list = Array.from(map.values())
        .sort((a, b) => b.count - a.count)
        .map(x => ({ ...x, amount: +x.amount.toFixed(2), avgPrice: +(x.amount / (x.count || 1)).toFixed(2) }));
    return {
        inspectors: list,
        bar: {
            labels: list.map(x => x.name),
            counts: list.map(x => x.count),
            amounts: list.map(x => x.amount)
        }
    };
}

export function calcKpi(records, rangeRecords) {
    const total = records.length;
    const amount = +records.reduce((s, r) => s + (r.finalPrice || 0), 0).toFixed(2);
    const avgPrice = total ? +(amount / total).toFixed(2) : 0;
    const catStats = groupRecordsByCategory(records).detail;
    const topCat = catStats.sort((a, b) => b.amount - a.amount)[0] || null;
    const rangeTotal = rangeRecords?.length || 0;
    const growth = rangeTotal ? +((total - rangeTotal) / rangeTotal * 100).toFixed(1) : 0;
    return {
        totalRecords: total,
        totalAmount: amount,
        avgPrice,
        topCategory: topCat?.name || '--',
        growthRate: growth
    };
}

export function buildRecordsForExcel(records) {
    return records.map(r => ({
        '回收单号': r.orderNo || '',
        '门店': r.storeId || '',
        '登记时间': formatDate(r.createdAt),
        '顾客姓名': r.customer?.name || '',
        '联系电话': r.customer?.phone || '',
        '身份证号': r.customer?.idNo || '',
        '首饰品类': ({gold:'黄金K金',platinum:'铂金钯金',diamond:'钻石彩宝',jade:'翡翠和田玉',pearl:'珍珠琥珀'})[r.category] || r.category,
        '品牌/款式': r.jewelry?.brand || '',
        '材质纯度': r.jewelry?.purity || '',
        '重量(克)': r.jewelry?.weight || '',
        '钻石克拉': r.inspection?.diamond?.carat || '',
        '回收价(元)': r.finalPrice || 0,
        '状态': ({draft:'草稿',pending:'待审批',approved:'已批准',rejected:'已驳回',completed:'已完成'})[r.status] || r.status,
        '鉴定师': r.inspector?.name || '',
        '证书编号': r.certificate?.no || '',
        '备注': r.remark || ''
    }));
}

export function exportToExcel(records, filename = '回收记录.xlsx') {
    if (typeof XLSX === 'undefined') {
        console.error('[Report] XLSX库未加载');
        return false;
    }
    const data = buildRecordsForExcel(records);
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '回收记录');
    const summary = calcKpi(records);
    const summarySheet = XLSX.utils.json_to_sheet([
        { 指标: '总回收件数', 值: summary.totalRecords },
        { 指标: '总回收金额(元)', 值: summary.totalAmount },
        { 指标: '平均单价(元)', 值: summary.avgPrice },
        { 指标: '热门品类', 值: summary.topCategory },
        { 指标: '环比增长率(%)', 值: summary.growthRate }
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, '汇总统计');
    XLSX.writeFile(wb, filename);
    return true;
}

export function buildQuotePdfData(record) {
    return {
        orderNo: record.orderNo,
        date: formatDate(record.createdAt),
        store: record.storeId,
        inspector: record.inspector?.name || '',
        customer: {
            name: record.customer?.name || '',
            phone: record.customer?.phone || ''
        },
        jewelry: record.jewelry || {},
        categoryLabel: ({gold:'黄金K金',platinum:'铂金钯金',diamond:'钻石彩宝',jade:'翡翠和田玉',pearl:'珍珠琥珀'})[record.category] || record.category,
        inspection: record.inspection || {},
        price: record.priceDetail || { basePrice: 0, finalPrice: 0 },
        finalPrice: record.finalPrice || 0,
        finalPriceLabel: formatCurrency(record.finalPrice || 0),
        remark: record.remark || '',
        signature: {
            customer: '',
            inspector: record.inspector?.name || '',
            manager: record.approvedBy || ''
        }
    };
}

export function getDateRange(rangeKey, customRange) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    let start;
    switch (rangeKey) {
        case 'today':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            break;
        case 'week': {
            const d = new Date();
            d.setDate(d.getDate() - d.getDay());
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            break;
        }
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            break;
        case 'quarter': {
            const q = Math.floor(now.getMonth() / 3) * 3;
            start = new Date(now.getFullYear(), q, 1).getTime();
            break;
        }
        case 'custom':
            return {
                start: customRange?.start ? new Date(customRange.start).getTime() : null,
                end: customRange?.end ? (new Date(customRange.end).getTime() + 86399999) : null
            };
        default:
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).getTime();
    }
    return { start, end };
}

export default {
    groupRecordsByDate,
    groupRecordsByCategory,
    groupByStore,
    groupByInspector,
    calcKpi,
    buildRecordsForExcel,
    exportToExcel,
    buildQuotePdfData,
    getDateRange
};
