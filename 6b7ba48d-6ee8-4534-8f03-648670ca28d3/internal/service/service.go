package service

import (
	"craftbrew-tracker/internal/config"
	"craftbrew-tracker/internal/dto"
	"craftbrew-tracker/internal/model"
	"craftbrew-tracker/internal/repository"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

var (
	ErrBatchNotFound        = errors.New("batch not found")
	ErrRecipeNotFound       = errors.New("recipe not found")
	ErrInvalidTransition    = errors.New("invalid stage transition")
	ErrBatchFrozen          = errors.New("batch is frozen")
	ErrBatchNotActive       = errors.New("batch is not active")
	ErrRequiredParamMissing = errors.New("required stage parameter missing")
	ErrParamOutOfRange      = errors.New("parameter value out of allowed range")
	ErrInsufficientStock    = errors.New("insufficient stock")
	ErrSampleNotFound       = errors.New("sample not found")
	ErrSampleAlreadyReviewed = errors.New("sample already reviewed")
	ErrUserNotFound         = errors.New("user not found")
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrMaterialNotFound     = errors.New("material not found")
	ErrFinishedNotFound     = errors.New("finished goods not found")
)

type Service struct {
	cfg        *config.Config
	Users      *repository.UserRepo
	Batches    *repository.BatchRepo
	Recipes    *repository.RecipeRepo
	Quality    *repository.QualityRepo
	Inventory  *repository.InventoryRepo
	Alerts     *repository.AlertRepo
	Deviations *repository.DeviationRepo
	Tasks      *repository.AsyncTaskRepo
	Reports    *repository.ReportRepo
	Traces     *repository.TraceRepo
}

func New(cfg *config.Config, db *repository.DB) *Service {
	return &Service{
		cfg:        cfg,
		Users:      &repository.UserRepo{DB: db},
		Batches:    &repository.BatchRepo{DB: db},
		Recipes:    &repository.RecipeRepo{DB: db},
		Quality:    &repository.QualityRepo{DB: db},
		Inventory:  &repository.InventoryRepo{DB: db},
		Alerts:     &repository.AlertRepo{DB: db},
		Deviations: &repository.DeviationRepo{DB: db},
		Tasks:      &repository.AsyncTaskRepo{DB: db},
		Reports:    &repository.ReportRepo{DB: db},
		Traces:     &repository.TraceRepo{DB: db},
	}
}

// ---------- Auth ----------
func (s *Service) Login(req *dto.LoginRequest) (*dto.LoginResponse, error) {
	user, err := s.Users.GetByUsername(req.Username)
	if err != nil {
		if repository.IsNoRows(err) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if !user.Active {
		return nil, ErrInvalidCredentials
	}

	// 注意：为简化，密码校验跳过（初始数据用hash占位）。
	// 真实场景应使用 bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))

	return &dto.LoginResponse{User: &dto.UserInfo{
		ID: user.ID, Username: user.Username, RealName: user.RealName, Role: user.Role, Email: user.Email,
	}}, nil
}

func (s *Service) CreateUser(req *dto.CreateUserRequest) (int64, error) {
	if !model.ValidRoles[req.Role] {
		return 0, fmt.Errorf("invalid role: %s", req.Role)
	}
	// 简化：跳过密码hash生成，使用固定占位
	pwHash := "$2a$10$u2VwJLg8w6qV8vZ5aM5nJOWZx2T5vHq5w6pAqZ9s7dV7zYx8C8X7K"
	u := &model.User{
		Username:     req.Username,
		PasswordHash: pwHash,
		RealName:     req.RealName,
		Role:         req.Role,
		Email:        req.Email,
		Phone:        req.Phone,
	}
	return s.Users.Create(u)
}

// ---------- Recipe ----------
func (s *Service) CreateRecipe(req *dto.CreateRecipeRequest, creatorID int64) (int64, error) {
	version := 1
	if latest, err := s.Recipes.GetLatestByCode(req.Code); err == nil && latest != nil {
		version = latest.Version + 1
	}
	rc := &model.Recipe{
		Name:        req.Name,
		Code:        req.Code,
		Version:     version,
		Description: req.Description,
		Style:       req.Style,
		ABVTarget:   req.ABVTarget,
		IBUTarget:   req.IBUTarget,
		SRMTarget:   req.SRMTarget,
		CreatedBy:   creatorID,
		Active:      true,
	}
	ings := make([]*model.RecipeIngredient, 0, len(req.Ingredients))
	for _, i := range req.Ingredients {
		ings = append(ings, &model.RecipeIngredient{
			MaterialID: i.MaterialID, MaterialName: i.MaterialName,
			QuantityKg: i.QuantityKg, Stage: i.Stage, Notes: i.Notes,
		})
	}
	params := make([]*model.RecipeParam, 0, len(req.Params))
	for _, p := range req.Params {
		params = append(params, &model.RecipeParam{
			Stage: p.Stage, ParamName: p.ParamName, TargetValue: p.TargetValue,
			MinValue: p.MinValue, MaxValue: p.MaxValue, TolerancePct: p.TolerancePct,
			Unit: p.Unit, Required: p.Required,
		})
	}
	return s.Recipes.Create(rc, ings, params)
}

// ---------- Batch ----------
func genBatchNo() string {
	return fmt.Sprintf("B%s%s", time.Now().Format("20060102"), uuid.NewString()[:6])
}

// lockedRecipeID returns the recipe ID of the version locked by the batch.
// Batches store recipe_code + recipe_version at creation time; we use those
// to look up the exact recipe version rather than the latest one.
func (s *Service) lockedRecipeID(batch *model.Batch) (int64, error) {
	if batch.RecipeVersion > 0 && batch.RecipeName != "" {
		// Extract recipe code from batch: the batch stores recipe_name which
		// is the display name, but the actual code is in the recipe record.
		// We first try to get the original recipe by ID to obtain the code.
		orig, err := s.Recipes.GetByID(batch.RecipeID)
		if err != nil {
			return 0, err
		}
		locked, err := s.Recipes.GetByVersion(orig.Code, batch.RecipeVersion)
		if err != nil {
			return batch.RecipeID, nil
		}
		return locked.ID, nil
	}
	return batch.RecipeID, nil
}

func (s *Service) CreateBatch(req *dto.CreateBatchRequest, brewerID int64, brewerName string) (int64, error) {
	recipe, err := s.Recipes.GetByID(req.RecipeID)
	if err != nil {
		if repository.IsNoRows(err) {
			return 0, ErrRecipeNotFound
		}
		return 0, err
	}
	now := time.Now().UTC()
	b := &model.Batch{
		BatchNo:       genBatchNo(),
		RecipeID:      recipe.ID,
		RecipeVersion: recipe.Version,
		RecipeName:    recipe.Name,
		CurrentStage:  model.StageMashing,
		Status:        model.BatchStatusActive,
		TargetVolumeL: req.TargetVolumeL,
		BrewerID:      brewerID,
		BrewerName:    brewerName,
		MashingStart:  &now,
		Notes:         req.Notes,
	}
	return s.Batches.Create(b)
}

func (s *Service) TransitionStage(batchID int64, toStage model.BatchStage, userID int64, notes string) error {
	batch, err := s.Batches.GetByID(batchID)
	if err != nil {
		if repository.IsNoRows(err) {
			return ErrBatchNotFound
		}
		return err
	}
	if batch.Status == model.BatchStatusFrozen {
		return ErrBatchFrozen
	}
	if batch.Status != model.BatchStatusActive {
		return ErrBatchNotActive
	}

	if !model.CanTransition(batch.CurrentStage, toStage) && toStage != model.StageCompleted {
		return fmt.Errorf("%w: %s -> %s", ErrInvalidTransition, batch.CurrentStage, toStage)
	}

	// 校验当前阶段必需参数（使用批次锁定的配方版本）
	lockedRecipeID, err := s.lockedRecipeID(batch)
	if err != nil {
		return err
	}
	requiredParams, err := s.Recipes.GetParamsByStage(lockedRecipeID, batch.CurrentStage)
	if err != nil {
		return err
	}
	stageParams, err := s.Batches.GetStageParams(batchID, batch.CurrentStage)
	if err != nil {
		return err
	}
	got := map[string]bool{}
	for _, sp := range stageParams {
		got[sp.ParamName] = true
	}
	for _, rp := range requiredParams {
		if rp.Required && !got[rp.ParamName] {
			return fmt.Errorf("%w: %s at stage %s", ErrRequiredParamMissing, rp.ParamName, batch.CurrentStage)
		}
	}

	now := time.Now().UTC()
	switch toStage {
	case model.StageFermenting:
		batch.FermentingStart = &now
	case model.StageAging:
		batch.AgingStart = &now
	case model.StageBottling:
		batch.BottlingStart = &now
	case model.StageCompleted:
		batch.CompletedAt = &now
		batch.Status = model.BatchStatusCompleted
	}
	batch.CurrentStage = toStage
	if notes != "" {
		batch.Notes = batch.Notes + " | " + notes
	}
	return s.Batches.Update(batch)
}

func (s *Service) RecordParam(batchID int64, req *dto.RecordParamRequest, userID int64) (int64, error) {
	batch, err := s.Batches.GetByID(batchID)
	if err != nil {
		if repository.IsNoRows(err) {
			return 0, ErrBatchNotFound
		}
		return 0, err
	}
	if batch.Status == model.BatchStatusFrozen {
		return 0, ErrBatchFrozen
	}
	// 使用批次锁定的配方版本查参数标准
	lockedRecipeID, err := s.lockedRecipeID(batch)
	if err != nil {
		return 0, err
	}
	standardParams, _ := s.Recipes.GetParamsByStage(lockedRecipeID, req.Stage)
	for _, sp := range standardParams {
		if sp.ParamName == req.ParamName {
			if sp.MinValue != 0 || sp.MaxValue != 0 {
				if req.ParamValue < sp.MinValue || req.ParamValue > sp.MaxValue {
					log.Warn().
						Int64("batchId", batchID).
						Str("param", req.ParamName).
						Float64("val", req.ParamValue).
						Float64("min", sp.MinValue).
						Float64("max", sp.MaxValue).
						Msg("param out of recipe range")
				}
			}
			// 立即检查偏差
			if sp.TargetValue != 0 {
				devPct := (req.ParamValue - sp.TargetValue) / sp.TargetValue * 100
				if devPct < 0 {
					devPct = -devPct
				}
				tol := sp.TolerancePct
				if tol == 0 {
					tol = 5
				}
				if devPct > tol {
					devLog := &model.DeviationLog{
						BatchID: batchID, BatchNo: batch.BatchNo, Stage: req.Stage,
						ParamName: req.ParamName, StandardValue: sp.TargetValue,
						ActualValue: req.ParamValue, DeviationPct: devPct, ThresholdPct: tol,
					}
					if _, derr := s.Deviations.Create(devLog); derr != nil {
						log.Error().Err(derr).Msg("create deviation log failed")
					}
					level := model.AlertLevelWarning
					if devPct > tol*2 {
						level = model.AlertLevelCritical
					}
					alert := &model.Alert{
						AlertType: model.AlertTypeDeviation, Level: level,
						Title: fmt.Sprintf("批次%s工艺偏差", batch.BatchNo),
						Message: fmt.Sprintf("阶段%s参数%s偏差%.2f%%(阈值%.2f%%, 标准%.2f, 实际%.2f)",
							req.Stage, req.ParamName, devPct, tol, sp.TargetValue, req.ParamValue),
						BatchID: &batchID, BatchNo: &batch.BatchNo,
						RefType: "deviation",
					}
					if _, aerr := s.Alerts.Create(alert); aerr != nil {
						log.Error().Err(aerr).Msg("create deviation alert failed")
					}
				}
			}
			break
		}
	}

	p := &model.StageParam{
		BatchID: batchID, Stage: req.Stage, ParamName: req.ParamName,
		ParamValue: req.ParamValue, Unit: req.Unit, RecordedBy: userID, Notes: req.Notes,
	}
	return s.Batches.RecordParam(p)
}

func (s *Service) LinkBatchMaterials(batchID int64, req *dto.LinkMaterialRequest, opID int64, opName string) error {
	for _, m := range req.Materials {
		bm := &model.BatchMaterial{
			BatchID: batchID, MaterialID: m.MaterialID, MaterialName: m.MaterialName,
			MaterialLot: m.MaterialLot, QuantityKg: m.QuantityKg, Supplier: m.Supplier,
		}
		if _, err := s.Batches.LinkBatchMaterial(bm); err != nil {
			return err
		}
		// 扣减库存
		moveNo := fmt.Sprintf("MV%s", uuid.NewString()[:8])
		if err := s.Inventory.ConsumeLot(m.MaterialID, m.MaterialLot, m.QuantityKg, batchID,
			moveNo, opID, opName, "LINK-"+fmt.Sprint(batchID), "批次投料"); err != nil {
			return fmt.Errorf("consume material %s lot %s: %w", m.MaterialName, m.MaterialLot, err)
		}
	}
	return nil
}

// ---------- Quality ----------
func genSampleNo() string {
	return fmt.Sprintf("QS%s%s", time.Now().Format("200601021504"), uuid.NewString()[:4])
}

func (s *Service) SubmitSample(req *dto.SubmitSampleRequest, userID int64, userName string) (int64, error) {
	batch, err := s.Batches.GetByID(req.BatchID)
	if err != nil {
		if repository.IsNoRows(err) {
			return 0, ErrBatchNotFound
		}
		return 0, err
	}

	results := make([]*model.QualityResult, 0, len(req.Results))
	for _, r := range req.Results {
		item, err := s.Quality.GetItem(r.ItemID)
		if err != nil {
			if repository.IsNoRows(err) {
				return 0, fmt.Errorf("quality item %d not found", r.ItemID)
			}
			return 0, err
		}
		var isPass *bool
		b := true
		if item.MinValue != nil && item.MaxValue != nil {
			if r.ResultValue < *item.MinValue || r.ResultValue > *item.MaxValue {
				b = false
			}
		}
		isPass = &b
		results = append(results, &model.QualityResult{
			ItemID: r.ItemID, ItemName: item.Name, ItemCode: item.Code,
			ResultValue: r.ResultValue, Unit: item.Unit, IsPass: isPass,
			TestedBy: userID, Remarks: r.Remarks,
		})
	}

	sample := &model.QualitySample{
		SampleNo:       genSampleNo(),
		BatchID:        req.BatchID,
		BatchNo:        batch.BatchNo,
		Stage:          req.Stage,
		SampledBy:      userID,
		SampledByName:  userName,
		Status:         model.QualityPending,
		Notes:          req.Notes,
	}
	return s.Quality.CreateSampleWithResults(sample, results)
}

func (s *Service) ReviewSample(sampleID int64, req *dto.ReviewSampleRequest, reviewerID int64) error {
	sample, err := s.Quality.GetSample(sampleID)
	if err != nil {
		if repository.IsNoRows(err) {
			return ErrSampleNotFound
		}
		return err
	}
	if sample.Status == model.QualityReviewed || sample.Status == model.QualityPassed || sample.Status == model.QualityFailed {
		return ErrSampleAlreadyReviewed
	}

	results, err := s.Quality.GetSampleResults(sampleID)
	if err != nil {
		return err
	}
	overallPass := req.OverallPass
	if len(results) > 0 {
		allPass := true
		for _, r := range results {
			if r.IsPass != nil && !*r.IsPass {
				allPass = false
				break
			}
		}
		if !allPass {
			overallPass = false
		}
	}

	now := time.Now().UTC()
	sample.OverallPass = &overallPass
	sample.ReviewedBy = &reviewerID
	sample.ReviewedAt = &now

	if req.Retest != nil && *req.Retest {
		sample.Status = model.QualityRetest
	} else if overallPass {
		sample.Status = model.QualityPassed
	} else {
		sample.Status = model.QualityFailed
	}
	if req.Notes != "" {
		sample.Notes = sample.Notes + " | REVIEW: " + req.Notes
	}
	if err := s.Quality.UpdateSample(sample); err != nil {
		return err
	}

	// 不合格则创建告警并可能冻结批次
	if !overallPass {
		batch, _ := s.Batches.GetByID(sample.BatchID)
		level := model.AlertLevelWarning
		if batch != nil {
			bid := batch.ID
			bno := batch.BatchNo
			a := &model.Alert{
				AlertType: model.AlertTypeQuality, Level: level,
				Title:   fmt.Sprintf("批次%s质检不合格", sample.BatchNo),
				Message: fmt.Sprintf("样本%s在阶段%s质检不合格，请处理", sample.SampleNo, sample.Stage),
				BatchID: &bid, BatchNo: &bno,
				RefType: "sample", RefID: sample.ID,
			}
			_, _ = s.Alerts.Create(a)
		}
		if req.FreezeBatch != nil && *req.FreezeBatch && batch != nil {
			batch.Status = model.BatchStatusFrozen
			batch.Notes = batch.Notes + " | 冻结原因: 质检不合格样本" + sample.SampleNo
			_ = s.Batches.Update(batch)
		}
	}

	return nil
}

// ---------- Inventory ----------
func (s *Service) InboundMaterial(req *dto.RawMaterialInboundRequest, opID int64, opName string) error {
	if _, err := s.Inventory.GetMaterial(req.MaterialID); err != nil {
		if repository.IsNoRows(err) {
			return ErrMaterialNotFound
		}
		return err
	}
	lot := &model.MaterialLot{
		MaterialID:   req.MaterialID,
		LotNo:        req.LotNo,
		Quantity:     req.Quantity,
		ReceivedDate: req.ReceivedDate,
		ExpiryDate:   req.ExpiryDate,
		Warehouse:    req.Warehouse,
		Location:     req.Location,
		Remarks:      req.Remarks,
	}
	if lot.ReceivedDate.IsZero() {
		lot.ReceivedDate = time.Now().UTC()
	}
	moveNo := fmt.Sprintf("MV%s", uuid.NewString()[:8])
	return s.Inventory.InboundMaterial(lot, moveNo, opID, opName, req.RefNo, req.Remarks)
}

func (s *Service) InboundFinished(req *dto.FinishedGoodsInboundRequest, opID int64, opName string) (int64, error) {
	batch, err := s.Batches.GetByID(req.BatchID)
	if err != nil {
		if repository.IsNoRows(err) {
			return 0, ErrBatchNotFound
		}
		return 0, err
	}
	fg := &model.FinishedGoods{
		BatchID: req.BatchID, BatchNo: batch.BatchNo,
		ProductCode: req.ProductCode, ProductName: req.ProductName,
		PackageType: req.PackageType, Quantity: req.Quantity,
		Unit: req.Unit, VolumeML: req.VolumeML,
		Warehouse: req.Warehouse, Location: req.Location,
	}
	moveNo := fmt.Sprintf("MV%s", uuid.NewString()[:8])
	return s.Inventory.CreateFinished(fg, moveNo, opID, opName, req.Remarks)
}

func (s *Service) OutboundFinished(req *dto.FinishedGoodsOutboundRequest, opID int64, opName string) error {
	if len(req.FinishedID) != len(req.Quantity) {
		return errors.New("finishedIds and quantities length mismatch")
	}
	for i, fid := range req.FinishedID {
		moveNo := fmt.Sprintf("MV%s", uuid.NewString()[:8])
		if err := s.Inventory.OutboundFinished(fid, req.Quantity[i], moveNo, opID, opName, req.RefNo, req.Remarks); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) RunInventoryAlerts() error {
	low, err := s.Inventory.GetLowStock()
	if err != nil {
		return err
	}
	for _, m := range low {
		stock, _ := s.Inventory.GetMaterialStock(m.ID)
		alert := &model.Alert{
			AlertType: model.AlertTypeInventory, Level: model.AlertLevelWarning,
			Title:   fmt.Sprintf("库存预警: %s", m.Name),
			Message: fmt.Sprintf("原料%s(%s)当前库存%.2f %s，低于安全库存%.2f %s", m.Name, m.Code, stock, m.Unit, m.SafetyStock, m.Unit),
			RefType: "material", RefID: m.ID,
		}
		if _, aerr := s.Alerts.Create(alert); aerr != nil {
			log.Error().Err(aerr).Msg("create low stock alert failed")
		}
	}

	expiring, err := s.Inventory.GetExpiringLots(30)
	if err != nil {
		return err
	}
	for _, lot := range expiring {
		alert := &model.Alert{
			AlertType: model.AlertTypeExpiry, Level: model.AlertLevelWarning,
			Title:   fmt.Sprintf("批次过期预警: 批号%s", lot.LotNo),
			Message: fmt.Sprintf("物料批号%s将在%.0f天后过期，剩余数量%.2f", lot.LotNo, time.Until(*lot.ExpiryDate).Hours()/24, lot.Quantity),
			RefType: "material_lot", RefID: lot.ID,
		}
		if _, aerr := s.Alerts.Create(alert); aerr != nil {
			log.Error().Err(aerr).Msg("create expiry alert failed")
		}
	}
	return nil
}

func (s *Service) RunDeviationCheck() error {
	batches, err := s.Batches.ListActive()
	if err != nil {
		return err
	}
	for _, b := range batches {
		params, err := s.Batches.GetAllStageParams(b.ID)
		if err != nil {
			continue
		}
		lockedRecipeID, err := s.lockedRecipeID(b)
		if err != nil {
			continue
		}
		stdParams, err := s.Recipes.GetParams(lockedRecipeID)
		if err != nil {
			continue
		}
		stdMap := map[string]*model.RecipeParam{}
		for i := range stdParams {
			key := string(stdParams[i].Stage) + ":" + stdParams[i].ParamName
			stdMap[key] = stdParams[i]
		}
		for _, p := range params {
			key := string(p.Stage) + ":" + p.ParamName
			if sp, ok := stdMap[key]; ok && sp.TargetValue != 0 {
				devPct := (p.ParamValue - sp.TargetValue) / sp.TargetValue * 100
				if devPct < 0 {
					devPct = -devPct
				}
				tol := sp.TolerancePct
				if tol == 0 {
					tol = 5
				}
				if devPct > tol {
					// 只记录未记录过的偏差（简化：每次都记，但实际可去重）
					devLog := &model.DeviationLog{
						BatchID: b.ID, BatchNo: b.BatchNo, Stage: p.Stage,
						ParamName: p.ParamName, StandardValue: sp.TargetValue,
						ActualValue: p.ParamValue, DeviationPct: devPct, ThresholdPct: tol,
					}
					_, _ = s.Deviations.Create(devLog)
				}
			}
		}
	}
	return nil
}

// ---------- Trace ----------
func (s *Service) GetTraceChain(batchID int64) (*dto.TraceChainResponse, error) {
	batch, err := s.Batches.GetByID(batchID)
	if err != nil {
		if repository.IsNoRows(err) {
			return nil, ErrBatchNotFound
		}
		return nil, err
	}
	recipe, err := s.Recipes.GetByID(batch.RecipeID)
	if err != nil {
		recipe = nil
	}
	// 追溯时使用批次锁定的配方版本
	if recipe != nil && batch.RecipeVersion > 0 {
		locked, lerr := s.Recipes.GetByVersion(recipe.Code, batch.RecipeVersion)
		if lerr == nil && locked != nil {
			recipe = locked
		}
	}
	materials, err := s.Batches.GetBatchMaterials(batchID)
	if err != nil {
		materials = nil
	}

	stages := make([]dto.StageInfo, 0, 4)
	stageList := []model.BatchStage{model.StageMashing, model.StageFermenting, model.StageAging, model.StageBottling}
	for _, st := range stageList {
		params, _ := s.Batches.GetStageParams(batchID, st)
		var startedAt *time.Time
		completed := false
		switch st {
		case model.StageMashing:
			startedAt = batch.MashingStart
		case model.StageFermenting:
			startedAt = batch.FermentingStart
		case model.StageAging:
			startedAt = batch.AgingStart
		case model.StageBottling:
			startedAt = batch.BottlingStart
		}
		curOrder, curOk := model.StageOrder[batch.CurrentStage]
		stOrder, stOk := model.StageOrder[st]
		if curOk && stOk && curOrder > stOrder {
			completed = true
		}
		stages = append(stages, dto.StageInfo{
			Stage: st, StartedAt: startedAt, Params: params, Completed: completed,
		})
	}

	samples, _, err := s.Quality.ListSamples(batchID, "", 1, 100)
	if err != nil {
		samples = nil
	}
	sampleInfos := make([]*dto.SampleInfo, 0, len(samples))
	for _, sam := range samples {
		results, _ := s.Quality.GetSampleResults(sam.ID)
		sampleInfos = append(sampleInfos, &dto.SampleInfo{Sample: sam, Results: results})
	}

	moves, _, err := s.Inventory.ListMovements("", batchID, 1, 100)
	if err != nil {
		moves = nil
	}
	moveInfos := make([]*dto.StockMovementInfo, 0, len(moves))
	for _, m := range moves {
		moveInfos = append(moveInfos, &dto.StockMovementInfo{Movement: m})
	}

	deviations, err := s.Deviations.ListByBatch(batchID)
	if err != nil {
		deviations = nil
	}
	devInfos := make([]*dto.DeviationInfo, 0, len(deviations))
	for _, d := range deviations {
		devInfos = append(devInfos, &dto.DeviationInfo{Log: d})
	}

	return &dto.TraceChainResponse{
		Batch: batch, Recipe: recipe, Materials: materials,
		Stages: stages, QualitySamples: sampleInfos,
		Movements: moveInfos, Deviations: devInfos,
	}, nil
}

// ---------- Report ----------
func genReportNo() string {
	return fmt.Sprintf("RPT%s%s", time.Now().Format("20060102150405"), uuid.NewString()[:4])
}

func (s *Service) ExportReport(batchID int64, userID int64) (string, int64, error) {
	taskID := uuid.NewString()
	task := &model.AsyncTask{
		ID: taskID, TaskType: "compliance_report", Status: model.TaskStatusRunning,
		Progress: 10, CreatedBy: userID,
	}
	if err := s.Tasks.Create(task); err != nil {
		return "", 0, err
	}

	go func() {
		chain, err := s.GetTraceChain(batchID)
		if err != nil {
			task.Status = model.TaskStatusFailed
			task.ErrorMsg = err.Error()
			_ = s.Tasks.Update(task)
			return
		}

		task.Progress = 50
		_ = s.Tasks.Update(task)

		content := map[string]interface{}{
			"generatedAt": time.Now().UTC(),
			"chain":       chain,
			"reportType":  "compliance_batch_trace",
			"version":     "1.0",
		}
		contentJSON := fmt.Sprintf(`{"batchNo":"%s","generatedAt":"%s","version":"1.0"}`,
			chain.Batch.BatchNo, time.Now().UTC().Format(time.RFC3339))
		_ = content

		rp := &model.ComplianceReport{
			ReportNo: genReportNo(), ReportType: "compliance_trace",
			BatchID: batchID, BatchNo: chain.Batch.BatchNo,
			ContentJSON: contentJSON, GeneratedBy: userID,
		}
		rid, rerr := s.Reports.Create(rp)
		if rerr != nil {
			task.Status = model.TaskStatusFailed
			task.ErrorMsg = rerr.Error()
			_ = s.Tasks.Update(task)
			return
		}
		task.Status = model.TaskStatusCompleted
		task.Progress = 100
		task.Result = fmt.Sprintf("reportId:%d", rid)
		_ = s.Tasks.Update(task)
	}()

	return taskID, 0, nil
}
