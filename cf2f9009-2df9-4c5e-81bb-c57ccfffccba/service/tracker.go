package service

import (
	"context"
	"math"
	"time"

	"fishery-api/config"
	"fishery-api/model"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type TrackerService struct {
	trackCol      *mongo.Collection
	vesselCol     *mongo.Collection
	yawAlertCol   *mongo.Collection
}

func NewTrackerService() *TrackerService {
	return &TrackerService{
		trackCol:    config.DB.Collection(config.ColTrackPoints),
		vesselCol:   config.DB.Collection(config.ColVessels),
		yawAlertCol: config.DB.Collection(config.ColYawAlerts),
	}
}

func (s *TrackerService) AddTrackPoint(ctx context.Context, point *model.TrackPoint) error {
	_, err := s.trackCol.InsertOne(ctx, point)
	return err
}

func (s *TrackerService) GetTrackHistory(ctx context.Context, vesselID string, startTime, endTime time.Time) ([]model.TrackPoint, error) {
	filter := bson.M{
		"vessel_id": vesselID,
		"timestamp": bson.M{
			"$gte": startTime,
			"$lte": endTime,
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "timestamp", Value: 1}})
	cursor, err := s.trackCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var points []model.TrackPoint
	if err := cursor.All(ctx, &points); err != nil {
		return nil, err
	}
	return points, nil
}

func (s *TrackerService) Get72HourTrack(ctx context.Context, vesselID string) ([]model.TrackPoint, error) {
	endTime := time.Now()
	startTime := endTime.Add(-72 * time.Hour)
	return s.GetTrackHistory(ctx, vesselID, startTime, endTime)
}

func (s *TrackerService) GetLatestPosition(ctx context.Context, vesselID string) (*model.TrackPoint, error) {
	filter := bson.M{"vessel_id": vesselID}
	opts := options.FindOne().SetSort(bson.D{{Key: "timestamp", Value: -1}})

	var point model.TrackPoint
	err := s.trackCol.FindOne(ctx, filter, opts).Decode(&point)
	if err != nil {
		return nil, err
	}
	return &point, nil
}

func haversineDistance(lng1, lat1, lng2, lat2 float64) float64 {
	const earthRadius = 6371.0

	lat1Rad := lat1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	deltaLat := (lat2 - lat1) * math.Pi / 180
	deltaLng := (lng2 - lng1) * math.Pi / 180

	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLng/2)*math.Sin(deltaLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}

func (s *TrackerService) CheckYaw(ctx context.Context, point *model.TrackPoint, basePoint model.Point, maxDistance float64) (*model.YawAlert, error) {
	distance := haversineDistance(
		point.Location.Coordinates[0], point.Location.Coordinates[1],
		basePoint.Coordinates[0], basePoint.Coordinates[1],
	)

	if distance <= maxDistance {
		return nil, nil
	}

	alert := &model.YawAlert{
		ID:         bson.NewObjectID().Hex(),
		VesselID:   point.VesselID,
		VesselNo:   point.VesselNo,
		Location:   point.Location,
		BasePoint:  basePoint,
		Distance:   distance,
		AlertType:  "yaw",
		AlertTime:  point.Timestamp,
		Handled:    false,
		CreatedAt:  time.Now(),
	}

	_, err := s.yawAlertCol.InsertOne(ctx, alert)
	if err != nil {
		return nil, err
	}
	return alert, nil
}

func (s *TrackerService) ListYawAlerts(ctx context.Context, vesselID string, handled *bool, page, pageSize int64) ([]model.YawAlert, int64, error) {
	filter := bson.M{}
	if vesselID != "" {
		filter["vessel_id"] = vesselID
	}
	if handled != nil {
		filter["handled"] = *handled
	}

	total, err := s.yawAlertCol.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * pageSize).
		SetLimit(pageSize)

	cursor, err := s.yawAlertCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var alerts []model.YawAlert
	if err := cursor.All(ctx, &alerts); err != nil {
		return nil, 0, err
	}
	return alerts, total, nil
}

func (s *TrackerService) HandleYawAlert(ctx context.Context, alertID, handledBy, remark string) error {
	filter := bson.M{"_id": alertID}
	update := bson.M{
		"$set": bson.M{
			"handled":     true,
			"handled_by":  handledBy,
			"handled_at":  time.Now(),
			"remark":      remark,
			"updated_at":  time.Now(),
		},
	}
	_, err := s.yawAlertCol.UpdateOne(ctx, filter, update)
	return err
}

func (s *TrackerService) AggregateTracks(ctx context.Context, startTime, endTime time.Time) (map[string][]model.TrackPoint, error) {
	filter := bson.M{
		"timestamp": bson.M{
			"$gte": startTime,
			"$lte": endTime,
		},
	}

	opts := options.Find().SetSort(bson.D{{Key: "vessel_id", Value: 1}, {Key: "timestamp", Value: 1}})
	cursor, err := s.trackCol.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	result := make(map[string][]model.TrackPoint)
	for cursor.Next(ctx) {
		var point model.TrackPoint
		if err := cursor.Decode(&point); err != nil {
			continue
		}
		result[point.VesselID] = append(result[point.VesselID], point)
	}
	return result, nil
}
