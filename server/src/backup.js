// SQLite backups: consistent snapshot via VACUUM INTO under data/backups, with pruning; files/ is content-addressed and can be rsynced.
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';
import { audit } from './crypto.js';
const dir = () => path.join(config.dataDir, 'backups');
export function backupNow(by = '(system)') {
  fs.mkdirSync(dir(), { recursive: true });
  const name = 'cib-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite'; const file = path.join(dir(), name);
  db.exec("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
  const keep = Number(process.env.CIB_BACKUPS_KEEP || 14);
  const all = listBackups(); for (const b of all.slice(keep)) { try { fs.unlinkSync(path.join(dir(), b.name)); } catch (e) {} }
  audit(by, 'database backup written: ' + name + ' (' + fs.statSync(file).size + ' bytes)');
  return { name, size: fs.statSync(file).size, dir: dir() };
}
export function listBackups() { try { return fs.readdirSync(dir()).filter(f => f.endsWith('.sqlite')).map(f => ({ name: f, size: fs.statSync(path.join(dir(), f)).size, at: fs.statSync(path.join(dir(), f)).mtime.toISOString() })).sort((a, b) => b.at.localeCompare(a.at)); } catch (e) { return []; } }
export function startBackupScheduler() { const hours = Number(process.env.CIB_BACKUP_HOURS || 24); if (!hours) return; const h = setInterval(() => { try { backupNow(); } catch (e) { console.error('backup failed', e); } }, hours * 3600e3); h.unref(); }
