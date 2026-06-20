CREATE TABLE IF NOT EXISTS sys_user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    name VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    profession VARCHAR(20),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_no VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL,
    stage VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    contract_amount DECIMAL(15,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    client_name VARCHAR(200),
    client_contact VARCHAR(50),
    client_phone VARCHAR(20),
    project_manager_id INTEGER,
    description TEXT,
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_manager_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS project_professional (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    profession VARCHAR(20) NOT NULL,
    professional_lead_id INTEGER,
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (professional_lead_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS design_task (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    stage VARCHAR(20) NOT NULL,
    profession VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id INTEGER,
    assignee_id INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    progress INTEGER DEFAULT 0,
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    deliverables VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (parent_id) REFERENCES design_task(id),
    FOREIGN KEY (assignee_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS review_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    version_id INTEGER,
    level VARCHAR(20) NOT NULL,
    reviewer_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES design_task(id),
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (version_id) REFERENCES design_version(id),
    FOREIGN KEY (reviewer_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS review_comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_record_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    reply TEXT,
    location VARCHAR(200),
    resolved INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replied_at DATETIME,
    FOREIGN KEY (review_record_id) REFERENCES review_record(id),
    FOREIGN KEY (created_by) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS change_request (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    change_no VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    reason TEXT NOT NULL,
    content TEXT NOT NULL,
    impact_scope TEXT,
    workload INTEGER DEFAULT 0,
    additional_fee DECIMAL(15,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    applicant_id INTEGER NOT NULL,
    applicant_type VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    current_approver_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (applicant_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS change_approval (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_request_id INTEGER NOT NULL,
    approver_id INTEGER NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    comment TEXT,
    approved INTEGER DEFAULT 0,
    approved_at DATETIME,
    FOREIGN KEY (change_request_id) REFERENCES change_request(id),
    FOREIGN KEY (approver_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS design_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    task_id INTEGER,
    version_no VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER DEFAULT 0,
    file_path VARCHAR(500) NOT NULL,
    uploaded_by INTEGER NOT NULL,
    description TEXT,
    is_released INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (task_id) REFERENCES design_task(id),
    FOREIGN KEY (uploaded_by) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS project_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    content TEXT,
    operator_id INTEGER,
    operator_name VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (operator_id) REFERENCES sys_user(id)
);

CREATE TABLE IF NOT EXISTS client_confirmation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    version_id INTEGER,
    confirmation_type VARCHAR(50) NOT NULL,
    confirmed INTEGER DEFAULT 0,
    confirmed_by INTEGER,
    confirmed_at DATETIME,
    ip_address VARCHAR(50),
    remark TEXT,
    FOREIGN KEY (project_id) REFERENCES project(id),
    FOREIGN KEY (version_id) REFERENCES design_version(id),
    FOREIGN KEY (confirmed_by) REFERENCES sys_user(id)
);
