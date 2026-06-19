/* ==========================================================================
   analysis-engine.js — 统计引擎
   方差分析(ANOVA)、变异系数(CV)、Shukla稳定性方差、AMMI/GGE双标图PCA分解
   纯计算模块，不依赖DOM
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- 基础统计 ---------- */
  function sum(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i] || 0; return s; }
  function mean(arr) { return arr.length ? sum(arr) / arr.length : 0; }
  function sd(arr, sample) {
    if (arr.length < 2) return 0;
    var m = mean(arr), s = 0;
    for (var i = 0; i < arr.length; i++) { var d = (arr[i] || 0) - m; s += d * d; }
    return Math.sqrt(s / (arr.length - (sample ? 1 : 0)));
  }
  function cv(arr) { var m = mean(arr); return m ? (sd(arr, true) / m) * 100 : 0; }
  function min(arr) { return arr.length ? Math.min.apply(null, arr) : 0; }
  function max(arr) { return arr.length ? Math.max.apply(null, arr) : 0; }
  function round2(n) { return Math.round((n || 0) * 100) / 100; }
  function round3(n) { return Math.round((n || 0) * 1000) / 1000; }

  /* ---------- 矩阵工具 ---------- */
  function transpose(A) {
    if (!A.length) return [];
    var r = A.length, c = A[0].length, T = [];
    for (var j = 0; j < c; j++) { T[j] = []; for (var i = 0; i < r; i++) T[j][i] = A[i][j]; }
    return T;
  }
  function matMul(A, B) {
    var r = A.length, k = A[0].length, c = B[0].length, C = [];
    for (var i = 0; i < r; i++) {
      C[i] = [];
      for (var j = 0; j < c; j++) {
        var s = 0;
        for (var p = 0; p < k; p++) s += (A[i][p] || 0) * (B[p][j] || 0);
        C[i][j] = s;
      }
    }
    return C;
  }
  function colVec(M, j) { var v = []; for (var i = 0; i < M.length; i++) v.push(M[i][j]); return v; }

  /* ---------- Jacobi 对称矩阵特征分解 ---------- */
  function jacobiEigen(A, maxSweeps) {
    var n = A.length;
    var a = A.map(function (r) { return r.slice(); });
    var v = [];
    for (var i = 0; i < n; i++) { v.push(new Array(n).fill(0)); v[i][i] = 1; }
    maxSweeps = maxSweeps || 80;
    var iter;
    for (iter = 0; iter < maxSweeps; iter++) {
      var off = 0;
      for (var p = 0; p < n; p++) for (var q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
      if (off < 1e-14) break;
      for (var p = 0; p < n - 1; p++) {
        for (var q = p + 1; q < n; q++) {
          var apq = a[p][q];
          if (Math.abs(apq) < 1e-16) continue;
          var app = a[p][p], aqq = a[q][q];
          var t;
          if (Math.abs(app - aqq) < 1e-30) { t = apq > 0 ? 1 : -1; }
          else {
            var theta = (aqq - app) / (2 * apq);
            t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          }
          var c = 1 / Math.sqrt(t * t + 1);
          var s = t * c;
          for (var k = 0; k < n; k++) { var akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
          for (var k2 = 0; k2 < n; k2++) { var apk = a[p][k2], aqk = a[q][k2]; a[p][k2] = c * apk - s * aqk; a[q][k2] = s * apk + c * aqk; }
          for (var k3 = 0; k3 < n; k3++) { var vkp = v[k3][p], vkq = v[k3][q]; v[k3][p] = c * vkp - s * vkq; v[k3][q] = s * vkp + c * vkq; }
        }
      }
    }
    var eigenvalues = [];
    for (var i2 = 0; i2 < n; i2++) eigenvalues.push(a[i2][i2]);
    var idx = eigenvalues.map(function (_, i) { return i; }).sort(function (x, y) { return eigenvalues[y] - eigenvalues[x]; });
    return {
      eigenvalues: idx.map(function (i) { return Math.max(0, eigenvalues[i]); }),
      eigenvectors: idx.map(function (i) { return colVec(v, i); })
    };
  }

  /* ---------- 构建 品种×环境 均值矩阵 ---------- */
  // records: 试验记录数组；varieties: 品种对象数组；stations: 站点数组
  // 返回矩阵 M[g][e] = 品种g在环境e的小区均值(亩产)
  function buildGEMatrix(records, varieties, stations) {
    var genoIds = varieties.map(function (v) { return v.id; });
    var genoNames = varieties.map(function (v) { return v.name; });
    var envCodes = stations.map(function (s) { return s.code; });
    var envNames = stations.map(function (s) { return s.name; });
    var g = genoIds.length, e = envCodes.length;
    var acc = [];
    for (var i = 0; i < g; i++) { acc[i] = []; for (var j = 0; j < e; j++) acc[i][j] = { sum: 0, n: 0 }; }
    records.forEach(function (r) {
      var gi = genoIds.indexOf(r.varietyId);
      var ei = envCodes.indexOf(r.stationCode);
      if (gi < 0 || ei < 0) return;
      if (r.muYield == null || r.status === 'abnormal') return;
      acc[gi][ei].sum += r.muYield; acc[gi][ei].n++;
    });
    var matrix = acc.map(function (row) { return row.map(function (c) { return c.n ? c.sum / c.n : null; }); });
    var genoMeans = matrix.map(function (row) { var vals = row.filter(function (x) { return x != null; }); return mean(vals); });
    var envMeans = envCodes.map(function (_, j) { var vals = matrix.map(function (row) { return row[j]; }).filter(function (x) { return x != null; }); return mean(vals); });
    var allVals = [];
    matrix.forEach(function (row) { row.forEach(function (v) { if (v != null) allVals.push(v); }); });
    var grandMean = mean(allVals);
    return { matrix: matrix, genoIds: genoIds, genoNames: genoNames, envCodes: envCodes, envNames: envNames, genoMeans: genoMeans, envMeans: envMeans, grandMean: grandMean, counts: acc };
  }

  /* ---------- 多点汇总(每品种跨站点统计) ---------- */
  function multiPointSummary(records, varieties, stations) {
    var ge = buildGEMatrix(records, varieties, stations);
    var results = [];
    for (var i = 0; i < ge.genoIds.length; i++) {
      var vals = ge.matrix[i].filter(function (x) { return x != null; });
      var m = mean(vals), s = sd(vals, true);
      results.push({
        varietyId: ge.genoIds[i],
        name: ge.genoNames[i],
        mean: round2(m),
        sd: round2(s),
        cv: round2(s && m ? (s / m) * 100 : 0),
        min: round2(min(vals)),
        max: round2(max(vals)),
        n: vals.length,
        envCount: vals.length,
        rank: 0,
        stabilityRank: 0
      });
    }
    // Shukla 稳定性方差
    var stab = shuklaStability(ge);
    stab.forEach(function (st, idx) {
      results[idx].shuklaVar = round2(st.shuklaVar);
      results[idx].ecovalence = round2(st.ecovalence);
      results[idx].interaction = st.interaction;
    });
    // 产量均值降序排名
    var byMean = results.slice().sort(function (a, b) { return b.mean - a.mean; });
    byMean.forEach(function (r, idx) { r.rank = idx + 1; });
    // 稳定性方差升序排名(越小越稳定)
    var byStab = results.slice().sort(function (a, b) { return a.shuklaVar - b.shuklaVar; });
    byStab.forEach(function (r, idx) { r.stabilityRank = idx + 1; });
    // 综合理想评分：均值归一化 + 稳定性归一化(稳定为高分)
    var maxMean = max(results.map(function (r) { return r.mean; })) || 1;
    var maxStab = max(results.map(function (r) { return r.shuklaVar; })) || 1;
    results.forEach(function (r) {
      var yieldScore = (r.mean / maxMean) * 100;
      var stabScore = (1 - r.shuklaVar / maxStab) * 100;
      r.idealScore = round2(yieldScore * 0.6 + stabScore * 0.4);
    });
    return { rows: results, ge: ge };
  }

  /* ---------- Shukla 稳定性方差 / Wricke 生态价 ---------- */
  function shuklaStability(ge) {
    var matrix = ge.matrix, g = matrix.length, e = ge.envCodes.length;
    var results = [];
    for (var i = 0; i < g; i++) {
      var eco = 0, interaction = [];
      for (var j = 0; j < e; j++) {
        var yij = matrix[i][j];
        if (yij == null) { interaction.push(null); continue; }
        var inter = yij - ge.genoMeans[i] - ge.envMeans[j] + ge.grandMean;
        interaction.push(round2(inter));
        eco += inter * inter;
      }
      results.push({
        genoIdx: i,
        ecovalence: eco,
        shuklaVar: e > 1 ? eco / (e - 1) : 0,
        interaction: interaction
      });
    }
    return results;
  }

  /* ---------- GGE 双标图 PCA 分解 ---------- */
  // GGE = 基因型主效 + 基因型×环境互作；对环境均值中心化后做PCA
  function ggeBiplot(records, varieties, stations, opts) {
    opts = opts || {};
    var comps = opts.components || 2;
    var ge = buildGEMatrix(records, varieties, stations);
    var matrix = ge.matrix, g = matrix.length, e = ge.envCodes.length;
    // 缺失值用环境均值填充(简化)
    for (var i = 0; i < g; i++) {
      for (var j = 0; j < e; j++) {
        if (matrix[i][j] == null) matrix[i][j] = ge.envMeans[j];
      }
    }
    // 环境中心化(GGE): 减去各列(环境)均值
    var centered = [];
    for (var i2 = 0; i2 < g; i2++) {
      centered[i2] = [];
      for (var j = 0; j < e; j++) centered[i2][j] = matrix[i2][j] - ge.envMeans[j];
    }
    // 协方差矩阵 C = M^T M (e×e)
    var Mt = transpose(centered);
    var C = matMul(Mt, centered);
    var eig = jacobiEigen(C);
    var k = Math.min(comps, e);
    // 取前 k 个主成分
    var topEig = eig.eigenvalues.slice(0, k);
    var topVec = eig.eigenvectors.slice(0, k);
    var totalVar = sum(eig.eigenvalues) || 1;
    var explained = eig.eigenvalues.map(function (v) { return v / totalVar; });

    // 对称缩放：envScores = V * ev^(1/4)，genoScores = (M @ V) / ev^(1/4)
    var genoScores = [], envScores = [];
    for (var i3 = 0; i3 < g; i3++) {
      genoScores[i3] = [];
      for (var c = 0; c < k; c++) {
        var proj = 0;
        for (var j2 = 0; j2 < e; j2++) proj += centered[i3][j2] * topVec[c][j2];
        var denom = Math.pow(topEig[c], 0.25) || 1;
        genoScores[i3][c] = proj / denom;
      }
    }
    for (var j3 = 0; j3 < e; j3++) {
      envScores[j3] = [];
      for (var c2 = 0; c2 < k; c2++) {
        var denom2 = Math.pow(topEig[c2], 0.25) || 1;
        envScores[j3][c2] = topVec[c2][j3] * denom2;
      }
    }
    // 识别理想品种(高产+稳定)：在双标图上靠近"理想点"
    var genoLabels = ge.genoNames, envLabels = ge.envNames;
    var avgGx = mean(genoScores.map(function (s) { return s[0]; }));
    var avgGy = mean(genoScores.map(function (s) { return s[1] || 0; }));
    // 产量主效方向：用基因型均值
    var genoMeanY = ge.genoMeans;
    var maxMean = max(genoMeanY);
    var ideal = genoLabels.map(function (_, i) {
      var distIdeal = Math.sqrt(Math.pow(genoScores[i][0] - maxMean * 0 + avgGx, 2) + Math.pow((genoScores[i][1] || 0) - avgGy, 2));
      return { idx: i, name: genoLabels[i], meanY: genoMeanY[i], x: genoScores[i][0], y: genoScores[i][1] || 0 };
    });
    return {
      genoScores: genoScores, envScores: envScores,
      genoLabels: genoLabels, envLabels: envLabels,
      genoIds: ge.genoIds, envCodes: ge.envCodes,
      genoMeans: ge.genoMeans,
      eigenvalues: topEig.map(round3),
      explained: explained.slice(0, k).map(function (v) { return Math.round(v * 1000) / 10; }),
      allExplained: explained.map(function (v) { return Math.round(v * 1000) / 10; }),
      grandMean: ge.grandMean, genoMeanYield: ge.genoMeans, envMeanYield: ge.envMeans,
      ideal: ideal
    };
  }

  /* ---------- AMMI 模型(加性主效 + 互作主成分) ---------- */
  // AMMI: 先拟合加性主效(G+E)，再对残差(互作)做PCA
  function ammiModel(records, varieties, stations, opts) {
    opts = opts || {};
    var comps = opts.components || 2;
    var ge = buildGEMatrix(records, varieties, stations);
    var matrix = ge.matrix, g = matrix.length, e = ge.envCodes.length;
    var interaction = [];
    for (var i = 0; i < g; i++) {
      interaction[i] = [];
      for (var j = 0; j < e; j++) {
        var v = matrix[i][j];
        if (v == null) v = ge.envMeans[j];
        interaction[i][j] = v - ge.genoMeans[i] - ge.envMeans[j] + ge.grandMean;
      }
    }
    var Mt = transpose(interaction);
    var C = matMul(Mt, interaction);
    var eig = jacobiEigen(C);
    var k = Math.min(comps, e);
    var topEig = eig.eigenvalues.slice(0, k);
    var topVec = eig.eigenvectors.slice(0, k);
    var totalVar = sum(eig.eigenvalues) || 1;
    var explained = eig.eigenvalues.map(function (v) { return v / totalVar; });
    var genoScores = [], envScores = [];
    for (var i2 = 0; i2 < g; i2++) {
      genoScores[i2] = [];
      for (var c = 0; c < k; c++) {
        var proj = 0;
        for (var j2 = 0; j2 < e; j2++) proj += interaction[i2][j2] * topVec[c][j2];
        genoScores[i2][c] = proj;
      }
    }
    for (var j3 = 0; j3 < e; j3++) {
      envScores[j3] = [];
      for (var c2 = 0; c2 < k; c2++) envScores[j3][c2] = topVec[c2][j3] * topEig[c2];
    }
    return {
      genoScores: genoScores, envScores: envScores,
      genoLabels: ge.genoNames, envLabels: ge.envNames,
      genoIds: ge.genoIds, envCodes: ge.envCodes,
      genoMeans: ge.genoMeans, envMeans: ge.envMeans, grandMean: ge.grandMean,
      eigenvalues: topEig.map(round3),
      explained: explained.slice(0, k).map(function (v) { return Math.round(v * 1000) / 10; }),
      interaction: interaction
    };
  }

  /* ---------- 方差分析(ANOVA) 两因素有重复 ---------- */
  function anova(records, varieties, stations) {
    var ge = buildGEMatrix(records, varieties, stations);
    var g = ge.genoIds.length, e = ge.envCodes.length;
    var reps = {};
    records.forEach(function (r) {
      var key = r.varietyId + '|' + r.stationCode;
      if (!reps[key]) reps[key] = [];
      if (r.muYield != null && r.status !== 'abnormal') reps[key].push(r.muYield);
    });
    var repPerCell = 0;
    Object.keys(reps).forEach(function (k) { repPerCell = Math.max(repPerCell, reps[k].length); });
    repPerCell = repPerCell || 1;
    var r = repPerCell;
    var N = g * e * r;
    // 单元均值
    var cellMean = {};
    Object.keys(reps).forEach(function (k) { cellMean[k] = mean(reps[k]); });
    var grand = ge.grandMean;
    // SS
    var ssG = 0, ssE = 0, ssGE = 0, ssErr = 0, ssT = 0;
    for (var i = 0; i < g; i++) {
      ssG += e * r * Math.pow(ge.genoMeans[i] - grand, 2);
    }
    for (var j = 0; j < e; j++) {
      ssE += g * r * Math.pow(ge.envMeans[j] - grand, 2);
    }
    for (var i2 = 0; i2 < g; i2++) {
      for (var j2 = 0; j2 < e; j2++) {
        var cm = cellMean[ge.genoIds[i2] + '|' + ge.envCodes[j2]];
        if (cm == null) continue;
        ssGE += r * Math.pow(cm - ge.genoMeans[i2] - ge.envMeans[j2] + grand, 2);
        var repVals = reps[ge.genoIds[i2] + '|' + ge.envCodes[j2]] || [];
        repVals.forEach(function (y) { ssErr += Math.pow(y - cm, 2); ssT += Math.pow(y - grand, 2); });
      }
    }
    var dfG = g - 1, dfE = e - 1, dfGE = (g - 1) * (e - 1), dfErr = g * e * (r - 1), dfT = N - 1;
    var msG = dfG ? ssG / dfG : 0, msE = dfE ? ssE / dfE : 0, msGE = dfGE ? ssGE / dfGE : 0, msErr = dfErr ? ssErr / dfErr : 0;
    function fSig(f, df1, df2) {
      if (!df2 || !f) return '—';
      // 近似显著性判断(避免引入F表)
      if (f > 6) return '极显著**';
      if (f > 3.5) return '显著*';
      return '不显著';
    }
    var rows = [
      { source: '品种间(G)', df: dfG, ss: round2(ssG), ms: round2(msG), f: round2(msG / msErr), sig: fSig(msG / msErr, dfG, dfErr) },
      { source: '环境间(E)', df: dfE, ss: round2(ssE), ms: round2(msE), f: round2(msE / msErr), sig: fSig(msE / msErr, dfE, dfErr) },
      { source: '品种×环境(GE)', df: dfGE, ss: round2(ssGE), ms: round2(msGE), f: round2(msGE / msErr), sig: fSig(msGE / msErr, dfGE, dfErr) },
      { source: '误差', df: dfErr, ss: round2(ssErr), ms: round2(msErr), f: '', sig: '' },
      { source: '总计', df: dfT, ss: round2(ssT), ms: '', f: '', sig: '' }
    ];
    return { rows: rows, grandMean: round2(grand), CV: round2(Math.sqrt(msErr) / grand * 100) };
  }

  /* ---------- 适应性分析：每品种各环境表现 ---------- */
  function adaptability(records, varieties, stations) {
    var ge = buildGEMatrix(records, varieties, stations);
    var result = [];
    for (var i = 0; i < ge.genoIds.length; i++) {
      var best = null, bestEnv = null;
      for (var j = 0; j < ge.envCodes.length; j++) {
        var v = ge.matrix[i][j];
        if (v != null && (best == null || v > best)) { best = v; bestEnv = ge.envCodes[j]; }
      }
      var aboveAvg = 0;
      for (var j2 = 0; j2 < ge.envCodes.length; j2++) {
        if (ge.matrix[i][j2] != null && ge.matrix[i][j2] >= ge.envMeans[j2]) aboveAvg++;
      }
      result.push({
        varietyId: ge.genoIds[i], name: ge.genoNames[i],
        mean: round2(ge.genoMeans[i]),
        bestEnv: bestEnv, bestYield: round2(best),
        adaptRate: round2(aboveAvg / ge.envCodes.length * 100)
      });
    }
    return result;
  }

  /* ---------- 产量矩阵(品种×站点, 含均值列) ---------- */
  function yieldMatrix(records, varieties, stations) {
    var ge = buildGEMatrix(records, varieties, stations);
    return ge;
  }

  global.AnalysisEngine = {
    sum: sum, mean: mean, sd: sd, cv: cv, min: min, max: max, round2: round2, round3: round3,
    transpose: transpose, matMul: matMul, jacobiEigen: jacobiEigen,
    buildGEMatrix: buildGEMatrix, multiPointSummary: multiPointSummary,
    shuklaStability: shuklaStability, ggeBiplot: ggeBiplot, ammiModel: ammiModel,
    anova: anova, adaptability: adaptability, yieldMatrix: yieldMatrix
  };
})(window);
