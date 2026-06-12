/**
 * MongoDB Migration Script v1.1
 * Description: CcerTransfer schema migration
 *  - add projectCode field for all tenants (carbon_{tenantId})
 *  - add tenant_project_idx compound index
 *  - backfill projectCode for existing records using projectCode from CcerProject (if available)
 *
 * Execution:
 *   mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0" \
 *     --username=root --password=changeme --authenticationDatabase=admin \
 *     scripts/mongo-migrate-v1.1-ccer-transfer-projectCode.js
 *
 * Rollback:
 *   db.ccer_transfers.dropIndex("tenant_project_idx");
 *   db.ccer_transfers.updateMany({}, [{$unset: "projectCode"}]);
 */

// 1. Gather all tenant databases (prefix = "carbon_")
const adminDb = db.getSiblingDB("admin");
const allDbs = adminDb.runCommand({ listDatabases: 1 }).databases
  .map(d => d.name)
  .filter(name => name.startsWith("carbon_"));

print(`Found ${allDbs.length} tenant databases: ` + allDbs.join(", "));

allDbs.forEach(dbName => {
  print(`\n====== Processing: ${dbName} ======`);
  const tdb = db.getSiblingDB(dbName);
  const col = tdb.ccer_transfers;

  if (!col) {
    print("  [SKIP] ccer_transfers collection not found");
    return;
  }

  // 2. Backfill projectCode: copy from projectCode field of linked CcerProject (if available)
  try {
    if (tdb.ccer_projects) {
      const projectMap = {};
      tdb.ccer_projects.find({ projectCode: { $exists: true } }, { projectCode: 1 }).forEach(p => {
        if (p.projectCode) projectMap[p._id] = p.projectCode;
      });
      const linked = Object.keys(projectMap).length;
      if (linked > 0) {
        let backfilled = 0;
        Object.entries(projectMap).forEach(([pid, code]) => {
          const r = col.updateMany(
            { projectId: pid, projectCode: { $exists: false } },
            { $set: { projectCode: code } }
          );
          backfilled += r.modifiedCount || 0;
        });
        print(`  [BACKFILL] linked=${linked}, records updated=${backfilled}`);
      }
    }
  } catch (e) {
    print("  [WARN] backfill skipped: " + e.message);
  }

  // 3. Ensure projectCode exists for all records (fallback = projectId)
  const r1 = col.updateMany(
    { $or: [{ projectCode: { $exists: false } }, { projectCode: null }] },
    [{ $set: { projectCode: { $ifNull: ["$projectCode", "$projectId"] } } }],
    { multi: true }
  );
  print(`  [DEFAULT] records filled projectCode=projectId where missing: ${r1.modifiedCount || 0}`);

  // 4. Create compound index tenant_project_idx
  try {
    col.createIndex(
      { tenantId: 1, projectId: 1, projectCode: 1 },
      { name: "tenant_project_idx", background: true }
    );
    print("  [INDEX] created tenant_project_idx");
  } catch (e) {
    print("  [WARN] index creation: " + e.message);
  }
});

print("\n=== Migration v1.1 completed ===");
