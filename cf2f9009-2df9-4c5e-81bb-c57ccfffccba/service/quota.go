package service

import (
	"context"
	"errors"
	"time"

	"fishery-api/config"
	"fishery-api/model"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type QuotaService struct {
	quotaCol       *mongo.Collection
	vesselQuotaCol *mongo.Collection
	transferCol    *mongo.Collection
	catchCol       *mongo.Collection
}

func NewQuotaService() *QuotaService {
	return &QuotaService{
		quotaCol:       config.DB.Collection(config.ColAnnualQuotas),
		vesselQuotaCol: config.DB.Collection(config.ColVesselQuotas),
		transferCol:    config.DB.Collection(config.ColQuotaTransfers),
		catchCol:       config.DB.Collection(config.ColCatchRecords),
	}
}

func (s *QuotaService) CreateAnnualQuota(ctx context.Context, quota *model.AnnualQuota) error {
	quota.RemainingQuota = quota.TotalQuota
	quota.UsedQuota = 0
	quota.Locked = false
	if quota.WarningThreshold == 0 {
		quota.WarningThreshold = quota.TotalQuota * 0.1
	}
	quota.CreatedAt = time.Now()
	quota.UpdatedAt = time.Now()
	_, err := s.quotaCol.InsertOne(ctx, quota)
	return err
}

func (s *QuotaService) GetAnnualQuota(ctx context.Context, year int, speciesCode, fishingGround string) (*model.AnnualQuota, error) {
	filter := bson.M{
		"year":           year,
		"species_code":   speciesCode,
		"fishing_ground": fishingGround,
	}
	var quota model.AnnualQuota
	err := s.quotaCol.FindOne(ctx, filter).Decode(&quota)
	if err != nil {
		return nil, err
	}
	return &quota, nil
}

func (s *QuotaService) CreateVesselQuota(ctx context.Context, quota *model.VesselQuota) error {
	quota.RemainingQuota = quota.TotalQuota
	quota.UsedQuota = 0
	quota.Locked = false
	if quota.WarningThreshold == 0 {
		quota.WarningThreshold = quota.TotalQuota * 0.1
	}
	quota.CreatedAt = time.Now()
	quota.UpdatedAt = time.Now()
	_, err := s.vesselQuotaCol.InsertOne(ctx, quota)
	return err
}

func (s *QuotaService) GetVesselQuota(ctx context.Context, vesselID string, year int, speciesCode string) (*model.VesselQuota, error) {
	filter := bson.M{
		"vessel_id":    vesselID,
		"year":         year,
		"species_code": speciesCode,
	}
	var quota model.VesselQuota
	err := s.vesselQuotaCol.FindOne(ctx, filter).Decode(&quota)
	if err != nil {
		return nil, err
	}
	return &quota, nil
}

func (s *QuotaService) ListVesselQuotas(ctx context.Context, vesselID string, year int) ([]model.VesselQuota, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if year > 0 {
		filter["year"] = year
	}

	cursor, err := s.vesselQuotaCol.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var quotas []model.VesselQuota
	if err := cursor.All(ctx, &quotas); err != nil {
		return nil, err
	}
	return quotas, nil
}

func (s *QuotaService) DeductQuota(ctx context.Context, vesselID string, speciesCode string, amount float64, fishingGround string) (bool, error) {
	session, err := config.DB.Client.StartSession()
	if err != nil {
		return false, err
	}
	defer session.EndSession(ctx)

	res, err := session.WithTransaction(ctx, func(sessCtx context.Context) (interface{}, error) {
		return s.deductQuotaCore(sessCtx, vesselID, speciesCode, amount, fishingGround)
	})
	if err != nil {
		return false, err
	}

	warning, _ := res.(bool)
	return warning, nil
}

func (s *QuotaService) deductQuotaCore(ctx context.Context, vesselID string, speciesCode string, amount float64, fishingGround string) (bool, error) {
	year := time.Now().Year()

	vesselFilter := bson.M{
		"vessel_id":       vesselID,
		"year":            year,
		"species_code":    speciesCode,
		"locked":          false,
		"remaining_quota": bson.M{"$gte": amount},
	}

	vesselUpdate := bson.M{
		"$inc": bson.M{
			"used_quota":      amount,
			"remaining_quota": -amount,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	vesselOpts := options.FindOneAndUpdate().SetReturnDocument(options.Before)

	var oldQuota model.VesselQuota
	err := s.vesselQuotaCol.FindOneAndUpdate(ctx, vesselFilter, vesselUpdate, vesselOpts).Decode(&oldQuota)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			var checkQuota model.VesselQuota
			checkFilter := bson.M{
				"vessel_id":    vesselID,
				"year":         year,
				"species_code": speciesCode,
			}
			checkErr := s.vesselQuotaCol.FindOne(ctx, checkFilter).Decode(&checkQuota)
			if checkErr != nil {
				return false, errors.New("quota not found")
			}
			if checkQuota.Locked {
				return false, errors.New("quota is locked")
			}
			if checkQuota.RemainingQuota < amount {
				return false, errors.New("insufficient quota")
			}
			return false, err
		}
		return false, err
	}

	annualFilter := bson.M{
		"year":            year,
		"species_code":    speciesCode,
		"fishing_ground":  fishingGround,
		"remaining_quota": bson.M{"$gte": amount},
	}
	annualUpdate := bson.M{
		"$inc": bson.M{
			"used_quota":      amount,
			"remaining_quota": -amount,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	annualResult, err := s.quotaCol.UpdateOne(ctx, annualFilter, annualUpdate)
	if err != nil {
		return false, err
	}
	if annualResult.MatchedCount == 0 {
		return false, errors.New("annual quota insufficient")
	}

	remainingAfter := oldQuota.RemainingQuota - amount
	warning := remainingAfter <= oldQuota.WarningThreshold && oldQuota.RemainingQuota > oldQuota.WarningThreshold

	if remainingAfter <= 0 {
		lockFilter := bson.M{
			"vessel_id":    vesselID,
			"year":         year,
			"species_code": speciesCode,
		}
		lockUpdate := bson.M{
			"$set": bson.M{
				"locked":     true,
				"updated_at": time.Now(),
			},
		}
		_, _ = s.vesselQuotaCol.UpdateOne(ctx, lockFilter, lockUpdate)
	}

	return warning, nil
}

func (s *QuotaService) DeductQuotaAndInsertCatch(ctx context.Context, vesselID string, speciesCode string, amount float64, fishingGround string, record *model.CatchRecord) (bool, error) {
	session, err := config.DB.Client.StartSession()
	if err != nil {
		return false, err
	}
	defer session.EndSession(ctx)

	res, err := session.WithTransaction(ctx, func(sessCtx context.Context) (interface{}, error) {
		warning, err := s.deductQuotaCore(sessCtx, vesselID, speciesCode, amount, fishingGround)
		if err != nil {
			return nil, err
		}
		if _, err := s.catchCol.InsertOne(sessCtx, record); err != nil {
			return nil, err
		}
		return warning, nil
	})
	if err != nil {
		return false, err
	}

	warning, _ := res.(bool)
	return warning, nil
}

func (s *QuotaService) CreateTransfer(ctx context.Context, transfer *model.QuotaTransfer) error {
	transfer.Status = model.QuotaTransferStatusPending
	transfer.CreatedAt = time.Now()
	transfer.UpdatedAt = time.Now()
	_, err := s.transferCol.InsertOne(ctx, transfer)
	return err
}

func (s *QuotaService) ApproveTransfer(ctx context.Context, transferID string, approved bool, approvedBy, remark string) error {
	var transfer model.QuotaTransfer
	err := s.transferCol.FindOne(ctx, bson.M{"_id": transferID}).Decode(&transfer)
	if err != nil {
		return err
	}

	if transfer.Status != model.QuotaTransferStatusPending {
		return errors.New("transfer not in pending status")
	}

	if !approved {
		return s.updateTransferStatus(ctx, transferID, model.QuotaTransferStatusRejected, approvedBy, remark, time.Now())
	}

	year := transfer.Year
	speciesCode := transfer.SpeciesCode
	amount := transfer.Amount

	session, err := config.DB.Client.StartSession()
	if err != nil {
		return err
	}
	defer session.EndSession(ctx)

	_, err = session.WithTransaction(ctx, func(sessCtx context.Context) (interface{}, error) {
		var fromQuota model.VesselQuota
		fromQueryFilter := bson.M{
			"vessel_id":    transfer.FromVesselID,
			"year":         year,
			"species_code": speciesCode,
		}
		if err := s.vesselQuotaCol.FindOne(sessCtx, fromQueryFilter).Decode(&fromQuota); err != nil {
			return nil, errors.New("source vessel quota not found")
		}

		if err := s.approveTransferCore(sessCtx, transferID, transfer.FromVesselID, transfer.ToVesselID, fromQuota.ID, year, speciesCode, amount, approvedBy, remark); err != nil {
			return nil, err
		}
		return nil, nil
	})
	if err != nil {
		s.rejectTransfer(ctx, transferID, err.Error())
		return err
	}

	return nil
}

func (s *QuotaService) approveTransferCore(ctx context.Context, transferID, fromVesselID, toVesselID, fromQuotaID string, year int, speciesCode string, amount float64, approvedBy, remark string) error {
	fromDeductFilter := bson.M{
		"_id":             fromQuotaID,
		"remaining_quota": bson.M{"$gte": amount},
	}
	fromUpdate := bson.M{
		"$inc": bson.M{
			"total_quota":     -amount,
			"remaining_quota": -amount,
		},
		"$set": bson.M{"updated_at": time.Now()},
	}
	fromResult, err := s.vesselQuotaCol.UpdateOne(ctx, fromDeductFilter, fromUpdate)
	if err != nil {
		return err
	}
	if fromResult.MatchedCount == 0 {
		return errors.New("insufficient quota in source vessel")
	}

	toFilter := bson.M{
		"vessel_id":    toVesselID,
		"year":         year,
		"species_code": speciesCode,
	}
	toUpdate := bson.M{
		"$inc": bson.M{
			"total_quota":     amount,
			"remaining_quota": amount,
		},
		"$set": bson.M{"updated_at": time.Now()},
	}
	toResult, err := s.vesselQuotaCol.UpdateOne(ctx, toFilter, toUpdate)
	if err != nil {
		return err
	}
	if toResult.MatchedCount == 0 {
		return errors.New("target vessel quota not found")
	}

	return s.updateTransferStatus(ctx, transferID, model.QuotaTransferStatusApproved, approvedBy, remark, time.Now())
}

func (s *QuotaService) updateTransferStatus(ctx context.Context, transferID, status, approvedBy, remark string, approvedAt time.Time) error {
	update := bson.M{
		"$set": bson.M{
			"status":          status,
			"approved_by":     approvedBy,
			"approval_remark": remark,
			"approved_at":     approvedAt,
			"updated_at":      time.Now(),
		},
	}
	_, err := s.transferCol.UpdateByID(ctx, transferID, update)
	return err
}

func (s *QuotaService) rejectTransfer(ctx context.Context, transferID, reason string) {
	update := bson.M{
		"$set": bson.M{
			"status":          model.QuotaTransferStatusRejected,
			"approval_remark": reason,
			"updated_at":      time.Now(),
		},
	}
	_, _ = s.transferCol.UpdateByID(ctx, transferID, update)
}

func (s *QuotaService) ListTransfers(ctx context.Context, vesselID string, status string, page, pageSize int64) ([]model.QuotaTransfer, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["$or"] = []bson.M{
			{"from_vessel_id": vesselID},
			{"to_vessel_id": vesselID},
		}
	}
	if status != "" {
		filter["status"] = status
	}

	total, err := s.transferCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.transferCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var transfers []model.QuotaTransfer
	if err := cursor.All(ctx, &transfers); err != nil {
		return nil, 0, err
	}
	return transfers, total, nil
}

func (s *QuotaService) CheckQuotaWarning(ctx context.Context, vesselID string) ([]model.VesselQuota, error) {
	year := time.Now().Year()
	filter := bson.M{
		"vessel_id": vesselID,
		"year":      year,
		"$expr": bson.M{
			"$lte": []interface{}{"$remaining_quota", "$warning_threshold"},
		},
		"locked": false,
	}

	cursor, err := s.vesselQuotaCol.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var quotas []model.VesselQuota
	if err := cursor.All(ctx, &quotas); err != nil {
		return nil, err
	}
	return quotas, nil
}
