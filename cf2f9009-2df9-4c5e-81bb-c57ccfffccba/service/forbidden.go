package service

import (
	"context"
	"time"

	"fishery-api/config"
	"fishery-api/model"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type ForbiddenService struct {
	zoneCol      *mongo.Collection
	violationCol *mongo.Collection
}

func NewForbiddenService() *ForbiddenService {
	return &ForbiddenService{
		zoneCol:      config.DB.Collection(config.ColForbiddenZones),
		violationCol: config.DB.Collection(config.ColForbiddenViolations),
	}
}

func (s *ForbiddenService) CreateZone(ctx context.Context, zone *model.ForbiddenZone) error {
	zone.ID = bson.NewObjectID().Hex()
	zone.CreatedAt = time.Now()
	zone.UpdatedAt = time.Now()
	if zone.Status == "" {
		zone.Status = model.ZoneStatusActive
	}
	_, err := s.zoneCol.InsertOne(ctx, zone)
	return err
}

func (s *ForbiddenService) ListZones(ctx context.Context, zoneType string, status string) ([]model.ForbiddenZone, error) {
	filter := bson.M{}
	if zoneType != "" {
		filter["zone_type"] = zoneType
	}
	if status != "" {
		filter["status"] = status
	}

	cursor, err := s.zoneCol.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var zones []model.ForbiddenZone
	if err := cursor.All(ctx, &zones); err != nil {
		return nil, err
	}
	return zones, nil
}

func (s *ForbiddenService) GetActiveZones(ctx context.Context) ([]model.ForbiddenZone, error) {
	today := time.Now()
	monthDay := today.Format("01-02")

	filter := bson.M{
		"status": model.ZoneStatusActive,
		"$or": []bson.M{
			{"year_round": true},
			{
				"start_date": bson.M{"$lte": monthDay},
				"end_date":   bson.M{"$gte": monthDay},
			},
		},
	}

	cursor, err := s.zoneCol.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var zones []model.ForbiddenZone
	if err := cursor.All(ctx, &zones); err != nil {
		return nil, err
	}
	return zones, nil
}

func (s *ForbiddenService) CheckForbiddenZone(ctx context.Context, vesselID, vesselNo string, location model.Point, checkTime time.Time) (*model.ForbiddenViolation, error) {
	activeZones, err := s.GetActiveZones(ctx)
	if err != nil {
		return nil, err
	}

	for _, zone := range activeZones {
		pipeline := bson.A{
			bson.M{
				"$match": bson.M{
					"_id": zone.ID,
				},
			},
			bson.M{
				"$match": bson.M{
					"boundary": bson.M{
						"$geoIntersects": bson.M{
							"$geometry": bson.M{
								"type":        "Point",
								"coordinates": location.Coordinates,
							},
						},
					},
				},
			},
		}

		cursor, err := s.zoneCol.Aggregate(ctx, pipeline)
		if err != nil {
			continue
		}

		hasIntersection := cursor.Next(ctx)
		cursor.Close(ctx)

		if hasIntersection {
			activeFilter := bson.M{
				"vessel_id": vesselID,
				"zone_id":   zone.ID,
				"status":    model.ViolationStatusActive,
			}

			var existingViolation model.ForbiddenViolation
			err := s.violationCol.FindOne(ctx, activeFilter).Decode(&existingViolation)
			if err == nil {
				return nil, nil
			}

			violation := &model.ForbiddenViolation{
				ID:         bson.NewObjectID().Hex(),
				VesselID:   vesselID,
				VesselNo:   vesselNo,
				ZoneID:     zone.ID,
				ZoneName:   zone.Name,
				EnterPoint: location,
				EnterTime:  checkTime,
				Status:     model.ViolationStatusActive,
				Handled:    false,
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
			}

			_, err = s.violationCol.InsertOne(ctx, violation)
			if err != nil {
				return nil, err
			}
			return violation, nil
		}
	}

	exitFilter := bson.M{
		"vessel_id": vesselID,
		"status":    model.ViolationStatusActive,
	}

	var activeViolation model.ForbiddenViolation
	err = s.violationCol.FindOne(ctx, exitFilter).Decode(&activeViolation)
	if err == nil {
		duration := checkTime.Sub(activeViolation.EnterTime).Hours()
		update := bson.M{
			"$set": bson.M{
				"exit_point": location,
				"exit_time":  checkTime,
				"duration":   duration,
				"status":     model.ViolationStatusExited,
				"updated_at": time.Now(),
			},
		}
		_, _ = s.violationCol.UpdateByID(ctx, activeViolation.ID, update)
	}

	return nil, nil
}

func (s *ForbiddenService) ListViolations(ctx context.Context, vesselID string, status string, handled *bool, page, pageSize int64) ([]model.ForbiddenViolation, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if status != "" {
		filter["status"] = status
	}
	if handled != nil {
		filter["handled"] = *handled
	}

	total, err := s.violationCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.violationCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var violations []model.ForbiddenViolation
	if err := cursor.All(ctx, &violations); err != nil {
		return nil, 0, err
	}
	return violations, total, nil
}

func (s *ForbiddenService) HandleViolation(ctx context.Context, violationID, handledBy string, fineAmount float64, remark string) error {
	filter := bson.M{"_id": violationID}
	update := bson.M{
		"$set": bson.M{
			"handled":     true,
			"handled_by":  handledBy,
			"handled_at":  time.Now(),
			"fine_amount": fineAmount,
			"remark":      remark,
			"status":      model.ViolationStatusHandled,
			"updated_at":  time.Now(),
		},
	}
	_, err := s.violationCol.UpdateOne(ctx, filter, update)
	return err
}

func (s *ForbiddenService) UpdateZone(ctx context.Context, zoneID string, zone *model.ForbiddenZone) error {
	filter := bson.M{"_id": zoneID}
	update := bson.M{
		"$set": bson.M{
			"name":        zone.Name,
			"zone_type":   zone.ZoneType,
			"description": zone.Description,
			"boundary":    zone.Boundary,
			"start_date":  zone.StartDate,
			"end_date":    zone.EndDate,
			"year_round":  zone.YearRound,
			"species":     zone.Species,
			"status":      zone.Status,
			"updated_at":  time.Now(),
		},
	}
	_, err := s.zoneCol.UpdateOne(ctx, filter, update)
	return err
}
