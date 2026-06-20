(function(global) {
  'use strict';

  const InspectionModel = {
    validate(data, warehouse) {
      const errors = [];
      const wh = warehouse || (global.Store && data.warehouseId ? global.Store.getWarehouseById(data.warehouseId) : null);

      if (!data.temperature && data.temperature !== 0) {
        errors.push('温度不能为空');
      } else if (typeof data.temperature !== 'number' || isNaN(data.temperature)) {
        errors.push('温度必须为数字');
      } else if (data.temperature < -10 || data.temperature > 50) {
        errors.push('温度范围应在-10℃~50℃之间');
      }

      if (!data.humidity && data.humidity !== 0) {
        errors.push('湿度不能为空');
      } else if (typeof data.humidity !== 'number' || isNaN(data.humidity)) {
        errors.push('湿度必须为数字');
      } else if (data.humidity < 0 || data.humidity > 100) {
        errors.push('湿度范围应在0%~100%之间');
      }

      if (!data.operator) errors.push('巡检人员不能为空');

      const result = {
        valid: errors.length === 0,
        errors,
        hasAlert: false,
        alertType: null
      };

      if (result.valid && wh) {
        const overTemp = data.temperature < wh.temperatureMin || data.temperature > wh.temperatureMax;
        const overHumid = data.humidity < wh.humidityMin || data.humidity > wh.humidityMax;
        result.hasAlert = overTemp || overHumid;
        result.alertType = overTemp && overHumid ? '温湿度均超标' : overTemp ? '温度超标' : overHumid ? '湿度超标' : null;
        result.temperatureStatus = overTemp
          ? (data.temperature < wh.temperatureMin ? '偏低' : '偏高')
          : '正常';
        result.humidityStatus = overHumid
          ? (data.humidity < wh.humidityMin ? '偏低' : '偏高')
          : '正常';
      }

      return result;
    },

    getTrend(inspections) {
      if (!inspections || inspections.length === 0) return { avgTemp: 0, avgHumid: 0, trend: 'stable' };
      const temps = inspections.map(i => i.temperature);
      const humids = inspections.map(i => i.humidity);
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      const avgHumid = humids.reduce((a, b) => a + b, 0) / humids.length;
      const recent = inspections.slice(0, Math.min(5, inspections.length));
      const earlier = inspections.slice(Math.min(5, inspections.length), Math.min(10, inspections.length));
      const recentAvg = recent.reduce((s, i) => s + i.temperature, 0) / recent.length;
      let trend = 'stable';
      if (earlier.length > 0) {
        const earlierAvg = earlier.reduce((s, i) => s + i.temperature, 0) / earlier.length;
        if (recentAvg - earlierAvg > 1) trend = 'rising';
        else if (earlierAvg - recentAvg > 1) trend = 'falling';
      }
      return { avgTemp: Number(avgTemp.toFixed(1)), avgHumid: Number(avgHumid.toFixed(1)), trend };
    }
  };

  global.InspectionModel = InspectionModel;
})(window);
