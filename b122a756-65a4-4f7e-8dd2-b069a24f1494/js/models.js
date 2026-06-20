var Models = (function () {
  var CATEGORIES = ['欧包', '吐司', '蛋糕', '酥点', '饼干'];
  var CAT_COLORS = {
    '欧包': '#C0392B', '吐司': '#E67E22', '蛋糕': '#8E44AD',
    '酥点': '#2980B9', '饼干': '#27AE60'
  };
  var CAT_EMOJI = {
    '欧包': '🥖', '吐司': '🍞', '蛋糕': '🍰', '酥点': '🥐', '饼干': '🍪'
  };
  var RECHARGE_TIERS = [
    { amount: 300, bonus: 30 },
    { amount: 500, bonus: 60 },
    { amount: 1000, bonus: 150 }
  ];
  var MATERIAL_BASE = [
    { id: 'mat_001', name: '高筋面粉', unit: 'kg', unit_price: 8.5, category: '面粉' },
    { id: 'mat_002', name: '低筋面粉', unit: 'kg', unit_price: 7.8, category: '面粉' },
    { id: 'mat_003', name: '黄油', unit: 'kg', unit_price: 45.0, category: '油脂' },
    { id: 'mat_004', name: '淡奶油', unit: 'L', unit_price: 38.0, category: '乳制品' },
    { id: 'mat_005', name: '细砂糖', unit: 'kg', unit_price: 6.5, category: '糖' },
    { id: 'mat_006', name: '鸡蛋', unit: 'kg', unit_price: 12.0, category: '蛋' },
    { id: 'mat_007', name: '干酵母', unit: 'kg', unit_price: 28.0, category: '酵母' },
    { id: 'mat_008', name: '牛奶', unit: 'L', unit_price: 8.5, category: '乳制品' },
    { id: 'mat_009', name: '盐', unit: 'kg', unit_price: 3.5, category: '调味' },
    { id: 'mat_010', name: '巧克力', unit: 'kg', unit_price: 55.0, category: '原料' },
    { id: 'mat_011', name: '芝士', unit: 'kg', unit_price: 42.0, category: '乳制品' },
    { id: 'mat_012', name: '果干', unit: 'kg', unit_price: 35.0, category: '原料' },
    { id: 'mat_013', name: '坚果', unit: 'kg', unit_price: 65.0, category: '原料' },
    { id: 'mat_014', name: '蜂蜜', unit: 'kg', unit_price: 28.0, category: '糖' },
    { id: 'mat_015', name: '香草精', unit: 'L', unit_price: 120.0, category: '调味' }
  ];
  var WEATHER_FACTORS = {
    sunny:    { name: '晴天',   factor: 1.05, icon: '☀️' },
    cloudy:   { name: '多云',   factor: 1.00, icon: '⛅' },
    rainy:    { name: '雨天',   factor: 0.85, icon: '🌧️' },
    snowy:    { name: '雪天',   factor: 0.70, icon: '❄️' },
    weekend:  { name: '周末',   factor: 1.15, icon: '📅' },
    holiday:  { name: '节假日', factor: 1.30, icon: '🎊' }
  };
  var HOLIDAYS = ['01-01','02-10','02-11','02-12','04-04','05-01','06-10','10-01','10-02','10-03','12-25'];
  var PROCESS_MATERIAL_MAP = {
    '面团制作': [['mat_001', 0.5], ['mat_003', 0.1], ['mat_005', 0.08], ['mat_007', 0.01]],
    '基础发酵': [],
    '整形': [],
    '最后发酵': [],
    '烘焙': [],
    '冷却装饰': [['mat_010', 0.05]],
    '发酵': [],
    '成型': [],
    '装饰': [['mat_004', 0.1]],
    '配料': [['mat_002', 0.4], ['mat_006', 0.15]],
    '搅拌': [['mat_003', 0.08]],
    '原料准备': [['mat_001', 0.3], ['mat_005', 0.05]]
  };
  var PY_MAP = {
    '法':'f','棍':'g','巧':'q','可':'k','力':'l','颂':'s','吐':'t','司':'s',
    '奶':'n','油':'y','蛋':'d','糕':'g','卷':'j','芝':'z','士':'s','芒':'m',
    '果':'g','水':'s','红':'h','提':'t','米':'m','布':'b','丁':'d','千':'q',
    '层':'c','贝':'b','黑':'h','森':'s','林':'l','角':'j','餐':'c','包':'b',
    '蒜':'s','香':'x','肠':'c','烤':'k','肉':'r','桂':'g','花':'h','生':'s',
    '日':'r','式':'s','麦':'m','核':'h','桃':'t','葡':'p','蓝':'l','莓':'m',
    '酸':'s','酪':'l','抹':'m','茶':'c','绿':'l','豆':'d','沙':'s','糖':'t',
    '酥':'s','脆':'c','软':'r','心':'x','饼':'b','干':'g','奇':'q','曲':'q',
    '黄':'h','油':'y','蜂':'f','蜜':'m','盐':'y','咸':'x','甜':'t','味':'w',
    '多':'d','料':'l','牛':'n','薯':'s','芋':'y','头':'t','圈':'q','结':'j',
    '榴':'l','莲':'l','马':'m','芬':'f','泡':'p','芙':'f','蓉':'r','松':'s',
    '枣':'z','泥':'n','朗':'l','姆':'m','巴':'b','里':'l','奥':'a','原':'y',
    '村':'cn','乡':'x','全':'q','麦':'m','酒':'j','乡':'x','紫':'z','薯':'s',
    '蔓':'m','越':'y','越':'y','培':'p','根':'gn','榴':'l','芝':'z','麻':'m',
    '红':'h','茶':'c','玉':'y','米':'m','墨':'mo','鱼':'y','南':'n','瓜':'g',
    '芋':'y','头':'t','咸':'x','蛋':'d','火':'h','腿':'t','凤':'f','梨':'l',
    '新':'x','鲜':'x','芒':'m','百':'bi','草':'c','无':'w','花':'h','生':'sh',
    '枫':'f','糖':'t','核':'h','桃':'t','古':'gu','早':'z','风':'f','梨':'l',
    '拿':'n','破':'p','仑':'l','半':'bn','熟':'sh','切':'q','片':'p','装':'zh',
    '盒':'h','个':'g','寸':'c','流':'l','脏':'z','脏':'z','丹':'dn','麦':'m',
    '老':'lo','公':'g','老':'lo','婆':'p','鲜':'x','花':'h','太':'ti','阳':'y',
    '威':'w','化':'h','夹':'j','坚':'ji','海':'hi','苔':'ti','燕':'y','麦':'m',
    '手':'sh','指':'z','瓦':'w','龙':'lo','蛋':'d','挞':'t','椰':'y','蓉':'r',
    '杏':'x','仁':'r','碧':'b','根':'g','柠':'n','檬':'m','可':'k','乐':'l',
    '咖':'k','啡':'f','巧':'q','克':'k','力':'l','抹':'m','茶':'c','薄':'bo',
    '荷':'h','草':'c','酒':'ji','精':'j','食':'sh','盐':'y','燕':'y','麦':'m',
    '蔬':'sh','菜':'c','果':'g','仁':'r','碎':'s','拉':'l','丁':'d','奶':'n',
    '盖':'g','酱':'j','香':'x','草':'c','芒':'m','果':'g','百':'b','合':'h',
    '凤':'f','梨':'l','苹':'p','果':'g','草':'c','莓':'m','芒':'m','果':'g',
    '蓝':'l','莓':'m','树':'sh','莓':'m','覆':'f','盆':'p','子':'z','桑':'s',
    '葚':'sh','石':'sh','榴':'l','百':'b','香':'x','果':'g','木':'m','瓜':'g',
    '黄':'h','瓜':'g','葡':'p','萄':'t','柠':'n','檬':'m','橘':'j','子':'z',
    '柚':'y','子':'z','橙':'ch','子':'z','柠':'n','檬':'m','可':'k','口':'k',
    '可':'k','乐':'l','雪':'x','碧':'b','芬':'f','达':'d','醒':'x','目':'m',
    '动':'d','物':'w','饼':'b','加':'ji','菲':'f','猫':'m','史':'sh','努':'n',
    '比':'b','':'','':'','':'','':'','':'','':''
  };

  function pinyinOf(name) {
    var py = '';
    for (var i = 0; i < name.length; i++) {
      var ch = name.charAt(i);
      var c = ch.charCodeAt(0);
      if (c >= 0x4e00 && c <= 0x9fa5) {
        py += (PY_MAP[ch] || (String.fromCharCode(97 + ((c * 13) % 26))));
      } else {
        py += ch.toLowerCase();
      }
    }
    return py;
  }

  function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
  }

  function validateDate(d) {
    if (!d) return false;
    var t = new Date(d).getTime();
    return !isNaN(t);
  }

  function validateNumber(n, min, max) {
    if (n === null || n === undefined || isNaN(n)) return false;
    if (min !== undefined && Number(n) < min) return false;
    if (max !== undefined && Number(n) > max) return false;
    return true;
  }

  function calcRechargeBonus(amount) {
    var bonus = 0;
    amount = Number(amount) || 0;
    RECHARGE_TIERS.forEach(function (t) {
      if (amount >= t.amount && t.bonus > bonus) bonus = t.bonus;
    });
    return bonus;
  }

  function genProducts() {
    var products = [];
    var processes = [];
    var idx = 0;
    var groups = [
      { cat: '欧包', names: [
        ['法棍',18,6,240],['蒜香法棍',22,8,240],['乡村面包',28,10,260],['红酒桂圆',32,12,300],
        ['巧克力软欧',26,10,240],['抹茶红豆',28,11,240],['紫薯软欧',25,9,240],['蔓越莓核桃',30,11,260],
        ['芝士培根',32,13,240],['芝士软欧',28,10,240],['榴莲软欧',35,14,260],['黑芝麻麻薯',22,8,180],
        ['红茶奶酥',26,10,240],['玉米芝士',28,11,240],['墨鱼芝士',30,12,260],['南瓜软欧',24,9,240],
        ['芋头麻薯',22,8,240],['培根芝士',28,11,240],['黑麦核桃',32,13,300],['无花果欧包',35,14,300],
        ['酸种面包',28,10,360],['黑森林欧包',30,11,280],['海盐黄油',26,10,240],['全麦欧包',20,7,240]
      ]},
      { cat: '吐司', names: [
        ['原味吐司',22,7,240],['牛奶吐司',25,8,240],['全麦吐司',24,8,240],['紫薯吐司',26,9,240],
        ['红豆吐司',26,9,240],['葡萄干吐司',26,9,240],['椰蓉吐司',28,10,240],['巧克力吐司',28,10,240],
        ['奶酥吐司',30,11,240],['肉松吐司',32,12,240],['芝士吐司',30,11,240],['南瓜吐司',26,9,240],
        ['抹茶红豆吐司',30,11,240],['麻薯吐司',32,12,240],['芋泥吐司',30,11,240],['枫糖核桃吐司',32,12,240],
        ['黑糖麻薯吐司',32,12,240],['花生酱吐司',28,10,240],['卡仕达吐司',30,11,240],['花生巧克力吐司',35,13,240],
        ['咸蛋吐司',32,12,240],['芝士火腿吐司',35,13,240],['蓝莓吐司',30,11,240],['奥利奥奶酥吐司',35,13,240]
      ]},
      { cat: '蛋糕', names: [
        ['奶油蛋糕(6寸)',128,50,60],['水果蛋糕(6寸)',158,60,60],['黑森林蛋糕(6寸)',168,65,80],
        ['提拉米苏',38,15,40],['芝士蛋糕',42,16,60],['慕斯蛋糕',36,14,40],['芒果蛋糕',45,18,60],
        ['草莓蛋糕',42,17,60],['抹茶千层',38,15,30],['巧克力熔岩',32,12,30],['红丝绒蛋糕',45,18,45],
        ['榴莲千层',58,25,60],['巴斯克芝士',38,14,50],['舒芙蕾',35,13,25],['舒芙蕾芝士',42,16,60],
        ['抹茶卷',28,10,35],['虎皮卷',32,12,30],['瑞士卷',22,8,30],['北海道蛋糕',35,13,40],
        ['古早蛋糕',28,10,50],['半熟芝士(4个)',38,14,25],['戚风蛋糕',68,28,45],['拿破仑',38,15,60],
        ['歌剧院蛋糕',52,20,45]
      ]},
      { cat: '酥点', names: [
        ['原味可颂',15,5,40],['巧克力可颂',18,6,45],['黄油可颂',16,5,40],['杏仁可颂',20,7,50],
        ['芝士可颂',18,6,45],['肉松可颂',20,7,45],['流心可颂',22,8,50],['脏脏包',22,8,45],
        ['黄油牛角包',15,5,40],['丹麦酥',16,5,40],['水果丹麦',18,6,45],['芝士丹麦',18,6,45],
        ['焦糖可颂',18,6,45],['抹茶可颂',20,7,45],['芋泥酥',15,5,45],['红豆酥',15,5,40],
        ['老婆饼',12,4,30],['老公饼',12,4,30],['蛋黄酥',15,6,40],['流心蛋黄酥',18,7,40],
        ['榴莲酥',18,7,45],['凤梨酥',16,6,30],['鲜花饼',16,6,30],['太阳饼',14,5,40]
      ]},
      { cat: '饼干', names: [
        ['原味曲奇(盒)',28,8,20],['巧克力曲奇(盒)',32,10,20],['抹茶曲奇(盒)',30,9,20],
        ['蔓越莓曲奇(盒)',30,9,20],['黄油曲奇(盒)',35,11,20],['芝士曲奇(盒)',32,10,20],
        ['椰蓉曲奇(盒)',30,9,20],['杏仁瓦片(盒)',38,12,20],['玛格丽特(盒)',28,9,20],
        ['马卡龙(6个)',48,18,30],['蛋白糖(盒)',25,8,30],['手指饼干(盒)',22,7,25],
        ['燕麦饼干(盒)',26,8,20],['焦糖饼干(盒)',22,7,20],['全麦苏打(盒)',20,6,20],
        ['海苔苏打(盒)',22,7,20],['芝士苏打(盒)',22,7,20],['巧克力夹心(盒)',35,11,25],
        ['夹心饼干(盒)',28,9,20],['威化饼干(盒)',25,8,20],['凤梨酥饼干(盒)',30,10,20],
        ['坚果饼干(盒)',38,13,25],['抹茶夹心',28,9,20],['牛奶饼干(盒)',25,8,20]
      ]}
    ];
    groups.forEach(function (g) {
      g.names.forEach(function (item) {
        idx++;
        var skuId = 'sku_' + String(idx).padStart(3, '0');
        products.push({
          id: skuId, name: item[0],
          barcode: '69' + String(1000000 + idx),
          pinyin: pinyinOf(item[0]),
          category: g.cat, price: item[1], cost: item[2],
          image: CAT_EMOJI[g.cat]
        });
        makeProcesses(skuId, item[3]).forEach(function (p) { processes.push(p); });
      });
    });
    return { products: products, processes: processes };
  }

  function getProcessMaterials(processName) {
    return PROCESS_MATERIAL_MAP[processName] || [];
  }

  function makeProcesses(skuId, fermentMin) {
    var defs;
    if (fermentMin >= 200) {
      defs = [
        { n:'面团制作', d:20, r:null, i:1 },
        { n:'基础发酵', d:fermentMin, r:'fermenter', i:2 },
        { n:'整形', d:15, r:null, i:3 },
        { n:'最后发酵', d:60, r:'fermenter', i:4 },
        { n:'烘焙', d:25, r:'oven', i:5 },
        { n:'冷却装饰', d:20, r:null, i:6 }
      ];
    } else if (fermentMin >= 60) {
      defs = [
        { n:'面团制作', d:15, r:null, i:1 },
        { n:'发酵', d:fermentMin, r:'fermenter', i:2 },
        { n:'成型', d:10, r:null, i:3 },
        { n:'烘焙', d:30, r:'oven', i:4 },
        { n:'装饰', d:20, r:null, i:5 }
      ];
    } else {
      defs = [
        { n:'配料', d:10, r:null, i:1 },
        { n:'搅拌', d: fermentMin > 30 ? 15 : 10, r:null, i:2 },
        { n:'成型', d:15, r:null, i:3 },
        { n:'烘焙', d: fermentMin > 30 ? 20 : 12, r:'oven', i:4 }
      ];
    }
    return defs.map(function (d) {
      return {
        id: 'proc_' + skuId + '_' + d.i,
        sku_id: skuId, name: d.n, duration_min: d.d,
        resource_type: d.r, order_index: d.i,
        material_consumption: getProcessMaterials(d.n)
      };
    });
  }

  function createSeedData() {
    var stores = [
      { id:'st_01', name:'麦香坊·总店', address:'中山路128号', fermenter_count:4, oven_count:3 },
      { id:'st_02', name:'麦香坊·朝阳店', address:'朝阳路56号', fermenter_count:3, oven_count:2 },
      { id:'st_03', name:'麦香坊·滨江店', address:'滨江大道88号', fermenter_count:3, oven_count:2 },
      { id:'st_04', name:'麦香坊·大学城店', address:'学府路200号', fermenter_count:2, oven_count:2 },
      { id:'st_05', name:'麦香坊·城西店', address:'城西商业街15号', fermenter_count:2, oven_count:2 }
    ];
    var pd = genProducts();
    var memberNames = ['张伟','李娜','王芳','刘洋','陈静','赵磊','黄丽','周敏','吴强','郑华'];
    var members = [];
    for (var i = 0; i < 20; i++) {
      var phone = '139' + String(10000000 + Math.floor(Math.random() * 89999999));
      members.push({
        id:'m_' + (i + 1), phone: phone,
        name: memberNames[i % memberNames.length] + (i >= memberNames.length ? String(i - memberNames.length + 1) : ''),
        balance: Math.floor(Math.random() * 800) + 50,
        created_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString()
      });
    }
    var inventory = [];
    stores.forEach(function (st) {
      pd.products.forEach(function (p) {
        inventory.push({
          id: 'inv_' + st.id + '_' + p.id, store_id: st.id, sku_id: p.id,
          quantity: Math.floor(Math.random() * 40) + 5,
          frozen_quantity: 0,
          produce_date: new Date().toISOString().slice(0, 10)
        });
      });
    });
    var now = new Date();
    var sales = [];
    var saleItems = [];
    var membertx = [];
    for (var d = 13; d >= 0; d--) {
      var day = new Date(now.getTime() - d * 86400000);
      var dayStr = day.toISOString().slice(0, 10);
      stores.forEach(function (store) {
        var orderCount = 20 + Math.floor(Math.random() * 40);
        for (var o = 0; o < orderCount; o++) {
          var saleId = 'sale_' + dayStr.replace(/-/g, '') + '_' + store.id + '_' + o;
          var useMember = Math.random() > 0.4;
          var member = useMember ? members[Math.floor(Math.random() * members.length)] : null;
          var itemsCount = 1 + Math.floor(Math.random() * 4);
          var total = 0;
          for (var it = 0; it < itemsCount; it++) {
            var sku = pd.products[Math.floor(Math.random() * pd.products.length)];
            var qty = 1 + Math.floor(Math.random() * 3);
            var disc = Math.random() > 0.8 ? 0.9 : 1;
            var sub = +(sku.price * qty * disc).toFixed(2);
            total += sub;
            saleItems.push({
              id:'si_' + saleId + '_' + it, sale_id: saleId, sku_id: sku.id,
              quantity: qty, unit_price: sku.price,
              discount: Math.round(disc * 100), subtotal: sub
            });
          }
          var discAll = Math.random() > 0.9 ? 0.95 : 1;
          var finalAmt = +(total * discAll).toFixed(2);
          var payType = (member && Math.random() > 0.5) ? 'member' : 'cash';
          var sale = {
            id: saleId, store_id: store.id, member_id: member ? member.id : null,
            total_amount: +total.toFixed(2),
            discount_amount: +(total - finalAmt).toFixed(2),
            actual_amount: finalAmt,
            pay_type: payType,
            created_at: new Date(day.getTime() + Math.random() * 43200000 + 28800000).toISOString()
          };
          sales.push(sale);
          if (member && payType === 'member') {
            membertx.push({
              id: 'tx_' + saleId, member_id: member.id,
              type: 'consume', amount: -finalAmt, balance_after: 0,
              store_id: store.id, created_at: sale.created_at
            });
          }
        }
      });
    }
    var materials = [];
    var materialtx = [];
    stores.forEach(function (st) {
      MATERIAL_BASE.forEach(function (m) {
        materials.push({
          id: 'mat_' + st.id + '_' + m.id,
          store_id: st.id,
          material_id: m.id,
          name: m.name,
          unit: m.unit,
          unit_price: m.unit_price,
          category: m.category,
          quantity: 50 + Math.floor(Math.random() * 100),
          min_stock: 10
        });
      });
    });
    var settings = {
      currentStoreId: 'st_01', operator: '店长·王芳', shift: '早班'
    };
    return {
      stores: stores, products: pd.products, processes: pd.processes,
      members: members, membertx: membertx, inventory: inventory,
      materials: materials, materialtx: materialtx,
      workorders: [], sales: sales, sale_items: saleItems,
      transfers: [], settings: settings
    };
  }

  function seed() {
    var data = createSeedData();
    Store.batchUpdate({
      stores: data.stores, products: data.products, processes: data.processes,
      members: data.members, membertx: data.membertx, inventory: data.inventory,
      materials: data.materials, materialtx: data.materialtx,
      workorders: data.workorders, sales: data.sales, sale_items: data.sale_items,
      transfers: data.transfers, settings: data.settings,
      data_version: Store.VERSION
    });
    return data;
  }

  function getWeatherFactor(dateStr) {
    var d = new Date(dateStr);
    var mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (HOLIDAYS.indexOf(mmdd) >= 0) return WEATHER_FACTORS.holiday;
    var dow = d.getDay();
    if (dow === 0 || dow === 6) return WEATHER_FACTORS.weekend;
    return null;
  }

  return {
    CATEGORIES: CATEGORIES,
    CAT_COLORS: CAT_COLORS,
    CAT_EMOJI: CAT_EMOJI,
    RECHARGE_TIERS: RECHARGE_TIERS,
    WEATHER_FACTORS: WEATHER_FACTORS,
    HOLIDAYS: HOLIDAYS,
    MATERIAL_BASE: MATERIAL_BASE,
    PROCESS_MATERIAL_MAP: PROCESS_MATERIAL_MAP,
    pinyinOf: pinyinOf,
    validatePhone: validatePhone,
    validateDate: validateDate,
    validateNumber: validateNumber,
    calcRechargeBonus: calcRechargeBonus,
    getWeatherFactor: getWeatherFactor,
    seed: seed
  };
})();
