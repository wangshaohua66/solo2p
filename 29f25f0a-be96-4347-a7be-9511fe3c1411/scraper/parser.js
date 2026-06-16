const cheerio = require('cheerio');

class FreightParser {
  constructor(selectors) {
    this.selectors = selectors || {};
  }

  parseRates(html, carrierId, carrierName) {
    const $ = cheerio.load(html);
    const { rateRow, priceCell, portFrom: pfSel, portTo: ptSel, containerType: ctSel, validFrom: vfSel, validTo: vtSel } = this.selectors;

    const results = [];
    const collectedAt = new Date().toISOString();

    $(rateRow).each((i, el) => {
      const $row = $(el);
      
      const portFrom = this._cleanText($row.find(pfSel).text());
      const portTo = this._cleanText($row.find(ptSel).text());
      const containerType = this._cleanText($row.find(ctSel).text());
      const priceText = this._cleanText($row.find(priceCell).text());
      const baseRate = this._parsePrice(priceText);
      const validFrom = vfSel ? this._cleanText($row.find(vfSel).text()) : null;
      const validTo = vtSel ? this._cleanText($row.find(vtSel).text()) : null;

      if (baseRate && portFrom && portTo) {
        results.push({
          carrier_id: carrierId,
          carrier_name: carrierName,
          port_from: portFrom,
          port_to: portTo,
          container_type: containerType || '20GP',
          base_rate: baseRate,
          currency: this._detectCurrency(priceText),
          valid_from: validFrom,
          valid_to: validTo,
          surcharges_total: 0,
          total_rate: baseRate,
          collected_at: collectedAt,
          source_url: null
        });
      }
    });

    return results;
  }

  parseSpaceAvailability(html, carrierId, carrierName) {
    const $ = cheerio.load(html);
    const { spaceStatus, spaceAvailable, portFrom: pfSel, portTo: ptSel, containerType: ctSel, vesselName: vnSel, voyageNumber: voySel, departureDate: ddSel } = this.selectors;

    const results = [];
    const collectedAt = new Date().toISOString();

    if (spaceStatus && $(spaceStatus).length > 0) {
      $(spaceStatus).each((i, el) => {
        const $el = $(el);
        
        const portFrom = pfSel ? this._cleanText($el.find(pfSel).text()) : null;
        const portTo = ptSel ? this._cleanText($el.find(ptSel).text()) : null;
        const containerType = ctSel ? this._cleanText($el.find(ctSel).text()) : null;
        const availableText = spaceAvailable ? this._cleanText($el.find(spaceAvailable).text()) : null;
        const availableCount = this._parseNumber(availableText);
        const statusText = this._cleanText($el.text());
        const status = this._classifySpaceStatus(statusText, availableCount);
        const vesselName = vnSel ? this._cleanText($el.find(vnSel).text()) : null;
        const voyageNumber = voySel ? this._cleanText($el.find(voySel).text()) : null;
        const departureDate = ddSel ? this._cleanText($el.find(ddSel).text()) : null;

        results.push({
          carrier_id: carrierId,
          carrier_name: carrierName,
          port_from: portFrom,
          port_to: portTo,
          container_type: containerType || '20GP',
          available_count: availableCount,
          status,
          status_text: statusText,
          vessel_name: vesselName,
          voyage_number: voyageNumber,
          departure_date: departureDate,
          collected_at: collectedAt
        });
      });
    }

    return results;
  }

  parseSchedules(html, carrierId, carrierName) {
    const $ = cheerio.load(html);
    const { scheduleRow, portFrom: pfSel, portTo: ptSel, vesselName: vnSel, voyageNumber: voySel, departureDate: ddSel, arrivalDate: adSel } = this.selectors;

    const results = [];
    const collectedAt = new Date().toISOString();

    if (scheduleRow && $(scheduleRow).length > 0) {
      $(scheduleRow).each((i, el) => {
        const $row = $(el);
        
        const portFrom = pfSel ? this._cleanText($row.find(pfSel).text()) : null;
        const portTo = ptSel ? this._cleanText($row.find(ptSel).text()) : null;
        const vesselName = vnSel ? this._cleanText($row.find(vnSel).text()) : null;
        const voyageNumber = voySel ? this._cleanText($row.find(voySel).text()) : null;
        const departureDate = ddSel ? this._cleanText($row.find(ddSel).text()) : null;
        const arrivalDate = adSel ? this._cleanText($row.find(adSel).text()) : null;
        const transitDays = this._calculateTransitDays(departureDate, arrivalDate);

        if (vesselName || voyageNumber || departureDate) {
          results.push({
            carrier_id: carrierId,
            carrier_name: carrierName,
            port_from: portFrom,
            port_to: portTo,
            vessel_name: vesselName,
            voyage_number: voyageNumber,
            departure_date: departureDate,
            arrival_date: arrivalDate,
            transit_days: transitDays,
            service_code: null,
            collected_at: collectedAt
          });
        }
      });
    }

    return results;
  }

  parseSurcharges(html, carrierId, carrierName) {
    const $ = cheerio.load(html);
    const { surchargeItem, surchargeName, surchargeAmount, surchargeEffectiveDate } = this.selectors;

    const results = [];
    const detectedAt = new Date().toISOString();

    if (surchargeItem && $(surchargeItem).length > 0) {
      $(surchargeItem).each((i, el) => {
        const $el = $(el);
        
        const name = surchargeName ? this._cleanText($el.find(surchargeName).text()) : this._cleanText($el.text());
        const amountText = surchargeAmount ? this._cleanText($el.find(surchargeAmount).text()) : null;
        const amount = this._parsePrice(amountText);
        const effectiveDate = surchargeEffectiveDate ? this._cleanText($el.find(surchargeEffectiveDate).text()) : null;

        if (name && amount !== null) {
          const code = this._generateSurchargeCode(name);
          results.push({
            carrier_id: carrierId,
            carrier_name: carrierName,
            surcharge_code: code,
            surcharge_name: name,
            previous_amount: null,
            new_amount: amount,
            currency: this._detectCurrency(amountText || name),
            effective_date: effectiveDate,
            change_type: 'detected',
            description: null,
            detected_at: detectedAt,
            source_url: null
          });
        }
      });
    }

    return results;
  }

  _cleanText(text) {
    if (!text) return null;
    return text.replace(/\s+/g, ' ').trim();
  }

  _parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9.,]/g, '');
    const normalized = cleaned.replace(/,/g, '');
    const value = parseFloat(normalized);
    return isNaN(value) ? null : value;
  }

  _parseNumber(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^0-9]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? null : value;
  }

  _detectCurrency(text) {
    if (!text) return 'USD';
    if (text.includes('¥') || text.includes('CNY') || text.includes('RMB')) return 'CNY';
    if (text.includes('€') || text.includes('EUR')) return 'EUR';
    if (text.includes('£') || text.includes('GBP')) return 'GBP';
    if (text.includes('$') || text.includes('USD')) return 'USD';
    return 'USD';
  }

  _classifySpaceStatus(text, availableCount) {
    const lowerText = text ? text.toLowerCase() : '';
    
    if (lowerText.includes('full') || lowerText.includes('sold') || lowerText.includes('爆舱') || lowerText.includes('满')) {
      return 'full';
    }
    if (lowerText.includes('limited') || lowerText.includes('tight') || lowerText.includes('紧张') || lowerText.includes('紧')) {
      return 'limited';
    }
    if (lowerText.includes('available') || lowerText.includes('充足') || lowerText.includes('available')) {
      return 'available';
    }
    
    if (availableCount !== null) {
      if (availableCount === 0) return 'full';
      if (availableCount < 20) return 'limited';
      return 'available';
    }
    
    return 'unknown';
  }

  _calculateTransitDays(departure, arrival) {
    if (!departure || !arrival) return null;
    
    const depDate = new Date(departure);
    const arrDate = new Date(arrival);
    
    if (isNaN(depDate.getTime()) || isNaN(arrDate.getTime())) return null;
    
    const diffTime = arrDate.getTime() - depDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : null;
  }

  _generateSurchargeCode(name) {
    if (!name) return 'UNKNOWN';
    
    const upper = name.toUpperCase();
    
    if (upper.includes('BAF') || upper.includes('BUNKER')) return 'BAF';
    if (upper.includes('CAF') || upper.includes('CURRENCY')) return 'CAF';
    if (upper.includes('PSS') || upper.includes('PEAK SEASON')) return 'PSS';
    if (upper.includes('GRI') || upper.includes('GENERAL RATE')) return 'GRI';
    if (upper.includes('THC') || upper.includes('TERMINAL')) return 'THC';
    if (upper.includes('DOC') || upper.includes('DOCUMENT')) return 'DOC';
    if (upper.includes('EBS') || upper.includes('EMERGENCY')) return 'EBS';
    if (upper.includes('ISPS') || upper.includes('SECURITY')) return 'ISPS';
    
    return name.replace(/[^A-Z0-9]/g, '').substring(0, 10) || 'OTHER';
  }
}

function createParser(selectors) {
  return new FreightParser(selectors);
}

module.exports = {
  FreightParser,
  createParser
};
