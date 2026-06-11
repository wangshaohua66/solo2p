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
