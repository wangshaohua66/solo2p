var fs = require('fs');

var content = fs.readFileSync('js/herb-data.js', 'utf8');

var match = content.match(/function getPinyin\(name\) \{[\s\S]*?var map = (\{[\s\S]*?\});/);
eval('var PINYIN_MAP = ' + match[1]);

var flavorMatch = content.match(/var FLAVOR_MAP = (\{[\s\S]*?\});/);
eval('var FLAVOR_MAP = ' + flavorMatch[1]);

var defaultMatch = content.match(/var DEFAULT_FLAVORS = (\{[\s\S]*?\});/);
eval('var DEFAULT_FLAVORS = ' + defaultMatch[1]);

function getFlavors(name, category) {
  if (FLAVOR_MAP[name]) return FLAVOR_MAP[name];
  if (DEFAULT_FLAVORS[category]) return DEFAULT_FLAVORS[category];
  return '甘';
}

var rawStart = content.indexOf('var RAW = [');
var rawBracketStart = content.indexOf('[', rawStart);
var rawBracketEnd = content.indexOf('];', rawBracketStart);
var rawContent = content.substring(rawBracketStart + 1, rawBracketEnd);

eval('var RAW = [' + rawContent + ']');

console.log('原始RAW条数: ' + RAW.length);
console.log('原始单条长度: ' + RAW[0].length);
console.log('原始示例: ' + JSON.stringify(RAW[0]));

var newRAW = RAW.map(function(r) {
  var name = r[0];
  var aliases = r[1];
  var nature = r[2];
  var meridians = r[3];
  var toxicity = r[4];
  var minDose = r[5];
  var maxDose = r[6];
  var pregnancy = r[7];
  var specialMethods = r[8];
  var category = r[9];
  
  var flavors = getFlavors(name, category);
  
  return [
    name,
    aliases,
    nature,
    flavors,
    meridians,
    toxicity,
    minDose,
    maxDose,
    pregnancy,
    specialMethods,
    category
  ];
});

console.log('新RAW条数: ' + newRAW.length);
console.log('新单条长度: ' + newRAW[0].length);
console.log('新示例: ' + JSON.stringify(newRAW[0]));

function formatRawArr(arr) {
  var lines = [];
  arr.forEach(function(r) {
    var items = r.map(function(item) {
      if (typeof item === 'string') {
        return "'" + item.replace(/'/g, "\\'") + "'";
      }
      return String(item);
    });
    lines.push('    [' + items.join(',') + ']');
  });
  return lines.join(',\n');
}

var newRawStr = 'var RAW = [\n' + formatRawArr(newRAW) + '\n  ];';
var newContent = content.substring(0, rawStart) + newRawStr + content.substring(rawBracketEnd + 2);

var hermsStart = newContent.indexOf('var HERBS = RAW.map(function(r, i) {');
var hermsEnd = newContent.indexOf('});', hermsStart) + 3;

var newHerms = `var HERBS = RAW.map(function(r, i) {
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
  });`;

newContent = newContent.substring(0, hermsStart) + newHerms + newContent.substring(hermsEnd);

fs.writeFileSync('js/herb-data.js', newContent, 'utf8');
console.log('herb-data.js 已更新');

var getFlavorsFunc = newContent.indexOf('function getFlavors(name, category) {');
if (getFlavorsFunc !== -1) {
  console.log('警告：getFlavors函数仍然存在，建议检查是否需要删除');
}
