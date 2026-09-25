import re

path = 'src/app/api/attendance/mark/route.ts'
with open(path, 'r') as f:
    code = f.read()

# Replace studentId destructuring to include studentIds
code = code.replace("let { studentId, status, method, qrToken, otp, latitude, longitude, recordId, classId } = body;",
"""let { studentId, studentIds, status, method, qrToken, otp, latitude, longitude, recordId, classId } = body;
  
  // Workaround for DB constraint missing kiosk/ai_vision
  let dbMethod = method;
  if (method === 'kiosk' || method === 'ai_vision') dbMethod = 'manual';
""")

# Actually I already did the dbMethod workaround above. So let me do it carefully.
