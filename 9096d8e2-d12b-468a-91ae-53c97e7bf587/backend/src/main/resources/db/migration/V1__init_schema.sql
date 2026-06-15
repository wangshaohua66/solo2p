CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    roles VARCHAR(100) NOT NULL DEFAULT 'DISPATCHER',
    department VARCHAR(100),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT
);

CREATE TABLE hospitals (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address VARCHAR(500),
    phone VARCHAR(20),
    level VARCHAR(20),
    emergency_department BOOLEAN DEFAULT TRUE,
    location GEOGRAPHY(POINT, 4326),
    available_beds INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ambulances (
    id BIGSERIAL PRIMARY KEY,
    vehicle_no VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,
    equipment_level VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    current_location GEOGRAPHY(POINT, 4326),
    current_station_id BIGINT,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    mileage INTEGER DEFAULT 0,
    fuel_level INTEGER DEFAULT 100,
    equipment_status JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dispatch_events (
    id BIGSERIAL PRIMARY KEY,
    event_no VARCHAR(50) NOT NULL UNIQUE,
    caller_name VARCHAR(100),
    caller_phone VARCHAR(20) NOT NULL,
    patient_name VARCHAR(100),
    patient_gender VARCHAR(10),
    patient_age INTEGER,
    emergency_address VARCHAR(500) NOT NULL,
    emergency_location GEOGRAPHY(POINT, 4326) NOT NULL,
    chief_complaint VARCHAR(500) NOT NULL,
    condition_severity VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ambulance_id BIGINT REFERENCES ambulances(id),
    hospital_id BIGINT REFERENCES hospitals(id),
    dispatcher_id BIGINT REFERENCES users(id),
    doctor_id BIGINT REFERENCES users(id),
    call_received_time TIMESTAMP NOT NULL,
    dispatch_time TIMESTAMP,
    vehicle_departure_time TIMESTAMP,
    arrival_scene_time TIMESTAMP,
    departure_scene_time TIMESTAMP,
    arrival_hospital_time TIMESTAMP,
    transfer_complete_time TIMESTAMP,
    estimated_arrival_minutes INTEGER,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE medical_records (
    id BIGSERIAL PRIMARY KEY,
    record_no VARCHAR(50) NOT NULL UNIQUE,
    dispatch_event_id BIGINT NOT NULL REFERENCES dispatch_events(id) ON DELETE CASCADE,
    patient_name VARCHAR(100) NOT NULL,
    patient_gender VARCHAR(10),
    patient_age INTEGER,
    patient_id_card VARCHAR(20),
    chief_complaint VARCHAR(500),
    present_illness TEXT,
    past_history TEXT,
    allergy_history TEXT,
    vital_signs JSONB,
    physical_examination TEXT,
    auxiliary_examination TEXT,
    preliminary_diagnosis VARCHAR(500),
    treatment_measures JSONB,
    medications JSONB,
    procedures_performed TEXT,
    consciousness VARCHAR(50),
    breathing VARCHAR(50),
    circulation VARCHAR(50),
    glasgow_score INTEGER,
    ecg_monitoring BOOLEAN DEFAULT FALSE,
    oxygen_saturation INTEGER,
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,
    heart_rate INTEGER,
    respiratory_rate INTEGER,
    temperature DECIMAL(4,1),
    blood_glucose DECIMAL(5,1),
    outcome VARCHAR(50),
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id)
);

CREATE TABLE ambulance_locations (
    id BIGSERIAL PRIMARY KEY,
    ambulance_id BIGINT NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    speed DECIMAL(8,2),
    heading INTEGER,
    altitude DECIMAL(8,2),
    gps_accuracy INTEGER,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ignition_status BOOLEAN,
    odometer INTEGER
);

CREATE TABLE vehicle_maintenance (
    id BIGSERIAL PRIMARY KEY,
    ambulance_id BIGINT NOT NULL REFERENCES ambulances(id) ON DELETE CASCADE,
    maintenance_type VARCHAR(50) NOT NULL,
    maintenance_date DATE NOT NULL,
    mileage_at_service INTEGER NOT NULL,
    description TEXT,
    parts_replaced JSONB,
    service_cost DECIMAL(10,2),
    service_station VARCHAR(200),
    next_maintenance_date DATE,
    next_mileage_threshold INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES users(id)
);

CREATE TABLE medical_supplies (
    id BIGSERIAL PRIMARY KEY,
    ambulance_id BIGINT REFERENCES ambulances(id),
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    specification VARCHAR(200),
    unit VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    minimum_stock INTEGER NOT NULL DEFAULT 10,
    expiry_date DATE,
    batch_no VARCHAR(50),
    manufacturer VARCHAR(200),
    last_restock_date DATE,
    last_restock_quantity INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quality_control_reviews (
    id BIGSERIAL PRIMARY KEY,
    review_no VARCHAR(50) NOT NULL UNIQUE,
    medical_record_id BIGINT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    reviewer_id BIGINT REFERENCES users(id),
    review_type VARCHAR(30) NOT NULL,
    review_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    overall_score INTEGER,
    completeness_score INTEGER,
    timeliness_score INTEGER,
    accuracy_score INTEGER,
    defects JSONB,
    improvement_suggestions TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    rectification_required BOOLEAN DEFAULT FALSE,
    rectification_deadline TIMESTAMP,
    rectification_completed BOOLEAN DEFAULT FALSE,
    rectification_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    notification_no VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    title VARCHAR(200) NOT NULL,
    content TEXT,
    dispatch_event_id BIGINT REFERENCES dispatch_events(id),
    recipient_user_id BIGINT REFERENCES users(id),
    recipient_hospital_id BIGINT REFERENCES hospitals(id),
    channel VARCHAR(30) NOT NULL DEFAULT 'WEBSOCKET',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    ack_received BOOLEAN DEFAULT FALSE,
    ack_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dispatch_events_status ON dispatch_events(status);
CREATE INDEX idx_dispatch_events_created_at ON dispatch_events(created_at DESC);
CREATE INDEX idx_dispatch_events_location ON dispatch_events USING GIST(emergency_location);
CREATE INDEX idx_dispatch_events_ambulance ON dispatch_events(ambulance_id);
CREATE INDEX idx_dispatch_events_dispatcher ON dispatch_events(dispatcher_id);

CREATE INDEX idx_ambulances_status ON ambulances(status);
CREATE INDEX idx_ambulances_location ON ambulances USING GIST(current_location);

CREATE INDEX idx_ambulance_locations_ambulance ON ambulance_locations(ambulance_id);
CREATE INDEX idx_ambulance_locations_timestamp ON ambulance_locations(timestamp DESC);
CREATE INDEX idx_ambulance_locations_location ON ambulance_locations USING GIST(location);

CREATE INDEX idx_medical_records_event ON medical_records(dispatch_event_id);
CREATE INDEX idx_medical_records_created ON medical_records(created_at DESC);
CREATE INDEX idx_medical_records_locked ON medical_records(is_locked);

CREATE INDEX idx_vehicle_maintenance_ambulance ON vehicle_maintenance(ambulance_id);
CREATE INDEX idx_vehicle_maintenance_date ON vehicle_maintenance(maintenance_date DESC);
CREATE INDEX idx_vehicle_maintenance_next ON vehicle_maintenance(next_maintenance_date);

CREATE INDEX idx_medical_supplies_ambulance ON medical_supplies(ambulance_id);
CREATE INDEX idx_medical_supplies_expiry ON medical_supplies(expiry_date);
CREATE INDEX idx_medical_supplies_quantity ON medical_supplies(quantity);

CREATE INDEX idx_quality_control_reviews_record ON quality_control_reviews(medical_record_id);
CREATE INDEX idx_quality_control_reviews_status ON quality_control_reviews(status);
CREATE INDEX idx_quality_control_reviews_date ON quality_control_reviews(review_date DESC);

CREATE INDEX idx_hospitals_location ON hospitals USING GIST(location);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX idx_notifications_hospital ON notifications(recipient_hospital_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_roles ON users(roles);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ambulances_updated_at BEFORE UPDATE ON ambulances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dispatch_events_updated_at BEFORE UPDATE ON dispatch_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_medical_supplies_updated_at BEFORE UPDATE ON medical_supplies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
