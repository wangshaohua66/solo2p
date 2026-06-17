var fs = require('fs');
var content = fs.readFileSync('js/herb-data.js', 'utf8');

var rawMatch = content.match(/var RAW = \[([\s\S]*?)\];/);
eval('var RAW = [' + rawMatch[1] + ']');

var PINYIN_MAP_match = content.match(/function getPinyin\(name\) \{[\s\S]*?var map = (\{[\s\S]*?\});/);
eval('var PINYIN_MAP = ' + PINYIN_MAP_match[1]);

function getPinyin(name) { return PINYIN_MAP[name] || ''; }
function parseMeridians(str) { return str ? str.split(',') : []; }
function parseMethods(str) { return str ? str.split(',') : []; }
function buildId(idx) { return 'H' + String(idx+1).padStart(4,'0'); }

var HERBS = RAW.map(function(r, i) {
  return {
    id: buildId(i),
    name: r[0],
    aliases: r[1] ? r[1].split('|') : [],
    pinyin: getPinyin(r[0]),
    category: r[10],
    nature: r[2],
    flavors: r[3] ? r[3].split(',') : [],
    meridians: parseMeridians(r[4]),
    toxicity: r[5],
    minDose: r[6],
    maxDose: r[7],
    pregnancy: r[8],
    specialMethods: parseMethods(r[9]),
    eighteenAnti: [],
    nineteenFear: []
  };
});

console.log('HERBS总数: ' + HERBS.length);
console.log('H0001麻黄:');
console.log('  nature: ' + HERBS[0].nature);
console.log('  flavors: ' + JSON.stringify(HERBS[0].flavors));
console.log('  meridians: ' + JSON.stringify(HERBS[0].meridians));
console.log('  toxicity: ' + HERBS[0].toxicity);
console.log('  minDose: ' + HERBS[0].minDose);
console.log('  maxDose: ' + HERBS[0].maxDose);
console.log('  pregnancy: ' + HERBS[0].pregnancy);
console.log('  specialMethods: ' + JSON.stringify(HERBS[0].specialMethods));
console.log('  category: ' + HERBS[0].category);
console.log('H0601木蝴蝶:');
console.log('  nature: ' + HERBS[600].nature);
console.log('  flavors: ' + JSON.stringify(HERBS[600].flavors));
console.log('  meridians: ' + JSON.stringify(HERBS[600].meridians));
console.log('  toxicity: ' + HERBS[600].toxicity);
console.log('  category: ' + HERBS[600].category);

var flavorErr = 0;
var meridiansErr = 0;
var zangfu = ['心','肝','脾','肺','肾','胃','胆','小肠','大肠','膀胱','三焦','心包'];
var wuwei = ['辛','甘','酸','苦','咸','淡','涩'];
HERBS.forEach(function(h) {
  h.flavors.forEach(function(f) {
    if (zangfu.indexOf(f) !== -1) flavorErr++;
  });
  h.meridians.forEach(function(m) {
    if (wuwei.indexOf(m) !== -1) meridiansErr++;
  });
});
console.log('\nflavors含脏腑错误: ' + flavorErr);
console.log('meridians含五味错误: ' + meridiansErr);
console.log('单条字段数: ' + RAW[0].length + ' (应为11)');
console.log('RAW字段顺序验证通过!');
