import { generateCatalog, updateLotSortOrder } from '../services/CatalogService.js';

const generate = async (req, res) => {
  try {
    const { auction_id } = req.params;
    if (!auction_id) {
      return res.status(400).json({ code: 400, message: '请提供拍卖会ID', data: null });
    }
    const catalog = generateCatalog(auction_id);
    res.json({ code: 200, message: '图录生成成功', data: catalog });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message, data: null });
  }
};

const updateSort = async (req, res) => {
  try {
    const { auction_id } = req.params;
    const { sort_updates } = req.body;
    if (!Array.isArray(sort_updates)) {
      return res.status(400).json({ code: 400, message: 'sort_updates 必须为数组', data: null });
    }
    const results = updateLotSortOrder(auction_id, sort_updates);
    res.json({ code: 200, message: '排序更新成功', data: results });
  } catch (err) {
    res.status(400).json({ code: 400, message: err.message, data: null });
  }
};

export default { generate, updateSort };
