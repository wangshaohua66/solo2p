INSERT INTO scripts (name, description, min_players, max_players, estimated_duration_minutes, genre, difficulty, visibility_level, background_story, ending_count, status, total_played_count, average_rating) VALUES
('雾都孤儿', '一个发生在维多利亚时代伦敦的悬疑推理故事，玩家扮演侦探调查一起神秘的连环谋杀案。', 5, 8, 240, 'REASONING', 'NORMAL', 'PUBLIC', '1888年的伦敦笼罩在迷雾之中，白教堂区发生了一连串令人发指的凶杀案...', 3, 'ACTIVE', 15, 8.5),
('诡秘之主', '克苏鲁风格的恐怖推理剧本，玩家们在一座古老庄园中遭遇不可名状的恐惧。', 4, 6, 300, 'HORROR', 'HARD', 'PUBLIC', '深夜的奥兹庄园矗立在悬崖边，传说庄园主人痴迷于神秘学研究...', 2, 'ACTIVE', 23, 7.8),
('樱花飘落时', '日式情感沉浸本，讲述一段跨越时代的爱情故事，感人至深。', 6, 7, 360, 'EMOTIONAL', 'NORMAL', 'PUBLIC', '昭和年间，樱花树下，一段被遗忘的约定...', 4, 'ACTIVE', 31, 9.2),
('星际迷航', '科幻题材的硬核推理本，玩家在太空飞船中破解密室杀人案。', 5, 7, 280, 'SCI_FI', 'EXPERT', 'PUBLIC', '公元2157年，星舰希望号在前往火星的途中发生了离奇命案...', 2, 'ACTIVE', 8, 7.5),
('长安十二时辰', '古风硬核推理本，盛唐背景，玩家在十二个时辰内破解长安城的惊天阴谋。', 6, 10, 480, 'ANCIENT', 'HARD', 'DM_ONLY', '大唐天宝三载，上元节前夕，长安城暗流涌动...', 5, 'ACTIVE', 42, 8.9),
('不眠之夜', '现代都市情感本，讲述都市男女在一夜之间发生的爱恨情仇。', 5, 9, 210, 'MODERN', 'EASY', 'PUBLIC', '霓虹闪烁的大都市，一场派对，一场意外...', 3, 'ACTIVE', 56, 8.1),
('小丑回魂', '恐怖欢乐本，恐怖元素与欢乐机制相结合，体验极致反差。', 6, 8, 270, 'HORROR', 'NORMAL', 'PUBLIC', '废弃的游乐园，消失的孩子们...', 2, 'ACTIVE', 18, 7.2),
('盗梦空间', '硬核烧脑推理本，多层梦境嵌套，考验玩家逻辑思维。', 4, 6, 320, 'SUSPENSE', 'EXPERT', 'DM_ONLY', '梦境与现实的边界逐渐模糊...', 4, 'ACTIVE', 12, 8.7);

INSERT INTO characters (script_id, name, gender, age_range, description, character_story, secret_info, character_trait, visibility_level, sort_order, is_killer) VALUES
(1, '侦探福尔摩斯', '男', '30-40', '睿智的私家侦探', '曾是苏格兰场的顾问', '其实一直在寻找失落的亲人', '冷静理性', 'PUBLIC', 1, 0),
(1, '医生华生', '男', '35-45', '退伍军医', '从阿富汗战场退役', '有不为人知的过去', '忠诚勇敢', 'PUBLIC', 2, 0),
(1, '艾琳艾德勒', '女', '25-35', '神秘的女歌手', '曾是国王的情人', '掌握着一个重要秘密', '聪慧狡黠', 'PUBLIC', 3, 1),
(1, '雷斯垂德探长', '男', '40-50', '苏格兰场探长', '兢兢业业的警察', '曾经犯过一个错误', '正直但固执', 'PUBLIC', 4, 0),
(1, '莫里亚蒂教授', '男', '40-50', '数学教授', '犯罪界的拿破仑', '是一切的幕后黑手', '邪恶天才', 'SECRET', 5, 1),
(1, '哈德森太太', '女', '50-60', '贝克街房东', '和蔼的老太太', '隐藏着自己的秘密', '慈祥幽默', 'PUBLIC', 6, 0),
(1, '玛丽莫斯坦', '女', '20-30', '委托人', '神秘的委托人', '有一段不为人知的经历', '温柔坚强', 'PUBLIC', 7, 0),
(1, '格雷格森警官', '男', '30-40', '苏格兰场警官', '年轻有为的警官', '急于破案的野心家', '年轻气盛', 'PUBLIC', 8, 0),
(2, '庄园主艾德蒙', '男', '45-55', '奥兹庄园主人', '痴迷神秘学', '与邪神做了交易', '疯狂执着', 'PUBLIC', 1, 0),
(2, '夫人伊莎贝拉', '女', '35-45', '庄园女主人', '美丽的贵妇人', '知道丈夫的秘密', '优雅神秘', 'PUBLIC', 2, 1),
(2, '管家托马斯', '男', '50-60', '老管家', '服务了家族三代', '目睹了太多秘密', '沉默寡言', 'PUBLIC', 3, 0),
(2, '画家文森特', '男', '25-35', '来访画家', '受邀来庄园写生', '有特殊目的', '艺术家气质', 'PUBLIC', 4, 0),
(2, '女仆露西', '女', '18-25', '年轻女仆', '新来的女仆', '真实身份是调查者', '胆小好奇', 'PUBLIC', 5, 0),
(2, '医生亨利', '男', '35-45', '家庭医生', '庄园的私人医生', '有医疗事故', '专业冷静', 'PUBLIC', 6, 0),
(3, '樱井美咲', '女', '20-25', '花店女孩', '在樱花树下等待', '患了不治之症', '温柔善良', 'PUBLIC', 1, 0),
(3, '佐藤健一', '男', '25-30', '年轻画家', '来到小镇写生', '来寻找过去的记忆', '忧郁才华', 'PUBLIC', 2, 0),
(3, '老奶奶田中', '女', '60-70', '神社巫女', '守护着古老的传说', '知道一切真相', '慈祥神秘', 'PUBLIC', 3, 0),
(3, '小岛阳太', '男', '20-25', '咖啡馆店员', '美咲的青梅竹马', '一直默默守护着美咲', '阳光开朗', 'PUBLIC', 4, 0),
(3, '中村由美', '女', '25-30', '东京来的记者', '来小镇采访', '是健一的未婚妻', '现代独立', 'PUBLIC', 5, 1),
(3, '山本老师', '男', '50-60', '退休教师', '小镇上的智者', '知道往事', '博学多识', 'PUBLIC', 6, 0),
(3, '铃子', '女', '10-15', '神秘的小女孩', '总是在樱花树下出现', '是过去的幽灵', '纯真可爱', 'SECRET', 7, 0);

INSERT INTO stages (script_id, stage_order, name, description, duration_minutes, stage_goal, visibility_level, dm_hint, event_trigger) VALUES
(1, 1, '初到伦敦', '玩家们收到邀请函来到贝克街221B', 30, '自我介绍，了解案件背景', 'PUBLIC', '引导玩家快速带入角色', '案件介绍'),
(1, 2, '第一起命案', '白教堂发生第一起凶杀案', 45, '调查第一起命案现场', 'PUBLIC', '注意引导玩家关注细节', '发现尸体'),
(1, 3, '线索收集', '走访相关人士，收集线索', 60, '收集足够的线索', 'DM_ONLY', '控制线索释放节奏', '线索发放'),
(1, 4, '第二起命案', '第二起谋杀案发生', 45, '分析两起案件的关联', 'PUBLIC', '制造紧张感', '第二具尸体'),
(1, 5, '真相推演', '玩家们讨论推理', 40, '推出凶手身份', 'PUBLIC', '引导逻辑推理', '集中讨论'),
(1, 6, '真相大白', '公布真相，结局演绎', 20, '故事结局', 'SECRET', '准备结局演绎', '结局揭晓'),
(2, 1, '抵达庄园', '玩家们受邀来到奥兹庄园', 30, '角色介绍，氛围营造', 'PUBLIC', '营造恐怖氛围', '庄园大门'),
(2, 2, '晚宴', '庄园晚宴', 40, '互相认识，暗流涌动', 'PUBLIC', '铺垫伏笔', '晚宴开始'),
(2, 3, '第一夜', '第一个夜晚发生怪事', 50, '探索庄园', 'DM_ONLY', '恐怖元素渐入', '夜半钟声'),
(2, 4, '失踪', '有人失踪了', 45, '寻找失踪的人', 'PUBLIC', '增加紧张感', '有人失踪'),
(2, 5, '真相', '发现真相', 35, '揭开庄园秘密', 'SECRET', '高潮部分', '真相揭露'),
(2, 6, '结局', '最终结局', 20, '结局演绎', 'SECRET', '多重结局', '结局'),
(3, 1, '初遇', '樱花树下的初次相遇', 30, '角色登场', 'PUBLIC', '浪漫开场', '樱花飘落'),
(3, 2, '相知', '逐渐熟悉彼此', 50, '感情升温', 'PUBLIC', '情感铺垫', '花火大会'),
(3, 3, '变故', '发生了意想不到的事', 60, '剧情转折', 'PUBLIC', '情感高潮', '秘密揭露'),
(3, 4, '分离', '被迫分离', 45, '情感爆发', 'PUBLIC', '虐心部分', '离别'),
(3, 5, '真相', '多年后的真相', 40, '揭开所有秘密', 'SECRET', '情感升华', '真相大白'),
(3, 6, '结局', '樱花树下的结局', 25, '结局演绎', 'SECRET', '情感收尾', '结局');

INSERT INTO clues (script_id, stage_id, title, content, clue_level, trigger_type, trigger_condition, trigger_time_minutes, visibility_level, is_key_clue, sort_order, dm_note) VALUES
(1, 2, '金色头发', '现场发现了一缕金色的头发', 1, 'LOCATION', '犯罪现场', NULL, 'PUBLIC', 0, 1, '引导玩家注意头发颜色'),
(1, 2, '刻字怀表', '一块刻着字母M的怀表', 2, 'TIME', NULL, 15, 'DM_ONLY', 1, 2, '重要线索'),
(1, 3, '神秘信件', '一封寄给艾琳的神秘信件', 2, 'EVENT', '走访艾琳', NULL, 'DM_ONLY', 0, 3, '涉及人物关系'),
(1, 3, '旧报纸', '报道过去的一起旧案', 1, 'LOCATION', '图书馆', NULL, 'PUBLIC', 0, 4, '背景补充'),
(1, 4, '女士鞋印', '现场的女士皮鞋脚印', 2, 'LOCATION', '第二现场', NULL, 'PUBLIC', 1, 5, '指向女性凶手'),
(1, 5, '教授日记', '莫里亚蒂的日记', 3, 'EVENT', '搜查书房', NULL, 'SECRET', 1, 6, '关键证据'),
(2, 2, '诡异油画', '一幅诡异的油画', 1, 'LOCATION', '走廊', NULL, 'PUBLIC', 0, 1, '氛围道具'),
(2, 3, '庄园主日记', '庄园主的日记', 2, 'TIME', NULL, 20, 'DM_ONLY', 1, 2, '关键线索'),
(2, 3, '神秘符文', '墙上的神秘符文', 1, 'EVENT', '探索地下室', NULL, 'SECRET', 1, 3, '克苏鲁元素'),
(2, 4, '书房血迹', '书房的血迹', 2, 'LOCATION', '书房', NULL, 'PUBLIC', 0, 4, '引导调查'),
(2, 5, '邪神契约', '与邪神的契约书', 3, 'EVENT', '进入密室', NULL, 'SECRET', 1, 5, '真相核心'),
(3, 2, '旧情书', '一封旧情书', 1, 'LOCATION', '神社', NULL, 'DM_ONLY', 0, 1, '情感线索'),
(3, 3, '神秘病历', '神秘的病历本', 2, 'TIME', NULL, 30, 'DM_ONLY', 1, 2, '关键秘密'),
(3, 4, '老照片', '一张老照片', 2, 'EVENT', '遇到老奶奶', NULL, 'PUBLIC', 0, 3, '回忆杀'),
(3, 5, '美咲日记', '美咲的日记', 3, 'EVENT', '找到日记', NULL, 'SECRET', 1, 4, '情感核心');

INSERT INTO sessions (script_id, dm_id, status, start_time, room_number, max_players, current_players_count, difficulty_factor, deposit_amount, price_per_person) VALUES
(1, 3, 'COMPLETED', '2024-12-20 14:00:00', 'A101', 6, 6, 1.0, 50, 128),
(2, 4, 'PLAYING', '2024-12-25 19:00:00', 'B201', 5, 5, 1.2, 80, 158),
(3, 3, 'MATCHING', '2024-12-31 13:00:00', 'C301', 7, 4, 1.0, 60, 188),
(5, 4, 'NOT_STARTED', '2025-01-01 10:00:00', 'A102', 8, 0, 1.5, 100, 228),
(6, 3, 'REVIEWING', '2024-12-24 20:00:00', 'D401', 6, 6, 1.0, 50, 108);

INSERT INTO bookings (session_id, player_id, status, deposit_paid, booking_time) VALUES
(1, 5, 'COMPLETED', 50, '2024-12-15 10:00:00'),
(1, 6, 'COMPLETED', 50, '2024-12-15 11:00:00'),
(1, 7, 'COMPLETED', 50, '2024-12-16 09:00:00'),
(2, 5, 'CONFIRMED', 80, '2024-12-20 14:00:00'),
(2, 6, 'CONFIRMED', 80, '2024-12-20 15:00:00'),
(3, 7, 'CONFIRMED', 60, '2024-12-25 16:00:00'),
(3, 5, 'CONFIRMED', 60, '2024-12-26 10:00:00'),
(3, 6, 'PENDING', 60, '2024-12-27 11:00:00'),
(5, 7, 'CONFIRMED', 50, '2024-12-23 09:00:00'),
(5, 5, 'CONFIRMED', 50, '2024-12-23 10:00:00'),
(5, 6, 'NO_SHOW', 50, '2024-12-23 11:00:00');

INSERT INTO reviews (session_id, script_id, player_id, script_rating, dm_professionalism, character_fit, overall_experience, story_rating, puzzle_difficulty_rating, atmosphere_rating, is_anonymous, comment, would_recommend, emotional_tags) VALUES
(1, 1, 5, 8, 9, 7, 8, 8, 7, 9, 1, '推理过程很精彩，DM控场很棒！', 1, '烧脑,惊喜'),
(1, 1, 6, 9, 8, 9, 9, 9, 6, 8, 0, '情感线也太感人了...', 1, '感动,回味'),
(1, 1, 7, 7, 9, 6, 8, 7, 8, 7, 1, '难度适中，氛围不错', 1, '紧张'),
(5, 5, 5, 9, 10, 8, 9, 10, 9, 9, 1, '盛唐风华，太赞了！', 1, '震撼,沉浸'),
(5, 5, 7, 10, 9, 9, 10, 9, 10, 10, 0, '十二个时辰的紧张感太棒了', 1, '紧张,过瘾');

INSERT INTO dm_schedules (dm_id, session_id, schedule_date, start_time, end_time, shift_type, commission_amount, difficulty_coefficient, player_count, base_salary, total_earnings, is_paid, status) VALUES
(3, 1, '2024-12-20', '14:00:00', '18:30:00', 'AFTERNOON', 230, 1.0, 6, 100, 330, 1, 'COMPLETED'),
(4, 2, '2024-12-25', '19:00:00', '00:30:00', 'NIGHT', 284, 1.2, 5, 150, 434, 0, 'IN_PROGRESS'),
(3, 3, '2024-12-31', '13:00:00', '19:30:00', 'AFTERNOON', 0, 1.0, 4, 100, 100, 0, 'SCHEDULED'),
(3, 5, '2024-12-24', '20:00:00', '04:00:00', 'NIGHT', 264, 1.0, 6, 150, 414, 0, 'COMPLETED'),
(4, 4, '2025-01-01', '10:00:00', '18:00:00', 'MORNING', 0, 1.5, 0, 120, 120, 0, 'SCHEDULED');

INSERT INTO deposits (booking_id, player_id, session_id, amount, status, payment_method) VALUES
(4, 5, 2, 80, 'HELD', 'WECHAT'),
(5, 6, 2, 80, 'HELD', 'ALIPAY'),
(6, 7, 3, 60, 'HELD', 'WECHAT'),
(7, 5, 3, 60, 'HELD', 'ALIPAY'),
(11, 6, 5, 50, 'FORFEITED', 'WECHAT');

INSERT INTO purchases (script_name, script_description, author, publisher, player_count, estimated_duration, genre, difficulty, purchase_price, sample_content, status, submitter_id, reviewer_1_id, reviewer_1_score, reviewer_1_comment, reviewer_2_id, reviewer_2_score, reviewer_2_comment, average_score, passing_score) VALUES
('迷雾小镇', '一个发生在迷雾小镇的悬疑故事', '张三', '某某工作室', '5-7人', '4-5小时', '恐怖/推理', '硬核', 598, '第一章：迷雾中的小镇...', 'PENDING_REVIEW', 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 60),
('深海恐惧', '深海题材的恐怖本', '李四', '深海工作室', '4-6人', '3-4小时', '恐怖', '中等', 458, '深海中的恐惧...', 'APPROVED', 4, 3, 85, '恐怖氛围很好', 4, 78, '还不错', 81.5, 60),
('时间迷宫', '时间循环题材的推理本', '王五', '时间工作室', '6-8人', '5-6小时', '悬疑', '烧脑', 688, '循环的一天...', 'CANDIDATE_POOL', 3, 3, 55, '有点复杂', 4, 62, '还行吧', NULL, 60);
