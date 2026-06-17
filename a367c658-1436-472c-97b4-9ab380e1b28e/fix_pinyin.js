var fs = require('fs');

var PINYIN_INITIALS = {
  '阿':'a','艾':'ai','安':'an','八':'b','白':'b','百':'b','斑':'b','半':'b','薄':'b','贝':'b','本':'b','荜':'b','萆':'b','扁':'b','鳖':'b','槟':'b','冰':'b','薄':'b','补':'b',
  '布':'b','采':'c','蚕':'c','苍':'c','草':'c','柴':'c','蝉':'c','蟾':'c','菖':'c','常':'c','车':'c','陈':'c','陈':'c','川':'ch','穿':'ch','垂':'ch','椿':'ch','磁':'c','刺':'c',
  '葱':'c','大':'d','代':'d','丹':'d','胆':'d','当':'d','党':'d','刀':'d','灯':'d','地':'d','颠':'d','滇':'d','冬':'d','豆':'d','独':'d','杜':'d','煅':'duan','莪':'e','鹅':'e',
  '儿':'e','耳':'e','二':'e','番':'f','防':'f','飞':'f','粉':'f','枫':'f','蜂':'f','佛':'f','茯':'f','浮':'f','福':'f','附':'f','复':'f','富':'f','甘':'g','干':'g','藁':'g',
  '葛':'g','蛤':'g','隔':'g','公':'g','钩':'g','狗':'g','枸':'g','谷':'g','瓜':'g','关':'g','贯':'g','广':'g','归':'g','龟':'g','桂':'g','过':'g','孩':'h','海':'h','寒':'h',
  '汉':'h','旱':'h','杭':'h','诃':'h','合':'h','何':'h','荷':'h','核':'h','鹤':'h','黑':'h','红':'h','胡':'h','葫':'h','琥':'h','花':'h','化':'h','槐':'h','黄':'h','火':'h',
  '藿':'h','鸡':'j','芨':'j','急':'j','蒺':'j','戟':'j','寄':'j','稷':'j','蓟':'j','夹':'j','家':'j','假':'j','尖':'j','姜':'j','僵':'j','降':'j','椒':'j','焦':'jiao',
  '角':'j','脚':'j','绞':'j','接':'j','节':'j','桔':'j','金':'j','锦':'j','京':'j','荆':'j','景天':'j','九':'j','韭':'j','酒':'jiu','菊':'j','橘':'j','瞿':'q','卷':'j','决明':'j',
  '君':'j','卡':'k','开':'k','勘':'k','糠':'k','抗':'k','柯':'k','稞':'k','咳':'k','空':'k','苦':'k','宽':'k','款':'k','昆':'k','腊':'l','莱':'l','兰':'l','狼':'l','榔':'l',
  '老':'l','雷':'l','棱':'l','冷':'l','梨':'l','李':'l','理':'l','鲤':'l','连':'l','莲':'l','楝':'l','良':'l','两':'l','蓼':'l','列':'l','林':'l','灵':'l','零':'l','刘':'l',
  '硫':'l','柳':'l','六':'l','龙':'l','蝼':'l','芦':'l','炉':'l','颅':'l','路':'l','鹿':'l','路':'l','绿':'l','卵':'l','罗布':'l','萝':'l','络':'l','落':'l','麻':'m','马':'m',
  '麦':'m','荬':'m','蔓':'m','芒':'m','猫':'m','毛':'m','茅':'m','没':'m','玫':'m','梅':'m','美':'m','礞':'m','密':'m','蜜':'mi','绵':'m','棉':'m','缅':'m','面':'m','苗':'m',
  '民':'m','明':'m','茉':'m','墨':'m','牡':'m','木':'m','苜':'m','慕':'m','墓':'m','南':'n','囊':'n','硇':'n','脑':'n','闹':'n','内':'n','嫩':'n','尼':'n','逆':'n','年':'n',
  '黏':'n','念':'n','鸟':'n','尿':'n','茑':'n','涅':'n','宁':'n','牛':'n','女':'n','糯':'n','诺':'n','藕':'ou','帕':'p','排':'p','盘':'p','胖':'p','炮':'pao','佩':'p',
  '硼':'p','蓬':'p','枇':'p','毗':'p','皮':'p','枇':'p','蜱':'p','片':'p','漂':'p','飘':'p','苤':'p','苹':'p','平':'p','萍':'p','破':'p','菩':'p','蒲':'p','七':'q','栖':'q',
  '桤':'q','漆':'q','蕲':'q','千':'q','前':'q','茜':'q','羌':'q','荞麦':'q','秦':'q','青':'q','清':'q','苘':'q','庆':'q','琼':'q','秋':'q','蚯':'q','楸':'q','曲':'q','瞿':'q',
  '全':'q','拳':'q','犬':'q','雀':'q','缺':'q','确':'q','群':'q','然':'r','荛':'r','忍':'r','人':'r','任':'r','肉':'r','茹':'r','乳':'r','软':'r','蕤':'r','瑞':'r','润':'r',
  '三':'s','散':'s','桑':'s','沙':'s','砂':'sha','山':'s','杉':'s','商':'s','上':'s','蛇':'s','射':'s','麝':'s','参':'s','神':'s','升':'s','生':'s','省':'s','剩':'s','十':'s',
  '石':'s','实':'s','使':'s','柿':'s','首乌':'s','熟':'shu','薯':'s','鼠':'s','术':'s','树':'s','双':'s','水':'s','睡':'s','顺':'s','硕':'s','松':'s','苏':'s','粟':'s','酸':'s',
  '蒜':'s','绥':'s','荽':'s','锁':'s','索':'s','踏':'t','台':'t','太':'t','秦艽':'j','青黛':'qd','拳参':'qs','忍冬藤':'rdt','肉苁蓉':'rcr','肉豆蔻':'rdk','肉桂':'rg','乳香':'rx',
  '三棱':'sl','三七':'sq','桑白皮':'sbp','桑寄生':'sjs','桑椹':'ssh','桑枝':'sz','沙棘':'sji','沙参':'ss','沙苑子':'syz','砂仁':'sr','山慈菇':'scg','山豆根':'sdg','山药':'sy',
  '山楂':'shz','山茱萸':'szy','商陆':'sl','蛇床子':'scz','射干':'sg','麝香':'sx','神曲':'sq','升麻':'sm','生地黄':'sdh','生姜':'sj','生石膏':'ssg','石菖蒲':'scp',
  '石斛':'shh','石决明':'sjm','石榴皮':'slp','石韦':'sw','使君子':'sjz','柿蒂':'sd','首乌藤':'swt','熟地黄':'sdh','水牛角':'snj','水蛭':'sz','丝瓜络':'sg','四季青':'sij',
  '松花粉':'shf','苏合香':'shx','苏子':'sz','酸枣仁':'szr','娑罗子':'slz','锁阳':'sy','太子参':'tzs','檀香':'tx','桃仁':'tr','天冬':'td','天花粉':'thf','天麻':'tm',
  '天南星':'tnx','天仙藤':'txt','天仙子':'txz','葶苈子':'tlz','通草':'tc','土鳖虫':'tbc','土茯苓':'tfl','土荆皮':'tjp','菟丝子':'tsz','瓦楞子':'wlz','威灵仙':'wlx',
  '乌梅':'wm','乌梢蛇':'wss','乌药':'wy','吴茱萸':'wzy','蜈蚣':'wg','五倍子':'wbz','五加皮':'wjp','五灵脂':'wlz','五味子':'wwz','五指毛桃':'wzmt','西河柳':'xhl',
  '西洋参':'xys','豨莶草':'xxc','细辛':'xx','夏枯草':'xkc','仙鹤草':'xhc','仙茅':'xm','香加皮':'xjp','香薷':'xr','香橼':'xy','香附':'xf','小茴香':'xhx',
  '小蓟':'xj','薤白':'xb','辛夷':'xy','信石':'xs','熊胆粉':'xdf','徐长卿':'xcq','续断':'xd','玄参':'xs','玄明粉':'xmf','旋覆花':'xfh','血余炭':'xyt',
  '血竭':'xj','寻骨风':'xgf','鸦胆子':'ydz','鸭跖草':'yzc','延胡索':'yhs','芫花':'yh','羊蹄':'yt','阳起石':'yqs','洋金花':'yjh','野菊花':'yjh','夜交藤':'yjt',
  '夜明砂':'yms','一叶萩':'yyq','益母草':'ymc','益智仁':'yzr','薏苡仁':'yyr','茵陈':'yc',' Yin':'y','银柴胡':'ych','银杏':'yx','淫羊藿':'yyh','罂粟壳':'ysk',
  '鱼腥草':'yxc','余甘子':'ygz','禹余粮':'yyl','玉竹':'yz','郁金':'yj','郁李仁':'ylr','预知子':'yzz','元胡':'yh','月季花':'yjh','越橘':'yj','云苓':'yl',
  '云母':'ym','皂角刺':'zjc','灶心土':'zxt','泽泻':'zx','泽兰':'zl','樟脑':'zn','赭石':'dzs','浙贝母':'zbm','珍珠':'zz','珍珠母':'zzm','知母':'zm',
  '栀子':'zz','枳壳':'zq','枳实':'zs','制草乌':'zcw','制川乌':'zcw','制何首乌':'zhsw','制马钱子':'zmqz','肿节风':'zjf','重楼':'zl',
  '朱砂':'zs','朱砂根':'zsgen','猪苓':'zl','竹茹':'zr','竹沥':'zl','苎麻根':'zmg','紫草':'zc','紫河车':'zhc','紫花地丁':'zhdd','紫苏':'zs',
  '紫苏子':'zsz','紫菀':'zw','棕榈':'zl','钻地风':'zdf','醉鱼草':'zyc'
};

function generatePinyin(name) {
  if (!name) return '';
  var result = '';
  var full = '';
  var chars = name.split('');
  for (var i = 0; i < chars.length; i++) {
    var c = chars[i];
    var found = null;
    for (var key in PINYIN_INITIALS) {
      if (name.substr(i, key.length) === key) {
        found = PINYIN_INITIALS[key];
        full += found;
        if (found.length > 0) result += found[0];
        i += key.length - 1;
        break;
      }
    }
    if (!found) {
      if (PINYIN_INITIALS[c]) {
        full += PINYIN_INITIALS[c];
        result += PINYIN_INITIALS[c][0];
      } else {
        full += c;
        result += c;
      }
    }
  }
  return full ? (full + '|' + result) : '';
}

function generateForProcessed(name) {
  var prefixes = ['酒','醋','盐','姜','蜜','炒','焦','煅','炭','煨','制','麸','土','米','蛤粉','蒲黄','滑石粉烫','红参','生晒参','皮尾参','人参须','人参叶','炮','醋山甲','炮山甲','枯矾'];
  for (var i = 0; i < prefixes.length; i++) {
    if (name.indexOf(prefixes[i]) === 0 && name.length > prefixes[i].length) {
      var base = name.substring(prefixes[i].length);
      var basePinyin = generatePinyin(base);
      if (basePinyin) {
        var prefixPinyin = generatePinyin(prefixes[i]);
        if (prefixPinyin) {
          var parts = basePinyin.split('|');
          var prefixParts = prefixPinyin.split('|');
          return prefixParts[0] + parts[0] + '|' + prefixParts[1] + parts[1];
        }
        return basePinyin;
      }
    }
  }
  return generatePinyin(name);
}

var content = fs.readFileSync('js/herb-data.js', 'utf8');

var match = content.match(/function getPinyin\(name\) \{[\s\S]*?var map = (\{[\s\S]*?\});/);
if (!match) { console.log('找不到map'); process.exit(1); }

eval('var PINYIN_MAP = ' + match[1]);

var rawMatch = content.match(/var RAW = \[([\s\S]*?)\];/);
if (!rawMatch) { console.log('找不到RAW'); process.exit(1); }

eval('var RAW = [' + rawMatch[1] + ']');

var beforeCount = Object.keys(PINYIN_MAP).length;
RAW.forEach(function(r) {
  var name = r[0];
  if (!PINYIN_MAP[name]) {
    var py = generateForProcessed(name);
    if (py) {
      PINYIN_MAP[name] = py;
    } else {
      missing.push(name);
    }
  }
});

console.log('总药材数: ' + RAW.length);
console.log('新增拼音映射: ' + (Object.keys(PINYIN_MAP).length - beforeCount));
console.log('仍缺失: ' + missing.length);
if (missing.length > 0) {
  console.log('缺失列表: ' + JSON.stringify(missing));
}

var mapStr = JSON.stringify(PINYIN_MAP, null, 2);
mapStr = mapStr.replace(/"/g, "'").replace(/',/g, "',").replace(/':/g, "':");
mapStr = mapStr.substring(1, mapStr.length - 1);

var newContent = content.replace(
  /function getPinyin\(name\) \{\s*var map = \{[\s\S]*?\};/,
  'function getPinyin(name) {\n    var map = {\n      ' + mapStr + '\n    };'
);

fs.writeFileSync('js/herb-data.js', newContent, 'utf8');
console.log('herb-data.js 已更新');
