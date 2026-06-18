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

type SupplyService struct {
	fuelRecordCol  *mongo.Collection
	supplyPointCol *mongo.Collection
	supplyPlanCol  *mongo.Collection
	vesselCol      *mongo.Collection
}

func NewSupplyService() *SupplyService {
	return &SupplyService{
		fuelRecordCol:  config.DB.Collection(config.ColFuelRecords),
		supplyPointCol: config.DB.Collection(config.ColSupplyPoints),
		supplyPlanCol:  config.DB.Collection(config.ColFuelSupplyPlans),
		vesselCol:      config.DB.Collection(config.ColVessels),
	}
}

func generatePlanNo() string {
	now := time.Now()
	return fmt.Sprintf("SP%s%s", now.Format("20060102"), bson.NewObjectID().Hex()[:8])
}

func (s *SupplyService) AddFuelRecord(ctx context.Context, record *model.FuelRecord) error {
	record.ID = bson.NewObjectID().Hex()
	record.CreatedAt = time.Now()
	_, err := s.fuelRecordCol.InsertOne(ctx, record)
	return err
}

func (s *SupplyService) GetVesselFuelStatus(ctx context.Context, vesselID string, safeThresholdDays float64) (*model.VesselFuelStatus, error) {
	filter := bson.M{"vessel_id": vesselID}
	opts := options.FindOne().SetSort(bson.D{{Key: "recorded_at", Value: -1}})

	var latestRecord model.FuelRecord
	err := s.fuelRecordCol.FindOne(ctx, filter, opts).Decode(&latestRecord)
	if err != nil {
		return nil, err
	}

	var vessel model.Vessel
	err = s.vesselCol.FindOne(ctx, bson.M{"_id": vesselID}).Decode(&vessel)
	if err != nil {
		return nil, err
	}

	dailyConsumption := vessel.DailyFuelConsumption
	if dailyConsumption <= 0 {
		dailyConsumption = latestRecord.FuelAmount / 7
	}

	enduranceDays := latestRecord.CurrentFuel / dailyConsumption
	lowFuelAlert := enduranceDays < safeThresholdDays

	status := &model.VesselFuelStatus{
		VesselID:          vesselID,
		VesselNo:          vessel.VesselNo,
		CurrentFuel:       latestRecord.CurrentFuel,
		DailyConsumption:  dailyConsumption,
		EnduranceDays:     enduranceDays,
		LastRefuelTime:    latestRecord.RecordedAt,
		SafeThresholdDays: safeThresholdDays,
		LowFuelAlert:      lowFuelAlert,
	}

	return status, nil
}

func (s *SupplyService) ListFuelRecords(ctx context.Context, vesselID string, startTime, endTime time.Time, page, pageSize int64) ([]model.FuelRecord, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if !startTime.IsZero() && !endTime.IsZero() {
		filter["recorded_at"] = bson.M{"$gte": startTime, "$lte": endTime}
	}

	total, err := s.fuelRecordCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "recorded_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.fuelRecordCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var records []model.FuelRecord
	if err := cursor.All(ctx, &records); err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func (s *SupplyService) CreateSupplyPoint(ctx context.Context, point *model.SupplyPoint) error {
	point.ID = bson.NewObjectID().Hex()
	_, err := s.supplyPointCol.InsertOne(ctx, point)
	return err
}

func (s *SupplyService) ListSupplyPoints(ctx context.Context, pointType string, status string) ([]model.SupplyPoint, error) {
	filter := bson.M{}
	if pointType != "" {
		filter["type"] = pointType
	}
	if status != "" {
		filter["status"] = status
	}

	cursor, err := s.supplyPointCol.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var points []model.SupplyPoint
	if err := cursor.All(ctx, &points); err != nil {
		return nil, err
	}
	return points, nil
}

func (s *SupplyService) FindNearestSupplyPoint(ctx context.Context, lng, lat float64) (*model.SupplyPoint, float64, error) {
	pipeline := bson.A{
		bson.M{
			"$geoNear": bson.M{
				"near": bson.M{
					"type":        "Point",
					"coordinates": []float64{lng, lat},
				},
				"distanceField": "distance",
				"spherical":     true,
			},
		},
		bson.M{"$limit": 1},
	}

	cursor, err := s.supplyPointCol.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	if !cursor.Next(ctx) {
		return nil, 0, errors.New("no supply points found")
	}

	var result struct {
		model.SupplyPoint
		Distance float64 `bson:"distance"`
	}
	if err := cursor.Decode(&result); err != nil {
		return nil, 0, err
	}

	return &result.SupplyPoint, result.Distance / 1000, nil
}

func (s *SupplyService) GenerateSupplyPlan(ctx context.Context, vesselID string, currentLocation model.Point, plannedBy string) (*model.FuelSupplyPlan, error) {
	fuelStatus, err := s.GetVesselFuelStatus(ctx, vesselID, 3)
	if err != nil {
		return nil, err
	}

	if !fuelStatus.LowFuelAlert {
		return nil, errors.New("fuel level is sufficient, no supply needed")
	}

	supplyPoint, distance, err := s.FindNearestSupplyPoint(ctx,
		currentLocation.Coordinates[0], currentLocation.Coordinates[1])
	if err != nil {
		return nil, err
	}

	var vessel model.Vessel
	err = s.vesselCol.FindOne(ctx, bson.M{"_id": vesselID}).Decode(&vessel)
	if err != nil {
		return nil, err
	}

	suggestedAmount := vessel.FuelTankCapacity - fuelStatus.CurrentFuel
	if suggestedAmount < 0 {
		suggestedAmount = 0
	}

	averageSpeed := 12.0
	travelHours := distance / averageSpeed
	estimatedArrival := time.Now().Add(time.Duration(travelHours) * time.Hour)

	plan := &model.FuelSupplyPlan{
		ID:                bson.NewObjectID().Hex(),
		PlanNo:            generatePlanNo(),
		VesselID:          vesselID,
		VesselNo:          vessel.VesselNo,
		CurrentFuel:       fuelStatus.CurrentFuel,
		DailyConsumption:  fuelStatus.DailyConsumption,
		EnduranceDays:     fuelStatus.EnduranceDays,
		SupplyPointID:     supplyPoint.ID,
		SupplyPointName:   supplyPoint.Name,
		Distance:          distance,
		SuggestedAmount:   suggestedAmount,
		EstimatedArrival:  estimatedArrival,
		Status:            model.SupplyPlanStatusPending,
		PlannedBy:         plannedBy,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	_, err = s.supplyPlanCol.InsertOne(ctx, plan)
	if err != nil {
		return nil, err
	}

	return plan, nil
}

func (s *SupplyService) ListSupplyPlans(ctx context.Context, vesselID string, status string, page, pageSize int64) ([]model.FuelSupplyPlan, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if status != "" {
		filter["status"] = status
	}

	total, err := s.supplyPlanCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.supplyPlanCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var plans []model.FuelSupplyPlan
	if err := cursor.All(ctx, &plans); err != nil {
		return nil, 0, err
	}
	return plans, total, nil
}

func (s *SupplyService) UpdateSupplyPlanStatus(ctx context.Context, planID, status string) error {
	filter := bson.M{"_id": planID}
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	}
	_, err := s.supplyPlanCol.UpdateOne(ctx, filter, update)
	return err
}

func (s *SupplyService) RefuelVessel(ctx context.Context, vesselID string, amount float64, supplyPointID, supplyPointName string, unitPrice float64, recordedBy string) error {
	var latestRecord model.FuelRecord
	filter := bson.M{"vessel_id": vesselID}
	opts := options.FindOne().SetSort(bson.D{{Key: "recorded_at", Value: -1}})
	err := s.fuelRecordCol.FindOne(ctx, filter, opts).Decode(&latestRecord)
	if err != nil && err != mongo.ErrNoDocuments {
		return err
	}

	var currentFuel float64
	if err == nil {
		currentFuel = latestRecord.CurrentFuel
	}

	newFuel := currentFuel + amount

	record := &model.FuelRecord{
		ID:              bson.NewObjectID().Hex(),
		VesselID:        vesselID,
		RecordType:      model.FuelRecordTypeRefuel,
		FuelAmount:      amount,
		CurrentFuel:     newFuel,
		SupplyPointID:   supplyPointID,
		SupplyPointName: supplyPointName,
		UnitPrice:       unitPrice,
		TotalCost:       amount * unitPrice,
		RecordedAt:      time.Now(),
		RecordedBy:      recordedBy,
		CreatedAt:       time.Now(),
	}

	_, err = s.fuelRecordCol.InsertOne(ctx, record)
	return err
}
