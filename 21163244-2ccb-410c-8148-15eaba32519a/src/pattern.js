class PatternEngine {
  constructor(patterns) {
    this.patterns = [];
    this.compiledPatterns = new Map();
    this.compositePatterns = new Map();
    this.matchResults = new Map();

    if (Array.isArray(patterns)) {
      this.loadPatterns(patterns);
    }
  }

  loadPatterns(patterns) {
    for (const pattern of patterns) {
      if (pattern.composite && pattern.composite.operator) {
        this.compositePatterns.set(pattern.name, pattern);
      } else {
        try {
          const regex = new RegExp(pattern.regex, 'gi');
          this.compiledPatterns.set(pattern.name, {
            regex,
            original: pattern.regex,
            severity: pattern.severity || 'info',
            meta: pattern
          });
        } catch (e) {
          throw new Error(`Invalid regex for pattern '${pattern.name}': ${pattern.regex} - ${e.message}`);
        }
      }

      this.matchResults.set(pattern.name, {
        count: 0,
        firstSeen: null,
        lastSeen: null,
        matches: []
      });
    }

    for (const [name, pattern] of this.compositePatterns) {
      const missing = pattern.composite.patterns.filter(p => !this.compiledPatterns.has(p) && !this.compositePatterns.has(p));
      if (missing.length > 0) {
        throw new Error(`Composite pattern '${name}' references undefined patterns: ${missing.join(', ')}`);
      }
    }
  }

  matchLine(parsedLine) {
    const results = [];

    for (const [name, compiled] of this.compiledPatterns) {
      compiled.regex.lastIndex = 0;
      const lineText = parsedLine._raw || parsedLine.message || '';
      const match = compiled.regex.test(lineText);

      if (match) {
        const entry = this.matchResults.get(name);
        const now = parsedLine._timestamp || new Date().toISOString();
        entry.count++;
        if (!entry.firstSeen) entry.firstSeen = now;
        entry.lastSeen = now;
        if (entry.matches.length < 1000) {
          entry.matches.push({ timestamp: now, source: parsedLine._source, line: lineText });
        }

        results.push({
          pattern: name,
          severity: compiled.severity,
          timestamp: now,
          source: parsedLine._source,
          matched: true
        });
      }
    }

    for (const [name, pattern] of this.compositePatterns) {
      const compositeResult = this.evaluateComposite(pattern, parsedLine);
      if (compositeResult) {
        const entry = this.matchResults.get(name);
        const now = parsedLine._timestamp || new Date().toISOString();
        entry.count++;
        if (!entry.firstSeen) entry.firstSeen = now;
        entry.lastSeen = now;

        results.push({
          pattern: name,
          severity: pattern.severity || 'info',
          timestamp: now,
          source: parsedLine._source,
          matched: true,
          composite: true
        });
      }
    }

    return results;
  }

  evaluateComposite(pattern, parsedLine) {
    const { operator, patterns: subPatterns } = pattern.composite;
    const lineText = parsedLine._raw || parsedLine.message || '';

    switch (operator) {
      case 'AND':
        return subPatterns.every(name => {
          const compiled = this.compiledPatterns.get(name);
          if (compiled) {
            compiled.regex.lastIndex = 0;
            return compiled.regex.test(lineText);
          }
          return false;
        });

      case 'OR':
        return subPatterns.some(name => {
          const compiled = this.compiledPatterns.get(name);
          if (compiled) {
            compiled.regex.lastIndex = 0;
            return compiled.regex.test(lineText);
          }
          return false;
        });

      case 'NOT':
        return subPatterns.every(name => {
          const compiled = this.compiledPatterns.get(name);
          if (compiled) {
            compiled.regex.lastIndex = 0;
            return !compiled.regex.test(lineText);
          }
          return true;
        });

      default:
        return false;
    }
  }

  getStats() {
    const stats = [];
    for (const [name, entry] of this.matchResults) {
      stats.push({
        pattern: name,
        count: entry.count,
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen
      });
    }
    return stats.sort((a, b) => b.count - a.count);
  }

  getMatchDetail(name) {
    const entry = this.matchResults.get(name);
    if (!entry) return null;
    return {
      pattern: name,
      count: entry.count,
      firstSeen: entry.firstSeen,
      lastSeen: entry.lastSeen,
      matches: entry.matches
    };
  }

  reset() {
    for (const [, entry] of this.matchResults) {
      entry.count = 0;
      entry.firstSeen = null;
      entry.lastSeen = null;
      entry.matches = [];
    }
  }
}

module.exports = { PatternEngine };
