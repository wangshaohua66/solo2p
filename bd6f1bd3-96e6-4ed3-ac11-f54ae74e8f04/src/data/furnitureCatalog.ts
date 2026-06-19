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
  createItem('三人沙发', '客厅', '沙发', 2200, 900, colors.gray, 'sofa'),
  createItem('双人沙发', '客厅', '沙发', 1600, 900, colors.gray, 'sofa'),
  createItem('单人沙发', '客厅', '沙发', 900, 900, colors.gray, 'sofa'),
  createItem('L型沙发', '客厅', '沙发', 2800, 1800, colors.darkWood, 'sofa'),
  createItem('贵妃榻', '客厅', '沙发', 1800, 800, colors.lightWood, 'sofa'),
  createItem('模块化沙发', '客厅', '沙发', 3200, 1000, colors.blue, 'sofa'),
  createItem('休闲沙发椅', '客厅', '沙发', 800, 800, colors.green, 'chair'),
  createItem('懒人沙发', '客厅', '沙发', 1200, 1000, colors.pink, 'sofa'),
  
  // 客厅 - 茶几
  createItem('方形茶几', '客厅', '茶几', 1200, 600, colors.wood, 'chair'),
  createItem('圆形茶几', '客厅', '茶几', 800, 800, colors.metal, 'round'),
  createItem('玻璃茶几', '客厅', '茶几', 1400, 700, colors.white, 'window'),
  createItem('组合茶几', '客厅', '茶几', 1000, 500, colors.darkWood, 'chair'),
  createItem('边几', '客厅', '茶几', 500, 500, colors.lightWood, 'box'),
  createItem('角几', '客厅', '茶几', 600, 600, colors.wood, 'box'),
  
  // 客厅 - 电视柜
  createItem('地柜式电视柜', '客厅', '电视柜', 2400, 450, colors.darkWood, 'tv'),
  createItem('悬挂式电视柜', '客厅', '电视柜', 1800, 300, colors.white, 'tv'),
  createItem('组合电视柜', '客厅', '电视柜', 3000, 600, colors.wood, 'tv'),
  createItem('简约电视柜', '客厅', '电视柜', 1600, 400, colors.gray, 'tv'),
  
  // 客厅 - 装饰
  createItem('落地灯', '客厅', '装饰', 400, 400, colors.yellow, 'lamp'),
  createItem('台灯', '客厅', '装饰', 300, 300, colors.yellow, 'lamp'),
  createItem('盆栽', '客厅', '装饰', 500, 500, colors.green, 'plant'),
  createItem('挂画', '客厅', '装饰', 800, 600, colors.white, 'painting'),
  createItem('地毯', '客厅', '装饰', 2000, 1500, colors.red, 'carpet'),
  createItem('窗帘', '客厅', '装饰', 3000, 2800, colors.blue, 'window'),
  
  // 卧室 - 床
  createItem('双人床', '卧室', '床', 2000, 1800, colors.wood, 'bed'),
  createItem('单人床', '卧室', '床', 2000, 1000, colors.lightWood, 'bed'),
  createItem('儿童床', '卧室', '床', 1800, 900, colors.blue, 'bed'),
  createItem('榻榻米床', '卧室', '床', 2200, 1800, colors.gray, 'bed'),
  createItem('高架床', '卧室', '床', 2000, 1200, colors.darkWood, 'bed'),
  createItem('沙发床', '卧室', '床', 2000, 1000, colors.gray, 'sofa'),
  createItem('圆床', '卧室', '床', 2200, 2200, colors.pink, 'round'),
  
  // 卧室 - 衣柜
  createItem('四门衣柜', '卧室', '衣柜', 2400, 600, colors.wood, 'door'),
  createItem('三门衣柜', '卧室', '衣柜', 1800, 600, colors.darkWood, 'door'),
  createItem('两门衣柜', '卧室', '衣柜', 1200, 600, colors.lightWood, 'door'),
  createItem('步入式衣柜', '卧室', '衣柜', 3000, 800, colors.white, 'door'),
  createItem('推拉门衣柜', '卧室', '衣柜', 2000, 650, colors.gray, 'door'),
  createItem('衣帽间', '卧室', '衣柜', 3500, 2000, colors.brown, 'door'),
  
  // 卧室 - 床头柜
  createItem('床头柜', '卧室', '床头柜', 500, 450, colors.wood, 'cabinet'),
  createItem('简约床头柜', '卧室', '床头柜', 450, 400, colors.white, 'cabinet'),
  createItem('组合床头柜', '卧室', '床头柜', 600, 500, colors.darkWood, 'cabinet'),
  
  // 卧室 - 梳妆台
  createItem('梳妆台', '卧室', '梳妆台', 1200, 500, colors.lightWood, 'window'),
  createItem('化妆台', '卧室', '梳妆台', 1000, 450, colors.white, 'window'),
  createItem('带镜梳妆台', '卧室', '梳妆台', 1400, 550, colors.pink, 'window'),
  
  // 卧室 - 装饰
  createItem('床头灯', '卧室', '装饰', 300, 300, colors.yellow, 'lamp'),
  createItem('落地镜', '卧室', '装饰', 600, 1800, colors.metal, 'window'),
  createItem('卧室地毯', '卧室', '装饰', 1800, 1200, colors.purple, 'carpet'),
  createItem('衣柜镜', '卧室', '装饰', 400, 1500, colors.metal, 'window'),
  
  // 厨房 - 橱柜
  createItem('地柜', '厨房', '橱柜', 600, 850, colors.darkWood, 'cabinet'),
  createItem('吊柜', '厨房', '橱柜', 600, 700, colors.lightWood, 'cabinet'),
  createItem('转角柜', '厨房', '橱柜', 900, 900, colors.wood, 'cabinet'),
  createItem('高柜', '厨房', '橱柜', 600, 2200, colors.white, 'cabinet'),
  createItem('抽屉柜', '厨房', '橱柜', 800, 850, colors.gray, 'cabinet'),
  createItem('开放柜', '厨房', '橱柜', 600, 400, colors.brown, 'box'),
  createItem('L型橱柜', '厨房', '橱柜', 2400, 1800, colors.darkWood, 'cabinet'),
  createItem('一字型橱柜', '厨房', '橱柜', 3000, 600, colors.wood, 'cabinet'),
  createItem('岛台', '厨房', '橱柜', 1800, 900, colors.white, 'cabinet'),
  createItem('吧台', '厨房', '橱柜', 1500, 600, colors.wood, 'cup'),
  
  // 厨房 - 电器
  createItem('燃气灶', '厨房', '电器', 800, 500, colors.black, 'stove'),
  createItem('抽油烟机', '厨房', '电器', 900, 500, colors.metal, 'wide'),
  createItem('洗碗机', '厨房', '电器', 600, 850, colors.gray, 'cup'),
  createItem('冰箱', '厨房', '电器', 700, 1800, colors.white, 'fridge'),
  createItem('双开门冰箱', '厨房', '电器', 1200, 1800, colors.gray, 'fridge'),
  createItem('微波炉', '厨房', '电器', 500, 300, colors.black, 'box'),
  createItem('烤箱', '厨房', '电器', 600, 600, colors.black, 'stove'),
  createItem('蒸箱', '厨房', '电器', 600, 450, colors.gray, 'wide'),
  createItem('消毒柜', '厨房', '电器', 600, 650, colors.metal, 'cup'),
  createItem('净水器', '厨房', '电器', 400, 500, colors.white, 'flat'),
  
  // 厨房 - 水槽
  createItem('单槽水槽', '厨房', '水槽', 600, 500, colors.metal, 'bath'),
  createItem('双槽水槽', '厨房', '水槽', 800, 500, colors.metal, 'bath'),
  createItem('台下盆', '厨房', '水槽', 500, 400, colors.white, 'sink'),
  createItem('集成水槽', '厨房', '水槽', 900, 600, colors.metal, 'bath'),
  
  // 厨房 - 餐桌椅
  createItem('餐桌', '厨房', '餐桌椅', 1600, 900, colors.wood, 'chair'),
  createItem('圆桌', '厨房', '餐桌椅', 1200, 1200, colors.darkWood, 'ball'),
  createItem('方桌', '厨房', '餐桌椅', 900, 900, colors.lightWood, 'box'),
  createItem('餐椅', '厨房', '餐桌椅', 450, 500, colors.wood, 'chair'),
  createItem('餐椅(软包)', '厨房', '餐桌椅', 450, 500, colors.gray, 'chair'),
  createItem('长凳', '厨房', '餐桌椅', 1200, 400, colors.wood, 'chair'),
  
  // 卫生间 - 卫浴
  createItem('坐便器', '卫生间', '卫浴', 400, 700, colors.white, 'toilet'),
  createItem('智能马桶', '卫生间', '卫浴', 450, 700, colors.white, 'toilet'),
  createItem('洗手台', '卫生间', '卫浴', 1000, 550, colors.white, 'sink'),
  createItem('双盆洗手台', '卫生间', '卫浴', 1500, 550, colors.white, 'sink'),
  createItem('立柱盆', '卫生间', '卫浴', 500, 500, colors.white, 'sink'),
  createItem('浴缸', '卫生间', '卫浴', 1700, 800, colors.white, 'bath'),
  createItem('按摩浴缸', '卫生间', '卫浴', 1800, 900, colors.white, 'bath'),
  createItem('淋浴房', '卫生间', '卫浴', 1000, 1000, colors.metal, 'bath'),
  createItem('整体淋浴房', '卫生间', '卫浴', 1200, 1200, colors.metal, 'bath'),
  createItem('淋浴屏', '卫生间', '卫浴', 1400, 2000, colors.metal, 'window'),
  
  // 卫生间 - 收纳
  createItem('浴室柜', '卫生间', '收纳', 1200, 550, colors.wood, 'cabinet'),
  createItem('镜柜', '卫生间', '收纳', 800, 800, colors.white, 'window'),
  createItem('吊柜', '卫生间', '收纳', 600, 600, colors.white, 'cabinet'),
  createItem('置物架', '卫生间', '收纳', 400, 1200, colors.metal, 'box'),
  createItem('毛巾架', '卫生间', '收纳', 600, 100, colors.metal, 'box'),
  createItem('卫生纸架', '卫生间', '收纳', 200, 200, colors.metal, 'round'),
  
  // 卫生间 - 装饰
  createItem('浴霸', '卫生间', '装饰', 300, 300, colors.white, 'lamp'),
  createItem('排气扇', '卫生间', '装饰', 200, 200, colors.gray, 'wide'),
  createItem('浴室挂件', '卫生间', '装饰', 500, 200, colors.metal, 'box'),
  createItem('防水镜', '卫生间', '装饰', 800, 1000, colors.metal, 'window'),
  
  // 书房
  createItem('书桌', '书房', '书桌', 1600, 800, colors.wood, 'book'),
  createItem('电脑桌', '书房', '书桌', 1400, 700, colors.darkWood, 'flat'),
  createItem('转角书桌', '书房', '书桌', 1800, 1200, colors.wood, 'book'),
  createItem('升降桌', '书房', '书桌', 1600, 800, colors.metal, 'desk'),
  createItem('书柜', '书房', '书柜', 2000, 2200, colors.darkWood, 'book'),
  createItem('书架', '书房', '书柜', 1200, 2000, colors.lightWood, 'book'),
  createItem('文件柜', '书房', '书柜', 800, 1800, colors.gray, 'book'),
  createItem('办公椅', '书房', '座椅', 600, 600, colors.black, 'chair'),
  createItem('人体工学椅', '书房', '座椅', 700, 700, colors.gray, 'chair'),
  createItem('书房沙发', '书房', '座椅', 1200, 800, colors.brown, 'sofa'),
  createItem('台灯', '书房', '装饰', 300, 400, colors.yellow, 'lamp'),
  createItem('落地灯', '书房', '装饰', 400, 1600, colors.yellow, 'lamp'),
  createItem('装饰画', '书房', '装饰', 700, 500, colors.white, 'painting'),
  createItem('绿植', '书房', '装饰', 400, 400, colors.green, 'plant'),
  
  // 餐厅
  createItem('餐桌', '餐厅', '餐桌', 1800, 900, colors.wood, 'dish'),
  createItem('六人餐桌', '餐厅', '餐桌', 2200, 1000, colors.darkWood, 'dish'),
  createItem('八人餐桌', '餐厅', '餐桌', 2400, 1100, colors.wood, 'dish'),
  createItem('折叠餐桌', '餐厅', '餐桌', 1200, 800, colors.lightWood, 'dish'),
  createItem('餐椅', '餐厅', '餐椅', 450, 550, colors.wood, 'chair'),
  createItem('餐椅(布艺)', '餐厅', '餐椅', 450, 550, colors.gray, 'chair'),
  createItem('餐椅(皮艺)', '餐厅', '餐椅', 450, 550, colors.brown, 'chair'),
  createItem('餐边柜', '餐厅', '收纳', 1800, 850, colors.darkWood, 'cabinet'),
  createItem('酒柜', '餐厅', '收纳', 1200, 2200, colors.wood, 'cup'),
  createItem('展示柜', '餐厅', '收纳', 1500, 2000, colors.white, 'cabinet'),
  createItem('餐边架', '餐厅', '收纳', 1000, 900, colors.metal, 'box'),
  createItem('吊灯', '餐厅', '装饰', 800, 100, colors.yellow, 'lamp'),
  createItem('壁灯', '餐厅', '装饰', 300, 300, colors.yellow, 'lamp'),
  createItem('餐厅装饰画', '餐厅', '装饰', 1000, 700, colors.white, 'painting'),
  createItem('餐厅地毯', '餐厅', '装饰', 2400, 1600, colors.orange, 'carpet'),
  
  // 玄关
  createItem('玄关柜', '玄关', '收纳', 1200, 1000, colors.wood, 'door'),
  createItem('鞋柜', '玄关', '收纳', 1500, 1100, colors.darkWood, 'box'),
  createItem('换鞋凳', '玄关', '收纳', 800, 450, colors.lightWood, 'chair'),
  createItem('玄关台', '玄关', '收纳', 1000, 850, colors.wood, 'chair'),
  createItem('衣帽架', '玄关', '收纳', 500, 1800, colors.metal, 'tall'),
  createItem('挂衣板', '玄关', '收纳', 1000, 300, colors.wood, 'tall'),
  createItem('穿衣镜', '玄关', '装饰', 600, 1800, colors.metal, 'window'),
  createItem('玄关灯', '玄关', '装饰', 400, 400, colors.yellow, 'lamp'),
  createItem('玄关挂画', '玄关', '装饰', 800, 600, colors.white, 'painting'),
  createItem('地垫', '玄关', '装饰', 1200, 800, colors.red, 'carpet'),
  
  // 阳台
  createItem('洗衣柜', '阳台', '收纳', 1500, 900, colors.white, 'box'),
  createItem('洗衣机', '阳台', '电器', 600, 850, colors.gray, 'box'),
  createItem('烘干机', '阳台', '电器', 600, 850, colors.gray, 'round'),
  createItem('洗手池', '阳台', '卫浴', 600, 500, colors.white, 'sink'),
  createItem('晾衣架', '阳台', '收纳', 2000, 300, colors.metal, 'box'),
  createItem('阳台柜', '阳台', '收纳', 1200, 800, colors.wood, 'cabinet'),
  createItem('花架', '阳台', '装饰', 800, 1200, colors.metal, 'plant'),
  createItem('休闲桌椅', '阳台', '装饰', 700, 700, colors.brown, 'chair'),
  createItem('吊椅', '阳台', '装饰', 800, 1500, colors.orange, 'chair'),
  
  // 办公
  createItem('办公桌', '办公', '桌子', 1600, 800, colors.gray, 'box'),
  createItem('主管桌', '办公', '桌子', 2000, 1000, colors.darkWood, 'box'),
  createItem('会议桌', '办公', '桌子', 3000, 1400, colors.wood, 'book'),
  createItem('培训桌', '办公', '桌子', 1200, 600, colors.gray, 'book'),
  createItem('职员椅', '办公', '椅子', 600, 600, colors.black, 'chair'),
  createItem('会议椅', '办公', '椅子', 600, 600, colors.gray, 'chair'),
  createItem('班前椅', '办公', '椅子', 550, 550, colors.black, 'chair'),
  createItem('文件柜', '办公', '柜子', 900, 1800, colors.gray, 'book'),
  createItem('资料柜', '办公', '柜子', 900, 2000, colors.metal, 'book'),
  createItem('更衣柜', '办公', '柜子', 900, 1800, colors.gray, 'wardrobe'),
  createItem('密集柜', '办公', '柜子', 1200, 2000, colors.metal, 'book'),
  createItem('茶水柜', '办公', '柜子', 1200, 850, colors.wood, 'cup'),
  createItem('打印机柜', '办公', '柜子', 600, 600, colors.gray, 'box'),
  createItem('前台', '办公', '接待', 2400, 700, colors.white, 'tall'),
  createItem('接待台', '办公', '接待', 1800, 700, colors.gray, 'tall'),
  createItem('访客沙发', '办公', '接待', 2000, 900, colors.black, 'sofa'),
  createItem('访客茶几', '办公', '接待', 1200, 600, colors.metal, 'cup'),
  
  // 儿童房
  createItem('儿童床', '儿童房', '床', 1800, 1000, colors.blue, 'bed'),
  createItem('婴儿床', '儿童房', '床', 1400, 700, colors.white, 'bed'),
  createItem('上下铺', '儿童房', '床', 2000, 1000, colors.wood, 'bed'),
  createItem('滑梯床', '儿童房', '床', 2200, 1200, colors.pink, 'round'),
  createItem('儿童书桌', '儿童房', '书桌', 1200, 600, colors.blue, 'book'),
  createItem('儿童椅', '儿童房', '椅子', 400, 400, colors.yellow, 'chair'),
  createItem('儿童衣柜', '儿童房', '衣柜', 1500, 550, colors.pink, 'wardrobe'),
  createItem('玩具架', '儿童房', '收纳', 1200, 800, colors.green, 'round'),
  createItem('绘本架', '儿童房', '收纳', 1000, 1200, colors.blue, 'book'),
  createItem('儿童地毯', '儿童房', '装饰', 2000, 1500, colors.yellow, 'carpet'),
  createItem('卡通吊灯', '儿童房', '装饰', 500, 200, colors.pink, 'lamp'),
  createItem('黑板墙', '儿童房', '装饰', 1500, 1000, colors.black, 'book'),
  
  // 衣帽间
  createItem('衣柜系统', '衣帽间', '系统', 3000, 600, colors.wood, 'wardrobe'),
  createItem('玻璃衣柜', '衣帽间', '系统', 2000, 600, colors.metal, 'glass-cabinet'),
  createItem('开放式衣帽间', '衣帽间', '系统', 3500, 2000, colors.darkWood, 'wardrobe'),
  createItem('中岛台', '衣帽间', '收纳', 1500, 800, colors.white, 'round'),
  createItem('鞋架', '衣帽间', '收纳', 1500, 1200, colors.wood, 'box'),
  createItem('包包架', '衣帽间', '收纳', 1000, 800, colors.metal, 'box'),
  createItem('首饰柜', '衣帽间', '收纳', 800, 1000, colors.darkWood, 'round'),
  createItem('试衣镜', '衣帽间', '装饰', 800, 2000, colors.metal, 'window'),
  createItem('梳妆台', '衣帽间', '装饰', 1200, 500, colors.white, 'tall'),
  
  // 影音室
  createItem('观影沙发', '影音室', '沙发', 2500, 1000, colors.black, 'projector'),
  createItem('单人影院椅', '影音室', '沙发', 800, 1000, colors.brown, 'chair'),
  createItem('投影仪', '影音室', '设备', 400, 300, colors.black, 'projector'),
  createItem('幕布', '影音室', '设备', 3000, 1700, colors.white, 'painting'),
  createItem('音响', '影音室', '设备', 300, 1000, colors.black, 'speaker'),
  createItem('功放柜', '影音室', '设备', 600, 800, colors.black, 'oven'),
  createItem('设备架', '影音室', '设备', 800, 600, colors.metal, 'box'),
  createItem('影音柜', '影音室', '收纳', 2000, 600, colors.darkWood, 'cabinet'),
  createItem('吸音板', '影音室', '装饰', 1200, 600, colors.gray, 'box'),
  createItem('星空顶', '影音室', '装饰', 3000, 2000, colors.black, 'round'),
  
  // 健身房
  createItem('跑步机', '健身房', '器材', 1800, 800, colors.black, 'treadmill'),
  createItem('椭圆机', '健身房', '器材', 1500, 700, colors.gray, 'treadmill'),
  createItem('动感单车', '健身房', '器材', 1200, 600, colors.black, 'treadmill'),
  createItem('力量训练器', '健身房', '器材', 2000, 1500, colors.gray, 'tall'),
  createItem('哑铃架', '健身房', '器材', 1200, 600, colors.metal, 'box'),
  createItem('瑜伽垫', '健身房', '器材', 1800, 600, colors.purple, 'flat'),
  createItem('健身球', '健身房', '器材', 600, 600, colors.blue, 'ball'),
  createItem('镜子墙', '健身房', '装饰', 3000, 2000, colors.metal, 'window'),
  createItem('储物柜', '健身房', '收纳', 1800, 1800, colors.gray, 'cabinet'),
  createItem('饮水机', '健身房', '电器', 400, 1200, colors.white, 'flat'),
  
  // 客厅 - 补充沙发
  createItem('皮艺三人沙发', '客厅', '沙发', 2300, 950, colors.brown, 'sofa'),
  createItem('布艺双人沙发', '客厅', '沙发', 1700, 950, colors.orange, 'sofa'),
  createItem('北欧单人椅', '客厅', '沙发', 750, 800, colors.white, 'chair'),
  createItem('U型组合沙发', '客厅', '沙发', 3600, 2000, colors.darkWood, 'sofa'),
  createItem('折叠沙发床', '客厅', '沙发', 2000, 1100, colors.gray, 'sofa'),
  createItem('新中式沙发', '客厅', '沙发', 2400, 900, colors.wood, 'sofa'),
  createItem('儿童小沙发', '客厅', '沙发', 600, 500, colors.pink, 'sofa'),
  
  // 客厅 - 补充茶几
  createItem('升降茶几', '客厅', '茶几', 1300, 700, colors.white, 'box'),
  createItem('岩板茶几', '客厅', '茶几', 1400, 800, colors.metal, 'box'),
  createItem('储物茶几', '客厅', '茶几', 1200, 650, colors.darkWood, 'cabinet'),
  createItem('实木长茶几', '客厅', '茶几', 1600, 700, colors.wood, 'box'),
  createItem('异形茶几', '客厅', '茶几', 1100, 900, colors.purple, 'round'),
  createItem('双层边几', '客厅', '茶几', 450, 450, colors.lightWood, 'box'),
  createItem('移动边几', '客厅', '茶几', 400, 500, colors.metal, 'box'),
  createItem('沙发背几', '客厅', '茶几', 1800, 350, colors.wood, 'box'),
  
  // 客厅 - 补充电视柜
  createItem('实木电视柜', '客厅', '电视柜', 2200, 500, colors.wood, 'tv'),
  createItem('北欧电视柜', '客厅', '电视柜', 2000, 450, colors.lightWood, 'tv'),
  createItem('轻奢电视柜', '客厅', '电视柜', 2400, 500, colors.metal, 'tv'),
  createItem('带抽屉电视柜', '客厅', '电视柜', 1800, 550, colors.darkWood, 'cabinet'),
  createItem('壁挂式电视柜', '客厅', '电视柜', 1600, 250, colors.white, 'tv'),
  
  // 客厅 - 补充装饰
  createItem('水晶吊灯', '客厅', '装饰', 600, 600, colors.yellow, 'lamp'),
  createItem('吸顶灯', '客厅', '装饰', 800, 100, colors.white, 'lamp'),
  createItem('大型绿植', '客厅', '装饰', 700, 700, colors.green, 'plant'),
  createItem('组合挂画', '客厅', '装饰', 1200, 800, colors.white, 'painting'),
  createItem('玄关隔断柜', '客厅', '装饰', 1500, 1200, colors.wood, 'cabinet'),
  createItem('电视柜背景墙', '客厅', '装饰', 3600, 2400, colors.white, 'painting'),
  createItem('羊毛地毯', '客厅', '装饰', 2400, 1700, colors.brown, 'carpet'),
  createItem('竹百叶帘', '客厅', '装饰', 2500, 2000, colors.lightWood, 'window'),
  createItem('罗马杆窗帘', '客厅', '装饰', 3200, 2600, colors.purple, 'window'),
  
  // 卧室 - 补充床
  createItem('1.5m双人床', '卧室', '床', 2000, 1500, colors.white, 'bed'),
  createItem('1.8m布艺床', '卧室', '床', 2100, 1900, colors.gray, 'bed'),
  createItem('真皮软包床', '卧室', '床', 2100, 2000, colors.brown, 'bed'),
  createItem('北欧实木床', '卧室', '床', 2000, 1800, colors.lightWood, 'bed'),
  createItem('轻奢镀金床', '卧室', '床', 2100, 1900, colors.metal, 'bed'),
  createItem('抽屉储物床', '卧室', '床', 2100, 1800, colors.darkWood, 'bed'),
  createItem('气压杆高箱床', '卧室', '床', 2100, 1800, colors.white, 'bed'),
  
  // 卧室 - 补充衣柜
  createItem('五门衣柜', '卧室', '衣柜', 3000, 600, colors.lightWood, 'door'),
  createItem('六门衣柜', '卧室', '衣柜', 3600, 650, colors.darkWood, 'door'),
  createItem('实木衣柜', '卧室', '衣柜', 2400, 600, colors.wood, 'door'),
  createItem('烤漆衣柜', '卧室', '衣柜', 2000, 600, colors.white, 'door'),
  createItem('转角衣柜', '卧室', '衣柜', 2400, 1800, colors.wood, 'door'),
  
  // 卧室 - 补充床头柜/梳妆台
  createItem('岩板床头柜', '卧室', '床头柜', 500, 400, colors.metal, 'cabinet'),
  createItem('皮艺床头柜', '卧室', '床头柜', 550, 450, colors.brown, 'cabinet'),
  createItem('轻奢梳妆台', '卧室', '梳妆台', 1000, 500, colors.white, 'window'),
  createItem('实木梳妆台', '卧室', '梳妆台', 1100, 500, colors.wood, 'window'),
  createItem('卧室斗柜', '卧室', '床头柜', 1200, 450, colors.darkWood, 'cabinet'),
  
  // 卧室 - 补充装饰
  createItem('卧室吸顶灯', '卧室', '装饰', 500, 100, colors.white, 'lamp'),
  createItem('床头壁灯', '卧室', '装饰', 200, 300, colors.yellow, 'lamp'),
  createItem('卧室窗帘', '卧室', '装饰', 2800, 2500, colors.blue, 'window'),
  createItem('卧室床尾凳', '卧室', '装饰', 1500, 400, colors.brown, 'chair'),
  createItem('卧室挂衣架', '卧室', '装饰', 600, 1700, colors.metal, 'tall'),
  
  // 厨房 - 补充橱柜
  createItem('不锈钢橱柜', '厨房', '橱柜', 600, 850, colors.metal, 'cabinet'),
  createItem('晶钢门橱柜', '厨房', '橱柜', 600, 850, colors.white, 'cabinet'),
  createItem('模压门橱柜', '厨房', '橱柜', 600, 850, colors.lightWood, 'cabinet'),
  createItem('实木门板橱柜', '厨房', '橱柜', 600, 850, colors.wood, 'cabinet'),
  createItem('U型整体橱柜', '厨房', '橱柜', 3600, 2400, colors.darkWood, 'cabinet'),
  createItem('厨房中岛柜', '厨房', '橱柜', 1500, 900, colors.white, 'cabinet'),
  createItem('厨房操作台', '厨房', '橱柜', 1800, 800, colors.metal, 'box'),
  createItem('厨房调味拉篮', '厨房', '橱柜', 200, 500, colors.metal, 'box'),
  
  // 厨房 - 补充电器/餐桌椅
  createItem('集成灶', '厨房', '电器', 900, 600, colors.black, 'stove'),
  createItem('破壁机', '厨房', '电器', 200, 300, colors.white, 'cup'),
  createItem('电饭煲', '厨房', '电器', 300, 250, colors.white, 'round'),
  createItem('空气炸锅', '厨房', '电器', 300, 300, colors.gray, 'stove'),
  createItem('厨师机', '厨房', '电器', 250, 350, colors.red, 'round'),
  createItem('长餐桌', '厨房', '餐桌椅', 2000, 1000, colors.darkWood, 'chair'),
  createItem('折叠餐椅', '厨房', '餐桌椅', 450, 500, colors.wood, 'chair'),
  createItem('吧台椅', '厨房', '餐桌椅', 400, 400, colors.metal, 'chair'),
  createItem('岛台吊灯', '厨房', '电器', 300, 300, colors.yellow, 'lamp'),
  
  // 卫生间 - 补充卫浴/收纳
  createItem('壁挂马桶', '卫生间', '卫浴', 400, 550, colors.white, 'toilet'),
  createItem('蹲便器', '卫生间', '卫浴', 500, 400, colors.white, 'toilet'),
  createItem('妇洗器', '卫生间', '卫浴', 400, 600, colors.white, 'toilet'),
  createItem('整体浴室柜', '卫生间', '卫浴', 1200, 600, colors.wood, 'cabinet'),
  createItem('干湿分离隔断', '卫生间', '卫浴', 1500, 2000, colors.metal, 'window'),
  createItem('卫生间收纳柜', '卫生间', '收纳', 400, 1500, colors.white, 'cabinet'),
  createItem('卫生间边柜', '卫生间', '收纳', 300, 800, colors.metal, 'box'),
  createItem('智能浴室镜', '卫生间', '装饰', 800, 1000, colors.metal, 'window'),
  createItem('电热毛巾架', '卫生间', '装饰', 600, 800, colors.metal, 'box'),
  createItem('淋浴花洒套装', '卫生间', '卫浴', 300, 300, colors.metal, 'bath'),
  
  // 书房 - 补充
  createItem('实木大书桌', '书房', '书桌', 2000, 1000, colors.wood, 'book'),
  createItem('北欧风书桌', '书房', '书桌', 1400, 700, colors.lightWood, 'book'),
  createItem('儿童学习桌', '书房', '书桌', 1200, 700, colors.blue, 'book'),
  createItem('带抽屉书桌', '书房', '书桌', 1600, 800, colors.darkWood, 'cabinet'),
  createItem('实木书柜', '书房', '书柜', 1800, 2200, colors.wood, 'book'),
  createItem('带玻璃门书柜', '书房', '书柜', 1600, 2200, colors.metal, 'book'),
  createItem('格子柜', '书房', '书柜', 1200, 1200, colors.white, 'book'),
  createItem('老板椅', '书房', '座椅', 700, 750, colors.black, 'chair'),
  createItem('会议椅', '书房', '座椅', 600, 600, colors.gray, 'chair'),
  createItem('书房地毯', '书房', '装饰', 1800, 1200, colors.blue, 'carpet'),
  
  // 餐厅 - 补充
  createItem('10人餐桌', '餐厅', '餐桌', 2800, 1200, colors.darkWood, 'dish'),
  createItem('4人方桌', '餐厅', '餐桌', 900, 900, colors.lightWood, 'dish'),
  createItem('岩板餐桌', '餐厅', '餐桌', 1600, 900, colors.metal, 'dish'),
  createItem('伸缩餐桌', '餐厅', '餐桌', 1400, 850, colors.wood, 'dish'),
  createItem('实木餐椅', '餐厅', '餐椅', 450, 550, colors.wood, 'chair'),
  createItem('金属餐椅', '餐厅', '餐椅', 450, 500, colors.metal, 'chair'),
  createItem('实木餐边柜', '餐厅', '收纳', 1600, 900, colors.wood, 'cabinet'),
  createItem('餐厅酒柜', '餐厅', '收纳', 1800, 2000, colors.darkWood, 'cup'),
  createItem('餐厅吊灯', '餐厅', '装饰', 1000, 200, colors.yellow, 'lamp'),
  createItem('餐边镜', '餐厅', '装饰', 1000, 700, colors.metal, 'window'),
  
  // 玄关 - 补充
  createItem('隔断玄关柜', '玄关', '收纳', 1500, 2000, colors.wood, 'door'),
  createItem('超薄鞋柜', '玄关', '收纳', 1200, 300, colors.white, 'box'),
  createItem('实木换鞋凳', '玄关', '收纳', 1000, 450, colors.wood, 'chair'),
  createItem('玄关隔断屏风', '玄关', '装饰', 1500, 2200, colors.lightWood, 'painting'),
  createItem('感应玄关灯', '玄关', '装饰', 300, 300, colors.yellow, 'lamp'),
  
  // 阳台 - 补充
  createItem('阳台吊柜', '阳台', '收纳', 1500, 700, colors.white, 'cabinet'),
  createItem('阳台洗衣池', '阳台', '卫浴', 1200, 600, colors.metal, 'sink'),
  createItem('折叠晾衣架', '阳台', '收纳', 2500, 400, colors.metal, 'box'),
  createItem('阳台榻榻米', '阳台', '装饰', 2000, 1500, colors.lightWood, 'box'),
  createItem('阳台秋千椅', '阳台', '装饰', 1200, 1500, colors.brown, 'chair'),
  createItem('阳台花箱', '阳台', '装饰', 600, 400, colors.wood, 'plant'),
  createItem('阳台储物柜', '阳台', '收纳', 1800, 800, colors.darkWood, 'cabinet'),
  createItem('户外藤编椅', '阳台', '装饰', 700, 700, colors.brown, 'chair'),
  
  // 办公 - 补充
  createItem('L型办公桌', '办公', '桌子', 2000, 1600, colors.gray, 'box'),
  createItem('职员办公桌', '办公', '桌子', 1400, 700, colors.white, 'box'),
  createItem('人体工学主管椅', '办公', '椅子', 700, 750, colors.brown, 'chair'),
  createItem('折叠培训椅', '办公', '椅子', 500, 500, colors.gray, 'chair'),
  createItem('凭证柜', '办公', '柜子', 900, 1800, colors.metal, 'book'),
  createItem('地图柜', '办公', '柜子', 1200, 900, colors.gray, 'box'),
  createItem('公司前台', '办公', '接待', 3000, 800, colors.white, 'tall'),
  createItem('办公室沙发', '办公', '接待', 2200, 900, colors.black, 'sofa'),
  createItem('办公会议白板', '办公', '设备', 2000, 1200, colors.white, 'book'),
  createItem('投影仪幕布', '办公', '设备', 2400, 1500, colors.white, 'projector'),
  createItem('办公茶水台', '办公', '柜子', 1800, 900, colors.wood, 'cup'),
  createItem('复印机柜', '办公', '柜子', 800, 700, colors.gray, 'box'),
  
  // 儿童房 - 补充
  createItem('儿童公主床', '儿童房', '床', 1900, 1500, colors.pink, 'bed'),
  createItem('儿童汽车床', '儿童房', '床', 2000, 1000, colors.blue, 'bed'),
  createItem('儿童书柜', '儿童房', '衣柜', 1200, 1800, colors.green, 'book'),
  createItem('儿童学习椅', '儿童房', '椅子', 450, 450, colors.yellow, 'chair'),
  createItem('儿童玩具收纳柜', '儿童房', '收纳', 1600, 800, colors.pink, 'round'),
  createItem('儿童帐篷', '儿童房', '装饰', 1200, 1200, colors.blue, 'tall'),
  createItem('儿童积木桌', '儿童房', '书桌', 1000, 600, colors.green, 'book'),
  createItem('儿童摇摇马', '儿童房', '装饰', 600, 300, colors.brown, 'round'),
  
  // 衣帽间 - 补充
  createItem('衣帽间裤架', '衣帽间', '收纳', 800, 600, colors.metal, 'wardrobe'),
  createItem('衣帽间首饰收纳盒', '衣帽间', '收纳', 400, 150, colors.darkWood, 'round'),
  createItem('衣帽间展示柜', '衣帽间', '系统', 1500, 2200, colors.metal, 'glass-cabinet'),
  createItem('衣帽间岛台收纳柜', '衣帽间', '收纳', 1800, 1000, colors.white, 'cabinet'),
  createItem('衣帽间换鞋凳', '衣帽间', '收纳', 1000, 450, colors.wood, 'chair'),
  
  // 影音室 - 补充
  createItem('家庭影院沙发', '影音室', '沙发', 2800, 1200, colors.brown, 'projector'),
  createItem('KTV点歌台', '影音室', '设备', 600, 500, colors.black, 'oven'),
  createItem('环绕音响', '影音室', '设备', 250, 400, colors.black, 'speaker'),
  createItem('影音室沙发椅', '影音室', '沙发', 900, 1100, colors.red, 'chair'),
  
  // 健身房 - 补充
  createItem('划船机', '健身房', '器材', 2000, 600, colors.black, 'treadmill'),
  createItem('综合训练架', '健身房', '器材', 1500, 1200, colors.metal, 'box'),
  createItem('史密斯架', '健身房', '器材', 2200, 1500, colors.metal, 'box'),
  createItem('哑铃凳', '健身房', '器材', 1200, 500, colors.black, 'box'),
  createItem('壶铃组', '健身房', '器材', 500, 300, colors.metal, 'tall'),
  createItem('健身垫', '健身房', '器材', 1830, 610, colors.green, 'flat'),
  createItem('动感单车房镜子', '健身房', '装饰', 2000, 1500, colors.metal, 'window'),
  createItem('健身房休息沙发', '健身房', '收纳', 1800, 800, colors.gray, 'sofa')
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
