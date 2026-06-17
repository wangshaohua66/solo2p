package service

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"lab-management/internal/model"
	"lab-management/internal/dto"
	appErr "lab-management/internal/pkg/errors"
	"lab-management/internal/pkg/utils"
	"lab-management/internal/repository"
)

type TestResultService struct {
	db                *gorm.DB
	resultRepo        *repository.TestResultRepository
	sampleRepo        *repository.SampleRepository
	sampleItemRepo    *repository.SampleItemRepository
	itemRepo          *repository.TestItemRepository
	criticalRepo      *repository.CriticalValueRecordRepository
	userRepo          *repository.UserRepository
}

func NewTestResultService(
	db *gorm.DB,
	resultRepo *repository.TestResultRepository,
	sampleRepo *repository.SampleRepository,
	sampleItemRepo *repository.SampleItemRepository,
	itemRepo *repository.TestItemRepository,
	criticalRepo *repository.CriticalValueRecordRepository,
	userRepo *repository.UserRepository,
) *TestResultService {
	return &TestResultService{
		db:             db,
		resultRepo:     resultRepo,
		sampleRepo:     sampleRepo,
		sampleItemRepo: sampleItemRepo,
		itemRepo:       itemRepo,
		criticalRepo:   criticalRepo,
		userRepo:       userRepo,
	}
}

func (s *TestResultService) checkCritical(ti *model.TestItem, numericValue *float64) (bool, bool, string) {
	isCritical := false
	isAbnormal := false
	flag := ""

	if numericValue == nil {
		return isCritical, isAbnormal, flag
	}
	val := *numericValue

	if ti.CriticalLow != nil && val <= *ti.CriticalLow {
		isCritical = true
		flag = "!!L"
	}
	if ti.CriticalHigh != nil && val >= *ti.CriticalHigh {
		isCritical = true
		flag = "!!H"
	}
	if !isCritical {
		if ti.MinValue != nil && val < *ti.MinValue {
			isAbnormal = true
			flag = "L"
		}
		if ti.MaxValue != nil && val > *ti.MaxValue {
			isAbnormal = true
			flag = "H"
		}
	}
	return isCritical, isAbnormal, flag
}

func (s *TestResultService) SubmitResults(req *dto.SubmitTestResultsRequest, testedBy uint) *appErr.ErrorCode {
	sample, exists, err := s.sampleRepo.FindByID(req.SampleID)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrSampleNotFound
	}
	if sample.Status != model.SampleStatusReceived && sample.Status != model.SampleStatusTesting {
		return appErr.ErrSampleStatusInvalid.WithMessage("样本状态不允许录入结果")
	}

	sampleItems, err := s.sampleItemRepo.FindBySampleID(req.SampleID)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if len(sampleItems) == 0 {
		return appErr.ErrSampleNotFound.WithMessage("样本无检验项目")
	}

	itemMap := make(map[uint]model.SampleItem)
	for _, si := range sampleItems {
		itemMap[si.SampleItemID] = si
	}

	results := make([]model.TestResult, 0, len(req.Results))
	criticalRecords := make([]model.CriticalValueRecord, 0)
	hasCritical := false
	now := time.Now()

	for _, input := range req.Results {
		_, ok := itemMap[input.SampleItemID]
		if !ok {
			return appErr.ErrTestItemNotFound.WithMessage(fmt.Sprintf("样本项目%d不存在", input.SampleItemID))
		}
		ti, tiExists, err := s.itemRepo.FindByID(input.TestItemID)
		if err != nil {
			return appErr.ErrDatabaseError
		}
		if !tiExists {
			return appErr.ErrTestItemNotFound
		}

		isCritical, isAbnormal, flag := s.checkCritical(ti, input.NumericValue)
		if isCritical {
			hasCritical = true
			priority := 1
			criticalRecords = append(criticalRecords, model.CriticalValueRecord{
				SampleID:    req.SampleID,
				TestItemID:  input.TestItemID,
				ResultValue: input.ResultValue,
				RefRange:    ti.RefRange,
				AlertTime:   now,
				Priority:    priority,
			})
		}

		testedByPtr := &testedBy
		results = append(results, model.TestResult{
			SampleID:     req.SampleID,
			SampleItemID: input.SampleItemID,
			TestItemID:   input.TestItemID,
			ResultValue:  input.ResultValue,
			NumericValue: input.NumericValue,
			IsCritical:   isCritical,
			IsAbnormal:   isAbnormal,
			Flag:         flag,
			Device:       input.Device,
			TestTime:     &now,
			TestedBy:     testedByPtr,
			Remark:       input.Remark,
		})
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.resultRepo.CreateBatchWithTx(tx, results); err != nil {
			return err
		}
		for i := range criticalRecords {
			for j := range results {
				if results[j].TestItemID == criticalRecords[i].TestItemID {
					criticalRecords[i].TestResultID = results[j].ID
					break
				}
			}
			if err := s.criticalRepo.CreateWithTx(tx, &criticalRecords[i]); err != nil {
				return err
			}
		}
		if err := s.sampleRepo.UpdateStatus(req.SampleID, model.SampleStatusReviewing, nil, nil, nil, &hasCritical); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return appErr.ErrDatabaseError.WithMessage(err.Error())
	}
	return nil
}

func (s *TestResultService) GetResults(sampleID uint) ([]model.TestResult, *appErr.ErrorCode) {
	results, err := s.resultRepo.FindBySampleID(sampleID)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	return results, nil
}

type CriticalValueService struct {
	db            *gorm.DB
	criticalRepo  *repository.CriticalValueRecordRepository
	sampleRepo    *repository.SampleRepository
	userRepo      *repository.UserRepository
}

func NewCriticalValueService(
	db *gorm.DB,
	criticalRepo *repository.CriticalValueRecordRepository,
	sampleRepo *repository.SampleRepository,
	userRepo *repository.UserRepository,
) *CriticalValueService {
	return &CriticalValueService{
		db:           db,
		criticalRepo: criticalRepo,
		sampleRepo:   sampleRepo,
		userRepo:     userRepo,
	}
}

func (s *CriticalValueService) Review(req *dto.ReviewCriticalValueRequest, reviewerID uint) *appErr.ErrorCode {
	record, exists, err := s.criticalRepo.FindByID(req.RecordID)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrSampleNotFound.WithMessage("危急值记录不存在")
	}

	now := time.Now()
	if req.IsSecond {
		if record.FirstReviewedBy == nil {
			return appErr.ErrCriticalValueUnreviewed.WithMessage("需先进行第一复核")
		}
		if record.SecondReviewedBy != nil {
			return appErr.ErrCriticalValueReviewed.WithMessage("已完成第二复核")
		}
		if *record.FirstReviewedBy == reviewerID {
			return appErr.ErrCriticalValueUnreviewed.WithMessage("双人复核需不同人员")
		}
		if err := s.criticalRepo.SecondReview(req.RecordID, reviewerID, req.Comment, now); err != nil {
			return appErr.ErrDatabaseError
		}
	} else {
		if record.FirstReviewedBy != nil {
			return appErr.ErrCriticalValueReviewed.WithMessage("已完成第一复核")
		}
		if err := s.criticalRepo.FirstReview(req.RecordID, reviewerID, req.Comment, now); err != nil {
			return appErr.ErrDatabaseError
		}
	}
	return nil
}

func (s *CriticalValueService) GetBySample(sampleID uint) ([]model.CriticalValueRecord, *appErr.ErrorCode) {
	records, err := s.criticalRepo.FindBySampleID(sampleID)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	return records, nil
}

type ReportService struct {
	db                *gorm.DB
	reportRepo        *repository.ReportRepository
	reportReadRepo    *repository.ReportReadLogRepository
	sampleRepo        *repository.SampleRepository
	resultRepo        *repository.TestResultRepository
	sampleItemRepo    *repository.SampleItemRepository
	itemRepo          *repository.TestItemRepository
	criticalRepo      *repository.CriticalValueRecordRepository
	userRepo          *repository.UserRepository
	instRepo          *repository.InstitutionRepository
}

func NewReportService(
	db *gorm.DB,
	reportRepo *repository.ReportRepository,
	reportReadRepo *repository.ReportReadLogRepository,
	sampleRepo *repository.SampleRepository,
	resultRepo *repository.TestResultRepository,
	sampleItemRepo *repository.SampleItemRepository,
	itemRepo *repository.TestItemRepository,
	criticalRepo *repository.CriticalValueRecordRepository,
	userRepo *repository.UserRepository,
	instRepo *repository.InstitutionRepository,
) *ReportService {
	return &ReportService{
		db:             db,
		reportRepo:     reportRepo,
		reportReadRepo: reportReadRepo,
		sampleRepo:     sampleRepo,
		resultRepo:     resultRepo,
		sampleItemRepo: sampleItemRepo,
		itemRepo:       itemRepo,
		criticalRepo:   criticalRepo,
		userRepo:       userRepo,
		instRepo:       instRepo,
	}
}

func (s *ReportService) Generate(sampleID uint, operatorID uint) (string, *appErr.ErrorCode) {
	sample, exists, err := s.sampleRepo.FindByID(sampleID)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	if !exists {
		return "", appErr.ErrSampleNotFound
	}
	if sample.Status != model.SampleStatusReviewing && sample.Status != model.SampleStatusCompleted {
		return "", appErr.ErrSampleStatusInvalid.WithMessage("样本未完成检验")
	}

	hasUnreviewed, err := s.criticalRepo.HasUnreviewed(sampleID)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	if hasUnreviewed {
		return "", appErr.ErrCriticalValueUnreviewed.WithMessage("存在未完成复核的危急值")
	}

	existingReport, reportExists, err := s.reportRepo.FindBySampleID(sampleID)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	if reportExists && existingReport.Status == model.ReportStatusPublished {
		return existingReport.ReportNo, appErr.ErrReportSigned.WithMessage("报告已签发")
	}

	results, err := s.resultRepo.FindBySampleID(sampleID)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	if len(results) == 0 {
		return "", appErr.ErrReportNotGenerated.WithMessage("无检验结果")
	}

	sampleItems, err := s.sampleItemRepo.FindBySampleID(sampleID)
	if err != nil {
		return "", appErr.ErrDatabaseError
	}
	resultItemMap := make(map[uint]model.TestResult)
	for _, r := range results {
		resultItemMap[r.TestItemID] = r
	}

	operator, _, _ := s.userRepo.FindByID(operatorID)
	doctorName := ""
	reviewerName := ""
	if operator != nil {
		reviewerName = operator.RealName
		if reviewerName == "" {
			reviewerName = operator.Username
		}
		doctorName = reviewerName
	}

	inst, _, _ := s.instRepo.FindByID(sample.InstitutionID)
	instName := ""
	if inst != nil {
		instName = inst.Name
	}

	reportItems := make([]utils.ReportItemData, 0, len(sampleItems))
	for _, si := range sampleItems {
		ti, _, _ := s.itemRepo.FindByID(si.TestItemID)
		result := resultItemMap[si.TestItemID]
		if ti != nil {
			reportItems = append(reportItems, utils.ReportItemData{
				ItemName:     ti.Name,
				ItemCode:     ti.Code,
				Result:       result.ResultValue,
				Unit:         ti.Unit,
				RefRange:     ti.RefRange,
				IsCritical:   result.IsCritical,
				IsAbnormal:   result.IsAbnormal,
				AbnormalFlag: result.Flag,
			})
		}
	}

	now := time.Now()
	reportNo := utils.GenerateReportNo()
	signContent := fmt.Sprintf("%s|%d|%s", reportNo, sampleID, now.Format("20060102150405"))
	signature := utils.MD5Sign(signContent)

	reportData := &utils.ReportData{
		ReportNo:    reportNo,
		Institution: instName,
		PatientName: sample.PatientName,
		PatientID:   sample.PatientID,
		Gender:      sample.Gender,
		Age:         sample.Age,
		CollectTime: sample.CollectTime,
		ReportTime:  now,
		Doctor:      doctorName,
		Reviewer:    reviewerName,
		Items:       reportItems,
		Signature:   signature,
		Barcode:     sample.Barcode,
	}

	pdfData, err := utils.GenerateReportPDF(reportData)
	if err != nil {
		return "", appErr.ErrGenerateReport.WithMessage(err.Error())
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		var reportID uint
		if reportExists {
			reportID = existingReport.ID
			if err := s.reportRepo.UpdateStatus(reportID, model.ReportStatusGenerated,
				&operatorID, &operatorID, doctorName, reviewerName, signature, &now, nil); err != nil {
				return err
			}
		} else {
			report := &model.Report{
				SampleID:      sampleID,
				ReportNo:      reportNo,
				InstitutionID: sample.InstitutionID,
				Status:        model.ReportStatusGenerated,
				DoctorID:      &operatorID,
				ReviewerID:    &operatorID,
				DoctorName:    doctorName,
				ReviewerName:  reviewerName,
				Signature:     signature,
				GeneratedAt:   &now,
				FileData:      pdfData,
			}
			if err := tx.Create(report).Error; err != nil {
				return err
			}
			reportID = report.ID
		}
		if err := s.reportRepo.UpdateFileData(reportID, pdfData); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return "", appErr.ErrDatabaseError.WithMessage(err.Error())
	}
	return reportNo, nil
}

func (s *ReportService) Publish(sampleID uint, operatorID uint) *appErr.ErrorCode {
	report, exists, err := s.reportRepo.FindBySampleID(sampleID)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrReportNotFound
	}
	if report.Status != model.ReportStatusGenerated {
		return appErr.ErrReportSigned.WithMessage("报告状态不允许签发")
	}

	sample, _, _ := s.sampleRepo.FindByID(sampleID)
	if sample != nil {
		if err := s.sampleRepo.UpdateStatus(sampleID, model.SampleStatusCompleted, nil, nil, &operatorID, nil); err != nil {
			return appErr.ErrDatabaseError
		}
	}

	now := time.Now()
	return s.reportRepo.UpdateStatus(report.ID, model.ReportStatusPublished,
		report.DoctorID, report.ReviewerID, report.DoctorName, report.ReviewerName,
		report.Signature, report.GeneratedAt, &now)
}

func (s *ReportService) GetByID(id uint) (*model.Report, *appErr.ErrorCode) {
	report, exists, err := s.reportRepo.FindByID(id)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrReportNotFound
	}
	return report, nil
}

func (s *ReportService) GetByReportNo(reportNo string) (*model.Report, *appErr.ErrorCode) {
	report, exists, err := s.reportRepo.FindByReportNo(reportNo)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrReportNotFound
	}
	return report, nil
}

func (s *ReportService) GetBySample(sampleID uint) (*model.Report, *appErr.ErrorCode) {
	report, exists, err := s.reportRepo.FindBySampleID(sampleID)
	if err != nil {
		return nil, appErr.ErrDatabaseError
	}
	if !exists {
		return nil, appErr.ErrReportNotFound
	}
	return report, nil
}

func (s *ReportService) GetFileData(id uint) ([]byte, *appErr.ErrorCode) {
	report, ec := s.GetByID(id)
	if ec != nil {
		return nil, ec
	}
	if len(report.FileData) == 0 {
		return nil, appErr.ErrReportNotGenerated
	}
	return report.FileData, nil
}

func (s *ReportService) MarkRead(id uint, readerID uint, readerName string, instID uint, ip string) *appErr.ErrorCode {
	report, exists, err := s.reportRepo.FindByID(id)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !exists {
		return appErr.ErrReportNotFound
	}
	readExists, err := s.reportReadRepo.Exists(id, readerID)
	if err != nil {
		return appErr.ErrDatabaseError
	}
	if !readExists {
		log := &model.ReportReadLog{
			ReportID:      id,
			ReaderID:      readerID,
			ReaderName:    readerName,
			InstitutionID: instID,
			ReadAt:        time.Now(),
			IPAddress:     ip,
		}
		if err := s.reportReadRepo.Create(log); err != nil {
			return appErr.ErrDatabaseError
		}
	}
	if report.Status == model.ReportStatusPublished {
		_ = s.reportRepo.UpdateStatus(id, model.ReportStatusRead,
			report.DoctorID, report.ReviewerID, report.DoctorName, report.ReviewerName,
			report.Signature, report.GeneratedAt, report.PublishedAt)
	}
	return nil
}

func (s *ReportService) List(q *dto.SampleReportQuery, currentInstID uint) ([]model.Report, int64, *appErr.ErrorCode) {
	instID := q.InstitutionID
	if currentInstID > 0 && instID == nil {
		instID = &currentInstID
	}
	list, total, err := s.reportRepo.List(instID, q.Barcode, q.Status, q.IsRead, q.Page, q.PageSize)
	if err != nil {
		return nil, 0, appErr.ErrDatabaseError
	}
	return list, total, nil
}
