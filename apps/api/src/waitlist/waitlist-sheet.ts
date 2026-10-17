import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as ExcelJS from 'exceljs';

/** One waitlist signup as it appears in the Excel file. */
export interface SheetRow {
  joinedAt: Date;
  name: string;
  email: string;
  phone: string | null;
  interests: string[];
  shoes: string[];
  source: string;
  unsubscribed: boolean;
}

const COLUMNS = [
  { header: 'Joined (IST)', key: 'joined', width: 22 },
  { header: 'Name', key: 'name', width: 26 },
  { header: 'Email', key: 'email', width: 34 },
  { header: 'Phone', key: 'phone', width: 18 },
  { header: 'Interests', key: 'interests', width: 30 },
  { header: 'Shoes they want', key: 'shoes', width: 34 },
  { header: 'Source', key: 'source', width: 16 },
  { header: 'Unsubscribed', key: 'unsub', width: 14 },
];

function cells(r: SheetRow) {
  return {
    joined: r.joinedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }),
    name: r.name,
    email: r.email,
    // Text, so Excel keeps a leading + or 0 instead of turning the number into 9.1999E+11.
    phone: r.phone ?? '',
    interests: r.interests.join(', '),
    shoes: r.shoes.join(', '),
    source: r.source,
    unsub: r.unsubscribed ? 'yes' : '',
  };
}

function prepare(ws: ExcelJS.Worksheet) {
  ws.columns = COLUMNS;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.getColumn('phone').numFmt = '@';
}

/** Writes the whole file from scratch (used on first start, after a failed write, and by the export script). */
export async function writeWorkbook(path: string, rows: SheetRow[]): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Waitlist');
  prepare(ws);
  for (const r of rows) ws.addRow(cells(r));
  await wb.xlsx.writeFile(path);
}

/** Adds one row to the existing file (creating it with the header if it is not there yet). */
export async function appendRow(path: string, row: SheetRow): Promise<void> {
  if (!existsSync(path)) return writeWorkbook(path, [row]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet('Waitlist') ?? wb.addWorksheet('Waitlist');
  prepare(ws);
  ws.addRow(cells(row));
  await wb.xlsx.writeFile(path);
}
