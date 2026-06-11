(function(global) {
  'use strict';

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    const parseLine = (line) => {
      const out = [];
      let cur = '', inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
          else inQuote = !inQuote;
        } else if (ch === ',' && !inQuote) {
          out.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(s => s.trim());
    };
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  }

  function parseXML(text) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const err = xml.querySelector('parsererror');
    if (err) throw new Error('XML 解析错误');
    const items = Array.from(xml.querySelectorAll('ITEM, Item, item'));
    if (items.length === 0) return { headers: [], rows: [] };
    const headersSet = new Set();
    items.forEach(it => Array.from(it.children).forEach(c => headersSet.add(c.tagName)));
    const headers = Array.from(headersSet);
    const rows = items.map(it => headers.map(h => {
      const el = it.querySelector(h);
      return el ? (el.textContent || '').trim() : '';
    }));
    return { headers, rows };
  }

  const BRICKLINK_FIELD_MAP = {
    'ITEMID': 'partNumber', 'ItemID': 'partNumber', 'itemid': 'partNumber',
    'ITEMTYPE': 'category', 'ItemType': 'category', 'itemtype': 'category',
    'COLOR': 'color', 'Color': 'color', 'color': 'color',
    'QTY': 'quantity', 'Qty': 'quantity', 'quantity': 'quantity',
    'PRICE': 'unitPrice', 'Price': 'price', 'price': 'unitPrice',
    'ITEMNAME': 'name', 'ItemName': 'name', 'itemname': 'name'
  };

  function mapFields(headers, rows, fieldMap) {
    const map = fieldMap || BRICKLINK_FIELD_MAP;
    const mappedHeaders = headers.map(h => map[h] || h.toLowerCase());
    return rows.map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        const key = map[h] || h.toLowerCase();
        let val = r[i];
        if (['quantity', 'unitPrice'].includes(key)) {
          val = parseFloat(val) || 0;
        }
        obj[key] = val;
      });
      return obj;
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsText(file, 'UTF-8');
    });
  }

  async function importFile(file) {
    const text = await readFile(file);
    const isXML = /\.xml$/i.test(file.name) || /^\s*</.test(text.trim());
    const parsed = isXML ? parseXML(text) : parseCSV(text);
    return {
      filename: file.name,
      type: isXML ? 'xml' : 'csv',
      headers: parsed.headers,
      rows: parsed.rows,
      mapped: mapFields(parsed.headers, parsed.rows)
    };
  }

  global.BVImport = { parseCSV, parseXML, mapFields, importFile };
})(window);
