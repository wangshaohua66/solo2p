CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    credit_score INTEGER DEFAULT 100,
    no_show_count INTEGER DEFAULT 0,
    total_booking_count INTEGER DEFAULT 0,
    avatar_url VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_phone ON users(phone);
CREATE INDEX idx_role ON users(role);

CREATE TABLE scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    min_players INTEGER NOT NULL,
    max_players INTEGER NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    genre VARCHAR(20) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    visibility_level VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    version INTEGER DEFAULT 1,
    version_snapshot TEXT,
    cover_image_url VARCHAR(500),
    background_story TEXT,
    ending_count INTEGER DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    total_played_count INTEGER DEFAULT 0,
    average_rating REAL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_script_name ON scripts(name);
CREATE INDEX idx_genre ON scripts(genre);
CREATE INDEX idx_difficulty ON scripts(difficulty);
CREATE INDEX idx_status ON scripts(status);

CREATE TABLE characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    gender VARCHAR(10),
    age_range VARCHAR(20),
    description TEXT,
    character_story TEXT,
    secret_info TEXT,
    character_trait VARCHAR(200),
    visibility_level VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    sort_order INTEGER DEFAULT 0,
    is_killer BOOLEAN DEFAULT 0,
    avatar_url VARCHAR(500),
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

CREATE INDEX idx_character_script ON characters(script_id);
CREATE INDEX idx_character_gender ON characters(gender);

CREATE TABLE stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    stage_order INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    duration_minutes INTEGER,
    stage_goal VARCHAR(500),
    visibility_level VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    dm_hint TEXT,
    event_trigger VARCHAR(200),
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

CREATE INDEX idx_stage_script ON stages(script_id);
CREATE INDEX idx_stage_order ON stages(stage_order);

CREATE TABLE clues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    stage_id INTEGER,
    character_id INTEGER,
    title VARCHAR(100) NOT NULL,
    content TEXT,
    clue_level INTEGER NOT NULL DEFAULT 1,
    trigger_type VARCHAR(20) NOT NULL,
    trigger_condition VARCHAR(500),
    trigger_time_minutes INTEGER,
    trigger_location VARCHAR(100),
    visibility_level VARCHAR(20) NOT NULL DEFAULT 'DM_ONLY',
    is_key_clue BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    image_url VARCHAR(500),
    dm_note TEXT,
    FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE INDEX idx_clue_script ON clues(script_id);
CREATE INDEX idx_clue_stage ON clues(stage_id);
CREATE INDEX idx_clue_character ON clues(character_id);
CREATE INDEX idx_trigger_type ON clues(trigger_type);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL,
    dm_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED',
    start_time DATETIME,
    end_time DATETIME,
    current_stage_id INTEGER,
    current_stage_index INTEGER DEFAULT 0,
    room_number VARCHAR(20),
    max_players INTEGER NOT NULL,
    current_players_count INTEGER DEFAULT 0,
    difficulty_factor REAL DEFAULT 1.0,
    deposit_amount INTEGER DEFAULT 0,
    price_per_person INTEGER DEFAULT 0,
    total_revenue INTEGER DEFAULT 0,
    dm_commission INTEGER DEFAULT 0,
    notes TEXT,
    is_archived BOOLEAN DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (script_id) REFERENCES scripts(id),
    FOREIGN KEY (dm_id) REFERENCES users(id)
);

CREATE INDEX idx_session_script ON sessions(script_id);
CREATE INDEX idx_session_dm ON sessions(dm_id);
CREATE INDEX idx_session_status ON sessions(status);
CREATE INDEX idx_session_start_time ON sessions(start_time);
CREATE INDEX idx_session_room ON sessions(room_number);

CREATE TABLE session_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    triggered_by INTEGER,
    event_data TEXT,
    description VARCHAR(500),
    event_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_event_session ON session_events(session_id);
CREATE INDEX idx_event_timestamp ON session_events(event_timestamp);
CREATE INDEX idx_event_type ON session_events(event_type);

CREATE TABLE session_clue_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    clue_id INTEGER NOT NULL,
    triggered_by INTEGER,
    triggered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    trigger_type VARCHAR(20),
    stage_index INTEGER,
    notes VARCHAR(500),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (clue_id) REFERENCES clues(id)
);

CREATE INDEX idx_clue_log_session ON session_clue_logs(session_id);
CREATE INDEX idx_clue_log_clue ON session_clue_logs(clue_id);
CREATE INDEX idx_clue_log_time ON session_clue_logs(triggered_at);

CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    real_name VARCHAR(50),
    age_group VARCHAR(20),
    gender VARCHAR(10),
    preferred_genre VARCHAR(100),
    play_count INTEGER DEFAULT 0,
    average_rating REAL DEFAULT 0.0,
    history_score INTEGER DEFAULT 0,
    preference_tags VARCHAR(500),
    horror_tolerance INTEGER DEFAULT 5,
    emotional_sensitivity INTEGER DEFAULT 5,
    reasoning_ability INTEGER DEFAULT 5,
    social_level INTEGER DEFAULT 5,
    birthday DATE,
    member_level VARCHAR(20) DEFAULT 'NORMAL',
    total_spent INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_player_user ON players(user_id);
CREATE INDEX idx_player_preference ON players(preferred_genre);
CREATE INDEX idx_player_age_group ON players(age_group);

CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    character_id INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    deposit_paid INTEGER NOT NULL DEFAULT 0,
    full_price_paid INTEGER DEFAULT 0,
    is_deposit_refunded BOOLEAN DEFAULT 0,
    booking_time DATETIME,
    cancel_time DATETIME,
    cancel_reason VARCHAR(500),
    notes VARCHAR(500),
    check_in_time DATETIME,
    check_out_time DATETIME,
    character_preference_1 INTEGER,
    character_preference_2 INTEGER,
    character_preference_3 INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (player_id) REFERENCES users(id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE INDEX idx_booking_session ON bookings(session_id);
CREATE INDEX idx_booking_player ON bookings(player_id);
CREATE INDEX idx_booking_status ON bookings(status);
CREATE INDEX idx_booking_time ON bookings(booking_time);

CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    script_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    character_id INTEGER,
    script_rating INTEGER NOT NULL,
    dm_professionalism INTEGER NOT NULL,
    character_fit INTEGER NOT NULL,
    overall_experience INTEGER NOT NULL,
    story_rating INTEGER,
    puzzle_difficulty_rating INTEGER,
    atmosphere_rating INTEGER,
    is_anonymous BOOLEAN NOT NULL DEFAULT 1,
    comment TEXT,
    suggestions TEXT,
    would_recommend BOOLEAN,
    emotional_tags VARCHAR(200),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (script_id) REFERENCES scripts(id),
    FOREIGN KEY (player_id) REFERENCES users(id),
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
);

CREATE INDEX idx_review_session ON reviews(session_id);
CREATE INDEX idx_review_script ON reviews(script_id);
CREATE INDEX idx_review_player ON reviews(player_id);

CREATE TABLE dm_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dm_id INTEGER NOT NULL,
    session_id INTEGER,
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_type VARCHAR(20),
    commission_amount INTEGER DEFAULT 0,
    difficulty_coefficient REAL DEFAULT 1.0,
    player_count INTEGER DEFAULT 0,
    base_salary INTEGER DEFAULT 0,
    bonus INTEGER DEFAULT 0,
    total_earnings INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT 0,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    notes VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dm_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_schedule_dm ON dm_schedules(dm_id);
CREATE INDEX idx_schedule_date ON dm_schedules(schedule_date);
CREATE INDEX idx_schedule_session ON dm_schedules(session_id);

CREATE TABLE deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'HELD',
    payment_method VARCHAR(20),
    transaction_id VARCHAR(100),
    refund_amount INTEGER DEFAULT 0,
    refund_time DATETIME,
    forfeit_reason VARCHAR(500),
    notes VARCHAR(500),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (player_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_deposit_booking ON deposits(booking_id);
CREATE INDEX idx_deposit_player ON deposits(player_id);
CREATE INDEX idx_deposit_status ON deposits(status);

CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_name VARCHAR(100) NOT NULL,
    script_description TEXT,
    author VARCHAR(50),
    publisher VARCHAR(100),
    player_count VARCHAR(20),
    estimated_duration VARCHAR(20),
    genre VARCHAR(50),
    difficulty VARCHAR(20),
    purchase_price INTEGER,
    sample_content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
    submitter_id INTEGER,
    reviewer_1_id INTEGER,
    reviewer_1_score INTEGER,
    reviewer_1_comment VARCHAR(500),
    reviewer_2_id INTEGER,
    reviewer_2_score INTEGER,
    reviewer_2_comment VARCHAR(500),
    reviewer_3_id INTEGER,
    reviewer_3_score INTEGER,
    reviewer_3_comment VARCHAR(500),
    average_score REAL,
    passing_score INTEGER DEFAULT 60,
    result_script_id INTEGER,
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_purchase_status ON purchases(status);
CREATE INDEX idx_purchase_script_name ON purchases(script_name);
CREATE INDEX idx_purchase_submitter ON purchases(submitter_id);

INSERT INTO users (username, password, nickname, phone, email, role) VALUES 
('admin', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', '超级管理员', '13800000001', 'admin@scriptkill.com', 'ADMIN'),
('manager', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', '店长', '13800000002', 'manager@scriptkill.com', 'STORE_MANAGER'),
('dm01', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', 'DM小A', '13800000003', 'dm01@scriptkill.com', 'DM'),
('dm02', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', 'DM小B', '13800000004', 'dm02@scriptkill.com', 'DM'),
('player01', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', '玩家小明', '13900000001', 'player01@scriptkill.com', 'PLAYER'),
('player02', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', '玩家小红', '13900000002', 'player02@scriptkill.com', 'PLAYER'),
('player03', '$2a$10$rjFrEeMVy3a42OL383pXbeLSB4gayV88xkkMFOjQH8exnTetPFMEO', '玩家小刚', '13900000003', 'player03@scriptkill.com', 'PLAYER');

INSERT INTO players (user_id, real_name, age_group, gender, preferred_genre, horror_tolerance, emotional_sensitivity, reasoning_ability, social_level) VALUES 
(5, '张明', '18-25', '男', 'REASONING,HORROR', 7, 3, 8, 6),
(6, '李红', '25-35', '女', 'EMOTIONAL,HAPPY', 3, 9, 5, 8),
(7, '王刚', '35-45', '男', 'SUSPENSE,SCI_FI', 5, 4, 9, 4);
