import db from '../config/database.js';

const VALID_TRANSITIONS = {
  submitted: ['appraising'],
  appraising: ['photographed'],
  photographed: ['cataloging'],
  cataloging: ['previewing'],
  previewing: ['bidding'],
  bidding: ['sold', 'passed'],
  sold: ['settled'],
  passed: ['settled'],
  settled: ['delivered'],
  delivered: [],
};

function generateLotNumber() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const lots = db.collection('lots').find();
  const todayLots = lots.filter((l) => l.lot_number && l.lot_number.includes(dateStr));
  const seq = String(todayLots.length + 1).padStart(4, '0');
  return `LOT-${dateStr}-${seq}`;
}

function validateStatusTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`不允许从 "${currentStatus}" 转换到 "${newStatus}"`);
  }
  return true;
}

function recordStatusHistory(lot, newStatus, changedBy) {
  const history = lot.status_history || [];
  history.push({
    status: newStatus,
    changed_at: new Date().toISOString(),
    changed_by: changedBy,
  });
  return history;
}

export { generateLotNumber, validateStatusTransition, recordStatusHistory, VALID_TRANSITIONS };
