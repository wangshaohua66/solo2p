import type { FurnitureCatalogItem } from '@/types'
import { generateId } from '@/utils/geometry'

const colors = {
  wood: '#8B4513',
  lightWood: '#DEB887',
  darkWood: '#654321',
  white: '#FAFAFA',
  gray: '#808080',
  black: '#2F2F2F',
  blue: '#4A90D9',
  green: '#4CAF50',
  red: '#E57373',
  yellow: '#FFD54F',
  purple: '#9C27B0',
  orange: '#FF8A65',
  pink: '#F48FB1',
  brown: '#A1887F',
  metal: '#B0BEC5'
}

function createItem(
  name: string,
  category: string,
  subcategory: string,
  width: number,
  height: number,
  color: string,
  icon: string
): FurnitureCatalogItem {
  return {
    id: generateId(),
    name,
    category,
    subcategory,
    width,
    height,
    color,
    icon
  }
}

export const furnitureCatalog: FurnitureCatalogItem[] = [
  // 客厅 - 沙发
  createItem('三人沙发', '客厅', '沙发', 2200, 900, colors.gray, '🛋️'),
  createItem('双人沙发', '客厅', '沙发', 1600, 900, colors.gray, '🛋️'),
  createItem('单人沙发', '客厅', '沙发', 900, 900, colors.gray, '🛋️'),
  createItem('L型沙发', '客厅', '沙发', 2800, 1800, colors.darkWood, '🛋️'),
  createItem('贵妃榻', '客厅', '沙发', 1800, 800, colors.lightWood, '🛋️'),
  createItem('模块化沙发', '客厅', '沙发', 3200, 1000, colors.blue, '🛋️'),
  createItem('休闲沙发椅', '客厅', '沙发', 800, 800, colors.green, '🪑'),
  createItem('懒人沙发', '客厅', '沙发', 1200, 1000, colors.pink, '🛋️'),
  
  // 客厅 - 茶几
  createItem('方形茶几', '客厅', '茶几', 1200, 600, colors.wood, '🪑'),
  createItem('圆形茶几', '客厅', '茶几', 800, 800, colors.metal, '🔘'),
  createItem('玻璃茶几', '客厅', '茶几', 1400, 700, colors.white, '🪟'),
  createItem('组合茶几', '客厅', '茶几', 1000, 500, colors.darkWood, '🪑'),
  createItem('边几', '客厅', '茶几', 500, 500, colors.lightWood, '🔲'),
  createItem('角几', '客厅', '茶几', 600, 600, colors.wood, '🔲'),
  
  // 客厅 - 电视柜
  createItem('地柜式电视柜', '客厅', '电视柜', 2400, 450, colors.darkWood, '📺'),
  createItem('悬挂式电视柜', '客厅', '电视柜', 1800, 300, colors.white, '📺'),
  createItem('组合电视柜', '客厅', '电视柜', 3000, 600, colors.wood, '📺'),
  createItem('简约电视柜', '客厅', '电视柜', 1600, 400, colors.gray, '📺'),
  
  // 客厅 - 装饰
  createItem('落地灯', '客厅', '装饰', 400, 400, colors.yellow, '💡'),
  createItem('台灯', '客厅', '装饰', 300, 300, colors.yellow, '💡'),
  createItem('盆栽', '客厅', '装饰', 500, 500, colors.green, '🪴'),
  createItem('挂画', '客厅', '装饰', 800, 600, colors.white, '🖼️'),
  createItem('地毯', '客厅', '装饰', 2000, 1500, colors.red, '🟥'),
  createItem('窗帘', '客厅', '装饰', 3000, 2800, colors.blue, '🪟'),
  
  // 卧室 - 床
  createItem('双人床', '卧室', '床', 2000, 1800, colors.wood, '🛏️'),
  createItem('单人床', '卧室', '床', 2000, 1000, colors.lightWood, '🛏️'),
  createItem('儿童床', '卧室', '床', 1800, 900, colors.blue, '🛏️'),
  createItem('榻榻米床', '卧室', '床', 2200, 1800, colors.gray, '🛏️'),
  createItem('高架床', '卧室', '床', 2000, 1200, colors.darkWood, '🛏️'),
  createItem('沙发床', '卧室', '床', 2000, 1000, colors.gray, '🛋️'),
  createItem('圆床', '卧室', '床', 2200, 2200, colors.pink, '🔴'),
  
  // 卧室 - 衣柜
  createItem('四门衣柜', '卧室', '衣柜', 2400, 600, colors.wood, '🚪'),
  createItem('三门衣柜', '卧室', '衣柜', 1800, 600, colors.darkWood, '🚪'),
  createItem('两门衣柜', '卧室', '衣柜', 1200, 600, colors.lightWood, '🚪'),
  createItem('步入式衣柜', '卧室', '衣柜', 3000, 800, colors.white, '🚪'),
  createItem('推拉门衣柜', '卧室', '衣柜', 2000, 650, colors.gray, '🚪'),
  createItem('衣帽间', '卧室', '衣柜', 3500, 2000, colors.brown, '🚪'),
  
  // 卧室 - 床头柜
  createItem('床头柜', '卧室', '床头柜', 500, 450, colors.wood, '🗄️'),
  createItem('简约床头柜', '卧室', '床头柜', 450, 400, colors.white, '🗄️'),
  createItem('组合床头柜', '卧室', '床头柜', 600, 500, colors.darkWood, '🗄️'),
  
  // 卧室 - 梳妆台
  createItem('梳妆台', '卧室', '梳妆台', 1200, 500, colors.lightWood, '🪞'),
  createItem('化妆台', '卧室', '梳妆台', 1000, 450, colors.white, '🪞'),
  createItem('带镜梳妆台', '卧室', '梳妆台', 1400, 550, colors.pink, '🪞'),
  
  // 卧室 - 装饰
  createItem('床头灯', '卧室', '装饰', 300, 300, colors.yellow, '💡'),
  createItem('落地镜', '卧室', '装饰', 600, 1800, colors.metal, '🪞'),
  createItem('卧室地毯', '卧室', '装饰', 1800, 1200, colors.purple, '🟪'),
  createItem('衣柜镜', '卧室', '装饰', 400, 1500, colors.metal, '🪞'),
  
  // 厨房 - 橱柜
  createItem('地柜', '厨房', '橱柜', 600, 850, colors.darkWood, '🗄️'),
  createItem('吊柜', '厨房', '橱柜', 600, 700, colors.lightWood, '🗄️'),
  createItem('转角柜', '厨房', '橱柜', 900, 900, colors.wood, '🗄️'),
  createItem('高柜', '厨房', '橱柜', 600, 2200, colors.white, '🗄️'),
  createItem('抽屉柜', '厨房', '橱柜', 800, 850, colors.gray, '🗄️'),
  createItem('开放柜', '厨房', '橱柜', 600, 400, colors.brown, '📦'),
  createItem('L型橱柜', '厨房', '橱柜', 2400, 1800, colors.darkWood, '🗄️'),
  createItem('一字型橱柜', '厨房', '橱柜', 3000, 600, colors.wood, '🗄️'),
  createItem('岛台', '厨房', '橱柜', 1800, 900, colors.white, '🗄️'),
  createItem('吧台', '厨房', '橱柜', 1500, 600, colors.wood, '🍹'),
  
  // 厨房 - 电器
  createItem('燃气灶', '厨房', '电器', 800, 500, colors.black, '🔥'),
  createItem('抽油烟机', '厨房', '电器', 900, 500, colors.metal, '💨'),
  createItem('洗碗机', '厨房', '电器', 600, 850, colors.gray, '🧼'),
  createItem('冰箱', '厨房', '电器', 700, 1800, colors.white, '🧊'),
  createItem('双开门冰箱', '厨房', '电器', 1200, 1800, colors.gray, '🧊'),
  createItem('微波炉', '厨房', '电器', 500, 300, colors.black, '📻'),
  createItem('烤箱', '厨房', '电器', 600, 600, colors.black, '🔥'),
  createItem('蒸箱', '厨房', '电器', 600, 450, colors.gray, '💨'),
  createItem('消毒柜', '厨房', '电器', 600, 650, colors.metal, '🧴'),
  createItem('净水器', '厨房', '电器', 400, 500, colors.white, '💧'),
  
  // 厨房 - 水槽
  createItem('单槽水槽', '厨房', '水槽', 600, 500, colors.metal, '🚿'),
  createItem('双槽水槽', '厨房', '水槽', 800, 500, colors.metal, '🚿'),
  createItem('台下盆', '厨房', '水槽', 500, 400, colors.white, '🚰'),
  createItem('集成水槽', '厨房', '水槽', 900, 600, colors.metal, '🚿'),
  
  // 厨房 - 餐桌椅
  createItem('餐桌', '厨房', '餐桌椅', 1600, 900, colors.wood, '🪑'),
  createItem('圆桌', '厨房', '餐桌椅', 1200, 1200, colors.darkWood, '🔵'),
  createItem('方桌', '厨房', '餐桌椅', 900, 900, colors.lightWood, '🔲'),
  createItem('餐椅', '厨房', '餐桌椅', 450, 500, colors.wood, '🪑'),
  createItem('餐椅(软包)', '厨房', '餐桌椅', 450, 500, colors.gray, '🪑'),
  createItem('长凳', '厨房', '餐桌椅', 1200, 400, colors.wood, '🪑'),
  
  // 卫生间 - 卫浴
  createItem('坐便器', '卫生间', '卫浴', 400, 700, colors.white, '🚽'),
  createItem('智能马桶', '卫生间', '卫浴', 450, 700, colors.white, '🚽'),
  createItem('洗手台', '卫生间', '卫浴', 1000, 550, colors.white, '🚰'),
  createItem('双盆洗手台', '卫生间', '卫浴', 1500, 550, colors.white, '🚰'),
  createItem('立柱盆', '卫生间', '卫浴', 500, 500, colors.white, '🚰'),
  createItem('浴缸', '卫生间', '卫浴', 1700, 800, colors.white, '🛁'),
  createItem('按摩浴缸', '卫生间', '卫浴', 1800, 900, colors.white, '🛁'),
  createItem('淋浴房', '卫生间', '卫浴', 1000, 1000, colors.metal, '🚿'),
  createItem('整体淋浴房', '卫生间', '卫浴', 1200, 1200, colors.metal, '🚿'),
  createItem('淋浴屏', '卫生间', '卫浴', 1400, 2000, colors.metal, '🪟'),
  
  // 卫生间 - 收纳
  createItem('浴室柜', '卫生间', '收纳', 1200, 550, colors.wood, '🗄️'),
  createItem('镜柜', '卫生间', '收纳', 800, 800, colors.white, '🪞'),
  createItem('吊柜', '卫生间', '收纳', 600, 600, colors.white, '🗄️'),
  createItem('置物架', '卫生间', '收纳', 400, 1200, colors.metal, '📦'),
  createItem('毛巾架', '卫生间', '收纳', 600, 100, colors.metal, '🧺'),
  createItem('卫生纸架', '卫生间', '收纳', 200, 200, colors.metal, '🧻'),
  
  // 卫生间 - 装饰
  createItem('浴霸', '卫生间', '装饰', 300, 300, colors.white, '💡'),
  createItem('排气扇', '卫生间', '装饰', 200, 200, colors.gray, '💨'),
  createItem('浴室挂件', '卫生间', '装饰', 500, 200, colors.metal, '🧺'),
  createItem('防水镜', '卫生间', '装饰', 800, 1000, colors.metal, '🪞'),
  
  // 书房
  createItem('书桌', '书房', '书桌', 1600, 800, colors.wood, '📚'),
  createItem('电脑桌', '书房', '书桌', 1400, 700, colors.darkWood, '💻'),
  createItem('转角书桌', '书房', '书桌', 1800, 1200, colors.wood, '📚'),
  createItem('升降桌', '书房', '书桌', 1600, 800, colors.metal, '📊'),
  createItem('书柜', '书房', '书柜', 2000, 2200, colors.darkWood, '📚'),
  createItem('书架', '书房', '书柜', 1200, 2000, colors.lightWood, '📚'),
  createItem('文件柜', '书房', '书柜', 800, 1800, colors.gray, '📁'),
  createItem('办公椅', '书房', '座椅', 600, 600, colors.black, '🪑'),
  createItem('人体工学椅', '书房', '座椅', 700, 700, colors.gray, '🪑'),
  createItem('书房沙发', '书房', '座椅', 1200, 800, colors.brown, '🛋️'),
  createItem('台灯', '书房', '装饰', 300, 400, colors.yellow, '💡'),
  createItem('落地灯', '书房', '装饰', 400, 1600, colors.yellow, '💡'),
  createItem('装饰画', '书房', '装饰', 700, 500, colors.white, '🖼️'),
  createItem('绿植', '书房', '装饰', 400, 400, colors.green, '🪴'),
  
  // 餐厅
  createItem('餐桌', '餐厅', '餐桌', 1800, 900, colors.wood, '🍽️'),
  createItem('六人餐桌', '餐厅', '餐桌', 2200, 1000, colors.darkWood, '🍽️'),
  createItem('八人餐桌', '餐厅', '餐桌', 2400, 1100, colors.wood, '🍽️'),
  createItem('折叠餐桌', '餐厅', '餐桌', 1200, 800, colors.lightWood, '🍽️'),
  createItem('餐椅', '餐厅', '餐椅', 450, 550, colors.wood, '🪑'),
  createItem('餐椅(布艺)', '餐厅', '餐椅', 450, 550, colors.gray, '🪑'),
  createItem('餐椅(皮艺)', '餐厅', '餐椅', 450, 550, colors.brown, '🪑'),
  createItem('餐边柜', '餐厅', '收纳', 1800, 850, colors.darkWood, '🗄️'),
  createItem('酒柜', '餐厅', '收纳', 1200, 2200, colors.wood, '🍷'),
  createItem('展示柜', '餐厅', '收纳', 1500, 2000, colors.white, '🗄️'),
  createItem('餐边架', '餐厅', '收纳', 1000, 900, colors.metal, '📦'),
  createItem('吊灯', '餐厅', '装饰', 800, 100, colors.yellow, '💡'),
  createItem('壁灯', '餐厅', '装饰', 300, 300, colors.yellow, '💡'),
  createItem('餐厅装饰画', '餐厅', '装饰', 1000, 700, colors.white, '🖼️'),
  createItem('餐厅地毯', '餐厅', '装饰', 2400, 1600, colors.orange, '🟧'),
  
  // 玄关
  createItem('玄关柜', '玄关', '收纳', 1200, 1000, colors.wood, '🚪'),
  createItem('鞋柜', '玄关', '收纳', 1500, 1100, colors.darkWood, '👟'),
  createItem('换鞋凳', '玄关', '收纳', 800, 450, colors.lightWood, '🪑'),
  createItem('玄关台', '玄关', '收纳', 1000, 850, colors.wood, '🪑'),
  createItem('衣帽架', '玄关', '收纳', 500, 1800, colors.metal, '🧥'),
  createItem('挂衣板', '玄关', '收纳', 1000, 300, colors.wood, '🧥'),
  createItem('穿衣镜', '玄关', '装饰', 600, 1800, colors.metal, '🪞'),
  createItem('玄关灯', '玄关', '装饰', 400, 400, colors.yellow, '💡'),
  createItem('玄关挂画', '玄关', '装饰', 800, 600, colors.white, '🖼️'),
  createItem('地垫', '玄关', '装饰', 1200, 800, colors.red, '🟥'),
  
  // 阳台
  createItem('洗衣柜', '阳台', '收纳', 1500, 900, colors.white, '🧺'),
  createItem('洗衣机', '阳台', '电器', 600, 850, colors.gray, '🧺'),
  createItem('烘干机', '阳台', '电器', 600, 850, colors.gray, '🌞'),
  createItem('洗手池', '阳台', '卫浴', 600, 500, colors.white, '🚰'),
  createItem('晾衣架', '阳台', '收纳', 2000, 300, colors.metal, '🧺'),
  createItem('阳台柜', '阳台', '收纳', 1200, 800, colors.wood, '🗄️'),
  createItem('花架', '阳台', '装饰', 800, 1200, colors.metal, '🪴'),
  createItem('休闲桌椅', '阳台', '装饰', 700, 700, colors.brown, '🪑'),
  createItem('吊椅', '阳台', '装饰', 800, 1500, colors.orange, '🪑'),
  
  // 办公
  createItem('办公桌', '办公', '桌子', 1600, 800, colors.gray, '💼'),
  createItem('主管桌', '办公', '桌子', 2000, 1000, colors.darkWood, '💼'),
  createItem('会议桌', '办公', '桌子', 3000, 1400, colors.wood, '📋'),
  createItem('培训桌', '办公', '桌子', 1200, 600, colors.gray, '📋'),
  createItem('职员椅', '办公', '椅子', 600, 600, colors.black, '🪑'),
  createItem('会议椅', '办公', '椅子', 600, 600, colors.gray, '🪑'),
  createItem('班前椅', '办公', '椅子', 550, 550, colors.black, '🪑'),
  createItem('文件柜', '办公', '柜子', 900, 1800, colors.gray, '📁'),
  createItem('资料柜', '办公', '柜子', 900, 2000, colors.metal, '📁'),
  createItem('更衣柜', '办公', '柜子', 900, 1800, colors.gray, '👔'),
  createItem('密集柜', '办公', '柜子', 1200, 2000, colors.metal, '📚'),
  createItem('茶水柜', '办公', '柜子', 1200, 850, colors.wood, '☕'),
  createItem('打印机柜', '办公', '柜子', 600, 600, colors.gray, '🖨️'),
  createItem('前台', '办公', '接待', 2400, 700, colors.white, '🏢'),
  createItem('接待台', '办公', '接待', 1800, 700, colors.gray, '🏢'),
  createItem('访客沙发', '办公', '接待', 2000, 900, colors.black, '🛋️'),
  createItem('访客茶几', '办公', '接待', 1200, 600, colors.metal, '☕'),
  
  // 儿童房
  createItem('儿童床', '儿童房', '床', 1800, 1000, colors.blue, '🛏️'),
  createItem('婴儿床', '儿童房', '床', 1400, 700, colors.white, '🛏️'),
  createItem('上下铺', '儿童房', '床', 2000, 1000, colors.wood, '🛏️'),
  createItem('滑梯床', '儿童房', '床', 2200, 1200, colors.pink, '🎢'),
  createItem('儿童书桌', '儿童房', '书桌', 1200, 600, colors.blue, '📚'),
  createItem('儿童椅', '儿童房', '椅子', 400, 400, colors.yellow, '🪑'),
  createItem('儿童衣柜', '儿童房', '衣柜', 1500, 550, colors.pink, '👕'),
  createItem('玩具架', '儿童房', '收纳', 1200, 800, colors.green, '🧸'),
  createItem('绘本架', '儿童房', '收纳', 1000, 1200, colors.blue, '📚'),
  createItem('儿童地毯', '儿童房', '装饰', 2000, 1500, colors.yellow, '🟨'),
  createItem('卡通吊灯', '儿童房', '装饰', 500, 200, colors.pink, '💡'),
  createItem('黑板墙', '儿童房', '装饰', 1500, 1000, colors.black, '📝'),
  
  // 衣帽间
  createItem('衣柜系统', '衣帽间', '系统', 3000, 600, colors.wood, '👔'),
  createItem('玻璃衣柜', '衣帽间', '系统', 2000, 600, colors.metal, '👗'),
  createItem('开放式衣帽间', '衣帽间', '系统', 3500, 2000, colors.darkWood, '👔'),
  createItem('中岛台', '衣帽间', '收纳', 1500, 800, colors.white, '💍'),
  createItem('鞋架', '衣帽间', '收纳', 1500, 1200, colors.wood, '👟'),
  createItem('包包架', '衣帽间', '收纳', 1000, 800, colors.metal, '👜'),
  createItem('首饰柜', '衣帽间', '收纳', 800, 1000, colors.darkWood, '💍'),
  createItem('试衣镜', '衣帽间', '装饰', 800, 2000, colors.metal, '🪞'),
  createItem('梳妆台', '衣帽间', '装饰', 1200, 500, colors.white, '💄'),
  
  // 影音室
  createItem('观影沙发', '影音室', '沙发', 2500, 1000, colors.black, '🎬'),
  createItem('单人影院椅', '影音室', '沙发', 800, 1000, colors.brown, '🪑'),
  createItem('投影仪', '影音室', '设备', 400, 300, colors.black, '📽️'),
  createItem('幕布', '影音室', '设备', 3000, 1700, colors.white, '🖼️'),
  createItem('音响', '影音室', '设备', 300, 1000, colors.black, '🔊'),
  createItem('功放柜', '影音室', '设备', 600, 800, colors.black, '🎛️'),
  createItem('设备架', '影音室', '设备', 800, 600, colors.metal, '📦'),
  createItem('影音柜', '影音室', '收纳', 2000, 600, colors.darkWood, '🗄️'),
  createItem('吸音板', '影音室', '装饰', 1200, 600, colors.gray, '🔇'),
  createItem('星空顶', '影音室', '装饰', 3000, 2000, colors.black, '✨'),
  
  // 健身房
  createItem('跑步机', '健身房', '器材', 1800, 800, colors.black, '🏃'),
  createItem('椭圆机', '健身房', '器材', 1500, 700, colors.gray, '🚴'),
  createItem('动感单车', '健身房', '器材', 1200, 600, colors.black, '🚴'),
  createItem('力量训练器', '健身房', '器材', 2000, 1500, colors.gray, '💪'),
  createItem('哑铃架', '健身房', '器材', 1200, 600, colors.metal, '🏋️'),
  createItem('瑜伽垫', '健身房', '器材', 1800, 600, colors.purple, '🧘'),
  createItem('健身球', '健身房', '器材', 600, 600, colors.blue, '🔵'),
  createItem('镜子墙', '健身房', '装饰', 3000, 2000, colors.metal, '🪞'),
  createItem('储物柜', '健身房', '收纳', 1800, 1800, colors.gray, '🗄️'),
  createItem('饮水机', '健身房', '电器', 400, 1200, colors.white, '💧'),
  
  // 客厅 - 补充沙发
  createItem('皮艺三人沙发', '客厅', '沙发', 2300, 950, colors.brown, '🛋️'),
  createItem('布艺双人沙发', '客厅', '沙发', 1700, 950, colors.orange, '🛋️'),
  createItem('北欧单人椅', '客厅', '沙发', 750, 800, colors.white, '🪑'),
  createItem('U型组合沙发', '客厅', '沙发', 3600, 2000, colors.darkWood, '🛋️'),
  createItem('折叠沙发床', '客厅', '沙发', 2000, 1100, colors.gray, '🛋️'),
  createItem('新中式沙发', '客厅', '沙发', 2400, 900, colors.wood, '🛋️'),
  createItem('儿童小沙发', '客厅', '沙发', 600, 500, colors.pink, '🛋️'),
  
  // 客厅 - 补充茶几
  createItem('升降茶几', '客厅', '茶几', 1300, 700, colors.white, '🔲'),
  createItem('岩板茶几', '客厅', '茶几', 1400, 800, colors.metal, '🔲'),
  createItem('储物茶几', '客厅', '茶几', 1200, 650, colors.darkWood, '🗄️'),
  createItem('实木长茶几', '客厅', '茶几', 1600, 700, colors.wood, '🔲'),
  createItem('异形茶几', '客厅', '茶几', 1100, 900, colors.purple, '🔘'),
  createItem('双层边几', '客厅', '茶几', 450, 450, colors.lightWood, '🔲'),
  createItem('移动边几', '客厅', '茶几', 400, 500, colors.metal, '🔲'),
  createItem('沙发背几', '客厅', '茶几', 1800, 350, colors.wood, '🔲'),
  
  // 客厅 - 补充电视柜
  createItem('实木电视柜', '客厅', '电视柜', 2200, 500, colors.wood, '📺'),
  createItem('北欧电视柜', '客厅', '电视柜', 2000, 450, colors.lightWood, '📺'),
  createItem('轻奢电视柜', '客厅', '电视柜', 2400, 500, colors.metal, '📺'),
  createItem('带抽屉电视柜', '客厅', '电视柜', 1800, 550, colors.darkWood, '🗄️'),
  createItem('壁挂式电视柜', '客厅', '电视柜', 1600, 250, colors.white, '📺'),
  
  // 客厅 - 补充装饰
  createItem('水晶吊灯', '客厅', '装饰', 600, 600, colors.yellow, '💡'),
  createItem('吸顶灯', '客厅', '装饰', 800, 100, colors.white, '💡'),
  createItem('大型绿植', '客厅', '装饰', 700, 700, colors.green, '🪴'),
  createItem('组合挂画', '客厅', '装饰', 1200, 800, colors.white, '🖼️'),
  createItem('玄关隔断柜', '客厅', '装饰', 1500, 1200, colors.wood, '🗄️'),
  createItem('电视柜背景墙', '客厅', '装饰', 3600, 2400, colors.white, '🖼️'),
  createItem('羊毛地毯', '客厅', '装饰', 2400, 1700, colors.brown, '🟥'),
  createItem('竹百叶帘', '客厅', '装饰', 2500, 2000, colors.lightWood, '🪟'),
  createItem('罗马杆窗帘', '客厅', '装饰', 3200, 2600, colors.purple, '🪟'),
  
  // 卧室 - 补充床
  createItem('1.5m双人床', '卧室', '床', 2000, 1500, colors.white, '🛏️'),
  createItem('1.8m布艺床', '卧室', '床', 2100, 1900, colors.gray, '🛏️'),
  createItem('真皮软包床', '卧室', '床', 2100, 2000, colors.brown, '🛏️'),
  createItem('北欧实木床', '卧室', '床', 2000, 1800, colors.lightWood, '🛏️'),
  createItem('轻奢镀金床', '卧室', '床', 2100, 1900, colors.metal, '🛏️'),
  createItem('抽屉储物床', '卧室', '床', 2100, 1800, colors.darkWood, '🛏️'),
  createItem('气压杆高箱床', '卧室', '床', 2100, 1800, colors.white, '🛏️'),
  
  // 卧室 - 补充衣柜
  createItem('五门衣柜', '卧室', '衣柜', 3000, 600, colors.lightWood, '🚪'),
  createItem('六门衣柜', '卧室', '衣柜', 3600, 650, colors.darkWood, '🚪'),
  createItem('实木衣柜', '卧室', '衣柜', 2400, 600, colors.wood, '🚪'),
  createItem('烤漆衣柜', '卧室', '衣柜', 2000, 600, colors.white, '🚪'),
  createItem('转角衣柜', '卧室', '衣柜', 2400, 1800, colors.wood, '🚪'),
  
  // 卧室 - 补充床头柜/梳妆台
  createItem('岩板床头柜', '卧室', '床头柜', 500, 400, colors.metal, '🗄️'),
  createItem('皮艺床头柜', '卧室', '床头柜', 550, 450, colors.brown, '🗄️'),
  createItem('轻奢梳妆台', '卧室', '梳妆台', 1000, 500, colors.white, '🪞'),
  createItem('实木梳妆台', '卧室', '梳妆台', 1100, 500, colors.wood, '🪞'),
  createItem('卧室斗柜', '卧室', '床头柜', 1200, 450, colors.darkWood, '🗄️'),
  
  // 卧室 - 补充装饰
  createItem('卧室吸顶灯', '卧室', '装饰', 500, 100, colors.white, '💡'),
  createItem('床头壁灯', '卧室', '装饰', 200, 300, colors.yellow, '💡'),
  createItem('卧室窗帘', '卧室', '装饰', 2800, 2500, colors.blue, '🪟'),
  createItem('卧室床尾凳', '卧室', '装饰', 1500, 400, colors.brown, '🪑'),
  createItem('卧室挂衣架', '卧室', '装饰', 600, 1700, colors.metal, '🧥'),
  
  // 厨房 - 补充橱柜
  createItem('不锈钢橱柜', '厨房', '橱柜', 600, 850, colors.metal, '🗄️'),
  createItem('晶钢门橱柜', '厨房', '橱柜', 600, 850, colors.white, '🗄️'),
  createItem('模压门橱柜', '厨房', '橱柜', 600, 850, colors.lightWood, '🗄️'),
  createItem('实木门板橱柜', '厨房', '橱柜', 600, 850, colors.wood, '🗄️'),
  createItem('U型整体橱柜', '厨房', '橱柜', 3600, 2400, colors.darkWood, '🗄️'),
  createItem('厨房中岛柜', '厨房', '橱柜', 1500, 900, colors.white, '🗄️'),
  createItem('厨房操作台', '厨房', '橱柜', 1800, 800, colors.metal, '🔲'),
  createItem('厨房调味拉篮', '厨房', '橱柜', 200, 500, colors.metal, '📦'),
  
  // 厨房 - 补充电器/餐桌椅
  createItem('集成灶', '厨房', '电器', 900, 600, colors.black, '🔥'),
  createItem('破壁机', '厨房', '电器', 200, 300, colors.white, '🍹'),
  createItem('电饭煲', '厨房', '电器', 300, 250, colors.white, '🍳'),
  createItem('空气炸锅', '厨房', '电器', 300, 300, colors.gray, '🔥'),
  createItem('厨师机', '厨房', '电器', 250, 350, colors.red, '🍳'),
  createItem('长餐桌', '厨房', '餐桌椅', 2000, 1000, colors.darkWood, '🪑'),
  createItem('折叠餐椅', '厨房', '餐桌椅', 450, 500, colors.wood, '🪑'),
  createItem('吧台椅', '厨房', '餐桌椅', 400, 400, colors.metal, '🪑'),
  createItem('岛台吊灯', '厨房', '电器', 300, 300, colors.yellow, '💡'),
  
  // 卫生间 - 补充卫浴/收纳
  createItem('壁挂马桶', '卫生间', '卫浴', 400, 550, colors.white, '🚽'),
  createItem('蹲便器', '卫生间', '卫浴', 500, 400, colors.white, '🚽'),
  createItem('妇洗器', '卫生间', '卫浴', 400, 600, colors.white, '🚽'),
  createItem('整体浴室柜', '卫生间', '卫浴', 1200, 600, colors.wood, '🗄️'),
  createItem('干湿分离隔断', '卫生间', '卫浴', 1500, 2000, colors.metal, '🪟'),
  createItem('卫生间收纳柜', '卫生间', '收纳', 400, 1500, colors.white, '🗄️'),
  createItem('卫生间边柜', '卫生间', '收纳', 300, 800, colors.metal, '📦'),
  createItem('智能浴室镜', '卫生间', '装饰', 800, 1000, colors.metal, '🪞'),
  createItem('电热毛巾架', '卫生间', '装饰', 600, 800, colors.metal, '🧺'),
  createItem('淋浴花洒套装', '卫生间', '卫浴', 300, 300, colors.metal, '🚿'),
  
  // 书房 - 补充
  createItem('实木大书桌', '书房', '书桌', 2000, 1000, colors.wood, '📚'),
  createItem('北欧风书桌', '书房', '书桌', 1400, 700, colors.lightWood, '📚'),
  createItem('儿童学习桌', '书房', '书桌', 1200, 700, colors.blue, '📚'),
  createItem('带抽屉书桌', '书房', '书桌', 1600, 800, colors.darkWood, '🗄️'),
  createItem('实木书柜', '书房', '书柜', 1800, 2200, colors.wood, '📚'),
  createItem('带玻璃门书柜', '书房', '书柜', 1600, 2200, colors.metal, '📚'),
  createItem('格子柜', '书房', '书柜', 1200, 1200, colors.white, '📚'),
  createItem('老板椅', '书房', '座椅', 700, 750, colors.black, '🪑'),
  createItem('会议椅', '书房', '座椅', 600, 600, colors.gray, '🪑'),
  createItem('书房地毯', '书房', '装饰', 1800, 1200, colors.blue, '🟦'),
  
  // 餐厅 - 补充
  createItem('10人餐桌', '餐厅', '餐桌', 2800, 1200, colors.darkWood, '🍽️'),
  createItem('4人方桌', '餐厅', '餐桌', 900, 900, colors.lightWood, '🍽️'),
  createItem('岩板餐桌', '餐厅', '餐桌', 1600, 900, colors.metal, '🍽️'),
  createItem('伸缩餐桌', '餐厅', '餐桌', 1400, 850, colors.wood, '🍽️'),
  createItem('实木餐椅', '餐厅', '餐椅', 450, 550, colors.wood, '🪑'),
  createItem('金属餐椅', '餐厅', '餐椅', 450, 500, colors.metal, '🪑'),
  createItem('实木餐边柜', '餐厅', '收纳', 1600, 900, colors.wood, '🗄️'),
  createItem('餐厅酒柜', '餐厅', '收纳', 1800, 2000, colors.darkWood, '🍷'),
  createItem('餐厅吊灯', '餐厅', '装饰', 1000, 200, colors.yellow, '💡'),
  createItem('餐边镜', '餐厅', '装饰', 1000, 700, colors.metal, '🪞'),
  
  // 玄关 - 补充
  createItem('隔断玄关柜', '玄关', '收纳', 1500, 2000, colors.wood, '🚪'),
  createItem('超薄鞋柜', '玄关', '收纳', 1200, 300, colors.white, '👟'),
  createItem('实木换鞋凳', '玄关', '收纳', 1000, 450, colors.wood, '🪑'),
  createItem('玄关隔断屏风', '玄关', '装饰', 1500, 2200, colors.lightWood, '🖼️'),
  createItem('感应玄关灯', '玄关', '装饰', 300, 300, colors.yellow, '💡'),
  
  // 阳台 - 补充
  createItem('阳台吊柜', '阳台', '收纳', 1500, 700, colors.white, '🗄️'),
  createItem('阳台洗衣池', '阳台', '卫浴', 1200, 600, colors.metal, '🚰'),
  createItem('折叠晾衣架', '阳台', '收纳', 2500, 400, colors.metal, '🧺'),
  createItem('阳台榻榻米', '阳台', '装饰', 2000, 1500, colors.lightWood, '🔲'),
  createItem('阳台秋千椅', '阳台', '装饰', 1200, 1500, colors.brown, '🪑'),
  createItem('阳台花箱', '阳台', '装饰', 600, 400, colors.wood, '🪴'),
  createItem('阳台储物柜', '阳台', '收纳', 1800, 800, colors.darkWood, '🗄️'),
  createItem('户外藤编椅', '阳台', '装饰', 700, 700, colors.brown, '🪑'),
  
  // 办公 - 补充
  createItem('L型办公桌', '办公', '桌子', 2000, 1600, colors.gray, '💼'),
  createItem('职员办公桌', '办公', '桌子', 1400, 700, colors.white, '💼'),
  createItem('人体工学主管椅', '办公', '椅子', 700, 750, colors.brown, '🪑'),
  createItem('折叠培训椅', '办公', '椅子', 500, 500, colors.gray, '🪑'),
  createItem('凭证柜', '办公', '柜子', 900, 1800, colors.metal, '📁'),
  createItem('地图柜', '办公', '柜子', 1200, 900, colors.gray, '📦'),
  createItem('公司前台', '办公', '接待', 3000, 800, colors.white, '🏢'),
  createItem('办公室沙发', '办公', '接待', 2200, 900, colors.black, '🛋️'),
  createItem('办公会议白板', '办公', '设备', 2000, 1200, colors.white, '📋'),
  createItem('投影仪幕布', '办公', '设备', 2400, 1500, colors.white, '📽️'),
  createItem('办公茶水台', '办公', '柜子', 1800, 900, colors.wood, '☕'),
  createItem('复印机柜', '办公', '柜子', 800, 700, colors.gray, '🖨️'),
  
  // 儿童房 - 补充
  createItem('儿童公主床', '儿童房', '床', 1900, 1500, colors.pink, '🛏️'),
  createItem('儿童汽车床', '儿童房', '床', 2000, 1000, colors.blue, '🛏️'),
  createItem('儿童书柜', '儿童房', '衣柜', 1200, 1800, colors.green, '📚'),
  createItem('儿童学习椅', '儿童房', '椅子', 450, 450, colors.yellow, '🪑'),
  createItem('儿童玩具收纳柜', '儿童房', '收纳', 1600, 800, colors.pink, '🧸'),
  createItem('儿童帐篷', '儿童房', '装饰', 1200, 1200, colors.blue, '🏠'),
  createItem('儿童积木桌', '儿童房', '书桌', 1000, 600, colors.green, '📚'),
  createItem('儿童摇摇马', '儿童房', '装饰', 600, 300, colors.brown, '🧸'),
  
  // 衣帽间 - 补充
  createItem('衣帽间裤架', '衣帽间', '收纳', 800, 600, colors.metal, '👔'),
  createItem('衣帽间首饰收纳盒', '衣帽间', '收纳', 400, 150, colors.darkWood, '💍'),
  createItem('衣帽间展示柜', '衣帽间', '系统', 1500, 2200, colors.metal, '👗'),
  createItem('衣帽间岛台收纳柜', '衣帽间', '收纳', 1800, 1000, colors.white, '🗄️'),
  createItem('衣帽间换鞋凳', '衣帽间', '收纳', 1000, 450, colors.wood, '🪑'),
  
  // 影音室 - 补充
  createItem('家庭影院沙发', '影音室', '沙发', 2800, 1200, colors.brown, '🎬'),
  createItem('KTV点歌台', '影音室', '设备', 600, 500, colors.black, '🎛️'),
  createItem('环绕音响', '影音室', '设备', 250, 400, colors.black, '🔊'),
  createItem('影音室沙发椅', '影音室', '沙发', 900, 1100, colors.red, '🪑'),
  
  // 健身房 - 补充
  createItem('划船机', '健身房', '器材', 2000, 600, colors.black, '🚴'),
  createItem('综合训练架', '健身房', '器材', 1500, 1200, colors.metal, '🏋️'),
  createItem('史密斯架', '健身房', '器材', 2200, 1500, colors.metal, '🏋️'),
  createItem('哑铃凳', '健身房', '器材', 1200, 500, colors.black, '🏋️'),
  createItem('壶铃组', '健身房', '器材', 500, 300, colors.metal, '💪'),
  createItem('健身垫', '健身房', '器材', 1830, 610, colors.green, '🧘'),
  createItem('动感单车房镜子', '健身房', '装饰', 2000, 1500, colors.metal, '🪞'),
  createItem('健身房休息沙发', '健身房', '收纳', 1800, 800, colors.gray, '🛋️')
]

export const categories = [
  { id: 'living', name: '客厅', icon: '🛋️', subcategories: ['沙发', '茶几', '电视柜', '装饰'] },
  { id: 'bedroom', name: '卧室', icon: '🛏️', subcategories: ['床', '衣柜', '床头柜', '梳妆台', '装饰'] },
  { id: 'kitchen', name: '厨房', icon: '🍳', subcategories: ['橱柜', '电器', '水槽', '餐桌椅'] },
  { id: 'bathroom', name: '卫生间', icon: '🚿', subcategories: ['卫浴', '收纳', '装饰'] },
  { id: 'study', name: '书房', icon: '📚', subcategories: ['书桌', '书柜', '座椅', '装饰'] },
  { id: 'dining', name: '餐厅', icon: '🍽️', subcategories: ['餐桌', '餐椅', '收纳', '装饰'] },
  { id: 'entrance', name: '玄关', icon: '🚪', subcategories: ['收纳', '装饰'] },
  { id: 'balcony', name: '阳台', icon: '🌞', subcategories: ['收纳', '电器', '卫浴', '装饰'] },
  { id: 'office', name: '办公', icon: '💼', subcategories: ['桌子', '椅子', '柜子', '接待', '设备'] },
  { id: 'kids', name: '儿童房', icon: '🧸', subcategories: ['床', '书桌', '椅子', '衣柜', '收纳', '装饰'] },
  { id: 'walkin', name: '衣帽间', icon: '👔', subcategories: ['系统', '收纳', '装饰'] },
  { id: 'media', name: '影音室', icon: '🎬', subcategories: ['沙发', '设备', '收纳', '装饰'] },
  { id: 'gym', name: '健身房', icon: '💪', subcategories: ['器材', '收纳', '电器', '装饰'] }
]

export function getItemsByCategory(category: string, subcategory?: string): FurnitureCatalogItem[] {
  return furnitureCatalog.filter(item => {
    if (subcategory) {
      return item.category === category && item.subcategory === subcategory
    }
    return item.category === category
  })
}

export function getItemById(id: string): FurnitureCatalogItem | undefined {
  return furnitureCatalog.find(item => item.id === id)
}
