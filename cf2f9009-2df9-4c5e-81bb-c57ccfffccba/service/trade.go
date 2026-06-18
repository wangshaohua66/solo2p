package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"fishery-api/config"
	"fishery-api/model"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type TradeService struct {
	tradeCol      *mongo.Collection
	settlementCol *mongo.Collection
	disputeCol    *mongo.Collection
}

func NewTradeService() *TradeService {
	return &TradeService{
		tradeCol:      config.DB.Collection(config.ColSeaTrades),
		settlementCol: config.DB.Collection(config.ColMonthlySettlements),
		disputeCol:    config.DB.Collection(config.ColTradeDisputes),
	}
}

func generateTradeNo() string {
	now := time.Now()
	return fmt.Sprintf("ST%s%s", now.Format("20060102"), bson.NewObjectID().Hex()[:8])
}

func (s *TradeService) CreateTrade(ctx context.Context, trade *model.SeaTrade) error {
	trade.ID = bson.NewObjectID().Hex()
	trade.TradeNo = generateTradeNo()
	trade.Status = model.TradeStatusPending
	trade.SellerConfirmed = false
	trade.BuyerConfirmed = false
	trade.TotalAmount = trade.Weight * trade.UnitPrice
	trade.SettlementMonth = trade.TradeTime.Format("2006-01")
	trade.Settled = false
	trade.CreatedAt = time.Now()
	trade.UpdatedAt = time.Now()

	_, err := s.tradeCol.InsertOne(ctx, trade)
	return err
}

func (s *TradeService) GetTrade(ctx context.Context, tradeID string) (*model.SeaTrade, error) {
	var trade model.SeaTrade
	err := s.tradeCol.FindOne(ctx, bson.M{"_id": tradeID}).Decode(&trade)
	if err != nil {
		return nil, err
	}
	return &trade, nil
}

func (s *TradeService) ConfirmTrade(ctx context.Context, tradeID string, vesselID string, role string) error {
	filter := bson.M{"_id": tradeID}

	var trade model.SeaTrade
	err := s.tradeCol.FindOne(ctx, filter).Decode(&trade)
	if err != nil {
		return err
	}

	if role == "seller" {
		if trade.SellerVesselID != vesselID {
			return errors.New("vessel is not the seller")
		}
		if trade.SellerConfirmed {
			return nil
		}
	} else if role == "buyer" {
		if trade.BuyerVesselID != vesselID {
			return errors.New("vessel is not the buyer")
		}
		if trade.BuyerConfirmed {
			return nil
		}
	} else {
		return errors.New("invalid role")
	}

	if trade.Status == model.TradeStatusConfirmed || trade.Status == model.TradeStatusSettled {
		return nil
	}

	if trade.Status == model.TradeStatusRejected {
		return errors.New("trade has been rejected")
	}

	update := bson.M{
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	confirmFilter := bson.M{
		"_id":    tradeID,
		"status": model.TradeStatusPending,
	}

	if role == "seller" {
		confirmFilter["seller_confirmed"] = false
		update["$set"].(bson.M)["seller_confirmed"] = true
	} else {
		confirmFilter["buyer_confirmed"] = false
		update["$set"].(bson.M)["buyer_confirmed"] = true
	}

	result, err := s.tradeCol.UpdateOne(ctx, confirmFilter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		var checkTrade model.SeaTrade
		if err := s.tradeCol.FindOne(ctx, filter).Decode(&checkTrade); err == nil {
			if role == "seller" && checkTrade.SellerConfirmed {
				return nil
			}
			if role == "buyer" && checkTrade.BuyerConfirmed {
				return nil
			}
			if checkTrade.Status != model.TradeStatusPending {
				return errors.New("trade status has changed")
			}
		}
		return errors.New("failed to confirm trade")
	}

	var updatedTrade model.SeaTrade
	if err := s.tradeCol.FindOne(ctx, filter).Decode(&updatedTrade); err == nil {
		if updatedTrade.SellerConfirmed && updatedTrade.BuyerConfirmed {
			finalFilter := bson.M{
				"_id":               tradeID,
				"seller_confirmed":  true,
				"buyer_confirmed":   true,
				"status":            model.TradeStatusPending,
			}
			finalUpdate := bson.M{
				"$set": bson.M{
					"status":       model.TradeStatusConfirmed,
					"confirmed_at": time.Now(),
					"updated_at":   time.Now(),
				},
			}
			_, _ = s.tradeCol.UpdateOne(ctx, finalFilter, finalUpdate)
		}
	}

	return nil
}

func (s *TradeService) RejectTrade(ctx context.Context, tradeID string, vesselID string, reason string) error {
	filter := bson.M{"_id": tradeID}
	var trade model.SeaTrade
	err := s.tradeCol.FindOne(ctx, filter).Decode(&trade)
	if err != nil {
		return err
	}

	if trade.Status != model.TradeStatusPending {
		return errors.New("trade not in pending status")
	}

	if trade.SellerVesselID != vesselID && trade.BuyerVesselID != vesselID {
		return errors.New("vessel not involved in trade")
	}

	update := bson.M{
		"$set": bson.M{
			"status":     model.TradeStatusRejected,
			"remark":     reason,
			"updated_at": time.Now(),
		},
	}
	_, err = s.tradeCol.UpdateByID(ctx, tradeID, update)
	return err
}

func (s *TradeService) ListTrades(ctx context.Context, vesselID string, status string, startTime, endTime time.Time, page, pageSize int64) ([]model.SeaTrade, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["$or"] = []bson.M{
			{"seller_vessel_id": vesselID},
			{"buyer_vessel_id": vesselID},
		}
	}
	if status != "" {
		filter["status"] = status
	}
	if !startTime.IsZero() && !endTime.IsZero() {
		filter["trade_time"] = bson.M{"$gte": startTime, "$lte": endTime}
	}

	total, err := s.tradeCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.tradeCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var trades []model.SeaTrade
	if err := cursor.All(ctx, &trades); err != nil {
		return nil, 0, err
	}
	return trades, total, nil
}

func (s *TradeService) GenerateMonthlySettlement(ctx context.Context, vesselID string, month string) (*model.MonthlySettlement, error) {
	filter := bson.M{
		"settlement_month": month,
		"status":           model.TradeStatusConfirmed,
		"settled":          false,
		"$or": []bson.M{
			{"seller_vessel_id": vesselID},
			{"buyer_vessel_id": vesselID},
		},
	}

	cursor, err := s.tradeCol.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var trades []model.SeaTrade
	if err := cursor.All(ctx, &trades); err != nil {
		return nil, err
	}

	if len(trades) == 0 {
		return nil, errors.New("no unsettled trades found")
	}

	var totalSalesWeight float64
	var totalSalesAmount float64
	var totalPurchaseWeight float64
	var totalPurchaseAmount float64
	var salesTradeIDs []string
	var purchaseTradeIDs []string
	var allTradeIDs []string
	var vesselNo string

	for _, trade := range trades {
		allTradeIDs = append(allTradeIDs, trade.ID)
		if trade.SellerVesselID == vesselID {
			vesselNo = trade.SellerVesselNo
			salesTradeIDs = append(salesTradeIDs, trade.ID)
			totalSalesWeight += trade.Weight
			totalSalesAmount += trade.TotalAmount
		}
		if trade.BuyerVesselID == vesselID {
			vesselNo = trade.BuyerVesselNo
			purchaseTradeIDs = append(purchaseTradeIDs, trade.ID)
			totalPurchaseWeight += trade.Weight
			totalPurchaseAmount += trade.TotalAmount
		}
	}

	settlement := &model.MonthlySettlement{
		ID:                  bson.NewObjectID().Hex(),
		SettlementMonth:     month,
		VesselID:            vesselID,
		VesselNo:            vesselNo,
		TotalSalesWeight:    totalSalesWeight,
		TotalSalesAmount:    totalSalesAmount,
		SalesCount:          len(salesTradeIDs),
		SalesTradeIDs:       salesTradeIDs,
		TotalPurchaseWeight: totalPurchaseWeight,
		TotalPurchaseAmount: totalPurchaseAmount,
		PurchaseCount:       len(purchaseTradeIDs),
		PurchaseTradeIDs:    purchaseTradeIDs,
		NetAmount:           totalSalesAmount - totalPurchaseAmount,
		Status:              "generated",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	_, err = s.settlementCol.InsertOne(ctx, settlement)
	if err != nil {
		return nil, err
	}

	updateFilter := bson.M{
		"_id": bson.M{"$in": allTradeIDs},
	}
	update := bson.M{
		"$set": bson.M{
			"settled":    true,
			"settled_at": time.Now(),
			"status":     model.TradeStatusSettled,
			"updated_at": time.Now(),
		},
	}
	_, err = s.tradeCol.UpdateMany(ctx, updateFilter, update)

	return settlement, err
}

func (s *TradeService) ListSettlements(ctx context.Context, vesselID string, month string, page, pageSize int64) ([]model.MonthlySettlement, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if month != "" {
		filter["settlement_month"] = month
	}

	total, err := s.settlementCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.settlementCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var settlements []model.MonthlySettlement
	if err := cursor.All(ctx, &settlements); err != nil {
		return nil, 0, err
	}
	return settlements, total, nil
}

func (s *TradeService) CreateDispute(ctx context.Context, dispute *model.TradeDispute) error {
	dispute.ID = bson.NewObjectID().Hex()
	dispute.Status = "pending"
	dispute.CreatedAt = time.Now()
	dispute.UpdatedAt = time.Now()
	_, err := s.disputeCol.InsertOne(ctx, dispute)
	return err
}

func (s *TradeService) ResolveDispute(ctx context.Context, disputeID, resolution, resolvedBy string) error {
	filter := bson.M{"_id": disputeID}
	update := bson.M{
		"$set": bson.M{
			"status":      "resolved",
			"resolution":  resolution,
			"resolved_by": resolvedBy,
			"resolved_at": time.Now(),
			"updated_at":  time.Now(),
		},
	}
	_, err := s.disputeCol.UpdateOne(ctx, filter, update)
	return err
}
