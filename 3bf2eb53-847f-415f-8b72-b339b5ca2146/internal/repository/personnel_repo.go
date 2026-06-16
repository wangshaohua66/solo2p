package repository

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"offshore-wind-ops/internal/model"
)

type PersonnelRepository struct {
	collection   *mongo.Collection
	evacColl     *mongo.Collection
	certAlertColl *mongo.Collection
}

func NewPersonnelRepository(db *mongo.Database) *PersonnelRepository {
	return &PersonnelRepository{
		collection:    db.Collection(CollectionPersonnel),
		evacColl:      db.Collection(CollectionEvacuations),
		certAlertColl: db.Collection(CollectionCertAlerts),
	}
}

func (r *PersonnelRepository) Create(ctx context.Context, p *model.Personnel) error {
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	result, err := r.collection.InsertOne(ctx, p)
	if err == nil {
		p.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *PersonnelRepository) GetByID(ctx context.Context, id string) (*model.Personnel, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var p model.Personnel
	err = r.collection.FindOne(ctx, bson.M{"_id": oid}).Decode(&p)
	return &p, err
}

func (r *PersonnelRepository) GetByEmployeeNo(ctx context.Context, no string) (*model.Personnel, error) {
	var p model.Personnel
	err := r.collection.FindOne(ctx, bson.M{"employee_no": no}).Decode(&p)
	return &p, err
}

func (r *PersonnelRepository) List(ctx context.Context, filter bson.M, page, pageSize int) ([]model.Personnel, int64, error) {
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "employee_no", Value: 1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.Personnel
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *PersonnelRepository) Update(ctx context.Context, p *model.Personnel) error {
	p.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": p.ID}, bson.M{"$set": p})
	return err
}

func (r *PersonnelRepository) UpdateStatus(ctx context.Context, id string, status model.PersonnelStatus) error {
	_, err := r.collection.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	})
	return err
}

func (r *PersonnelRepository) UpdateVoyage(ctx context.Context, personnelIDs []string, voyageID string) error {
	_, err := r.collection.UpdateMany(ctx,
		bson.M{"_id": bson.M{"$in": personnelIDs}},
		bson.M{
			"$set": bson.M{
				"current_voyage_id": voyageID,
				"updated_at":        time.Now(),
			},
		},
	)
	return err
}

func (r *PersonnelRepository) GetExpiringCertificates(ctx context.Context, days int) ([]model.Personnel, error) {
	threshold := time.Now().AddDate(0, 0, days)
	filter := bson.M{
		"certificates": bson.M{
			"$elemMatch": bson.M{
				"expiry_date": bson.M{
					"$lte": threshold,
					"$gte": time.Now(),
				},
				"status": "valid",
			},
		},
		"status": model.PersonnelStatusActive,
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var list []model.Personnel
	err = cursor.All(ctx, &list)
	return list, err
}

func (r *PersonnelRepository) CreateEvacuation(ctx context.Context, evac *model.EvacuationOrder) error {
	now := time.Now()
	evac.CreatedAt = now
	evac.TriggeredAt = now
	if evac.OrderNo == "" {
		evac.OrderNo = generateOrderNo("EV", now)
	}
	result, err := r.evacColl.InsertOne(ctx, evac)
	if err == nil {
		evac.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *PersonnelRepository) GetEvacuation(ctx context.Context, id string) (*model.EvacuationOrder, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var evac model.EvacuationOrder
	err = r.evacColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&evac)
	return &evac, err
}

func (r *PersonnelRepository) ListEvacuations(ctx context.Context, filter bson.M, page, pageSize int) ([]model.EvacuationOrder, int64, error) {
	total, err := r.evacColl.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.evacColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.EvacuationOrder
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *PersonnelRepository) UpdateEvacuationPersonStatus(ctx context.Context, evacID, personnelID, status string, ackTime *time.Time, arriveTime *time.Time, notes string) error {
	update := bson.M{
		"$set": bson.M{
			"personnel_list.$.status": status,
		},
	}
	if ackTime != nil {
		update["$set"].(bson.M)["personnel_list.$.acknowledged_at"] = *ackTime
	}
	if arriveTime != nil {
		update["$set"].(bson.M)["personnel_list.$.arrived_at_port"] = *arriveTime
	}
	if notes != "" {
		update["$set"].(bson.M)["personnel_list.$.notes"] = notes
	}

	_, err := r.evacColl.UpdateOne(ctx,
		bson.M{
			"_id":                       evacID,
			"personnel_list.personnel_id": personnelID,
		},
		update,
	)
	return err
}

func (r *PersonnelRepository) CompleteEvacuation(ctx context.Context, id string) error {
	now := time.Now()
	_, err := r.evacColl.UpdateByID(ctx, id, bson.M{
		"$set": bson.M{
			"status":       "completed",
			"completed_at": now,
		},
	})
	return err
}

func (r *PersonnelRepository) CreateCertAlert(ctx context.Context, alert *model.CertificateAlert) error {
	alert.CreatedAt = time.Now()
	result, err := r.certAlertColl.InsertOne(ctx, alert)
	if err == nil {
		alert.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *PersonnelRepository) ListCertAlerts(ctx context.Context, filter bson.M, page, pageSize int) ([]model.CertificateAlert, int64, error) {
	total, err := r.certAlertColl.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.certAlertColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.CertificateAlert
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

type SparePartsRepository struct {
	partColl    *mongo.Collection
	inventoryColl *mongo.Collection
	warehouseColl *mongo.Collection
	transferColl  *mongo.Collection
	restockColl   *mongo.Collection
	alertColl     *mongo.Collection
}

func NewSparePartsRepository(db *mongo.Database) *SparePartsRepository {
	return &SparePartsRepository{
		partColl:    db.Collection(CollectionSpareParts),
		inventoryColl: db.Collection(CollectionInventory),
		warehouseColl: db.Collection(CollectionWarehouses),
		transferColl:  db.Collection(CollectionTransfers),
		restockColl:   db.Collection(CollectionRestockOrders),
		alertColl:     db.Collection(CollectionInventoryAlerts),
	}
}

func (r *SparePartsRepository) CreatePart(ctx context.Context, part *model.SparePart) error {
	now := time.Now()
	part.CreatedAt = now
	part.UpdatedAt = now
	result, err := r.partColl.InsertOne(ctx, part)
	if err == nil {
		part.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *SparePartsRepository) GetPart(ctx context.Context, id string) (*model.SparePart, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var part model.SparePart
	err = r.partColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&part)
	return &part, err
}

func (r *SparePartsRepository) ListParts(ctx context.Context, filter bson.M, page, pageSize int) ([]model.SparePart, int64, error) {
	total, err := r.partColl.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "part_no", Value: 1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.partColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.SparePart
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *SparePartsRepository) UpdatePart(ctx context.Context, part *model.SparePart) error {
	part.UpdatedAt = time.Now()
	_, err := r.partColl.UpdateOne(ctx, bson.M{"_id": part.ID}, bson.M{"$set": part})
	return err
}

func (r *SparePartsRepository) CreateWarehouse(ctx context.Context, wh *model.Warehouse) error {
	now := time.Now()
	wh.CreatedAt = now
	wh.UpdatedAt = now
	result, err := r.warehouseColl.InsertOne(ctx, wh)
	if err == nil {
		wh.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *SparePartsRepository) ListWarehouses(ctx context.Context, filter bson.M) ([]model.Warehouse, error) {
	cursor, err := r.warehouseColl.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var list []model.Warehouse
	err = cursor.All(ctx, &list)
	return list, err
}

func (r *SparePartsRepository) GetInventory(ctx context.Context, partID, warehouseID string) (*model.SparePartInventory, error) {
	var inv model.SparePartInventory
	err := r.inventoryColl.FindOne(ctx, bson.M{
		"part_id":      partID,
		"warehouse_id": warehouseID,
	}).Decode(&inv)
	return &inv, err
}

func (r *SparePartsRepository) ListInventory(ctx context.Context, filter bson.M, page, pageSize int) ([]model.SparePartInventory, int64, error) {
	total, err := r.inventoryColl.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "part_no", Value: 1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.inventoryColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.SparePartInventory
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *SparePartsRepository) UpsertInventory(ctx context.Context, inv *model.SparePartInventory) error {
	now := time.Now()
	inv.UpdatedAt = now
	inv.AvailableQty = inv.Quantity - inv.LockedQuantity

	filter := bson.M{"part_id": inv.PartID, "warehouse_id": inv.WarehouseID}
	update := bson.M{
		"$set": bson.M{
			"part_no":         inv.PartNo,
			"part_name":       inv.PartName,
			"quantity":        inv.Quantity,
			"locked_quantity": inv.LockedQuantity,
			"available_qty":   inv.AvailableQty,
			"status":          inv.Status,
			"updated_at":      now,
		},
		"$setOnInsert": bson.M{
			"wind_farm_id": inv.WindFarmID,
			"warehouse_name": inv.WarehouseName,
			"created_at":   now,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := r.inventoryColl.UpdateOne(ctx, filter, update, opts)
	return err
}

func (r *SparePartsRepository) UpdateInventoryQty(ctx context.Context, partID, warehouseID string, qtyChange, lockChange int) error {
	_, err := r.inventoryColl.UpdateOne(ctx,
		bson.M{"part_id": partID, "warehouse_id": warehouseID},
		bson.M{
			"$inc": bson.M{
				"quantity":        qtyChange,
				"locked_quantity": lockChange,
			},
			"$set": bson.M{
				"updated_at": time.Now(),
			},
		},
	)
	if err != nil {
		return err
	}

	_, err = r.inventoryColl.UpdateOne(ctx,
		bson.M{"part_id": partID, "warehouse_id": warehouseID},
		bson.M{
			"$set": bson.M{
				"available_qty": bson.M{"$subtract": []string{"$quantity", "$locked_quantity"}},
			},
		},
	)
	return err
}

func (r *SparePartsRepository) CreateTransfer(ctx context.Context, t *model.TransferOrder) error {
	now := time.Now()
	t.CreatedAt = now
	t.UpdatedAt = now
	if t.TransferNo == "" {
		t.TransferNo = generateOrderNo("TR", now)
	}
	result, err := r.transferColl.InsertOne(ctx, t)
	if err == nil {
		t.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *SparePartsRepository) GetTransfer(ctx context.Context, id string) (*model.TransferOrder, error) {
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}
	var t model.TransferOrder
	err = r.transferColl.FindOne(ctx, bson.M{"_id": oid}).Decode(&t)
	return &t, err
}

func (r *SparePartsRepository) ListTransfers(ctx context.Context, filter bson.M, page, pageSize int) ([]model.TransferOrder, int64, error) {
	total, err := r.transferColl.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))

	cursor, err := r.transferColl.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var list []model.TransferOrder
	if err = cursor.All(ctx, &list); err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *SparePartsRepository) UpdateTransferStatus(ctx context.Context, id, status, approverID string) error {
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	}
	if approverID != "" {
		update["$set"].(bson.M)["approver_id"] = approverID
		update["$set"].(bson.M)["approved_at"] = time.Now()
	}
	if status == "dispatched" {
		update["$set"].(bson.M)["dispatched_at"] = time.Now()
	} else if status == "received" {
		update["$set"].(bson.M)["received_at"] = time.Now()
	}

	_, err := r.transferColl.UpdateByID(ctx, id, update)
	return err
}

func (r *SparePartsRepository) CreateRestockOrder(ctx context.Context, order *model.RestockOrder) error {
	now := time.Now()
	order.CreatedAt = now
	order.UpdatedAt = now
	if order.RestockNo == "" {
		order.RestockNo = generateOrderNo("RS", now)
	}
	result, err := r.restockColl.InsertOne(ctx, order)
	if err == nil {
		order.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func (r *SparePartsRepository) GetLowStockItems(ctx context.Context, warehouseID string) ([]model.SparePartInventory, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$lookup", Value: bson.D{
			{Key: "from", Value: CollectionSpareParts},
			{Key: "localField", Value: "part_id"},
			{Key: "foreignField", Value: "_id"},
			{Key: "as", Value: "part_info"},
		}}},
		{{Key: "$match", Value: bson.M{
			"warehouse_id": warehouseID,
			"available_qty": bson.M{"$lte": 0},
		}}},
	}

	cursor, err := r.inventoryColl.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []model.SparePartInventory
	err = cursor.All(ctx, &results)
	return results, err
}

func (r *SparePartsRepository) CreateInventoryAlert(ctx context.Context, alert *model.InventoryAlert) error {
	alert.CreatedAt = time.Now()
	result, err := r.alertColl.InsertOne(ctx, alert)
	if err == nil {
		alert.ID = result.InsertedID.(primitive.ObjectID)
	}
	return err
}

func generateOrderNo2(prefix string, t time.Time) string {
	return fmt.Sprintf("%s%s%06d", prefix, t.Format("20060102150405"), time.Now().UnixNano()%1000000)
}
