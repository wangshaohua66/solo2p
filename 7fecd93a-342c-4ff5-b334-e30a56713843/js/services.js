/* API 服务层 — 连接 ASP.NET Core 8.0 Web API 后端 */

const API_BASE = window.API_BASE_URL || '/api';

const api = {
  async _request(method, path, data, query) {
    let url = API_BASE + path;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v != null && v !== '') params.append(k, v);
      });
      const qs = params.toString();
      if (qs) url += '?' + qs;
    }

    const opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data && method !== 'GET') opts.body = JSON.stringify(data);

    try {
      const res = await fetch(url, opts);
      const json = await res.json();
      if (!res.ok || !json.success) {
        const err = new Error(json.message || '请求失败');
        err.code = json.code || 'UNKNOWN_ERROR';
        err.errors = json.errors;
        throw err;
      }
      return json.data;
    } catch (e) {
      if (e.code) throw e;
      throw { code: 'NETWORK_ERROR', message: e.message || '网络错误' };
    }
  },

  /* ====== WaterLevelController ====== */
  waterlevel: {
    async stations() {
      return api._request('GET', '/waterlevel/stations');
    },
    async latest(type) {
      return api._request('GET', '/waterlevel/latest', null, { type });
    },
    async history(stationId, startTime, endTime, page = 1, pageSize = 100) {
      return api._request('GET', '/waterlevel/history', null, {
        stationId, startTime, endTime, page, pageSize
      });
    },
    async warnings() {
      return api._request('GET', '/waterlevel/warnings');
    },
    async floodSim(params) {
      return api._request('POST', '/waterlevel/flood-simulate', params);
    },
    async postReading(reading) {
      return api._request('POST', '/waterlevel/readings', reading);
    }
  },

  /* ====== DispatchController ====== */
  dispatch: {
    async gates(reservoirId) {
      return api._request('GET', '/dispatch/gates', null, { reservoirId });
    },
    async receivers() {
      return api._request('GET', '/dispatch/receivers');
    },
    async list(filter) {
      return api._request('GET', '/dispatch', null, filter);
    },
    async get(id) {
      return api._request('GET', '/dispatch/' + id);
    },
    async create(body) {
      return api._request('POST', '/dispatch', body);
    },
    async confirm(id, actual, remark, operatorName) {
      return api._request('PUT', `/dispatch/${id}/confirm`, { actualOpening: actual, remark, operatorName });
    },
    async close(id, remark, operatorName) {
      return api._request('PUT', `/dispatch/${id}/close`, { remark, operatorName });
    },
    async trace(id) {
      return api._request('GET', `/dispatch/${id}/trace`);
    },
    async stats() {
      return api._request('GET', '/dispatch/stats');
    }
  },

  /* ====== InspectionController ====== */
  inspection: {
    async list(filter) {
      return api._request('GET', '/inspection', null, filter);
    },
    async get(id) {
      return api._request('GET', '/inspection/' + id);
    },
    async generatePlan(month, planType) {
      return api._request('POST', '/inspection/generate-plan', { month, planType });
    },
    async addDefect(taskId, defect) {
      return api._request('POST', `/inspection/${taskId}/defects`, defect);
    },
    async resolveDefect(taskId, defectId, remark, operatorName) {
      return api._request('PUT', `/inspection/${taskId}/defects/${defectId}/resolve`, { resolveRemark: remark, operatorName });
    },
    async completeTask(taskId) {
      return api._request('PUT', `/inspection/${taskId}/complete`);
    },
    async defectStats(filter) {
      return api._request('GET', '/inspection/stats', null, filter);
    },
    async stats() {
      return api._request('GET', '/inspection/stats');
    }
  },

  /* ====== EmergencyController ====== */
  emergency: {
    async planTree() {
      return api._request('GET', '/emergency/plans/tree');
    },
    async versions(reservoirId) {
      return api._request('GET', `/emergency/plans/${reservoirId}/versions`);
    },
    async getVersion(vid) {
      return api._request('GET', '/emergency/plans/' + vid);
    },
    async diff(reservoirId, v1, v2) {
      return api._request('GET', `/emergency/plans/${reservoirId}/diff`, null, { v1, v2 });
    },
    async match(reservoirId, level) {
      return api._request('GET', `/emergency/plans/${reservoirId}/match`, null, { waterLevel: level });
    }
  },

  /* ====== Contacts / Notifications ====== */
  contacts: {
    async list(role) {
      return api._request('GET', '/emergency/contacts', null, { role });
    },
    async search(kw) {
      return api._request('GET', '/emergency/contacts', null, { keyword: kw });
    },
    async notify(contactIds, title, message, channel, priority, senderName) {
      return api._request('POST', '/emergency/notify', {
        contactIds, title, message, channel: channel || 'AppPush',
        priority: priority || 'normal', senderName
      });
    },
    async notifyLogs(batchId, recipientId, status) {
      return api._request('GET', '/emergency/notify-logs', null, { batchId, recipientId, status });
    },
    async markRead(notificationId) {
      return api._request('PUT', `/emergency/notify-logs/${notificationId}/read`);
    }
  },

  /* ====== LeveeController ====== */
  levee: {
    async list(params) {
      return api._request('GET', '/levee', null, params);
    },
    async get(id) {
      return api._request('GET', '/levee/' + id);
    },
    async create(d) {
      return api._request('POST', '/levee', d);
    },
    async update(id, d) {
      return api._request('PUT', '/levee/' + id, d);
    },
    async remove(id) {
      return api._request('DELETE', '/levee/' + id);
    }
  },

  /* ====== ReportController ====== */
  report: {
    async levelCurve(reservoirId, range) {
      return api._request('GET', '/report/level-curve', null, { reservoirId, range });
    },
    async rainfallIsohyet() {
      return api._request('GET', '/report/rainfall-isohyet');
    },
    async dispatchOps() {
      return api._request('GET', '/report/dispatch-stats');
    },
    async defectRatio() {
      return api._request('GET', '/report/inspection-stats');
    }
  },

  /* ====== 数据聚合服务 ====== */
  aggregation: {
    async overview() {
      return api._request('GET', '/waterlevel/stations');
    },
    async warnings() {
      return api._request('GET', '/waterlevel/warnings');
    }
  }
};

window.API = api;
