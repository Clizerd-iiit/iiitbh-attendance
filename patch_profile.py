import re
path = 'src/app/profile/page.tsx'
with open(path, 'r') as f: code = f.read()

# Remove the setInterval
code = re.sub(r'const interval = setInterval\(fetchData, 5000\);\n\s*return \(\) => clearInterval\(interval\);\n', '', code)
# Also need to make sure the hook doesn't have other setIntervals
# Let's do it safer.

