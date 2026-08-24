import os
import sys

def walk_js(root):
    for dirpath, dirnames, filenames in os.walk(root):
        if 'node_modules' in dirnames:
            dirnames.remove('node_modules')
        for fn in filenames:
            if fn.endswith('.js'):
                yield os.path.join(dirpath, fn)

def check_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        s = f.read()
    braces = parens = brackets = 0
    in_single = in_double = in_back = False
    escaped = False
    for ch in s:
        if escaped:
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == "'" and not in_double and not in_back:
            in_single = not in_single
            continue
        if ch == '"' and not in_single and not in_back:
            in_double = not in_double
            continue
        if ch == '`' and not in_single and not in_double:
            in_back = not in_back
            continue
        if in_single or in_double or in_back:
            continue
        if ch == '{':
            braces += 1
        elif ch == '}':
            braces -= 1
        elif ch == '(':
            parens += 1
        elif ch == ')':
            parens -= 1
        elif ch == '[':
            brackets += 1
        elif ch == ']':
            brackets -= 1

    issues = []
    if braces != 0:
        issues.append(f'braces imbalance ({braces})')
    if parens != 0:
        issues.append(f'parens imbalance ({parens})')
    if brackets != 0:
        issues.append(f'brackets imbalance ({brackets})')
    if in_single or in_double or in_back:
        issues.append('unclosed string/backtick')
    # report presence of module syntax (may be fine in browser but not parseable by new Function)
    if 'export ' in s or 'import ' in s:
        issues.append('uses import/export (ES modules)')

    return issues

def main():
    root = os.getcwd()
    files = list(walk_js(root))
    print(f'Found {len(files)} JS files')
    total_issues = 0
    for f in files:
        issues = check_file(f)
        if issues:
            total_issues += 1
            print('ISSUES', os.path.relpath(f, root), '-', '; '.join(issues))
        else:
            print('OK    ', os.path.relpath(f, root))
    if total_issues:
        print(f'Found {total_issues} files with potential issues')
        sys.exit(1)
    print('No obvious structural issues found')

if __name__ == '__main__':
    main()
