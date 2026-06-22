export const GOLD_FETCH_INTERVAL = 5 * 60 * 1000;

const SOURCES = [
    {
        name: '上海黄金交易所(SGE)模拟接口',
        fetch: async () => {
            await new Promise(r => setTimeout(r, 380 + Math.random() * 220));
            const seed = 725 + Math.sin(Date.now() / 86400000 * Math.PI) * 25;
            const noise = () => (Math.random() - 0.5) * 4;
            return {
                au9999: +(seed + 5 + noise()).toFixed(2),
                au9995: +(seed + 3 + noise()).toFixed(2),
                pt950:  +(seed * 1.18 + noise()).toFixed(2),
                pd999:  +(seed * 1.45 + noise() * 3).toFixed(2),
                source: 'SGE',
                currency: 'CNY',
                unit: 'yuan/gram'
            };
        }
    },
    {
        name: '备用数据源',
        fetch: async () => {
            await new Promise(r => setTimeout(r, 200));
            const base = 735 + (Math.random() - 0.5) * 8;
            return {
                au9999: +(base).toFixed(2),
                au9995: +(base - 2).toFixed(2),
                pt950:  +(base * 1.15).toFixed(2),
                pd999:  +(base * 1.42).toFixed(2),
                source: 'LOCAL_MOCK',
                currency: 'CNY',
                unit: 'yuan/gram'
            };
        }
    }
];

export class GoldPriceFetcher {
    constructor(store) {
        this.store = store;
        this._timer = null;
        this._running = false;
    }

    async fetchOnce() {
        const t0 = performance.now();
        let error = null;
        for (const src of SOURCES) {
            try {
                const data = await src.fetch();
                const t1 = performance.now();
                console.debug(`[GoldPrice] 数据源 ${src.name} 抓取成功, 耗时 ${(t1 - t0).toFixed(0)}ms`);
                await this.store.saveGoldPrices(data);
                return { success: true, data, source: src.name };
            } catch (e) {
                console.warn(`[GoldPrice] 数据源 ${src.name} 失败:`, e.message);
                error = e;
            }
        }
        const fallback = this.store.getState().goldPrices;
        if (fallback && fallback.au9999) {
            console.warn('[GoldPrice] 使用缓存金价');
            return { success: true, data: fallback, source: 'CACHE' };
        }
        const def = { au9999: 738.50, au9995: 736.20, pt950: 848.00, pd999: 1062.00, source: 'DEFAULT', currency: 'CNY', unit: 'yuan/gram' };
        await this.store.saveGoldPrices(def);
        return { success: false, data: def, error };
    }

    start(intervalMs = GOLD_FETCH_INTERVAL) {
        if (this._running) return;
        this._running = true;
        this.fetchOnce();
        this._timer = setInterval(() => this.fetchOnce(), intervalMs);
        console.info(`[GoldPrice] 自动抓取已启动, 间隔 ${intervalMs / 60000} 分钟`);
    }

    stop() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
        this._running = false;
    }
}

export function getDepreciationRate(purity, depreciationConfig) {
    const cfg = depreciationConfig || {};
    const key = String(purity || '').toUpperCase();
    if (cfg[key]) return cfg[key];
    const map = {
        '9999': 0.98, 'AU9999': 0.98, '足金999.9': 0.98,
        '9995': 0.97, 'AU9995': 0.97, '足金999.5': 0.97,
        '999': 0.96, 'AU999': 0.96, '千足金': 0.96, '足金': 0.95,
        '990': 0.95, 'AU990': 0.95,
        '916': 0.90, '22K': 0.90, 'AU916': 0.90,
        '750': 0.80, '18K': 0.80, 'AU750': 0.80, 'G750': 0.80,
        '585': 0.65, '14K': 0.65, 'AU585': 0.65,
        'PT950': 0.95, '950铂': 0.95,
        'PT900': 0.90, '900铂': 0.90,
        'PD950': 0.92, 'PD999': 0.94
    };
    if (map[key]) return map[key];
    for (const [k, v] of Object.entries(map)) {
        if (key.includes(k)) return v;
    }
    return 0.75;
}

export function getPurityCategory(category, purity) {
    const p = String(purity || '').toLowerCase();
    if (category === 'gold') {
        if (p.includes('9999') || p.includes('999.9')) return '9999';
        if (p.includes('9995') || p.includes('999.5')) return '9995';
        if (p.includes('999') || p.includes('千足金') || p.includes('足金999')) return '999';
        if (p.includes('990') || p.includes('足金')) return '990';
        if (p.includes('916') || p.includes('22k')) return '916';
        if (p.includes('750') || p.includes('18k')) return '750';
        if (p.includes('585') || p.includes('14k')) return '585';
        return '750';
    }
    if (category === 'platinum') {
        if (p.includes('950')) return 'PT950';
        if (p.includes('900')) return 'PT900';
        return 'PT950';
    }
    if (category === 'palladium') {
        if (p.includes('999')) return 'PD999';
        return 'PD950';
    }
    return purity || '999';
}

export function formatCurrency(amount) {
    const n = Number(amount) || 0;
    return n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export function parseDiamondRapaport(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    const result = {};
    const headers = lines[0].split(/[,\t]/).map(s => s.trim());
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,\t]/).map(s => s.trim());
        if (cols.length < 3) continue;
        const [weight, color, clarity, price] = cols;
        const key = `${Number(weight).toFixed(2)}|${color.toUpperCase()}|${clarity.toUpperCase()}`;
        result[key] = Number(price) || 0;
    }
    return result;
}

export default GoldPriceFetcher;
