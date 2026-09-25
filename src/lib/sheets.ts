import { google } from 'googleapis';
import { AttendanceStatus } from '@/types';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth;
}

export async function updateAttendanceInSheet(params: {
  subjectCode: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  studentRollNo: string;
  studentName: string;
  status: AttendanceStatus;
}) {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const sheetTitle = `${params.subjectCode}`;

    // 1. Get or create the sheet tab for this subject
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

    if (!existingSheets.includes(sheetTitle)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetTitle },
            },
          }],
        },
      });

      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [['Roll No', 'Name', params.date]] },
      });
    }

    // 2. Read current data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!A:ZZ`,
    });

    const rows = res.data.values || [['Roll No', 'Name']];
    const headerRow = rows[0];

    // Find or add date column
    let dateColIndex = headerRow.indexOf(params.date);
    if (dateColIndex === -1) {
      headerRow.push(params.date);
      dateColIndex = headerRow.length - 1;
    }

    // Find or add student row
    let studentRowIndex = rows.findIndex((row, i) => i > 0 && row[0] === params.studentRollNo);
    if (studentRowIndex === -1) {
      rows.push([params.studentRollNo, params.studentName]);
      studentRowIndex = rows.length - 1;
    }

    // Ensure row is long enough
    while (rows[studentRowIndex].length <= dateColIndex) {
      rows[studentRowIndex].push('—');
    }

    rows[studentRowIndex][dateColIndex] = params.status;

    // 3. Write back
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetTitle}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });

    return { success: true };
  } catch (err) {
    console.error('Google Sheets sync error:', err);
    return { success: false, error: err };
  }
}
