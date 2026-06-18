import db from '../config/database.js';

const CATEGORY_ORDER = ['ceramics', 'painting', 'jewelry', 'antique_book', 'other'];
const CATEGORY_LABELS = {
  ceramics: '瓷器',
  painting: '书画',
  jewelry: '珠宝玉器',
  antique_book: '古籍善本',
  other: '其他',
};

function generateCatalog(auctionId) {
  const lots = db.collection('lots').find({ auction_id: auctionId });
  const grouped = {};

  for (const category of CATEGORY_ORDER) {
    const categoryLots = lots
      .filter((l) => l.category === category)
      .sort((a, b) => {
        if (a.lot_number && b.lot_number) return a.lot_number.localeCompare(b.lot_number);
        return 0;
      });
    if (categoryLots.length > 0) {
      grouped[category] = {
        label: CATEGORY_LABELS[category],
        lots: categoryLots,
      };
    }
  }

  return {
    auction_id: auctionId,
    categories: grouped,
    total_lots: lots.length,
  };
}

function updateLotSortOrder(auctionId, sortUpdates) {
  const results = [];
  for (const update of sortUpdates) {
    const lot = db.collection('lots').updateById(update.lot_id, {
      lot_number: update.lot_number,
    });
    if (lot) results.push(lot);
  }
  return results;
}

export { generateCatalog, updateLotSortOrder, CATEGORY_ORDER, CATEGORY_LABELS };
