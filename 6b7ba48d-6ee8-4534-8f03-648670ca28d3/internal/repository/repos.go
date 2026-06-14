package repository

import (
	"craftbrew-tracker/internal/dto"
	"craftbrew-tracker/internal/model"
	"database/sql"
	"fmt"
	"time"
)

type UserRepo struct{ *DB }

func (r *UserRepo) GetByUsername(username string) (*model.User, error) {
	u := &model.User{}
	err := r.QueryRow(
		"SELECT id, username, password_hash, real_name, role, email, phone, active, created_at, updated_at FROM users WHERE username=?",
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.RealName, &u.Role, &u.Email, &u.Phone, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepo) GetByID(id int64) (*model.User, error) {
	u := &model.User{}
	err := r.QueryRow(
		"SELECT id, username, password_hash, real_name, role, email, phone, active, created_at, updated_at FROM users WHERE id=?",
		id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.RealName, &u.Role, &u.Email, &u.Phone, &u.Active, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepo) Create(u *model.User) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO users(username, password_hash, real_name, role, email, phone) VALUES(?,?,?,?,?,?)",
		u.Username, u.PasswordHash, u.RealName, u.Role, u.Email, u.Phone,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *UserRepo) List(page, size int) ([]*model.User, int64, error) {
	var total int64
	if err := r.QueryRow("SELECT COUNT(*) FROM users").Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.Query(
		"SELECT id, username, real_name, role, email, phone, active, created_at FROM users ORDER BY id LIMIT ? OFFSET ?",
		size, (page-1)*size,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	users := make([]*model.User, 0)
	for rows.Next() {
		u := &model.User{}
		if err := rows.Scan(&u.ID, &u.Username, &u.RealName, &u.Role, &u.Email, &u.Phone, &u.Active, &u.CreatedAt); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, nil
}

type BatchRepo struct{ *DB }

func (r *BatchRepo) Create(b *model.Batch) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO batches(batch_no, recipe_id, recipe_version, recipe_name, current_stage, status, target_volume_l, brewer_id, brewer_name, notes) VALUES(?,?,?,?,?,?,?,?,?,?)",
		b.BatchNo, b.RecipeID, b.RecipeVersion, b.RecipeName, b.CurrentStage, b.Status, b.TargetVolumeL, b.BrewerID, b.BrewerName, b.Notes,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *BatchRepo) GetByID(id int64) (*model.Batch, error) {
	b := &model.Batch{}
	err := r.QueryRow(
		`SELECT id, batch_no, recipe_id, recipe_version, recipe_name, current_stage, status, target_volume_l, actual_volume_l,
		 brewer_id, brewer_name, mashing_start, fermenting_start, aging_start, bottling_start, completed_at, notes, created_at, updated_at
		 FROM batches WHERE id=?`,
		id,
	).Scan(&b.ID, &b.BatchNo, &b.RecipeID, &b.RecipeVersion, &b.RecipeName, &b.CurrentStage, &b.Status, &b.TargetVolumeL, &b.ActualVolumeL,
		&b.BrewerID, &b.BrewerName, &b.MashingStart, &b.FermentingStart, &b.AgingStart, &b.BottlingStart, &b.CompletedAt, &b.Notes, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *BatchRepo) GetByNo(no string) (*model.Batch, error) {
	b := &model.Batch{}
	err := r.QueryRow(
		`SELECT id, batch_no, recipe_id, recipe_version, recipe_name, current_stage, status, target_volume_l, actual_volume_l,
		 brewer_id, brewer_name, mashing_start, fermenting_start, aging_start, bottling_start, completed_at, notes, created_at, updated_at
		 FROM batches WHERE batch_no=?`,
		no,
	).Scan(&b.ID, &b.BatchNo, &b.RecipeID, &b.RecipeVersion, &b.RecipeName, &b.CurrentStage, &b.Status, &b.TargetVolumeL, &b.ActualVolumeL,
		&b.BrewerID, &b.BrewerName, &b.MashingStart, &b.FermentingStart, &b.AgingStart, &b.BottlingStart, &b.CompletedAt, &b.Notes, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *BatchRepo) Update(b *model.Batch) error {
	_, err := r.Exec(
		`UPDATE batches SET current_stage=?, status=?, actual_volume_l=?,
		 mashing_start=?, fermenting_start=?, aging_start=?, bottling_start=?, completed_at=?, notes=?, updated_at=CURRENT_TIMESTAMP
		 WHERE id=?`,
		b.CurrentStage, b.Status, b.ActualVolumeL,
		b.MashingStart, b.FermentingStart, b.AgingStart, b.BottlingStart, b.CompletedAt, b.Notes, b.ID,
	)
	return err
}

func (r *BatchRepo) List(status model.BatchStatus, page, size int) ([]*model.Batch, int64, error) {
	query := "SELECT COUNT(*) FROM batches WHERE 1=1"
	args := []interface{}{}
	if status != "" {
		query += " AND status=?"
		args = append(args, status)
	}
	var total int64
	if err := r.QueryRow(query, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query = `SELECT id, batch_no, recipe_id, recipe_version, recipe_name, current_stage, status, target_volume_l, actual_volume_l,
	 brewer_id, brewer_name, mashing_start, fermenting_start, aging_start, bottling_start, completed_at, notes, created_at, updated_at
	 FROM batches WHERE 1=1`
	args = args[:0]
	if status != "" {
		query += " AND status=?"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := make([]*model.Batch, 0)
	for rows.Next() {
		b := &model.Batch{}
		if err := rows.Scan(&b.ID, &b.BatchNo, &b.RecipeID, &b.RecipeVersion, &b.RecipeName, &b.CurrentStage, &b.Status, &b.TargetVolumeL, &b.ActualVolumeL,
			&b.BrewerID, &b.BrewerName, &b.MashingStart, &b.FermentingStart, &b.AgingStart, &b.BottlingStart, &b.CompletedAt, &b.Notes, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, b)
	}
	return list, total, nil
}

func (r *BatchRepo) ListActive() ([]*model.Batch, error) {
	rows, err := r.Query(
		`SELECT id, batch_no, recipe_id, recipe_version, recipe_name, current_stage, status, target_volume_l, actual_volume_l,
		 brewer_id, brewer_name, mashing_start, fermenting_start, aging_start, bottling_start, notes, created_at
		 FROM batches WHERE status='active'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]*model.Batch, 0)
	for rows.Next() {
		b := &model.Batch{}
		if err := rows.Scan(&b.ID, &b.BatchNo, &b.RecipeID, &b.RecipeVersion, &b.RecipeName, &b.CurrentStage, &b.Status, &b.TargetVolumeL, &b.ActualVolumeL,
			&b.BrewerID, &b.BrewerName, &b.MashingStart, &b.FermentingStart, &b.AgingStart, &b.BottlingStart, &b.Notes, &b.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (r *BatchRepo) RecordParam(p *model.StageParam) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO stage_params(batch_id, stage, param_name, param_value, unit, recorded_by, notes) VALUES(?,?,?,?,?,?,?)",
		p.BatchID, p.Stage, p.ParamName, p.ParamValue, p.Unit, p.RecordedBy, p.Notes,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *BatchRepo) GetStageParams(batchID int64, stage model.BatchStage) ([]*model.StageParam, error) {
	rows, err := r.Query(
		"SELECT id, batch_id, stage, param_name, param_value, unit, recorded_by, recorded_at, notes FROM stage_params WHERE batch_id=? AND stage=? ORDER BY recorded_at",
		batchID, stage,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.StageParam{}
	for rows.Next() {
		p := &model.StageParam{}
		if err := rows.Scan(&p.ID, &p.BatchID, &p.Stage, &p.ParamName, &p.ParamValue, &p.Unit, &p.RecordedBy, &p.RecordedAt, &p.Notes); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *BatchRepo) GetAllStageParams(batchID int64) ([]*model.StageParam, error) {
	rows, err := r.Query(
		"SELECT id, batch_id, stage, param_name, param_value, unit, recorded_by, recorded_at, notes FROM stage_params WHERE batch_id=? ORDER BY recorded_at",
		batchID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.StageParam{}
	for rows.Next() {
		p := &model.StageParam{}
		if err := rows.Scan(&p.ID, &p.BatchID, &p.Stage, &p.ParamName, &p.ParamValue, &p.Unit, &p.RecordedBy, &p.RecordedAt, &p.Notes); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *BatchRepo) LinkBatchMaterial(m *model.BatchMaterial) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO batch_materials(batch_id, material_id, material_name, material_lot, quantity_kg, supplier) VALUES(?,?,?,?,?,?)",
		m.BatchID, m.MaterialID, m.MaterialName, m.MaterialLot, m.QuantityKg, m.Supplier,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *BatchRepo) GetBatchMaterials(batchID int64) ([]*model.BatchMaterial, error) {
	rows, err := r.Query(
		"SELECT id, batch_id, material_id, material_name, material_lot, quantity_kg, supplier FROM batch_materials WHERE batch_id=?",
		batchID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.BatchMaterial{}
	for rows.Next() {
		m := &model.BatchMaterial{}
		if err := rows.Scan(&m.ID, &m.BatchID, &m.MaterialID, &m.MaterialName, &m.MaterialLot, &m.QuantityKg, &m.Supplier); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

type RecipeRepo struct{ *DB }

func (r *RecipeRepo) Create(rc *model.Recipe, ings []*model.RecipeIngredient, params []*model.RecipeParam) (int64, error) {
	tx, err := r.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		"INSERT INTO recipes(name, code, version, description, style, abv_target, ibu_target, srm_target, created_by) VALUES(?,?,?,?,?,?,?,?,?)",
		rc.Name, rc.Code, rc.Version, rc.Description, rc.Style, rc.ABVTarget, rc.IBUTarget, rc.SRMTarget, rc.CreatedBy,
	)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()

	for _, ing := range ings {
		_, err := tx.Exec(
			"INSERT INTO recipe_ingredients(recipe_id, material_id, material_name, quantity_kg, stage, notes) VALUES(?,?,?,?,?,?)",
			id, ing.MaterialID, ing.MaterialName, ing.QuantityKg, ing.Stage, ing.Notes,
		)
		if err != nil {
			return 0, err
		}
	}
	for _, p := range params {
		_, err := tx.Exec(
			"INSERT INTO recipe_params(recipe_id, stage, param_name, target_value, min_value, max_value, tolerance_pct, unit, required) VALUES(?,?,?,?,?,?,?,?,?)",
			id, p.Stage, p.ParamName, p.TargetValue, p.MinValue, p.MaxValue, p.TolerancePct, p.Unit, p.Required,
		)
		if err != nil {
			return 0, err
		}
	}
	return id, tx.Commit()
}

func (r *RecipeRepo) GetLatestByCode(code string) (*model.Recipe, error) {
	rc := &model.Recipe{}
	err := r.QueryRow(
		"SELECT id, name, code, version, description, style, abv_target, ibu_target, srm_target, created_by, active, created_at FROM recipes WHERE code=? ORDER BY version DESC LIMIT 1",
		code,
	).Scan(&rc.ID, &rc.Name, &rc.Code, &rc.Version, &rc.Description, &rc.Style, &rc.ABVTarget, &rc.IBUTarget, &rc.SRMTarget, &rc.CreatedBy, &rc.Active, &rc.CreatedAt)
	if err != nil {
		return nil, err
	}
	return rc, nil
}

func (r *RecipeRepo) GetByID(id int64) (*model.Recipe, error) {
	rc := &model.Recipe{}
	err := r.QueryRow(
		"SELECT id, name, code, version, description, style, abv_target, ibu_target, srm_target, created_by, active, created_at FROM recipes WHERE id=?",
		id,
	).Scan(&rc.ID, &rc.Name, &rc.Code, &rc.Version, &rc.Description, &rc.Style, &rc.ABVTarget, &rc.IBUTarget, &rc.SRMTarget, &rc.CreatedBy, &rc.Active, &rc.CreatedAt)
	if err != nil {
		return nil, err
	}
	return rc, nil
}

func (r *RecipeRepo) List(page, size int) ([]*model.Recipe, int64, error) {
	var total int64
	if err := r.QueryRow("SELECT COUNT(*) FROM recipes WHERE active=1").Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.Query(
		"SELECT id, name, code, version, description, style, abv_target, ibu_target, srm_target, created_at FROM recipes WHERE active=1 ORDER BY created_at DESC LIMIT ? OFFSET ?",
		size, (page-1)*size,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.Recipe{}
	for rows.Next() {
		rc := &model.Recipe{}
		if err := rows.Scan(&rc.ID, &rc.Name, &rc.Code, &rc.Version, &rc.Description, &rc.Style, &rc.ABVTarget, &rc.IBUTarget, &rc.SRMTarget, &rc.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, rc)
	}
	return list, total, nil
}

func (r *RecipeRepo) GetIngredients(recipeID int64) ([]*model.RecipeIngredient, error) {
	rows, err := r.Query(
		"SELECT id, recipe_id, material_id, material_name, quantity_kg, stage, notes FROM recipe_ingredients WHERE recipe_id=?",
		recipeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.RecipeIngredient{}
	for rows.Next() {
		ing := &model.RecipeIngredient{}
		if err := rows.Scan(&ing.ID, &ing.RecipeID, &ing.MaterialID, &ing.MaterialName, &ing.QuantityKg, &ing.Stage, &ing.Notes); err != nil {
			return nil, err
		}
		list = append(list, ing)
	}
	return list, nil
}

func (r *RecipeRepo) GetParams(recipeID int64) ([]*model.RecipeParam, error) {
	rows, err := r.Query(
		"SELECT id, recipe_id, stage, param_name, target_value, min_value, max_value, tolerance_pct, unit, required FROM recipe_params WHERE recipe_id=?",
		recipeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.RecipeParam{}
	for rows.Next() {
		p := &model.RecipeParam{}
		if err := rows.Scan(&p.ID, &p.RecipeID, &p.Stage, &p.ParamName, &p.TargetValue, &p.MinValue, &p.MaxValue, &p.TolerancePct, &p.Unit, &p.Required); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *RecipeRepo) GetParamsByStage(recipeID int64, stage model.BatchStage) ([]*model.RecipeParam, error) {
	rows, err := r.Query(
		"SELECT id, recipe_id, stage, param_name, target_value, min_value, max_value, tolerance_pct, unit, required FROM recipe_params WHERE recipe_id=? AND stage=?",
		recipeID, stage,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.RecipeParam{}
	for rows.Next() {
		p := &model.RecipeParam{}
		if err := rows.Scan(&p.ID, &p.RecipeID, &p.Stage, &p.ParamName, &p.TargetValue, &p.MinValue, &p.MaxValue, &p.TolerancePct, &p.Unit, &p.Required); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

type QualityRepo struct{ *DB }

func (r *QualityRepo) CreateItem(qi *model.QualityItem) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO quality_items(code, name, category, method, min_value, max_value, target_value, unit, required, applicable_stages, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
		qi.Code, qi.Name, qi.Category, qi.Method, qi.MinValue, qi.MaxValue, qi.TargetValue, qi.Unit, qi.Required, qi.ApplicableStages, qi.CreatedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *QualityRepo) UpdateItem(qi *model.QualityItem) error {
	_, err := r.Exec(
		"UPDATE quality_items SET name=?, category=?, method=?, min_value=?, max_value=?, target_value=?, unit=?, required=?, applicable_stages=? WHERE id=?",
		qi.Name, qi.Category, qi.Method, qi.MinValue, qi.MaxValue, qi.TargetValue, qi.Unit, qi.Required, qi.ApplicableStages, qi.ID,
	)
	return err
}

func (r *QualityRepo) GetItem(id int64) (*model.QualityItem, error) {
	qi := &model.QualityItem{}
	err := r.QueryRow(
		"SELECT id, code, name, category, method, min_value, max_value, target_value, unit, required, applicable_stages, created_by, active, created_at FROM quality_items WHERE id=?",
		id,
	).Scan(&qi.ID, &qi.Code, &qi.Name, &qi.Category, &qi.Method, &qi.MinValue, &qi.MaxValue, &qi.TargetValue, &qi.Unit, &qi.Required, &qi.ApplicableStages, &qi.CreatedBy, &qi.Active, &qi.CreatedAt)
	if err != nil {
		return nil, err
	}
	return qi, nil
}

func (r *QualityRepo) ListItems(active bool, page, size int) ([]*model.QualityItem, int64, error) {
	q := "SELECT COUNT(*) FROM quality_items WHERE 1=1"
	args := []interface{}{}
	if active {
		q += " AND active=1"
	}
	var total int64
	if err := r.QueryRow(q, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q = "SELECT id, code, name, category, method, min_value, max_value, target_value, unit, required, applicable_stages, active, created_at FROM quality_items WHERE 1=1"
	args = args[:0]
	if active {
		q += " AND active=1"
	}
	q += " ORDER BY id LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.QualityItem{}
	for rows.Next() {
		qi := &model.QualityItem{}
		if err := rows.Scan(&qi.ID, &qi.Code, &qi.Name, &qi.Category, &qi.Method, &qi.MinValue, &qi.MaxValue, &qi.TargetValue, &qi.Unit, &qi.Required, &qi.ApplicableStages, &qi.Active, &qi.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, qi)
	}
	return list, total, nil
}

func (r *QualityRepo) CreateSampleWithResults(s *model.QualitySample, results []*model.QualityResult) (int64, error) {
	tx, err := r.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		"INSERT INTO quality_samples(sample_no, batch_id, batch_no, stage, sampled_by, sampled_by_name, status, notes, retest_of_id) VALUES(?,?,?,?,?,?,?,?,?)",
		s.SampleNo, s.BatchID, s.BatchNo, s.Stage, s.SampledBy, s.SampledByName, s.Status, s.Notes, s.RetestOfID,
	)
	if err != nil {
		return 0, err
	}
	sid, _ := res.LastInsertId()

	for _, r2 := range results {
		_, err := tx.Exec(
			"INSERT INTO quality_results(sample_id, item_id, item_name, item_code, result_value, unit, is_pass, tested_by, remarks) VALUES(?,?,?,?,?,?,?,?,?)",
			sid, r2.ItemID, r2.ItemName, r2.ItemCode, r2.ResultValue, r2.Unit, r2.IsPass, r2.TestedBy, r2.Remarks,
		)
		if err != nil {
			return 0, err
		}
	}
	return sid, tx.Commit()
}

func (r *QualityRepo) GetSample(id int64) (*model.QualitySample, error) {
	s := &model.QualitySample{}
	err := r.QueryRow(
		`SELECT id, sample_no, batch_id, batch_no, stage, sampled_by, sampled_by_name, sampled_at, status, reviewed_by, reviewed_at,
		 overall_pass, notes, retest_of_id FROM quality_samples WHERE id=?`,
		id,
	).Scan(&s.ID, &s.SampleNo, &s.BatchID, &s.BatchNo, &s.Stage, &s.SampledBy, &s.SampledByName, &s.SampledAt, &s.Status, &s.ReviewedBy, &s.ReviewedAt,
		&s.OverallPass, &s.Notes, &s.RetestOfID)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *QualityRepo) UpdateSample(s *model.QualitySample) error {
	_, err := r.Exec(
		`UPDATE quality_samples SET status=?, reviewed_by=?, reviewed_at=?, overall_pass=?, notes=? WHERE id=?`,
		s.Status, s.ReviewedBy, s.ReviewedAt, s.OverallPass, s.Notes, s.ID,
	)
	return err
}

func (r *QualityRepo) ListSamples(batchID int64, status model.QualityStatus, page, size int) ([]*model.QualitySample, int64, error) {
	q := "SELECT COUNT(*) FROM quality_samples WHERE 1=1"
	args := []interface{}{}
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	if status != "" {
		q += " AND status=?"
		args = append(args, status)
	}
	var total int64
	if err := r.QueryRow(q, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q = `SELECT id, sample_no, batch_id, batch_no, stage, sampled_by, sampled_by_name, sampled_at, status,
	 reviewed_by, reviewed_at, overall_pass, notes FROM quality_samples WHERE 1=1`
	args = args[:0]
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	if status != "" {
		q += " AND status=?"
		args = append(args, status)
	}
	q += " ORDER BY sampled_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.QualitySample{}
	for rows.Next() {
		s := &model.QualitySample{}
		if err := rows.Scan(&s.ID, &s.SampleNo, &s.BatchID, &s.BatchNo, &s.Stage, &s.SampledBy, &s.SampledByName, &s.SampledAt, &s.Status,
			&s.ReviewedBy, &s.ReviewedAt, &s.OverallPass, &s.Notes); err != nil {
			return nil, 0, err
		}
		list = append(list, s)
	}
	return list, total, nil
}

func (r *QualityRepo) GetSampleResults(sampleID int64) ([]*model.QualityResult, error) {
	rows, err := r.Query(
		"SELECT id, sample_id, item_id, item_name, item_code, result_value, unit, is_pass, tested_by, tested_at, remarks FROM quality_results WHERE sample_id=?",
		sampleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.QualityResult{}
	for rows.Next() {
		rs := &model.QualityResult{}
		if err := rows.Scan(&rs.ID, &rs.SampleID, &rs.ItemID, &rs.ItemName, &rs.ItemCode, &rs.ResultValue, &rs.Unit, &rs.IsPass, &rs.TestedBy, &rs.TestedAt, &rs.Remarks); err != nil {
			return nil, err
		}
		list = append(list, rs)
	}
	return list, nil
}

type InventoryRepo struct{ *DB }

func (r *InventoryRepo) CreateMaterial(m *model.Material) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO materials(code, name, category, unit, supplier, spec, safety_stock) VALUES(?,?,?,?,?,?,?)",
		m.Code, m.Name, m.Category, m.Unit, m.Supplier, m.Spec, m.SafetyStock,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *InventoryRepo) GetMaterial(id int64) (*model.Material, error) {
	m := &model.Material{}
	err := r.QueryRow(
		"SELECT id, code, name, category, unit, supplier, spec, safety_stock, active, created_at FROM materials WHERE id=?",
		id,
	).Scan(&m.ID, &m.Code, &m.Name, &m.Category, &m.Unit, &m.Supplier, &m.Spec, &m.SafetyStock, &m.Active, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *InventoryRepo) ListMaterials(page, size int) ([]*model.Material, int64, error) {
	var total int64
	if err := r.QueryRow("SELECT COUNT(*) FROM materials WHERE active=1").Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.Query(
		"SELECT id, code, name, category, unit, supplier, spec, safety_stock, active, created_at FROM materials WHERE active=1 ORDER BY id LIMIT ? OFFSET ?",
		size, (page-1)*size,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.Material{}
	for rows.Next() {
		m := &model.Material{}
		if err := rows.Scan(&m.ID, &m.Code, &m.Name, &m.Category, &m.Unit, &m.Supplier, &m.Spec, &m.SafetyStock, &m.Active, &m.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, m)
	}
	return list, total, nil
}

func (r *InventoryRepo) GetMaterialStock(materialID int64) (float64, error) {
	var total float64
	err := r.QueryRow("SELECT COALESCE(SUM(quantity), 0) FROM material_lots WHERE material_id=?", materialID).Scan(&total)
	return total, err
}

func (r *InventoryRepo) InboundMaterial(lot *model.MaterialLot, moveNo string, opID int64, opName, refNo, remarks string) error {
	tx, err := r.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		"INSERT INTO material_lots(material_id, lot_no, quantity, received_date, expiry_date, warehouse, location, remarks) VALUES(?,?,?,?,?,?,?,?)",
		lot.MaterialID, lot.LotNo, lot.Quantity, lot.ReceivedDate, lot.ExpiryDate, lot.Warehouse, lot.Location, lot.Remarks,
	)
	if err != nil {
		return err
	}
	_, err = tx.Exec(
		"INSERT INTO stock_movements(move_no, type, direction, material_id, material_lot, quantity, ref_no, operator_id, operator_name, remarks) VALUES(?,?,?,?,?,?,?,?,?,?)",
		moveNo, model.InventoryRawMaterial, "in", lot.MaterialID, lot.LotNo, lot.Quantity, refNo, opID, opName, remarks,
	)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *InventoryRepo) ConsumeLot(materialID int64, lotNo string, qty float64, batchID int64, moveNo string, opID int64, opName, refNo, remarks string) error {
	tx, err := r.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	row := tx.QueryRow("SELECT quantity FROM material_lots WHERE material_id=? AND lot_no=?", materialID, lotNo)
	var curQty float64
	if err := row.Scan(&curQty); err != nil {
		return fmt.Errorf("lot not found: %w", err)
	}
	if curQty < qty {
		return fmt.Errorf("insufficient stock: have %.2f need %.2f", curQty, qty)
	}

	_, err = tx.Exec("UPDATE material_lots SET quantity=quantity-? WHERE material_id=? AND lot_no=?", qty, materialID, lotNo)
	if err != nil {
		return err
	}
	_, err = tx.Exec(
		"INSERT INTO stock_movements(move_no, type, direction, material_id, material_lot, batch_id, quantity, ref_no, operator_id, operator_name, remarks) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
		moveNo, model.InventoryRawMaterial, "out", materialID, lotNo, batchID, qty, refNo, opID, opName, remarks,
	)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *InventoryRepo) CreateFinished(fg *model.FinishedGoods, moveNo string, opID int64, opName, remarks string) (int64, error) {
	tx, err := r.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		"INSERT INTO finished_goods(batch_id, batch_no, product_code, product_name, package_type, quantity, unit, volume_ml, warehouse, location) VALUES(?,?,?,?,?,?,?,?,?,?)",
		fg.BatchID, fg.BatchNo, fg.ProductCode, fg.ProductName, fg.PackageType, fg.Quantity, fg.Unit, fg.VolumeML, fg.Warehouse, fg.Location,
	)
	if err != nil {
		return 0, err
	}
	fgID, _ := res.LastInsertId()
	_, err = tx.Exec(
		"INSERT INTO stock_movements(move_no, type, direction, finished_id, batch_id, quantity, ref_no, operator_id, operator_name, remarks) VALUES(?,?,?,?,?,?,?,?,?,?)",
		moveNo, model.InventoryFinished, "in", fgID, fg.BatchID, float64(fg.Quantity), "PROD-"+fg.BatchNo, opID, opName, remarks,
	)
	if err != nil {
		return 0, err
	}
	return fgID, tx.Commit()
}

func (r *InventoryRepo) GetFinished(id int64) (*model.FinishedGoods, error) {
	fg := &model.FinishedGoods{}
	err := r.QueryRow(
		"SELECT id, batch_id, batch_no, product_code, product_name, package_type, quantity, unit, volume_ml, warehouse, location, produced_at, created_at FROM finished_goods WHERE id=?",
		id,
	).Scan(&fg.ID, &fg.BatchID, &fg.BatchNo, &fg.ProductCode, &fg.ProductName, &fg.PackageType, &fg.Quantity, &fg.Unit, &fg.VolumeML, &fg.Warehouse, &fg.Location, &fg.ProducedAt, &fg.CreatedAt)
	if err != nil {
		return nil, err
	}
	return fg, nil
}

func (r *InventoryRepo) ListFinished(batchID int64, page, size int) ([]*model.FinishedGoods, int64, error) {
	q := "SELECT COUNT(*) FROM finished_goods WHERE 1=1"
	args := []interface{}{}
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	var total int64
	if err := r.QueryRow(q, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q = "SELECT id, batch_id, batch_no, product_code, product_name, package_type, quantity, unit, volume_ml, warehouse, location, produced_at, created_at FROM finished_goods WHERE 1=1"
	args = args[:0]
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	q += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.FinishedGoods{}
	for rows.Next() {
		fg := &model.FinishedGoods{}
		if err := rows.Scan(&fg.ID, &fg.BatchID, &fg.BatchNo, &fg.ProductCode, &fg.ProductName, &fg.PackageType, &fg.Quantity, &fg.Unit, &fg.VolumeML, &fg.Warehouse, &fg.Location, &fg.ProducedAt, &fg.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, fg)
	}
	return list, total, nil
}

func (r *InventoryRepo) OutboundFinished(finishedID int64, qty int, moveNo string, opID int64, opName, refNo, remarks string) error {
	tx, err := r.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	row := tx.QueryRow("SELECT quantity, batch_id FROM finished_goods WHERE id=?", finishedID)
	var curQty int
	var batchID int64
	if err := row.Scan(&curQty, &batchID); err != nil {
		return fmt.Errorf("finished goods not found: %w", err)
	}
	if curQty < qty {
		return fmt.Errorf("insufficient stock: have %d need %d", curQty, qty)
	}

	_, err = tx.Exec("UPDATE finished_goods SET quantity=quantity-? WHERE id=?", qty, finishedID)
	if err != nil {
		return err
	}
	_, err = tx.Exec(
		"INSERT INTO stock_movements(move_no, type, direction, finished_id, batch_id, quantity, ref_no, operator_id, operator_name, remarks) VALUES(?,?,?,?,?,?,?,?,?,?)",
		moveNo, model.InventoryFinished, "out", finishedID, batchID, float64(qty), refNo, opID, opName, remarks,
	)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *InventoryRepo) ListMovements(typ model.InventoryType, batchID int64, page, size int) ([]*model.StockMovement, int64, error) {
	q := "SELECT COUNT(*) FROM stock_movements WHERE 1=1"
	args := []interface{}{}
	if typ != "" {
		q += " AND type=?"
		args = append(args, typ)
	}
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	var total int64
	if err := r.QueryRow(q, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q = `SELECT id, move_no, type, direction, material_id, material_lot, finished_id, batch_id, quantity, ref_no, operator_id, operator_name, remarks, created_at
	 FROM stock_movements WHERE 1=1`
	args = args[:0]
	if typ != "" {
		q += " AND type=?"
		args = append(args, typ)
	}
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	q += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.StockMovement{}
	for rows.Next() {
		mv := &model.StockMovement{}
		if err := rows.Scan(&mv.ID, &mv.MoveNo, &mv.Type, &mv.Direction, &mv.MaterialID, &mv.MaterialLot, &mv.FinishedID, &mv.BatchID, &mv.Quantity, &mv.RefNo, &mv.OperatorID, &mv.OperatorName, &mv.Remarks, &mv.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, mv)
	}
	return list, total, nil
}

func (r *InventoryRepo) GetLowStock() ([]*model.Material, error) {
	rows, err := r.Query(`
		SELECT m.id, m.code, m.name, m.category, m.unit, m.supplier, m.spec, m.safety_stock, m.active, m.created_at
		FROM materials m
		LEFT JOIN (SELECT material_id, SUM(quantity) as stock FROM material_lots GROUP BY material_id) ml ON ml.material_id=m.id
		WHERE m.active=1 AND COALESCE(ml.stock, 0) <= m.safety_stock`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.Material{}
	for rows.Next() {
		m := &model.Material{}
		if err := rows.Scan(&m.ID, &m.Code, &m.Name, &m.Category, &m.Unit, &m.Supplier, &m.Spec, &m.SafetyStock, &m.Active, &m.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, nil
}

func (r *InventoryRepo) GetExpiringLots(days int) ([]*model.MaterialLot, error) {
	until := time.Now().AddDate(0, 0, days)
	rows, err := r.Query(
		"SELECT ml.id, ml.material_id, ml.lot_no, ml.quantity, ml.received_date, ml.expiry_date, ml.warehouse, ml.location, ml.remarks, ml.created_at FROM material_lots ml WHERE ml.quantity>0 AND ml.expiry_date IS NOT NULL AND ml.expiry_date <= ? ORDER BY ml.expiry_date",
		until,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.MaterialLot{}
	for rows.Next() {
		lot := &model.MaterialLot{}
		if err := rows.Scan(&lot.ID, &lot.MaterialID, &lot.LotNo, &lot.Quantity, &lot.ReceivedDate, &lot.ExpiryDate, &lot.Warehouse, &lot.Location, &lot.Remarks, &lot.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, lot)
	}
	return list, nil
}

type AlertRepo struct{ *DB }

func (r *AlertRepo) Create(a *model.Alert) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO alerts(alert_type, level, title, message, batch_id, batch_no, ref_type, ref_id) VALUES(?,?,?,?,?,?,?,?)",
		a.AlertType, a.Level, a.Title, a.Message, a.BatchID, a.BatchNo, a.RefType, a.RefID,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *AlertRepo) List(resolved *bool, level model.AlertLevel, page, size int) ([]*model.Alert, int64, error) {
	q := "SELECT COUNT(*) FROM alerts WHERE 1=1"
	args := []interface{}{}
	if resolved != nil {
		q += " AND resolved=?"
		iv := 0
		if *resolved {
			iv = 1
		}
		args = append(args, iv)
	}
	if level != "" {
		q += " AND level=?"
		args = append(args, level)
	}
	var total int64
	if err := r.QueryRow(q, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q = `SELECT id, alert_type, level, title, message, batch_id, batch_no, ref_type, ref_id, resolved, resolved_by, resolved_at, resolved_note, created_at
	 FROM alerts WHERE 1=1`
	args = args[:0]
	if resolved != nil {
		q += " AND resolved=?"
		iv := 0
		if *resolved {
			iv = 1
		}
		args = append(args, iv)
	}
	if level != "" {
		q += " AND level=?"
		args = append(args, level)
	}
	q += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.Alert{}
	for rows.Next() {
		a := &model.Alert{}
		if err := rows.Scan(&a.ID, &a.AlertType, &a.Level, &a.Title, &a.Message, &a.BatchID, &a.BatchNo, &a.RefType, &a.RefID, &a.Resolved, &a.ResolvedBy, &a.ResolvedAt, &a.ResolvedNote, &a.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, a)
	}
	return list, total, nil
}

func (r *AlertRepo) Resolve(id int64, userID int64, note string) error {
	_, err := r.Exec(
		"UPDATE alerts SET resolved=1, resolved_by=?, resolved_at=CURRENT_TIMESTAMP, resolved_note=? WHERE id=?",
		userID, note, id,
	)
	return err
}

type DeviationRepo struct{ *DB }

func (r *DeviationRepo) Create(d *model.DeviationLog) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO deviation_logs(batch_id, batch_no, stage, param_name, standard_value, actual_value, deviation_pct, threshold_pct) VALUES(?,?,?,?,?,?,?,?)",
		d.BatchID, d.BatchNo, d.Stage, d.ParamName, d.StandardValue, d.ActualValue, d.DeviationPct, d.ThresholdPct,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *DeviationRepo) ListByBatch(batchID int64) ([]*model.DeviationLog, error) {
	rows, err := r.Query(
		"SELECT id, batch_id, batch_no, stage, param_name, standard_value, actual_value, deviation_pct, threshold_pct, handled, handler_id, handle_note, handled_at, created_at FROM deviation_logs WHERE batch_id=? ORDER BY created_at DESC",
		batchID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.DeviationLog{}
	for rows.Next() {
		d := &model.DeviationLog{}
		if err := rows.Scan(&d.ID, &d.BatchID, &d.BatchNo, &d.Stage, &d.ParamName, &d.StandardValue, &d.ActualValue, &d.DeviationPct, &d.ThresholdPct, &d.Handled, &d.HandlerID, &d.HandleNote, &d.HandledAt, &d.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, nil
}

func (r *DeviationRepo) ListUnhandled() ([]*model.DeviationLog, error) {
	rows, err := r.Query(
		"SELECT id, batch_id, batch_no, stage, param_name, standard_value, actual_value, deviation_pct, threshold_pct, handled, handler_id, handle_note, handled_at, created_at FROM deviation_logs WHERE handled=0 ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*model.DeviationLog{}
	for rows.Next() {
		d := &model.DeviationLog{}
		if err := rows.Scan(&d.ID, &d.BatchID, &d.BatchNo, &d.Stage, &d.ParamName, &d.StandardValue, &d.ActualValue, &d.DeviationPct, &d.ThresholdPct, &d.Handled, &d.HandlerID, &d.HandleNote, &d.HandledAt, &d.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	return list, nil
}

type AsyncTaskRepo struct{ *DB }

func (r *AsyncTaskRepo) Create(t *model.AsyncTask) error {
	_, err := r.Exec(
		"INSERT INTO async_tasks(id, task_type, status, progress, result, created_by) VALUES(?,?,?,?,?,?)",
		t.ID, t.TaskType, t.Status, t.Progress, t.Result, t.CreatedBy,
	)
	return err
}

func (r *AsyncTaskRepo) Update(t *model.AsyncTask) error {
	_, err := r.Exec(
		"UPDATE async_tasks SET status=?, progress=?, result=?, error_msg=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
		t.Status, t.Progress, t.Result, t.ErrorMsg, t.ID,
	)
	return err
}

func (r *AsyncTaskRepo) Get(id string) (*model.AsyncTask, error) {
	t := &model.AsyncTask{}
	err := r.QueryRow(
		"SELECT id, task_type, status, progress, result, error_msg, created_by, created_at, updated_at FROM async_tasks WHERE id=?",
		id,
	).Scan(&t.ID, &t.TaskType, &t.Status, &t.Progress, &t.Result, &t.ErrorMsg, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

type ReportRepo struct{ *DB }

func (r *ReportRepo) Create(rp *model.ComplianceReport) (int64, error) {
	res, err := r.Exec(
		"INSERT INTO compliance_reports(report_no, report_type, batch_id, batch_no, content_json, file_url, generated_by) VALUES(?,?,?,?,?,?,?)",
		rp.ReportNo, rp.ReportType, rp.BatchID, rp.BatchNo, rp.ContentJSON, rp.FileURL, rp.GeneratedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *ReportRepo) List(batchID int64, page, size int) ([]*model.ComplianceReport, int64, error) {
	q := "SELECT COUNT(*) FROM compliance_reports WHERE 1=1"
	args := []interface{}{}
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	var total int64
	if err := r.QueryRow(q, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	q = "SELECT id, report_no, report_type, batch_id, batch_no, file_url, generated_by, generated_at FROM compliance_reports WHERE 1=1"
	args = args[:0]
	if batchID > 0 {
		q += " AND batch_id=?"
		args = append(args, batchID)
	}
	q += " ORDER BY generated_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.ComplianceReport{}
	for rows.Next() {
		rp := &model.ComplianceReport{}
		if err := rows.Scan(&rp.ID, &rp.ReportNo, &rp.ReportType, &rp.BatchID, &rp.BatchNo, &rp.FileURL, &rp.GeneratedBy, &rp.GeneratedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, rp)
	}
	return list, total, nil
}

func (r *ReportRepo) Get(id int64) (*model.ComplianceReport, error) {
	rp := &model.ComplianceReport{}
	err := r.QueryRow(
		"SELECT id, report_no, report_type, batch_id, batch_no, content_json, file_url, generated_by, generated_at FROM compliance_reports WHERE id=?",
		id,
	).Scan(&rp.ID, &rp.ReportNo, &rp.ReportType, &rp.BatchID, &rp.BatchNo, &rp.ContentJSON, &rp.FileURL, &rp.GeneratedBy, &rp.GeneratedAt)
	if err != nil {
		return nil, err
	}
	return rp, nil
}

type TraceRepo struct{ *DB }

func (r *TraceRepo) TraceQuery(q *dto.TraceQueryRequest) ([]*model.Batch, int64, error) {
	sqlQ := "SELECT COUNT(DISTINCT b.id) FROM batches b WHERE 1=1"
	args := []interface{}{}
	if q.BatchNo != "" {
		sqlQ += " AND b.batch_no LIKE ?"
		args = append(args, "%"+q.BatchNo+"%")
	}
	if q.Stage != "" {
		sqlQ += " AND b.current_stage=?"
		args = append(args, q.Stage)
	}
	if q.StartDate != nil {
		sqlQ += " AND b.created_at >= ?"
		args = append(args, q.StartDate)
	}
	if q.EndDate != nil {
		sqlQ += " AND b.created_at <= ?"
		args = append(args, q.EndDate)
	}
	if q.QualityStatus != "" {
		sqlQ += " AND EXISTS (SELECT 1 FROM quality_samples qs WHERE qs.batch_id=b.id AND qs.status=?)"
		args = append(args, q.QualityStatus)
	}
	var total int64
	if err := r.QueryRow(sqlQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	page, size := q.Page, q.PageSize
	if page <= 0 {
		page = 1
	}
	if size <= 0 {
		size = 20
	}

	sqlQ = `SELECT b.id, b.batch_no, b.recipe_id, b.recipe_version, b.recipe_name, b.current_stage, b.status, b.target_volume_l, b.actual_volume_l,
	 b.brewer_id, b.brewer_name, b.mashing_start, b.fermenting_start, b.aging_start, b.bottling_start, b.completed_at, b.notes, b.created_at, b.updated_at
	 FROM batches b WHERE 1=1`
	args = args[:0]
	if q.BatchNo != "" {
		sqlQ += " AND b.batch_no LIKE ?"
		args = append(args, "%"+q.BatchNo+"%")
	}
	if q.Stage != "" {
		sqlQ += " AND b.current_stage=?"
		args = append(args, q.Stage)
	}
	if q.StartDate != nil {
		sqlQ += " AND b.created_at >= ?"
		args = append(args, q.StartDate)
	}
	if q.EndDate != nil {
		sqlQ += " AND b.created_at <= ?"
		args = append(args, q.EndDate)
	}
	if q.QualityStatus != "" {
		sqlQ += " AND EXISTS (SELECT 1 FROM quality_samples qs WHERE qs.batch_id=b.id AND qs.status=?)"
		args = append(args, q.QualityStatus)
	}
	sqlQ += " ORDER BY b.created_at DESC LIMIT ? OFFSET ?"
	args = append(args, size, (page-1)*size)

	rows, err := r.Query(sqlQ, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	list := []*model.Batch{}
	for rows.Next() {
		b := &model.Batch{}
		if err := rows.Scan(&b.ID, &b.BatchNo, &b.RecipeID, &b.RecipeVersion, &b.RecipeName, &b.CurrentStage, &b.Status, &b.TargetVolumeL, &b.ActualVolumeL,
			&b.BrewerID, &b.BrewerName, &b.MashingStart, &b.FermentingStart, &b.AgingStart, &b.BottlingStart, &b.CompletedAt, &b.Notes, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, b)
	}
	return list, total, nil
}

func IsNoRows(err error) bool {
	return err == sql.ErrNoRows
}
