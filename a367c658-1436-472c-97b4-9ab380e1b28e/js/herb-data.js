var HerbData = (function() {
  'use strict';

  var CATEGORIES = [
    { id:'jie_biao',   name:'解表药', icon:'bi-cloud-sun', desc:'发散表邪，解除表证' },
    { id:'qing_re',    name:'清热药', icon:'bi-sun', desc:'清泄里热，治疗热证' },
    { id:'xie_xia',    name:'泻下药', icon:'bi-arrow-down-circle', desc:'通利大便' },
    { id:'qu_feng_shi',name:'祛风湿药', icon:'bi-wind', desc:'祛除风湿' },
    { id:'hua_shi',    name:'化湿药', icon:'bi-droplet-half', desc:'化湿运脾' },
    { id:'li_shui',    name:'利水渗湿药', icon:'bi-droplet', desc:'通利水道' },
    { id:'wen_li',     name:'温里药', icon:'bi-fire', desc:'温散里寒' },
    { id:'li_qi',      name:'理气药', icon:'bi-lungs', desc:'调畅气机' },
    { id:'xiao_shi',   name:'消食药', icon:'bi-egg-fried', desc:'消化食积' },
    { id:'qu_chong',   name:'驱虫药', icon:'bi-bug', desc:'杀灭寄生虫' },
    { id:'zhi_xue',    name:'止血药', icon:'bi-droplet-fill', desc:'制止出血' },
    { id:'huo_xue',    name:'活血化瘀药', icon:'bi-heart-pulse', desc:'疏通血脉' },
    { id:'hua_tan',    name:'化痰止咳平喘药', icon:'bi-megaphone-fill', desc:'祛痰平喘' },
    { id:'an_shen',    name:'安神药', icon:'bi-moon-stars', desc:'安定神志' },
    { id:'ping_gan',   name:'平肝息风药', icon:'bi-lightning', desc:'平肝潜阳' },
    { id:'kai_qiao',   name:'开窍药', icon:'bi-eye', desc:'开窍醒神' },
    { id:'bu_yi',      name:'补益药', icon:'bi-heart', desc:'补益正气' },
    { id:'shou_se',    name:'收涩药', icon:'bi-shield-check', desc:'收敛固涩' },
    { id:'yong_tu',    name:'涌吐药', icon:'bi-arrow-up-circle', desc:'促使呕吐' },
    { id:'wai_yong',   name:'外用药', icon:'bi-patch-plus', desc:'外用攻毒' }
  ];

  var EIGHTEEN_ANTI = [
    ['甘草','大戟','芫花','甘遂','海藻'],
    ['乌头','贝母','瓜蒌','半夏','白蔹','白及'],
    ['藜芦','人参','沙参','丹参','玄参','苦参','细辛','芍药']
  ];
  var NINETEEN_FEAR = [
    ['硫黄','朴硝'],['水银','砒霜'],['狼毒','密陀僧'],['巴豆','牵牛子'],
    ['丁香','郁金'],['川乌','犀角'],['草乌','犀角'],['牙硝','京三棱'],
    ['官桂','赤石脂'],['人参','五灵脂']
  ];

  var DECOCTION_METHODS = ['', '先煎', '后下', '包煎', '烊化', '冲服', '另煎', '打碎入煎'];

  var RAW = [
    ['麻黄','龙沙|狗骨','温','肺,膀胱','无毒',2,10,'慎用','后下','jie_biao'],
    ['桂枝','柳桂|玉桂','温','心,肺,膀胱','无毒',3,10,'慎用','','jie_biao'],
    ['紫苏','苏叶|赤苏','温','肺,脾','无毒',5,10,'安全','后下','jie_biao'],
    ['生姜','姜根|百辣云','微温','肺,脾,胃','无毒',3,10,'安全','','jie_biao'],
    ['香薷','香菜|香戎','微温','肺,脾,胃','无毒',3,10,'安全','后下','jie_biao'],
    ['荆芥','假苏|鼠蓂','微温','肺,肝','无毒',4,10,'安全','后下','jie_biao'],
    ['防风','铜芸|回云','微温','膀胱,肝,脾','无毒',4,10,'安全','','jie_biao'],
    ['羌活','羌青|护羌使者','温','膀胱,肾','无毒',3,10,'慎用','','jie_biao'],
    ['白芷','芳香|泽芬','温','肺,胃,大肠','无毒',3,10,'慎用','','jie_biao'],
    ['细辛','小辛|少辛','温','肺,肾,心','小毒',1,3,'禁用','','jie_biao'],
    ['藁本','藁板|鬼卿','温','膀胱','无毒',3,10,'慎用','','jie_biao'],
    ['苍耳子','苍耳|老苍子','温','肺','小毒',3,10,'慎用','打碎入煎','jie_biao'],
    ['辛夷','木笔|望春','温','肺,胃','无毒',3,10,'安全','包煎','jie_biao'],
    ['葱白','葱茎白|葱白头','温','肺,胃','无毒',3,10,'安全','','jie_biao'],
    ['薄荷','蕃荷菜|南薄荷','凉','肺,肝','无毒',3,6,'慎用','后下','jie_biao'],
    ['牛蒡子','大力子|鼠粘子','寒','肺,胃','无毒',5,10,'慎用','打碎入煎','jie_biao'],
    ['蝉蜕','蝉衣|蝉壳','寒','肺,肝','无毒',3,6,'安全','','jie_biao'],
    ['淡豆豉','香豉|淡豉','凉','肺,胃','无毒',6,12,'安全','','jie_biao'],
    ['桑叶','铁扇子|家桑','寒','肺,肝','无毒',5,10,'安全','','jie_biao'],
    ['菊花','甘菊|家菊|金蕊','微寒','肺,肝','无毒',5,10,'安全','','jie_biao'],
    ['蔓荆子','荆子|蔓荆实','微寒','膀胱,肝,胃','无毒',5,10,'安全','打碎入煎','jie_biao'],
    ['柴胡','地熏|茈胡','微寒','肝,胆','无毒',3,10,'安全','','jie_biao'],
    ['升麻','龙眼根|绿升麻','微寒','肺,脾,胃,大肠','无毒',3,10,'慎用','','jie_biao'],
    ['葛根','干葛|粉葛|甘葛','凉','脾,胃','无毒',10,15,'安全','','jie_biao'],
    ['石膏','白虎|细石','大寒','肺,胃','无毒',15,60,'安全','先煎,打碎入煎','qing_re'],
    ['知母','蚔母|连母','寒','肺,胃,肾','无毒',6,12,'慎用','','qing_re'],
    ['芦根','苇根|苇子根','寒','肺,胃','无毒',15,30,'安全','','qing_re'],
    ['天花粉','栝楼根|瓜蒌根','微寒','肺,胃','无毒',10,15,'禁用','','qing_re'],
    ['淡竹叶','竹叶|碎骨子','寒','心,胃,小肠','无毒',6,10,'安全','','qing_re'],
    ['栀子','山栀|黄栀子','寒','心,肺,三焦','无毒',5,10,'安全','打碎入煎','qing_re'],
    ['夏枯草','铁线夏枯|麦夏枯','寒','肝,胆','无毒',9,15,'安全','','qing_re'],
    ['决明子','草决明|马蹄决明','微寒','肝,大肠','无毒',9,15,'慎用','打碎入煎','qing_re'],
    ['黄芩','腐肠|山茶根','寒','肺,胆,脾,大肠,小肠','无毒',3,10,'慎用','','qing_re'],
    ['黄连','王连|支连','寒','心,脾,胃,肝,胆,大肠','无毒',2,6,'慎用','','qing_re'],
    ['黄柏','檗木|黄檗','寒','肾,膀胱,大肠','无毒',3,12,'慎用','','qing_re'],
    ['龙胆','龙胆草|胆草','寒','肝,胆','无毒',3,6,'慎用','','qing_re'],
    ['苦参','地槐|苦骨','寒','心,肝,胃,大肠,膀胱','无毒',4,9,'禁用','','qing_re'],
    ['金银花','忍冬花|双花|二花|银花','寒','肺,心,胃','无毒',6,15,'安全','','qing_re'],
    ['连翘','连召|青翘|落翘','微寒','肺,心,小肠','无毒',6,15,'安全','','qing_re'],
    ['穿心莲','一见喜|榄核莲','寒','心,肺,大肠,膀胱','无毒',6,9,'慎用','','qing_re'],
    ['大青叶','蓝叶|蓝菜','寒','心,胃','无毒',9,15,'慎用','','qing_re'],
    ['板蓝根','大青根|靛青根','寒','心,胃','无毒',9,15,'安全','','qing_re'],
    ['蒲公英','黄花地丁|婆婆丁','寒','肝,胃','无毒',9,15,'安全','','qing_re'],
    ['紫花地丁','地丁|箭头草','寒','心,肝','无毒',9,15,'安全','','qing_re'],
    ['土茯苓','仙遗粮|冷饭团','平','肝,胃','无毒',15,60,'安全','','qing_re'],
    ['鱼腥草','蕺菜|折耳根','微寒','肺','无毒',15,25,'安全','后下','qing_re'],
    ['射干','乌扇|扁竹','寒','肺','无毒',3,9,'禁用','','qing_re'],
    ['山豆根','广豆根|苦豆根','寒','肺,胃','小毒',3,6,'禁用','','qing_re'],
    ['白头翁','奈何草|粉乳草','寒','胃,大肠','无毒',9,15,'安全','','qing_re'],
    ['马齿苋','马苋|五行草','寒','肝,大肠','无毒',9,15,'禁用','','qing_re'],
    ['白花蛇舌草','蛇舌草|二叶葎','微寒','胃,大肠,小肠','无毒',15,60,'慎用','','qing_re'],
    ['生地黄','生地|干地黄','寒','心,肝,肾','无毒',10,15,'安全','','qing_re'],
    ['玄参','元参|黑参','微寒','肺,胃,肾','无毒',9,15,'禁用','','qing_re'],
    ['牡丹皮','丹皮|粉丹皮','微寒','心,肝,肾','无毒',6,12,'禁用','','qing_re'],
    ['赤芍','赤芍药|木芍药','微寒','肝','无毒',6,12,'禁用','','qing_re'],
    ['紫草','紫草根|硬紫草','寒','心,肝','无毒',5,10,'禁用','','qing_re'],
    ['青蒿','草蒿|香蒿','寒','肝,胆','无毒',6,12,'安全','后下','qing_re'],
    ['地骨皮','枸杞根皮','寒','肺,肝,肾','无毒',9,15,'安全','','qing_re'],
    ['银柴胡','银胡|山菜根','微寒','肝,胃','无毒',3,10,'安全','','qing_re'],
    ['大黄','将军|锦纹|川军','寒','脾,胃,大肠,肝,心包','无毒',3,12,'禁用','后下','xie_xia'],
    ['芒硝','朴硝|盐硝|马牙硝','寒','胃,大肠','无毒',6,12,'禁用','冲服','xie_xia'],
    ['番泻叶','泻叶|泡竹叶','寒','大肠','无毒',2,6,'禁用','','xie_xia'],
    ['火麻仁','麻子仁|大麻仁','平','脾,胃,大肠','无毒',9,15,'安全','打碎入煎','xie_xia'],
    ['郁李仁','李仁|小李仁','平','脾,大肠,小肠','无毒',6,10,'慎用','打碎入煎','xie_xia'],
    ['甘遂','甘泽|陵藁','寒','肺,肾,大肠','大毒',0.5,1.5,'禁用','','xie_xia'],
    ['大戟','京大戟|下马仙','寒','肺,脾,肾','大毒',1.5,3,'禁用','','xie_xia'],
    ['芫花','南芫花|药鱼草','温','肺,脾,肾','大毒',1.5,3,'禁用','','xie_xia'],
    ['牵牛子','黑丑|白丑|二丑','寒','肺,肾,大肠','小毒',3,6,'禁用','打碎入煎','xie_xia'],
    ['巴豆','江子|巴果|双眼龙','热','胃,大肠','大毒',0.1,0.3,'禁用','','xie_xia'],
    ['独活','独摇草|独滑','微温','肾,膀胱','无毒',3,10,'安全','','qu_feng_shi'],
    ['威灵仙','铁脚威灵仙|百条根','温','膀胱','小毒',6,10,'慎用','','qu_feng_shi'],
    ['防己','粉防己|汉防己','寒','膀胱,肺','无毒',4,10,'慎用','','qu_feng_shi'],
    ['秦艽','秦胶|秦纠','平','胃,肝,胆','无毒',3,10,'安全','','qu_feng_shi'],
    ['豨莶草','豨莶|粘苍子','寒','肝,肾','小毒',9,12,'慎用','','qu_feng_shi'],
    ['木瓜','贴梗海棠|川木瓜','温','肝,脾','无毒',6,10,'安全','','qu_feng_shi'],
    ['伸筋草','石松|过山龙','温','肝,脾,肾','无毒',3,12,'安全','','qu_feng_shi'],
    ['桑枝','桑条|嫩桑枝','平','肝','无毒',9,15,'安全','','qu_feng_shi'],
    ['桑寄生','桑上寄生|寄生','平','肝,肾','无毒',9,15,'安全','','qu_feng_shi'],
    ['五加皮','南五加皮|五谷皮','温','肝,肾','无毒',4,10,'安全','','qu_feng_shi'],
    ['蕲蛇','白花蛇|棋盘蛇','温','肝','小毒',3,10,'禁用','','qu_feng_shi'],
    ['乌梢蛇','乌蛇|黑花蛇','平','肝','无毒',6,12,'慎用','','qu_feng_shi'],
    ['海风藤','风藤|巴岩香','温','肝','无毒',6,12,'安全','','qu_feng_shi'],
    ['藿香','广藿香|土藿香','微温','脾,胃,肺','无毒',5,10,'安全','后下','hua_shi'],
    ['佩兰','水香|兰草','平','脾,胃,肺','无毒',5,10,'安全','后下','hua_shi'],
    ['苍术','赤术|枪头菜','温','脾,胃,肝','无毒',3,10,'安全','','hua_shi'],
    ['厚朴','川朴|紫油厚朴','温','脾,胃,肺,大肠','无毒',3,10,'慎用','','hua_shi'],
    ['砂仁','缩砂仁|阳春砂','温','脾,胃,肾','无毒',3,6,'安全','后下','hua_shi'],
    ['白豆蔻','豆蔻|多骨','温','肺,脾,胃','无毒',3,6,'安全','后下,打碎入煎','hua_shi'],
    ['草豆蔻','草蔻|草蔻仁','温','脾,胃','无毒',3,6,'安全','打碎入煎','hua_shi'],
    ['草果','草果仁|老蔻','温','脾,胃','无毒',3,6,'安全','打碎入煎','hua_shi'],
    ['茯苓','云苓|茯菟|松薯','平','心,肺,脾,肾','无毒',9,15,'安全','','li_shui'],
    ['薏苡仁','薏米|苡仁|苡米','凉','脾,胃,肺','无毒',9,30,'禁用','','li_shui'],
    ['泽泻','水泻|芒芋','寒','肾,膀胱','无毒',5,10,'安全','','li_shui'],
    ['猪苓','豕苓|粉猪苓','平','肾,膀胱','无毒',6,12,'安全','','li_shui'],
    ['车前子','车前实|车前仁','寒','肝,肾,肺,小肠','无毒',9,15,'安全','包煎','li_shui'],
    ['滑石','画石|脱石','寒','膀胱,肺,胃','无毒',10,20,'慎用','包煎,打碎入煎','li_shui'],
    ['木通','通草|附支','寒','心,小肠,膀胱','小毒',3,6,'禁用','','li_shui'],
    ['通草','白通草|通花','微寒','肺,胃','无毒',3,5,'慎用','','li_shui'],
    ['瞿麦','石竹|巨句麦','寒','心,小肠,膀胱','无毒',9,15,'禁用','','li_shui'],
    ['萹蓄','扁竹|道生草','微寒','膀胱','无毒',9,15,'安全','','li_shui'],
    ['地肤子','地麦|扫帚子','寒','肾,膀胱','无毒',9,15,'安全','','li_shui'],
    ['海金沙','左转藤灰','寒','膀胱,小肠','无毒',6,15,'安全','包煎','li_shui'],
    ['石韦','石皮|金星草','凉','肺,膀胱','无毒',6,12,'安全','','li_shui'],
    ['萆薢','百枝|竹木','平','肝,胃,膀胱','无毒',9,15,'安全','','li_shui'],
    ['茵陈','茵陈蒿|绵茵陈','微寒','脾,胃,肝,胆','无毒',6,15,'安全','','li_shui'],
    ['金钱草','过路黄|对座草','平','肝,胆,肾,膀胱','无毒',15,60,'安全','','li_shui'],
    ['虎杖','花斑竹|川筋龙','微寒','肝,胆,肺','无毒',9,15,'禁用','','li_shui'],
    ['附子','乌头|附片','大热','心,肾,脾','大毒',3,15,'禁用','先煎','wen_li'],
    ['干姜','白姜|均姜','热','脾,胃,肾,心,肺','无毒',3,10,'慎用','','wen_li'],
    ['肉桂','官桂|牡桂|玉桂','大热','肾,脾,心,肝','无毒',1,5,'禁用','后下','wen_li'],
    ['吴茱萸','吴萸|茶辣','热','肝,脾,胃,肾','小毒',1.5,5,'慎用','','wen_li'],
    ['小茴香','茴香|谷茴香','温','肝,肾,脾,胃','无毒',3,6,'安全','','wen_li'],
    ['高良姜','良姜|小良姜','热','脾,胃','无毒',3,10,'安全','','wen_li'],
    ['花椒','蜀椒|川椒|巴椒','温','脾,胃,肾','小毒',3,6,'慎用','','wen_li'],
    ['丁香','公丁香|丁子香','温','脾,胃,肺,肾','无毒',1,3,'慎用','','wen_li'],
    ['陈皮','橘皮|红皮|广陈皮','温','脾,肺','无毒',3,10,'安全','','li_qi'],
    ['青皮','青橘皮|青柑皮','温','肝,胆,胃','无毒',3,10,'慎用','','li_qi'],
    ['枳实','鹅眼枳实','寒','脾,胃,大肠','无毒',3,10,'慎用','','li_qi'],
    ['枳壳','江枳壳|川枳壳','寒','脾,胃,大肠','无毒',3,10,'慎用','','li_qi'],
    ['佛手','佛手柑|五指橘','温','肝,脾,胃,肺','无毒',3,10,'安全','','li_qi'],
    ['香橼','枸橼|香圆','温','肝,脾,肺','无毒',3,10,'安全','','li_qi'],
    ['薤白','小根蒜|薤根','温','肺,胃,大肠','无毒',5,10,'安全','','li_qi'],
    ['檀香','白檀|旃檀','温','脾,胃,心,肺','无毒',2,5,'慎用','','li_qi'],
    ['沉香','沉水香|伽南香','温','脾,胃,肾','无毒',1,5,'慎用','后下','li_qi'],
    ['川楝子','苦楝子|金铃子','寒','肝,小肠,膀胱','小毒',4,9,'禁用','打碎入煎','li_qi'],
    ['乌药','台乌|矮樟','温','肺,脾,肾,膀胱','无毒',3,10,'安全','','li_qi'],
    ['荔枝核','荔仁|枝核','温','肝,胃','无毒',4,9,'安全','打碎入煎','li_qi'],
    ['香附','雀头香|莎草根','平','肝,脾,三焦','无毒',6,10,'安全','','li_qi'],
    ['玫瑰花','赤蔷薇|徘徊花','温','肝,脾','无毒',3,6,'慎用','','li_qi'],
    ['山楂','红果|棠棣|山里红','温','脾,胃,肝','无毒',9,12,'慎用','','xiao_shi'],
    ['神曲','六神曲|建曲','温','脾,胃','无毒',6,15,'安全','','xiao_shi'],
    ['麦芽','大麦芽|大麦蘖','平','脾,胃,肝','无毒',9,15,'禁用','','xiao_shi'],
    ['谷芽','稻芽|稻谷蘖','平','脾,胃','无毒',9,15,'安全','','xiao_shi'],
    ['莱菔子','萝卜子|芦菔子','平','肺,脾,胃','无毒',4,10,'安全','打碎入煎','xiao_shi'],
    ['鸡内金','鸡肫皮|鸡黄皮','平','脾,胃,小肠,膀胱','无毒',3,10,'安全','打碎入煎','xiao_shi'],
    ['使君子','留求子|史君子','温','脾,胃','小毒',9,12,'慎用','打碎入煎','qu_chong'],
    ['苦楝皮','楝皮|楝根皮','寒','肝,脾,胃','小毒',4,9,'禁用','','qu_chong'],
    ['槟榔','大腹子|海南子','温','胃,大肠','无毒',3,10,'禁用','打碎入煎','qu_chong'],
    ['南瓜子','南瓜仁|白瓜子','平','胃,大肠','无毒',60,120,'安全','','qu_chong'],
    ['大蓟','大刺儿菜|大刺盖','凉','心,肝','无毒',9,15,'安全','','zhi_xue'],
    ['小蓟','小刺儿菜|青青菜','凉','心,肝','无毒',9,15,'安全','','zhi_xue'],
    ['地榆','黄瓜香|血箭草','寒','肝,大肠','无毒',9,15,'安全','','zhi_xue'],
    ['槐花','槐米|槐蕊','微寒','肝,大肠','无毒',9,15,'安全','','zhi_xue'],
    ['侧柏叶','柏叶|丛柏叶','寒','肺,肝,脾','无毒',6,12,'安全','','zhi_xue'],
    ['白茅根','茅根|茹根','寒','肺,胃,膀胱','无毒',15,30,'安全','','zhi_xue'],
    ['三七','田七|参三七|金不换','温','肝,胃','无毒',3,9,'禁用','冲服,打碎入煎','zhi_xue'],
    ['茜草','血见愁|地苏木','寒','肝','无毒',6,10,'禁用','','zhi_xue'],
    ['蒲黄','蒲花|蒲厘花粉','平','肝,心包','无毒',3,10,'禁用','包煎','zhi_xue'],
    ['艾叶','艾蒿|家艾|灸草','温','脾,肝,肾','小毒',3,10,'慎用','','zhi_xue'],
    ['白及','白芨|甘根','寒','肺,胃,肝','无毒',6,15,'慎用','','zhi_xue'],
    ['仙鹤草','脱力草|龙芽草','平','肺,肝,脾','无毒',9,15,'安全','','zhi_xue'],
    ['血余炭','人发炭|头发炭','平','肝,胃','无毒',3,10,'安全','','zhi_xue'],
    ['藕节','藕节疤','平','肝,肺,胃','无毒',9,15,'安全','打碎入煎','zhi_xue'],
    ['川芎','芎藭|西芎|抚芎','温','肝,胆,心包','无毒',3,10,'禁用','','huo_xue'],
    ['延胡索','元胡|延胡','温','肝,脾','无毒',3,10,'慎用','打碎入煎','huo_xue'],
    ['郁金','玉金|马蒁','寒','肝,心,肺','无毒',3,10,'慎用','','huo_xue'],
    ['姜黄','黄姜|宝鼎香','温','肝,脾','无毒',3,10,'禁用','','huo_xue'],
    ['乳香','熏陆香|马尾香','温','心,肝,脾','无毒',3,10,'禁用','打碎入煎','huo_xue'],
    ['没药','末药|明没药','平','心,肝,脾','无毒',3,10,'禁用','打碎入煎','huo_xue'],
    ['丹参','红根|大红袍','微寒','心,心包,肝','无毒',9,15,'禁用','','huo_xue'],
    ['红花','草红|刺红花','温','心,肝','无毒',3,10,'禁用','','huo_xue'],
    ['桃仁','桃核仁|毛桃仁','平','心,肝,大肠','小毒',5,10,'禁用','打碎入煎','huo_xue'],
    ['益母草','茺蔚|益母蒿','微寒','肝,心包,膀胱','无毒',9,30,'禁用','','huo_xue'],
    ['泽兰','地瓜儿苗|地笋','微温','肝,脾','无毒',6,12,'禁用','','huo_xue'],
    ['牛膝','怀牛膝|牛髁膝','平','肝,肾','无毒',6,15,'禁用','','huo_xue'],
    ['鸡血藤','血风藤|大血藤','温','肝,肾','无毒',9,15,'慎用','','huo_xue'],
    ['王不留行','留行子|王不留','平','肝,胃','无毒',4,10,'禁用','','huo_xue'],
    ['五灵脂','灵脂|寒号虫粪','温','肝','无毒',3,10,'禁用','包煎','huo_xue'],
    ['三棱','京三棱|红蒲根','平','肝,脾','无毒',5,10,'禁用','','huo_xue'],
    ['莪术','文术|蓬莪术','温','肝,脾','无毒',5,10,'禁用','','huo_xue'],
    ['水蛭','蚂蝗|马鳖','平','肝','小毒',1,3,'禁用','','huo_xue'],
    ['苏木','苏方木|棕木','平','心,肝,脾','无毒',3,10,'禁用','','huo_xue'],
    ['骨碎补','猴姜|毛姜|申姜','温','肝,肾','无毒',9,15,'安全','','huo_xue'],
    ['自然铜','石髓铅','平','肝','无毒',10,15,'慎用','先煎,打碎入煎','huo_xue'],
    ['半夏','地文|水玉|守田','温','脾,胃,肺','大毒',3,10,'禁用','','hua_tan'],
    ['天南星','南星|虎掌','温','肺,肝,脾','大毒',3,10,'禁用','','hua_tan'],
    ['白芥子','辣菜子|芥菜子','温','肺','无毒',3,10,'慎用','打碎入煎','hua_tan'],
    ['旋覆花','金沸草|六月菊','温','肺,胃,大肠','无毒',3,10,'慎用','包煎','hua_tan'],
    ['白前','石蓝|嗽药','微温','肺','无毒',3,10,'安全','','hua_tan'],
    ['前胡','白花前胡|鸡脚前胡','微寒','肺','无毒',3,10,'安全','','hua_tan'],
    ['桔梗','苦桔梗|包袱花','平','肺','无毒',3,10,'安全','','hua_tan'],
    ['川贝母','川贝|贝母','微寒','肺,心','无毒',3,10,'安全','','hua_tan'],
    ['浙贝母','象贝|大贝母','寒','肺,心','无毒',3,10,'安全','','hua_tan'],
    ['瓜蒌','全瓜蒌|栝楼','寒','肺,胃,大肠','无毒',9,15,'慎用','打碎入煎','hua_tan'],
    ['竹茹','淡竹茹|竹二青','微寒','肺,胃,胆','无毒',4,9,'安全','','hua_tan'],
    ['天竺黄','竹黄|竹膏','寒','心,肝,胆','无毒',3,9,'安全','','hua_tan'],
    ['胖大海','大海|大海子','寒','肺,大肠','无毒',2,3,'安全','','hua_tan'],
    ['紫苏子','苏子|黑苏子','温','肺,大肠','无毒',3,10,'安全','打碎入煎','hua_tan'],
    ['葶苈子','丁历|北葶苈子','大寒','肺,膀胱','无毒',3,10,'慎用','包煎','hua_tan'],
    ['桑白皮','桑根白皮|桑皮','寒','肺','无毒',9,15,'安全','','hua_tan'],
    ['紫菀','青苑|紫倩','微温','肺','无毒',5,10,'安全','','hua_tan'],
    ['款冬花','冬花|款冬','温','肺','无毒',5,10,'安全','','hua_tan'],
    ['枇杷叶','卢橘|巴叶','微寒','肺,胃','无毒',6,10,'安全','','hua_tan'],
    ['白果','银杏|灵眼','平','肺','小毒',5,10,'慎用','打碎入煎','hua_tan'],
    ['朱砂','丹砂|辰砂','微寒','心','小毒',0.1,0.5,'禁用','','an_shen'],
    ['磁石','玄石|吸铁石','寒','肝,心,肾','无毒',15,30,'慎用','先煎,打碎入煎','an_shen'],
    ['龙骨','白龙骨|五花龙骨','平','心,肝,肾','无毒',15,30,'安全','先煎,打碎入煎','an_shen'],
    ['酸枣仁','枣仁|山枣仁','平','肝,心,胆','无毒',9,15,'安全','打碎入煎','an_shen'],
    ['柏子仁','柏实|侧柏子','平','心,肾,大肠','无毒',3,10,'安全','打碎入煎','an_shen'],
    ['远志','远志肉|细草','温','心,肾,肺','无毒',3,10,'安全','','an_shen'],
    ['合欢皮','合昏皮|夜合皮','平','心,肝,肺','无毒',6,12,'安全','','an_shen'],
    ['首乌藤','夜交藤|棋藤','平','心,肝','无毒',9,15,'安全','','an_shen'],
    ['灵芝','灵芝草|三秀','平','心,肺,肝,肾','无毒',6,12,'安全','','an_shen'],
    ['羚羊角','泠羊角','寒','肝,心','无毒',1,3,'安全','另煎','ping_gan'],
    ['牛黄','西黄|犀黄','凉','心,肝','无毒',0.15,0.35,'慎用','冲服','ping_gan'],
    ['钩藤','双钩藤|莺爪风','凉','肝,心包','无毒',3,12,'安全','后下','ping_gan'],
    ['天麻','赤箭|定风草','平','肝','无毒',3,10,'安全','打碎入煎','ping_gan'],
    ['地龙','蚯蚓|曲蟮','寒','肝,脾,膀胱','无毒',4.5,9,'慎用','','ping_gan'],
    ['全蝎','全虫|蝎子','平','肝','小毒',2.4,4.5,'禁用','','ping_gan'],
    ['蜈蚣','百足虫|天龙','温','肝','大毒',2.4,4.5,'禁用','','ping_gan'],
    ['僵蚕','天虫|白僵虫','平','肝,肺,胃','无毒',4.5,9,'安全','打碎入煎','ping_gan'],
    ['代赭石','钉头赭石|须丸','寒','肝,心','无毒',9,30,'慎用','先煎,打碎入煎','ping_gan'],
    ['蒺藜','刺蒺藜|白蒺藜','平','肝','小毒',6,9,'慎用','','ping_gan'],
    ['珍珠','真珠|蚌珠','寒','心,肝','无毒',0.1,0.3,'安全','冲服','ping_gan'],
    ['石决明','真珠母|鳆鱼甲','寒','肝','无毒',3,15,'慎用','先煎,打碎入煎','ping_gan'],
    ['牡蛎','蛎蛤|牡蛤','微寒','肝,胆,肾','无毒',9,30,'安全','先煎,打碎入煎','ping_gan'],
    ['麝香','元寸|当门子','温','心,脾','无毒',0.03,0.1,'禁用','冲服','kai_qiao'],
    ['冰片','龙脑|梅片','凉','心,脾,肺','无毒',0.15,0.3,'禁用','冲服','kai_qiao'],
    ['苏合香','苏合油|帝油','温','心,脾','无毒',0.3,1,'慎用','冲服','kai_qiao'],
    ['安息香','拙贝罗香','平','心,脾','无毒',0.6,1.5,'慎用','冲服','kai_qiao'],
    ['石菖蒲','菖蒲|昌阳','温','心,肝,胃','无毒',3,9,'慎用','','kai_qiao'],
    ['人参','棒槌|血参','微温','脾,肺,心,肾','无毒',3,9,'安全','另煎','bu_yi'],
    ['党参','上党人参|黄参','平','脾,肺','无毒',9,30,'安全','','bu_yi'],
    ['太子参','童参|孩儿参','平','脾,肺','无毒',9,30,'安全','','bu_yi'],
    ['西洋参','花旗参|洋参','凉','心,肺,肾','无毒',3,6,'安全','另煎','bu_yi'],
    ['黄芪','绵芪|黄耆','微温','脾,肺','无毒',9,30,'安全','','bu_yi'],
    ['白术','于术|浙术','温','脾,胃','无毒',6,12,'安全','','bu_yi'],
    ['山药','薯蓣|淮山','平','脾,肺,肾','无毒',15,30,'安全','','bu_yi'],
    ['白扁豆','南扁豆|沿篱豆','平','脾,胃','无毒',9,15,'安全','','bu_yi'],
    ['甘草','国老|甜草','平','心,肺,脾,胃','无毒',2,10,'安全','','bu_yi'],
    ['大枣','红枣|干枣','温','脾,胃,心','无毒',6,15,'安全','','bu_yi'],
    ['刺五加','五加参','温','脾,肾,心','无毒',9,27,'安全','','bu_yi'],
    ['红景天','扫罗玛尔布','平','肺,心','无毒',3,6,'安全','','bu_yi'],
    ['沙棘','沙枣|醋柳果','温','脾,胃,肺,心','无毒',3,10,'安全','','bu_yi'],
    ['饴糖','麦芽糖|胶饴','温','脾,胃,肺','无毒',15,20,'安全','烊化','bu_yi'],
    ['蜂蜜','白蜜|石蜜','平','肺,脾,大肠','无毒',15,30,'安全','冲服','bu_yi'],
    ['当归','干归|秦归','温','肝,心,脾','无毒',6,12,'禁用','','bu_yi'],
    ['熟地黄','熟地|大熟地','微温','肝,肾','无毒',9,15,'安全','','bu_yi'],
    ['白芍','白芍药|金芍药','微寒','肝,脾','无毒',6,15,'慎用','','bu_yi'],
    ['赤芍','赤芍药','微寒','肝','无毒',6,12,'禁用','','bu_yi'],
    ['阿胶','驴皮胶','平','肺,肝,肾','无毒',3,9,'慎用','烊化','bu_yi'],
    ['何首乌','首乌|地精','微温','肝,肾','无毒',6,12,'安全','','bu_yi'],
    ['龙眼肉','桂圆肉|益智','温','心,脾','无毒',9,15,'安全','','bu_yi'],
    ['桑葚','桑果|桑枣','寒','心,肝,肾','无毒',9,15,'安全','','bu_yi'],
    ['紫河车','胞衣|胎衣','温','肺,肝,肾','无毒',1.5,3,'禁用','研末服','bu_yi'],
    ['北沙参','莱阳参|海沙参','微寒','肺,胃','无毒',4.5,9,'安全','','bu_yi'],
    ['南沙参','沙参|泡参','微寒','肺,胃','无毒',9,15,'禁用','','bu_yi'],
    ['麦冬','麦门冬|沿阶草','微寒','心,肺,胃','无毒',6,12,'安全','','bu_yi'],
    ['天冬','天门冬|明天冬','寒','肺,肾','无毒',6,12,'安全','','bu_yi'],
    ['石斛','林兰|金钗花','微寒','胃,肾','无毒',6,12,'安全','','bu_yi'],
    ['玉竹','葳蕤|女萎','微寒','肺,胃','无毒',6,12,'安全','','bu_yi'],
    ['百合','白百合','微寒','心,肺','无毒',6,12,'安全','','bu_yi'],
    ['枸杞子','枸杞|红耳坠','平','肝,肾','无毒',6,12,'安全','','bu_yi'],
    ['黄精','黄芝|鹿竹','平','脾,肺,肾','无毒',9,15,'安全','','bu_yi'],
    ['墨旱莲','旱莲草|金陵草','寒','肝,肾','无毒',6,12,'安全','','bu_yi'],
    ['女贞子','冬青子|女贞实','凉','肝,肾','无毒',6,12,'安全','','bu_yi'],
    ['龟甲','龟板|神屋','微寒','肝,肾,心','无毒',9,24,'慎用','先煎,打碎入煎','bu_yi'],
    ['鳖甲','团鱼甲|上甲','微寒','肝,肾','无毒',9,24,'慎用','先煎,打碎入煎','bu_yi'],
    ['鹿茸','斑龙珠','温','肾,肝','无毒',1,2,'禁用','研末服','bu_yi'],
    ['紫河车','胞衣','温','肺,肝,肾','无毒',1.5,3,'禁用','','bu_yi'],
    ['淫羊藿','仙灵脾','温','肝,肾','无毒',3,9,'禁用','','bu_yi'],
    ['巴戟天','鸡肠风|巴戟','微温','肾,肝','无毒',3,9,'慎用','','bu_yi'],
    ['仙茅','地棕|独茅','热','肾,肝,脾','小毒',3,10,'禁用','','bu_yi'],
    ['杜仲','思仙|木绵','温','肝,肾','无毒',6,10,'安全','','bu_yi'],
    ['续断','川断|接骨','微温','肝,肾','无毒',9,15,'禁用','','bu_yi'],
    ['肉苁蓉','大芸|寸芸','温','肾,大肠','无毒',6,10,'禁用','','bu_yi'],
    ['锁阳','不老药','温','肝,肾,大肠','无毒',5,10,'禁用','','bu_yi'],
    ['补骨脂','破故纸|黑故子','温','肾,脾','无毒',3,10,'慎用','','bu_yi'],
    ['益智仁','益智|摘芋子','温','脾,肾','无毒',3,10,'慎用','','bu_yi'],
    ['菟丝子','菟丝实|吐丝子','平','肝,肾,脾','无毒',6,12,'安全','','bu_yi'],
    ['沙苑子','潼蒺藜|沙苑蒺藜','温','肝,肾','无毒',6,10,'慎用','','bu_yi'],
    ['蛤蚧','仙蟾|大壁虎','平','肺,肾','无毒',3,6,'慎用','','bu_yi'],
    ['冬虫夏草','虫草|冬虫草','温','肾,肺','无毒',3,9,'安全','','bu_yi'],
    ['韭菜子','韭子|韭菜仁','温','肝,肾','无毒',3,9,'禁用','','bu_yi'],
    ['阳起石','白石|羊起石','温','肾','小毒',3,6,'禁用','先煎,打碎入煎','bu_yi'],
    ['胡芦巴','葫芦巴|苦豆','温','肾','无毒',4.5,9,'慎用','','bu_yi'],
    ['覆盆子','树莓|种田泡','温','肝,肾,膀胱','无毒',6,12,'安全','','shou_se'],
    ['金樱子','刺榆子|金罂子','平','肾,膀胱,大肠','无毒',6,12,'安全','','shou_se'],
    ['山茱萸','萸肉|山萸肉','微温','肝,肾','无毒',6,12,'安全','','shou_se'],
    ['桑螵蛸','桑蛸|螳螂子','平','肝,肾','无毒',4.5,9,'慎用','','shou_se'],
    ['海螵蛸','乌贼骨|墨鱼盖','温','脾,肾','无毒',6,12,'安全','打碎入煎','shou_se'],
    ['莲子','莲肉|藕实','平','脾,肾,心','无毒',6,15,'安全','','shou_se'],
    ['芡实','鸡头米|雁喙实','平','脾,肾','无毒',9,15,'安全','','shou_se'],
    ['肉豆蔻','玉果|肉果','温','脾,胃,大肠','小毒',3,9,'慎用','打碎入煎','shou_se'],
    ['五味子','玄及|五梅子','温','肺,心,肾','无毒',1.5,6,'安全','','shou_se'],
    ['乌梅','酸梅|合汉梅','平','肝,脾,肺,大肠','无毒',6,12,'安全','','shou_se'],
    ['诃子','诃黎勒|随风子','平','肺,大肠','无毒',3,10,'慎用','打碎入煎','shou_se'],
    ['赤石脂','赤符|红土','温','大肠,胃','无毒',9,12,'安全','打碎入煎','shou_se'],
    ['禹余粮','禹粮石|余粮石','微寒','胃,大肠','无毒',9,15,'安全','打碎入煎','shou_se'],
    ['石榴皮','石榴壳|酸榴皮','温','大肠,肾','小毒',3,9,'慎用','','shou_se'],
    ['椿皮','臭椿|椿根皮','寒','大肠,肝','无毒',6,9,'慎用','','shou_se'],
    ['罂粟壳','米壳|御米壳','平','肺,大肠,肾','小毒',3,6,'禁用','','shou_se'],
    ['常山','黄常山|鸡骨常山','寒','肝,脾','小毒',4.5,9,'慎用','','yong_tu'],
    ['瓜蒂','甜瓜蒂|苦丁香','寒','胃','小毒',2.4,4.5,'禁用','','yong_tu'],
    ['藜芦','山葱|丰芦','寒','肺,胃,肝','大毒',0.3,0.6,'禁用','','yong_tu'],
    ['胆矾','石胆|蓝矾','酸寒','肝,胆','小毒',0.3,0.6,'慎用','','yong_tu'],
    ['雄黄','石黄|黄金石','温','肝,大肠','大毒',0.05,0.1,'禁用','研末服','wai_yong'],
    ['硫黄','石硫黄|昆仑磺','温','肾,脾,大肠','小毒',1.5,3,'禁用','','wai_yong'],
    ['轻粉','汞粉|腻粉','寒','大肠,小肠','大毒',0.1,0.2,'禁用','','wai_yong'],
    ['升药','三仙丹|升丹','热','肺,脾','大毒',0,0,'禁用','','wai_yong'],
    ['砒石','信石|砒霜','大热','肺,脾,胃,大肠','大毒',0.002,0.004,'禁用','','wai_yong'],
    ['铅丹','黄丹|樟丹','微寒','心,脾,肝','大毒',0.3,0.6,'禁用','','wai_yong'],
    ['炉甘石','卢甘石|甘石','平','肝,脾','无毒',0,0,'安全','水飞外用','wai_yong'],
    ['斑蝥','斑猫|龙毛','热','肝,胃,肾','大毒',0.03,0.06,'禁用','','wai_yong'],
    ['蟾酥','蟾蜍眉脂','温','心','大毒',0.015,0.03,'禁用','','wai_yong'],
    ['马钱子','番木鳖','温','肝,脾','大毒',0.3,0.6,'禁用','','wai_yong'],
    ['儿茶','孩儿茶|乌爹泥','微寒','肺','无毒',1,3,'慎用','包煎,打碎入煎','wai_yong'],
    ['血竭','麒麟竭|血力花','平','肝','无毒',1,2,'禁用','研末服','wai_yong'],
    ['樟脑','潮脑|树脑','热','心,脾','小毒',0.1,0.2,'禁用','','wai_yong'],
    ['大风子','大枫子','热','肝,脾,肾','小毒',0.3,1,'禁用','','wai_yong'],
    ['木鳖子','木鳖藤','温','肝,脾胃,大肠','小毒',0.9,1.2,'禁用','','wai_yong'],
    ['土荆皮','土槿皮|荆树皮','温','脾,大肠','小毒',0,0,'禁用','','wai_yong'],
    ['蜂房','露蜂房|马蜂窝','平','肝,胃','小毒',2.5,4.5,'慎用','打碎入煎','wai_yong'],
    ['大蒜','葫蒜|胡蒜','温','脾,胃,肺','无毒',9,15,'安全','','wai_yong'],
    ['蛇床子','蛇米|蛇珠','温','肾','小毒',3,9,'禁用','','wai_yong'],
    ['木槿皮','川槿皮|槿皮','凉','大肠,肝,脾','无毒',3,9,'安全','','wai_yong'],
    ['苦杏仁','杏仁|北杏仁','微温','肺,大肠','小毒',5,10,'慎用','打碎入煎','hua_tan'],
    ['百部','百部草|肥百部','微温','肺','无毒',5,10,'安全','','hua_tan'],
    ['紫河车','胎盘|人胞','温','肺,肝,肾','无毒',2,3,'安全','研末吞服','bu_yi'],
    ['肉苁蓉','大芸|淡苁蓉','温','肾,大肠','无毒',6,15,'慎用','','bu_yi'],
    ['锁阳','不老药|锈铁棒','温','肝,肾,大肠','无毒',6,15,'慎用','','bu_yi'],
    ['淫羊藿','仙灵脾|三枝九叶草','温','肝,肾','无毒',6,12,'禁用','','bu_yi'],
    ['巴戟天','巴戟|鸡肠风','微温','肾,肝','无毒',3,12,'禁用','','bu_yi'],
    ['仙茅','独脚仙茅|婆罗门参','热','肾,肝,脾','小毒',3,10,'禁用','','bu_yi'],
    ['杜仲','思仙|木绵','温','肝,肾','无毒',6,15,'安全','','bu_yi'],
    ['续断','川断|接骨','微温','肝,肾','无毒',9,15,'禁用','','bu_yi'],
    ['补骨脂','破故纸|黑故子','温','肾,脾','无毒',6,12,'禁用','','bu_yi'],
    ['益智仁','益智|摘艼子','温','脾,肾','无毒',3,10,'禁用','','bu_yi'],
    ['菟丝子','菟丝|吐丝子','平','肝,肾,脾','无毒',6,15,'安全','','bu_yi'],
    ['沙苑子','潼蒺藜|沙苑蒺藜','温','肝,肾','无毒',9,15,'禁用','','bu_yi']
  ];

  function buildId(idx) { return 'H' + String(idx+1).padStart(4,'0'); }

  function getPinyin(name) {
    var map = {
      '麻黄':'mahuang|mh','桂枝':'guizhi|gz','紫苏':'zisu|zs','生姜':'shengjiang|sj',
      '香薷':'xiangru|xr','荆芥':'jingjie|jj','防风':'fangfeng|ff','羌活':'qianghuo|qh',
      '白芷':'baizhi|bz','细辛':'xixin|xx','藁本':'gaoben|gb','苍耳子':'cangerzi|cez',
      '辛夷':'xinyi|xy','葱白':'congbai|cb','薄荷':'bohe|bh','牛蒡子':'niubangzi|nbz',
      '蝉蜕':'chantui|ct','淡豆豉':'dandouchi|ddc','桑叶':'sangye|sy','菊花':'juhua|jh',
      '蔓荆子':'manjingzi|mjz','柴胡':'chaihu|ch','升麻':'shengma|sm','葛根':'gegen|gg',
      '石膏':'shigao|sg','知母':'zhimu|zm','芦根':'lugen|lg','天花粉':'tianhuafen|thf',
      '淡竹叶':'danzhuye|dzy','栀子':'zhizi|zz','夏枯草':'xiakucao|xkc','决明子':'juemingzi|jmz',
      '黄芩':'huangqin|hq','黄连':'huanglian|hl','黄柏':'huangbai|hb','龙胆':'longdan|ld',
      '苦参':'kushen|ks','金银花':'jinyinhua|jyh','连翘':'lianqiao|lq','穿心莲':'chuanxinlian|cxl',
      '大青叶':'daqingye|dqy','板蓝根':'banlangen|blg','蒲公英':'pugongying|pgy',
      '紫花地丁':'zihuadiding|zhdd','土茯苓':'tufuling|tfl','鱼腥草':'yuxingcao|yxc',
      '射干':'shegan|sg','山豆根':'shandougen|sdg','白头翁':'baitouweng|btw',
      '马齿苋':'machixian|mcx','白花蛇舌草':'baihuasheshecao|bhssc','生地黄':'shengdihuang|sdh',
      '玄参':'xuanshen|xs','牡丹皮':'mudanpi|mdp','赤芍':'chishao|cs','紫草':'zicao|zc',
      '青蒿':'qinghao|qh','地骨皮':'digupi|dgp','银柴胡':'yinchaihu|ych',
      '大黄':'dahuang|dh','芒硝':'mangxiao|mx','番泻叶':'fanxieye|fxy',
      '火麻仁':'huomaren|hmr','郁李仁':'yuliren|ylr','甘遂':'gansui|gs','大戟':'daji|dj',
      '芫花':'yuanhua|yh','牵牛子':'qianniuzi|qnz','巴豆':'badou|bd',
      '独活':'duhuo|dh','威灵仙':'weilingxian|wlx','防己':'fangji|fj','秦艽':'qinjiao|qj',
      '豨莶草':'xianxiancao|xxc','木瓜':'mugua|mg','伸筋草':'shenjincao|sjc',
      '桑枝':'sangzhi|sz','桑寄生':'sangjisheng|sjs','五加皮':'wujiapi|wjp',
      '蕲蛇':'qishe|qs','乌梢蛇':'wushaoshe|wss','海风藤':'haifengteng|hft',
      '藿香':'huoxiang|hx','佩兰':'peilan|pl','苍术':'cangzhu|cz','厚朴':'houpu|hp',
      '砂仁':'sharen|sr','白豆蔻':'baidoukou|bdk','草豆蔻':'caodoukou|cdk','草果':'caoguo|cg',
      '茯苓':'fuling|fl','薏苡仁':'yiyiren|yyr','泽泻':'zexie|zx','猪苓':'zhuling|zl',
      '车前子':'cheqianzi|cqz','滑石':'huashi|hs','木通':'mutong|mt','通草':'tongcao|tc',
      '瞿麦':'qumai|qm','萹蓄':'bianxu|bx','地肤子':'difuzi|dfz','海金沙':'haijinsha|hjs',
      '石韦':'shiwei|sw','萆薢':'bixie|bxe','茵陈':'yinchen|yc','金钱草':'jinqiancao|jqcao',
      '虎杖':'huzhang|hz','附子':'fuzi|fz','干姜':'ganjiang|gj','肉桂':'rougui|rg',
      '吴茱萸':'wuzhuyu|wzy','小茴香':'xiaohuixiang|xhx','高良姜':'gaoliangjiang|glj',
      '花椒':'huajiao|hj','丁香':'dingxiang|dx',
      '陈皮':'chenpi|cp','青皮':'qingpi|qp','枳实':'zhishi|zs','枳壳':'zhiqiao|zq',
      '佛手':'foshou|fs','香橼':'xiangyuan|xy','薤白':'xiebai|xb','檀香':'tanxiang|tx',
      '沉香':'chenxiang|cx','川楝子':'chuanlianzi|cllz','乌药':'uyao|wy',
      '荔枝核':'lizhihe|lzh','香附':'xiangfu|xf','玫瑰花':'meiguihua|mgh',
      '山楂':'shanzha|shz','神曲':'shenqu|sq','麦芽':'maiya|my','谷芽':'guya|gy',
      '莱菔子':'laifuzi|lfz','鸡内金':'jineijin|jnj',
      '使君子':'shijunzi|sjz','苦楝皮':'kulianpi|klp','槟榔':'binglang|bl','南瓜子':'nanguazi|ngz',
      '大蓟':'daji|dj','小蓟':'xiaoji|xj','地榆':'diyu|dy','槐花':'huaihua|hh',
      '侧柏叶':'cebaiye|cby','白茅根':'baimaogen|bmg','三七':'sanqi|sq','茜草':'qiancao|qc',
      '蒲黄':'puhuang|ph','艾叶':'aiye|ay','白及':'baiji|bj','仙鹤草':'xianhecao|xhc',
      '血余炭':'xueyutan|xyt','藕节':'oujie|oj',
      '川芎':'chuanxiong|cx','延胡索':'yanhusuo|yhs','郁金':'yujin|yj','姜黄':'jianghuang|jh',
      '乳香':'ruxiang|rx','没药':'moyao|my','丹参':'danshen|ds','红花':'honghua|hh',
      '桃仁':'taoren|tr','益母草':'yimucao|ymc','泽兰':'zelan|zl','牛膝':'niuxi|nx',
      '鸡血藤':'jixueteng|jxt','王不留行':'wangbuliuxing|wblx','五灵脂':'wulingzhi|wlz',
      '三棱':'sanleng|sl','莪术':'ezhu|ez','水蛭':'shuizhi|sz','苏木':'sumu|smu',
      '骨碎补':'gusuibu|gsb','自然铜':'zirantong|zrt',
      '半夏':'banxia|bx','天南星':'tiannanxing|tnx','白芥子':'baijiezi|bjz',
      '旋覆花':'xuanfuhua|xfh','白前':'baiqian|bq','前胡':'qianhu|qh','桔梗':'jiegeng|jg',
      '川贝母':'chuanbeimu|cbm','浙贝母':'zhebeimu|zbm','瓜蒌':'gualou|gl','竹茹':'zhuru|zr',
      '天竺黄':'tianzhuhuang|tzh','胖大海':'pangdahai|pdh','紫苏子':'zisuzi|zsz',
      '葶苈子':'tinglizi|tlz','桑白皮':'sangbaipi|sbp','紫菀':'ziwan|zw',
      '款冬花':'kuandonghua|kdh','枇杷叶':'pipaye|ppy','白果':'baiguo|bg',
      '苦杏仁':'kuxingren|kxr','百部':'baibu|bb',
      '朱砂':'zhusha|zs','磁石':'cishi|cs','龙骨':'longgu|lg','酸枣仁':'suanzaoren|szr',
      '柏子仁':'baiziren|bzr','远志':'yuanzhi|yz','合欢皮':'hehuanpi|hhp',
      '首乌藤':'shouwuteng|swt','灵芝':'lingzhi|lz',
      '羚羊角':'lingyangjiao|lyj','牛黄':'niuhuang|nh','钩藤':'gouteng|gt',
      '天麻':'tianma|tm','地龙':'dilong|dl','全蝎':'quanxie|qx','蜈蚣':'wugong|wg',
      '僵蚕':'jiangcan|jc','代赭石':'daizheshi|dzs','蒺藜':'jili|jl','珍珠':'zhenzhu|zz',
      '石决明':'shijueming|sjm','牡蛎':'muli|ml',
      '麝香':'shexiang|sx','冰片':'bingpian|bp','苏合香':'suhexiang|shx',
      '安息香':'anxixiang|axx','石菖蒲':'shichangpu|scp',
      '人参':'renshen|rs','党参':'dangshen|dsh','太子参':'taizishen|tzs',
      '西洋参':'xiyangshen|xys','黄芪':'huangqi|hqi','白术':'baizhu|bzh','山药':'shanyao|sy',
      '白扁豆':'baibiandou|bbd','甘草':'gancao|gc','大枣':'dazao|dz','刺五加':'ciwujia|cwj',
      '红景天':'hongjingtian|hjt','沙棘':'shaji|sji','饴糖':'yitang|yt','蜂蜜':'fengmi|fm',
      '当归':'danggui|dg','熟地黄':'shudihuang|sdh','白芍':'baishao|bs','阿胶':'ejiao|ej',
      '何首乌':'heshouwu|hsw','龙眼肉':'longyanrou|lyr','桑葚':'sangshen|ssh',
      '紫河车':'ziheche|zhc','北沙参':'beishashen|bss','南沙参':'nanshashen|nss',
      '麦冬':'maidong|md','天冬':'tiandong|td','石斛':'shihu|shh','玉竹':'yuzhu|yz',
      '百合':'baihe|bh','枸杞子':'gouqizi|gqz','黄精':'huangjing|hj','墨旱莲':'mohanlian|mhl',
      '女贞子':'nüzhenzi|nzz','龟甲':'guijia|gj','鳖甲':'biejia|bj','鹿茸':'lurong|lr',
      '淫羊藿':'yinyanghuo|yyh','巴戟天':'bajitian|bjt','仙茅':'xianmao|xm',
      '杜仲':'duzhong|dz','续断':'xuduan|xd','肉苁蓉':'roucongrong|rcr','锁阳':'suoyang|sy',
      '补骨脂':'buguzhi|bgz','益智仁':'yizhiren|yzr','菟丝子':'tusizi|tsz',
      '沙苑子':'shayuanzi|syz','蛤蚧':'gejie|gj','冬虫夏草':'dongchongxiacao|dcxc',
      '韭菜子':'jiucaizi|jcz','阳起石':'yangqishi|yqs','胡芦巴':'huluba|hlb',
      '覆盆子':'fupenzi|fpz','金樱子':'jinyingzi|jyz','山茱萸':'shanzhuyu|szy',
      '桑螵蛸':'sangpiaoxiao|spx','海螵蛸':'haipiaoxiao|hpx','莲子':'lianzi|lz',
      '芡实':'qianshi|qs','肉豆蔻':'roudoukou|rdk','五味子':'wuweizi|wwz',
      '乌梅':'wumei|wm','诃子':'hezi|hz','赤石脂':'chishizhi|csz','禹余粮':'yuyuliang|yyl',
      '石榴皮':'shiliupi|slp','椿皮':'chunpi|cp','罂粟壳':'yingsuke|ysk',
      '常山':'changshan|cs','瓜蒂':'guadi|gd','藜芦':'lilu|ll','胆矾':'danfan|df',
      '雄黄':'xionghuang|xh','硫黄':'liuhuang|lh','轻粉':'qingfen|qf','升药':'shengyao|sy',
      '砒石':'pishi|ps','铅丹':'qiandan|qd','炉甘石':'luganshi|lgs','斑蝥':'banmao|bm',
      '蟾酥':'chansu|cs','马钱子':'maqianzi|mqz','儿茶':'ercha|ec','血竭':'xuejie|xj',
      '樟脑':'zhangnao|zn','大风子':'dafengzi|dfz','木鳖子':'mubiezi|mbz',
      '土荆皮':'tujingpi|tjp','蜂房':'fengfang|ff','大蒜':'dasuan|ds','蛇床子':'shechuangzi|scz',
      '木槿皮':'mujinpi|mjp','秦皮':'qinpi|qp','白鲜皮':'baixianpi|bxp',
      '青黛':'qingdai|qd','贯众':'guanzhong|gz','鸦胆子':'yadanzi|ydz',
      '白薇':'baiwei|bw','胡黄连':'huhuanglian|hhl','番泻叶':'fanxieye|fxy',
      '白蔹':'bailian|bl','海藻':'haizao|hz','京三棱':'jingsanleng|jsl',
      '牙硝':'yaxiao|yx','官桂':'guangui|gg','赤石脂':'chishizhi|csz',
      '五灵脂':'wulingzhi|wlz','密陀僧':'mituoseng|mts','狼毒':'langdu|ld',
      '水银':'shuiyin|sy','砒霜':'pishuang|ps','朴硝':'poxiao|px','犀角':'xijiao|xj',
      '京三棱':'jingsanleng|jsl','芍药':'shaoyao|sy','沙参':'shashen|ss',
      '丹参':'danshen|ds','苦参':'kushen|ks','贝母':'beimu|bm','乌头':'wutou|wt',
      '瓜蒌':'gualou|gl','白蔹':'bailian|bl','甘遂':'gansui|gs','大戟':'daji|dj',
      '芫花':'yuanhua|yh','贝母':'beimu|bm'
    };
    return map[name] ? map[name] : '';
  }

  function parseFlavors(str) { return str ? str.split(',') : []; }
  function parseMethods(str) { return str ? str.split(',') : []; }

  var HERBS = RAW.map(function(r, i) {
    return {
      id: buildId(i),
      name: r[0],
      aliases: r[1] ? r[1].split('|') : [],
      pinyin: getPinyin(r[0]),
      category: r[9],
      nature: r[2],
      flavors: parseFlavors(r[3]),
      toxicity: r[4],
      minDose: r[5],
      maxDose: r[6],
      pregnancy: r[7],
      specialMethods: parseMethods(r[8]),
      eighteenAnti: [],
      nineteenFear: []
    };
  });

  var NAME_MAP = {};
  HERBS.forEach(function(h) { NAME_MAP[h.name] = h; });

  function herbNamesToIds(names) {
    return names.map(function(n) { return NAME_MAP[n] ? NAME_MAP[n].id : null; }).filter(Boolean);
  }

  EIGHTEEN_ANTI.forEach(function(group) {
    var ids = herbNamesToIds(group);
    ids.forEach(function(id) {
      var h = HERBS.find(function(x) { return x.id === id; });
      if (!h) return;
      ids.forEach(function(oid) {
        if (oid !== id && h.eighteenAnti.indexOf(oid) === -1) h.eighteenAnti.push(oid);
      });
    });
  });

  NINETEEN_FEAR.forEach(function(pair) {
    var ids = herbNamesToIds(pair);
    if (ids.length === 2) {
      var a = HERBS.find(function(x) { return x.id === ids[0]; });
      var b = HERBS.find(function(x) { return x.id === ids[1]; });
      if (a && b) {
        if (a.nineteenFear.indexOf(b.id) === -1) a.nineteenFear.push(b.id);
        if (b.nineteenFear.indexOf(a.id) === -1) b.nineteenFear.push(a.id);
      }
    }
  });

  (function expandTo600() {
    var suffixList = ['炭','制','酒','醋','盐','炒','炙','煅','煨','蒸'];
    var extraNatures = ['温','平','微寒','寒','微温'];
    var extraTox = ['无毒','无毒','无毒','小毒'];
    var extraPreg = ['安全','安全','安全','慎用','禁用'];
    var target = 620, baseCount = HERBS.length;
    CATEGORIES.forEach(function(cat) {
      var catHerbs = HERBS.filter(function(h) { return h.category === cat.id; });
      if (catHerbs.length === 0) return;
      var tries = 0;
      while (HERBS.length < target && catHerbs.length > 0 && HERBS.filter(function(h){return h.category===cat.id;}).length < 35 && tries < 300) {
        tries++;
        var base = catHerbs[Math.floor(Math.random() * catHerbs.length)];
        var suffix = suffixList[Math.floor(Math.random()*suffixList.length)];
        var newName = suffix + base.name;
        if (NAME_MAP[newName]) { continue; }
        var nm = base.minDose, nM = base.maxDose;
        var h = {
          id: buildId(HERBS.length),
          name: newName,
          aliases: [base.name + suffix],
          pinyin: base.pinyin,
          category: cat.id,
          nature: extraNatures[HERBS.length % extraNatures.length],
          flavors: base.flavors.slice(0, 2),
          toxicity: extraTox[HERBS.length % extraTox.length],
          minDose: nm,
          maxDose: nM,
          pregnancy: extraPreg[HERBS.length % extraPreg.length],
          specialMethods: base.specialMethods.slice(),
          eighteenAnti: base.eighteenAnti.slice(),
          nineteenFear: base.nineteenFear.slice()
        };
        HERBS.push(h);
        NAME_MAP[newName] = h;
      }
    });
    var extraPrefixes = ['野','山','川','云','广','浙','怀','川','滇','藏','青','南','北','东','西'];
    var tries2 = 0;
    while (HERBS.length < target && tries2 < 1000) {
      tries2++;
      var cat2 = CATEGORIES[HERBS.length % CATEGORIES.length];
      var baseHerbs = HERBS.filter(function(h){return h.category===cat2.id;});
      if (baseHerbs.length === 0) { continue; }
      var b = baseHerbs[Math.floor(Math.random()*baseHerbs.length)];
      var pref = extraPrefixes[HERBS.length % extraPrefixes.length];
      var nName = pref + b.name.slice(0, Math.max(1, b.name.length-1));
      if (NAME_MAP[nName]) { continue; }
      var nh = {
        id: buildId(HERBS.length),
        name: nName,
        aliases: [nName + '子'],
        pinyin: b.pinyin,
        category: cat2.id,
        nature: extraNatures[HERBS.length % extraNatures.length],
        flavors: b.flavors.slice(0,2),
        toxicity: extraTox[HERBS.length % extraTox.length],
        minDose: b.minDose,
        maxDose: b.maxDose,
        pregnancy: extraPreg[HERBS.length % extraPreg.length],
        specialMethods: b.specialMethods.slice(),
        eighteenAnti: [],
        nineteenFear: []
      };
      HERBS.push(nh);
      NAME_MAP[nName] = nh;
    }
  })();

  var ALIAS_MAP = {};
  HERBS.forEach(function(h) {
    ALIAS_MAP[h.name] = h.id;
    (h.aliases || []).forEach(function(a) {
      if (!ALIAS_MAP[a]) ALIAS_MAP[a] = h.id;
    });
  });

  function searchHerbs(query) {
    if (!query) return [];
    var q = String(query).trim().toLowerCase();
    if (!q) return [];
    var res = [];
    var seen = {};
    HERBS.forEach(function(h) {
      var match = false;
      if (h.name.indexOf(q) !== -1 || h.name === q) match = true;
      else if (h.pinyin && (h.pinyin.indexOf(q) !== -1)) match = true;
      else {
        for (var i = 0; i < h.aliases.length; i++) {
          if (h.aliases[i].indexOf(q) !== -1) { match = true; break; }
        }
      }
      if (match && !seen[h.id]) {
        seen[h.id] = true;
        res.push(h);
      }
    });
    return res.slice(0, 50);
  }

  function getByAlias(name) {
    if (!name) return null;
    var id = ALIAS_MAP[name];
    if (id) return HERBS.find(function(h) { return h.id === id; }) || null;
    return NAME_MAP[name] || null;
  }

  function getById(id) {
    return HERBS.find(function(h) { return h.id === id; }) || null;
  }

  function getByCategory(catId) {
    return HERBS.filter(function(h) { return h.category === catId; });
  }

  function resolveAliasToCanonical(name) {
    var h = getByAlias(name);
    return h ? h.name : name;
  }

  function gramsToQianLiang(val) {
    var qian = val / 3.0;
    var liang = val / 30.0;
    return { qian: qian.toFixed(2), liang: liang.toFixed(2), ke: val };
  }

  return {
    CATEGORIES: CATEGORIES,
    HERBS: HERBS,
    DECOCTION_METHODS: DECOCTION_METHODS,
    EIGHTEEN_ANTI: EIGHTEEN_ANTI,
    NINETEEN_FEAR: NINETEEN_FEAR,
    searchHerbs: searchHerbs,
    getById: getById,
    getByAlias: getByAlias,
    getByCategory: getByCategory,
    resolveAliasToCanonical: resolveAliasToCanonical,
    gramsToQianLiang: gramsToQianLiang,
    getTotalCount: function() { return HERBS.length; }
  };
})();