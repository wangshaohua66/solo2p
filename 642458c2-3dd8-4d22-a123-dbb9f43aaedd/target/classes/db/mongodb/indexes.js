use notarization_db;

db.notarization_cases.createIndex({ caseNumber: 1 }, { unique: true, name: "idx_case_number_unique" });
db.notarization_cases.createIndex({ caseType: 1 }, { name: "idx_case_type" });
db.notarization_cases.createIndex({ status: 1 }, { name: "idx_status" });
db.notarization_cases.createIndex({ hallId: 1 }, { name: "idx_hall_id" });
db.notarization_cases.createIndex({ applicantName: "text", applicantIdCard: "text", caseNumber: "text" }, { name: "idx_applicant_text_search" });
db.notarization_cases.createIndex({ assignedNotaryId: 1 }, { name: "idx_assigned_notary" });
db.notarization_cases.createIndex({ assignedReviewerId: 1 }, { name: "idx_assigned_reviewer" });
db.notarization_cases.createIndex({ verificationCode: 1 }, { unique: true, sparse: true, name: "idx_verification_code_unique" });
db.notarization_cases.createIndex({ createdAt: -1 }, { name: "idx_created_at_desc" });
db.notarization_cases.createIndex({ status: 1, assignedNotaryId: 1, createdAt: 1 }, { name: "idx_status_notary_created" });

db.evidence_records.createIndex({ evidenceNumber: 1 }, { unique: true, name: "idx_evidence_number_unique" });
db.evidence_records.createIndex({ caseId: 1 }, { name: "idx_evidence_case_id" });
db.evidence_records.createIndex({ submitterId: 1 }, { name: "idx_evidence_submitter_id" });
db.evidence_records.createIndex({ evidenceType: 1 }, { name: "idx_evidence_type" });
db.evidence_records.createIndex({ chainId: 1 }, { name: "idx_evidence_chain_id" });
db.evidence_records.createIndex({ timestamp: -1 }, { name: "idx_evidence_timestamp_desc" });
db.evidence_records.createIndex({ hashIndex: 1 }, { name: "idx_hash_index" });

db.hash_chains.createIndex({ chainId: 1 }, { unique: true, name: "idx_hash_chain_id_unique" });
db.hash_chains.createIndex({ caseId: 1 }, { unique: true, sparse: true, name: "idx_hash_chain_case_id" });

db.users.createIndex({ username: 1 }, { unique: true, name: "idx_username_unique" });
db.users.createIndex({ role: 1, available: 1 }, { name: "idx_role_available" });
db.users.createIndex({ role: 1, available: 1, hallId: 1 }, { name: "idx_role_available_hall" });

db.translation_records.createIndex({ caseId: 1 }, { name: "idx_translation_case_id" });
db.translation_records.createIndex({ translatorId: 1 }, { name: "idx_translator_id" });
db.translation_records.createIndex({ materialId: 1 }, { name: "idx_translation_material_id" });

db.access_requests.createIndex({ caseId: 1 }, { name: "idx_access_case_id" });
db.access_requests.createIndex({ fromHallId: 1, toHallId: 1 }, { name: "idx_access_halls" });
db.access_requests.createIndex({ applicantId: 1 }, { name: "idx_access_applicant" });
db.access_requests.createIndex({ status: 1 }, { name: "idx_access_status" });

db.statistic_records.createIndex({ periodType: 1, startDate: 1 }, { unique: true, name: "idx_stat_period_unique" });
db.statistic_records.createIndex({ recordType: 1 }, { name: "idx_stat_record_type" });

db.access_tokens.createIndex({ token: 1 }, { unique: true, name: "idx_token_unique" });
db.access_tokens.createIndex({ userId: 1 }, { name: "idx_token_user_id" });
db.access_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "idx_token_expire_ttl" });
