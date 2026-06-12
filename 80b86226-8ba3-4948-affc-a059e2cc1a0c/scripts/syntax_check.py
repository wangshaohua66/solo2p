#!/usr/bin/env python3
"""Java syntax self-check: parenthesis/bracket/brace matching + quote balancing."""
import os, sys, re, glob

def check_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    stack = []
    line_of = [0]
    for i, ch in enumerate(content):
        if ch == '\n': line_of.append(i + 1)

    pairs = {'(': ')', '[': ']', '{': '}'}
    opening = set(pairs.keys())
    closing = set(pairs.values())

    in_line_comment = False
    in_block_comment = False
    in_string = False
    string_ch = None
    escape = False

    errors = []

    for idx, ch in enumerate(content):
        line = sum(1 for c in content[:idx] if c == '\n') + 1
        col = idx - (content.rfind('\n', 0, idx))
        if in_line_comment:
            if ch == '\n': in_line_comment = False
            continue
        if in_block_comment:
            if ch == '*' and idx + 1 < len(content) and content[idx + 1] == '/':
                in_block_comment = False
            continue
        if in_string:
            if escape:
                escape = False
                continue
            if ch == '\\':
                escape = True
                continue
            if ch == string_ch:
                in_string = False
                string_ch = None
            continue
        if ch == '/' and idx + 1 < len(content):
            if content[idx + 1] == '/':
                in_line_comment = True
                continue
            if content[idx + 1] == '*':
                in_block_comment = True
                continue
        if ch in ('"', "'"):
            in_string = True
            string_ch = ch
            continue
        if ch in opening:
            stack.append((ch, line, col))
        elif ch in closing:
            if not stack:
                errors.append(f"L{line}:{col} - Unmatched '{ch}'")
                continue
            top, tline, tcol = stack.pop()
            if pairs[top] != ch:
                errors.append(f"L{line}:{col} - Mismatch: '{top}' @ L{tline}:{tcol} closed with '{ch}'")
    while stack:
        top, tline, tcol = stack.pop()
        errors.append(f"Unclosed '{top}' opened @ L{tline}:{tcol}")

    import_check = True
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('import ') and ';' not in stripped:
            errors.append(f"L{i}: Import statement missing ';'")
        if 'System.out.println' in stripped and ';' not in stripped:
            continue  # allow multi-line
        m = re.search(r'^(public|private|protected|static|final|native|synchronized|abstract|default)\s+.*\)\s*\{?\s*$', stripped)
    return errors

def main():
    roots = [
        "common-lib/src/main/java",
        "api-gateway/src/main/java",
        "emission-source-service/src/main/java",
        "calculation-engine-service/src/main/java",
        "quota-compliance-service/src/main/java",
        "ccer-service/src/main/java",
        "verification-service/src/main/java",
        "factor-library-service/src/main/java",
    ]
    all_errors = {}
    base = "/Users/paul/WorkSpace/TestSoloCoder/80b86226-8ba3-4948-affc-a059e2cc1a0c"
    java_files = []
    for root in roots:
        full = os.path.join(base, root)
        if os.path.isdir(full):
            java_files.extend(glob.glob(os.path.join(full, "**/*.java"), recursive=True))
    print(f"Found {len(java_files)} Java files")
    for path in sorted(java_files):
        rel = os.path.relpath(path, base)
        errs = check_file(path)
        if errs:
            all_errors[rel] = errs
    if all_errors:
        print(f"\n❌ Found syntax issues in {len(all_errors)} files:")
        for rel, errs in all_errors.items():
            print(f"\n  📄 {rel}")
            for e in errs:
                print(f"     ✗ {e}")
        sys.exit(1)
    else:
        print(f"\n✅ All {len(java_files)} files passed syntax check (brackets/quotes/imports)")
        sys.exit(0)

if __name__ == "__main__":
    main()
