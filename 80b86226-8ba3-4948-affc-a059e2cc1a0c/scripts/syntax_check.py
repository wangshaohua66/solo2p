#!/usr/bin/env python3
"""Java type check via javac. Replaces character-level parenthesis matching with real compiler type checking."""
import os
import sys
import glob
import subprocess
import tempfile
import shutil

JAVA_VERSION = "17"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODULES = [
    "common-lib",
    "api-gateway",
    "emission-source-service",
    "calculation-engine-service",
    "quota-compliance-service",
    "ccer-service",
    "verification-service",
    "factor-library-service",
]

SOURCE_ROOTS = [os.path.join(BASE_DIR, m, "src", "main", "java") for m in MODULES]
TEST_ROOTS = [os.path.join(BASE_DIR, m, "src", "test", "java") for m in MODULES]


def find_javac():
    """Find javac executable, prefer JDK 17."""
    javac = shutil.which("javac")
    if javac:
        try:
            r = subprocess.run([javac, "-version"], capture_output=True, text=True)
            version_output = r.stderr.strip()
            if JAVA_VERSION in version_output or version_output.startswith(f"javac {JAVA_VERSION}"):
                return javac
        except Exception:
            pass

    java_home = os.environ.get("JAVA_HOME")
    if java_home:
        candidate = os.path.join(java_home, "bin", "javac")
        if os.path.exists(candidate):
            return candidate

    for root in ["/Library/Java/JavaVirtualMachines", "/usr/lib/jvm", "/opt/java"]:
        if not os.path.isdir(root):
            continue
        for d in os.listdir(root):
            if JAVA_VERSION in d:
                candidate = os.path.join(root, d, "Contents", "Home", "bin", "javac")
                if os.path.exists(candidate):
                    return candidate
                candidate = os.path.join(root, d, "bin", "javac")
                if os.path.exists(candidate):
                    return candidate

    return None


def get_maven_classpath(module):
    """Get classpath via mvn dependency:build-classpath."""
    mvn = shutil.which("mvn") or shutil.which("mvnw")
    if not mvn:
        return None

    module_dir = os.path.join(BASE_DIR, module)
    if not os.path.isdir(module_dir):
        return None

    try:
        r = subprocess.run(
            [mvn, "dependency:build-classpath", "-q", "-DincludeScope=compile",
             "-Dmdep.outputFile=/dev/stdout"],
            capture_output=True, text=True, cwd=module_dir, timeout=120
        )
        if r.returncode == 0:
            cp = r.stdout.strip()
            target_classes = os.path.join(module_dir, "target", "classes")
            if os.path.exists(target_classes):
                cp = target_classes + os.pathsep + cp
            return cp
    except Exception as e:
        print(f"⚠️  Failed to get classpath for {module}: {e}", file=sys.stderr)
    return None


def collect_java_files(roots):
    """Collect all .java files from source roots."""
    files = []
    for root in roots:
        if os.path.isdir(root):
            files.extend(glob.glob(os.path.join(root, "**", "*.java"), recursive=True))
    return sorted(files)


def run_javac(javac, java_files, classpath=None, output_dir=None):
    """Run javac type checking on the given files."""
    if not java_files:
        return 0, "", ""

    cmd = [
        javac,
        "-Xlint:all",
        "-proc:none",
        "-nowarn",
        "-source", JAVA_VERSION,
        "-target", JAVA_VERSION,
        "--release", JAVA_VERSION,
    ]

    if classpath:
        cmd.extend(["-cp", classpath])

    if output_dir:
        cmd.extend(["-d", output_dir])
    else:
        cmd.extend(["-d", "/tmp"])

    cmd.extend(java_files)

    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "javac timed out after 300 seconds"
    except Exception as e:
        return 1, "", f"Failed to run javac: {e}"


def parse_javac_errors(stderr, base_dir):
    """Parse javac stderr output into structured errors."""
    errors = []
    for line in stderr.split("\n"):
        line = line.strip()
        if not line or line.startswith("Note:") or line.startswith("warning:"):
            continue
        if ".java:" in line:
            rel_path = line
            if base_dir in rel_path:
                rel_path = os.path.relpath(line.split(":")[0], base_dir) + ":" + ":".join(line.split(":")[1:])
            errors.append(rel_path)
    return errors


def check_module(javac, module):
    """Type-check a single module via javac."""
    print(f"\n🔍 Checking module: {module}")

    src_root = os.path.join(BASE_DIR, module, "src", "main", "java")
    if not os.path.isdir(src_root):
        print(f"  ⏭️  Source root not found, skipping")
        return []

    java_files = collect_java_files([src_root])
    if not java_files:
        print(f"  ⏭️  No Java files found")
        return []

    print(f"  📄 Found {len(java_files)} Java files")

    classpath = get_maven_classpath(module)

    with tempfile.TemporaryDirectory(prefix=f"javac_{module}_") as tmpdir:
        returncode, stdout, stderr = run_javac(javac, java_files, classpath, tmpdir)

        if returncode == 0:
            print(f"  ✅ Type check passed")
            return []
        else:
            errors = parse_javac_errors(stderr, BASE_DIR)
            print(f"  ❌ Type check failed with {len(errors)} error(s)")
            for e in errors[:20]:
                print(f"     ✗ {e}")
            if len(errors) > 20:
                print(f"     ... and {len(errors) - 20} more")
            return errors


def main():
    javac = find_javac()
    if not javac:
        print(f"❌ javac (JDK {JAVA_VERSION}) not found. Please install JDK {JAVA_VERSION} or set JAVA_HOME.", file=sys.stderr)
        print(f"   Download: https://adoptium.net/temurin/releases/?version={JAVA_VERSION}", file=sys.stderr)
        sys.exit(1)

    try:
        r = subprocess.run([javac, "-version"], capture_output=True, text=True)
        print(f"🔧 Using {r.stderr.strip()} at {javac}")
    except Exception:
        print(f"🔧 Using javac at {javac}")

    all_errors = {}

    specific_files = sys.argv[1:] if len(sys.argv) > 1 else None

    if specific_files:
        java_files = [f for f in specific_files if f.endswith(".java") and os.path.isfile(f)]
        if not java_files:
            print("❌ No valid Java files specified", file=sys.stderr)
            sys.exit(1)

        print(f"🔍 Checking {len(java_files)} specified file(s)")
        returncode, stdout, stderr = run_javac(javac, java_files)
        errors = parse_javac_errors(stderr, BASE_DIR)

        if errors:
            print(f"\n❌ Type check failed:")
            for e in errors:
                print(f"  ✗ {e}")
            sys.exit(1)
        else:
            print(f"\n✅ All {len(java_files)} files passed type check")
            sys.exit(0)
    else:
        for module in MODULES:
            errs = check_module(javac, module)
            if errs:
                all_errors[module] = errs

        if all_errors:
            total = sum(len(v) for v in all_errors.values())
            print(f"\n❌ Type check failed with {total} error(s) in {len(all_errors)} module(s):")
            for module, errs in all_errors.items():
                print(f"\n  � {module} ({len(errs)} errors)")
            sys.exit(1)
        else:
            print(f"\n✅ All modules passed type check via javac")
            sys.exit(0)


if __name__ == "__main__":
    main()
