import re

path = 'src/app/api/teacher/classes/route.ts'
with open(path, 'r') as file:
    content = file.read()

target = "const { subjectId, method } = await req.json();"
replacement = "const { subjectId, method, latitude, longitude } = await req.json();"
# Wait, I previously did:
# target = "const { subjectId, method } = await req.json();"
# Wait, let me check the file content first.
