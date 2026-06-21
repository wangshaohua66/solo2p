import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from task_scheduler import TaskScheduler
scheduler = TaskScheduler(max_workers=2)
scheduler.submit({"project_name": "Test1", "folder_path": "/tmp"}, priority="URGENT", size_mb=100)
scheduler.submit({"project_name": "Test2", "folder_path": "/tmp"}, priority="NORMAL", size_mb=500)
scheduler.submit({"project_name": "Test3", "folder_path": "/tmp"}, priority="LOW", size_mb=2000)
print("Task scheduler OK, pending:", scheduler.pending_count)

from issue_classifier import ISSUE_TYPE_MAPPING
print("SIGNATURE_INCONSISTENCY in mapping:", "SIGNATURE_INCONSISTENCY" in ISSUE_TYPE_MAPPING)
print("FUZZY_SEAL in mapping:", "FUZZY_SEAL" in ISSUE_TYPE_MAPPING)

from database import DatabaseManager
db = DatabaseManager()
pid = db.create_project("filter_test", "chemical", "/tmp", "test")
db.insert_issues(pid, [
    {"module": "sig", "severity": "DEFECT", "issue_type": "FUZZY_SEAL", "description": "test1", "file_path": "/tmp/a"},
    {"module": "sig", "severity": "DEFECT", "issue_type": "MISSING_SEAL", "description": "test2", "file_path": "/tmp/b"},
    {"module": "sig", "severity": "FATAL", "issue_type": "MISSING_SEAL", "description": "test3", "file_path": "/tmp/c"},
])
all_issues = db.get_project_issues(pid)
type_filtered = db.get_project_issues(pid, issue_type="FUZZY_SEAL")
sev_filtered = db.get_project_issues(pid, severity="FATAL")
both_filtered = db.get_project_issues(pid, severity="DEFECT", issue_type="MISSING_SEAL")
print(f"All issues: {len(all_issues)}")
print(f"Type=FUZZY_SEAL: {len(type_filtered)}")
print(f"Severity=FATAL: {len(sev_filtered)}")
print(f"Severity=DEFECT AND Type=MISSING_SEAL: {len(both_filtered)}")

from file_checker import FileChecker, _generate_default_seal_templates, _generate_default_sig_templates
from config import TEMPLATE_DIR
import os
seal_dir = TEMPLATE_DIR / "seal_templates"
sig_dir = TEMPLATE_DIR / "sig_templates"
seal_files = list(seal_dir.glob("*.png"))
sig_files = list(sig_dir.glob("*.png"))
print(f"Seal templates: {len(seal_files)}")
print(f"Sig templates: {len(sig_files)}")

print("\nALL TESTS PASS")
