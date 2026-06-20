package service

import (
	"encoding/json"
	"errors"
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"equipment-trading-platform/internal/util"
	"equipment-trading-platform/pkg/logger"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

type ValuationService struct {
	valuationRepo *repository.ValuationRepository
	deviceRepo    *repository.DeviceRepository
}

func NewValuationService() *ValuationService {
	return &ValuationService{
		valuationRepo: repository.NewValuationRepository(),
		deviceRepo:    repository.NewDeviceRepository(),
	}
}

type ValuationFactors struct {
	BaseDepreciationRate  float64
	AgeFactor             float64
	HoursFactor           float64
	MaintenanceFactor     float64
	AccidentFactor        float64
	MarketFactor          float64
	BrandFactor           float64
	RegionFactor          float64
	ConditionScore        float64
	FinalAdjustmentRate   float64
}

func (s *ValuationService) Evaluate(deviceID, assessorID uint64) (*model.ValuationReport, error) {
	exists, err := s.valuationRepo.HasValidReport(deviceID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, util.ErrValuationExists
	}

	device, err := s.deviceRepo.GetByIDWithDetail(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.ErrDeviceNotFound
		}
		return nil, err
	}

	factors := s.calculateValuationFactors(device)
	valuationPrice := s.calculateValuationPrice(device, factors)

	lowPrice := valuationPrice * 0.92
	highPrice := valuationPrice * 1.08

	baseFactorsJSON, _ := json.Marshal(map[string]interface{}{
		"original_price":        device.OriginalPrice,
		"manufacture_year":      device.ManufactureYear,
		"work_hours":            device.WorkHours,
		"brand":                 device.Brand,
		"model":                 device.Model,
		"base_depreciation_rate": factors.BaseDepreciationRate,
	})

	adjustFactorsJSON, _ := json.Marshal(map[string]interface{}{
		"age_factor":           factors.AgeFactor,
		"hours_factor":         factors.HoursFactor,
		"maintenance_factor":   factors.MaintenanceFactor,
		"accident_factor":      factors.AccidentFactor,
		"market_factor":        factors.MarketFactor,
		"brand_factor":         factors.BrandFactor,
		"region_factor":        factors.RegionFactor,
		"condition_score":      factors.ConditionScore,
		"final_adjustment_rate": factors.FinalAdjustmentRate,
	})

	marketData, _ := s.valuationRepo.GetMarketData(device.Region, device.CategoryID, device.Brand, device.Model)
	var marketRefJSON []byte
	if marketData != nil {
		marketRefJSON, _ = json.Marshal(map[string]interface{}{
			"region":       marketData.Region,
			"avg_price":    marketData.AvgPrice,
			"low_price":    marketData.LowPrice,
			"high_price":   marketData.HighPrice,
			"sample_count": marketData.SampleCount,
			"trend":        marketData.Trend,
			"change_rate":  marketData.ChangeRate,
		})
	}

	content := s.generateValuationContent(device, factors, valuationPrice, lowPrice, highPrice)
	conclusion := s.generateConclusion(device, factors, valuationPrice)

	report := &model.ValuationReport{
		DeviceID:       deviceID,
		AssessorID:     assessorID,
		ValuationPrice: math.Round(valuationPrice*100) / 100,
		LowPrice:       math.Round(lowPrice*100) / 100,
		HighPrice:      math.Round(highPrice*100) / 100,
		ReportNo:       util.GenerateOrderNo("VR"),
		Method:         "综合评估法",
		BaseFactors:    string(baseFactorsJSON),
		AdjustFactors:  string(adjustFactorsJSON),
		MarketRef:      string(marketRefJSON),
		Content:        content,
		Conclusion:     conclusion,
		Status:         "valid",
		ValuationDate:  time.Now(),
	}

	if err := s.valuationRepo.Create(report); err != nil {
		return nil, err
	}

	valuationPriceFloat := float64(report.ValuationPrice)
	if err := s.deviceRepo.GetDB().Model(&model.Device{}).Where("id = ?", deviceID).Update("valuation_price", &valuationPriceFloat).Error; err != nil {
		logger.Warnf("update device valuation_price failed: %v", err)
	}

	return report, nil
}

func (s *ValuationService) calculateValuationFactors(device *model.Device) *ValuationFactors {
	factors := &ValuationFactors{}

	currentYear := time.Now().Year()
	age := float64(currentYear - device.ManufactureYear)
	if age < 0 {
		age = 0
	}

	factors.BaseDepreciationRate = 0.15

	factors.AgeFactor = 1.0
	if age > 0 {
		if age <= 3 {
			factors.AgeFactor = 1.0 - age*0.08
		} else if age <= 5 {
			factors.AgeFactor = 0.76 - (age-3)*0.06
		} else if age <= 10 {
			factors.AgeFactor = 0.64 - (age-5)*0.04
		} else {
			factors.AgeFactor = 0.44 - (age-10)*0.02
		}
	}
	if factors.AgeFactor < 0.1 {
		factors.AgeFactor = 0.1
	}

	avgAnnualHours := 2000.0
	expectedHours := age * avgAnnualHours
	if expectedHours <= 0 {
		expectedHours = avgAnnualHours
	}
	hoursRatio := device.WorkHours / expectedHours
	if hoursRatio <= 0.8 {
		factors.HoursFactor = 1.05
	} else if hoursRatio <= 1.0 {
		factors.HoursFactor = 1.0
	} else if hoursRatio <= 1.3 {
		factors.HoursFactor = 0.95 - (hoursRatio-1.0)*0.15
	} else {
		factors.HoursFactor = 0.85
	}

	maintenanceCount := len(device.MaintenanceRecords)
	if maintenanceCount >= int(age)+2 {
		factors.MaintenanceFactor = 1.05
	} else if maintenanceCount >= int(age) {
		factors.MaintenanceFactor = 1.0
	} else if maintenanceCount >= int(age)/2 {
		factors.MaintenanceFactor = 0.95
	} else {
		factors.MaintenanceFactor = 0.88
	}

	if device.HasAccident {
		factors.AccidentFactor = 0.8
	} else {
		factors.AccidentFactor = 1.0
	}

	premiumBrands := map[string]bool{"CATERPILLAR": true, "KOMATSU": true, "HITACHI": true, "沃尔沃": true, "卡特彼勒": true, "小松": true, "日立": true}
	if premiumBrands[device.Brand] {
		factors.BrandFactor = 1.08
	} else {
		factors.BrandFactor = 1.0
	}

	factors.RegionFactor = 1.0
	if device.Region != "" {
		marketData, err := s.valuationRepo.GetMarketData(device.Region, device.CategoryID, device.Brand, device.Model)
		if err == nil && marketData != nil {
			factors.RegionFactor = 1 + marketData.ChangeRate/100
		}
	}

	factors.ConditionScore = 75
	factors.ConditionScore += factors.MaintenanceFactor * 5
	factors.ConditionScore += factors.HoursFactor * 5
	factors.ConditionScore += factors.AccidentFactor * 10
	if factors.ConditionScore > 100 {
		factors.ConditionScore = 100
	}

	factors.MarketFactor = 1.0
	marketData, err := s.valuationRepo.GetMarketData(device.Region, device.CategoryID, device.Brand, device.Model)
	if err == nil && marketData != nil {
		if marketData.Trend == "up" {
			factors.MarketFactor = 1.03
		} else if marketData.Trend == "down" {
			factors.MarketFactor = 0.97
		}
	}

	factors.FinalAdjustmentRate = (factors.AgeFactor + factors.HoursFactor + factors.MaintenanceFactor +
		factors.AccidentFactor + factors.MarketFactor + factors.BrandFactor + factors.RegionFactor) / 7

	return factors
}

func (s *ValuationService) calculateValuationPrice(device *model.Device, factors *ValuationFactors) float64 {
	basePrice := device.OriginalPrice

	currentYear := time.Now().Year()
	age := float64(currentYear - device.ManufactureYear)
	if age < 0 {
		age = 0
	}

	depreciated := basePrice
	for i := 0; i < int(age); i++ {
		depRate := factors.BaseDepreciationRate
		if i >= 5 {
			depRate = 0.08
		}
		depreciated *= (1 - depRate)
	}

	adjustedPrice := depreciated * factors.FinalAdjustmentRate

	marketData, err := s.valuationRepo.GetMarketData(device.Region, device.CategoryID, device.Brand, device.Model)
	if err == nil && marketData != nil && marketData.SampleCount >= 5 {
		marketWeight := 0.4
		modelWeight := 0.6
		adjustedPrice = adjustedPrice*modelWeight + marketData.AvgPrice*marketWeight
	}

	if adjustedPrice < basePrice*0.1 {
		adjustedPrice = basePrice * 0.1
	}

	return adjustedPrice
}

func (s *ValuationService) generateValuationContent(device *model.Device, factors *ValuationFactors, value, low, high float64) string {
	currentYear := time.Now().Year()
	age := currentYear - device.ManufactureYear
	if age < 0 {
		age = 0
	}

	accidentStr := "无"
	if device.HasAccident {
		accidentStr = "有 - " + device.AccidentDetail
	}

	categoryName := ""
	if device.Category != nil {
		categoryName = device.Category.Name
	}

	return fmt.Sprintf(`
【设备基础信息】
设备类型：%s
品牌型号：%s %s
出厂年份：%d年（已使用%d年）
工作小时数：%.1f小时
原始价格：%.2f万元
所在地区：%s
事故记录：%s

【评估方法说明】
本次评估采用综合评估法，综合考虑设备成新率、使用强度、维护状况、事故历史、品牌价值、区域市场行情等多维度因素。

【评估因素分析】
1. 年限成新率：%.2f%%（基础年折旧率%.0f%%）
2. 工时系数：%.2f（实际工时与理论工时比值影响）
3. 保养系数：%.2f（保养记录完整性影响）
4. 事故系数：%.2f（事故记录影响）
5. 品牌系数：%.2f（品牌保值率影响）
6. 区域系数：%.2f（区域市场行情影响）
7. 市场系数：%.2f（当前市场供需影响）
8. 综合状况评分：%.0f分

【评估结果】
建议评估价：%.2f万元
合理价格区间：%.2f万元 - %.2f万元
评估误差范围：±8%%
`,
		categoryName, device.Brand, device.Model,
		device.ManufactureYear, age,
		device.WorkHours, device.OriginalPrice,
		device.Region, accidentStr,
		factors.AgeFactor*100, factors.BaseDepreciationRate*100,
		factors.HoursFactor, factors.MaintenanceFactor,
		factors.AccidentFactor, factors.BrandFactor,
		factors.RegionFactor, factors.MarketFactor,
		factors.ConditionScore,
		value, low, high,
	)
}

func (s *ValuationService) generateConclusion(device *model.Device, factors *ValuationFactors, value float64) string {
	conclusion := "综合评估意见："

	if factors.ConditionScore >= 85 {
		conclusion += "该设备整体状况优良，保养到位，无重大事故记录，保值能力较强，"
	} else if factors.ConditionScore >= 70 {
		conclusion += "该设备整体状况良好，保养正常，可正常投入使用，"
	} else if factors.ConditionScore >= 55 {
		conclusion += "该设备整体状况一般，存在一定磨损，建议进行必要检修后投入使用，"
	} else {
		conclusion += "该设备整体状况较差，建议谨慎购买或大幅砍价，"
	}

	return fmt.Sprintf("%s建议交易价格不高于评估价格的±10%%区间，建议成交价：%.2f万元。", conclusion, value)
}

func (s *ValuationService) GetByID(id uint64) (*model.ValuationReport, error) {
	report, err := s.valuationRepo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, util.NewAppError(404, 4002, "评估报告不存在")
		}
		return nil, err
	}
	return report, nil
}

func (s *ValuationService) GetByDevice(deviceID uint64) (*model.ValuationReport, error) {
	report, err := s.valuationRepo.GetLatestValid(deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return report, nil
}

func (s *ValuationService) List(deviceID, assessorID *uint64, page, pageSize int) ([]*model.ValuationReport, int64, error) {
	return s.valuationRepo.List(deviceID, assessorID, page, pageSize)
}

func (s *ValuationService) Invalidate(deviceID uint64) error {
	return s.valuationRepo.InvalidateByDevice(deviceID)
}
