import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserProfileData {
  id: string;
  name: string;
  username?: string;
  password?: string;
  avatar: string;
  phone?: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  bannedReason?: string;
  coins: number;
  rating: number;
  level: number;
  lastCheckinDate: string;
  stats: Record<string, { played: number; won: number; highestScore: number }>;
  updatedAt?: number;
  registeredAt?: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  // If stored password is still legacy plaintext (6 digits), compare directly
  if (!stored.includes(':')) {
    return stored.trim() === String(password).trim();
  }
  try {
    const [salt, key] = stored.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 32);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export interface MatchRecordData {
  id: string;
  gameType: string;
  gameName: string;
  result: 'win' | 'lose' | 'draw';
  coinsDelta: number;
  ratingDelta: number;
  details: string;
  timestamp: string;
  updatedAt?: number;
}

export interface AdminLogData {
  id: string;
  action: string;
  operator: string;
  target: string;
  amount?: number;
  details: string;
  timestamp: string;
}

export interface SystemAnnouncementData {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'game_database.json');

export interface DatabaseSchema {
  profiles: Record<string, UserProfileData>;
  records: MatchRecordData[];
  authorizedPhones: string[];
  adminPhones: string[];
  adminLogs: AdminLogData[];
  systemAnnouncements: SystemAnnouncementData[];
}

const defaultDatabase: DatabaseSchema = {
  authorizedPhones: ['13800138000', '13900139000', '13700137000', '13600136000'],
  adminPhones: ['13800138000'],
  profiles: {
    'default': {
      id: 'USER-8888',
      name: '茗局雅客 (管理员)',
      username: 'admin',
      avatar: '🀄',
      phone: '13800138000',
      isAdmin: true,
      coins: 88888,
      rating: 2200,
      level: 6,
      lastCheckinDate: '',
      registeredAt: Date.now() - 86400000 * 10,
      stats: {
        yansan: { played: 38, won: 26, highestScore: 1650 },
        shisanshui: { played: 24, won: 18, highestScore: 48 },
        mahjong: { played: 65, won: 45, highestScore: 188 },
      },
    },
    'USER-2001': {
      id: 'USER-2001',
      name: '江南茶客',
      username: 'player_tea',
      avatar: '🍵',
      phone: '13900139000',
      isAdmin: false,
      coins: 16800,
      rating: 1980,
      level: 5,
      lastCheckinDate: '',
      registeredAt: Date.now() - 86400000 * 5,
      stats: {
        yansan: { played: 18, won: 10, highestScore: 820 },
        shisanshui: { played: 14, won: 9, highestScore: 22 },
        mahjong: { played: 25, won: 15, highestScore: 68 },
      },
    },
    'USER-2002': {
      id: 'USER-2002',
      name: '云游散人',
      username: 'player_cloud',
      avatar: '☁️',
      phone: '13700137000',
      isAdmin: false,
      coins: 12500,
      rating: 1890,
      level: 4,
      lastCheckinDate: '',
      registeredAt: Date.now() - 86400000 * 3,
      stats: {
        yansan: { played: 16, won: 11, highestScore: 760 },
        shisanshui: { played: 11, won: 7, highestScore: 18 },
        mahjong: { played: 19, won: 11, highestScore: 54 },
      },
    },
    'USER-2003': {
      id: 'USER-2003',
      name: '醉月居士',
      username: 'player_moon',
      avatar: '🌙',
      phone: '13600136000',
      isAdmin: false,
      coins: 9200,
      rating: 1910,
      level: 4,
      lastCheckinDate: '',
      registeredAt: Date.now() - 86400000 * 2,
      stats: {
        yansan: { played: 14, won: 9, highestScore: 690 },
        shisanshui: { played: 8, won: 5, highestScore: 16 },
        mahjong: { played: 15, won: 8, highestScore: 46 },
      },
    },
  },
  records: [
    {
      id: 'REC-101',
      gameType: 'shisanshui',
      gameName: '水镜十三水',
      result: 'win',
      coinsDelta: 680,
      ratingDelta: 30,
      details: '尾道同花顺中道葫芦打枪全胜',
      timestamp: '10:05',
    },
    {
      id: 'REC-102',
      gameType: 'yansan',
      gameName: '经典烟三',
      result: 'win',
      coinsDelta: 450,
      ratingDelta: 20,
      details: '方块四连环开路，率先出清',
      timestamp: '10:08',
    },
    {
      id: 'REC-103',
      gameType: 'mahjong',
      gameName: '经典国标麻将',
      result: 'win',
      coinsDelta: 880,
      ratingDelta: 40,
      details: '自摸万字清一色满贯',
      timestamp: '10:12',
    },
  ],
  adminLogs: [
    {
      id: 'log-init-1',
      action: 'SYSTEM_BOOT',
      operator: 'Telegram Admin',
      target: '全服',
      details: 'Telegram 管理员控制中枢已启动，白名单安全审查机制就绪',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ],
  systemAnnouncements: [
    {
      id: 'ann-init-1',
      text: '欢迎诸位茶客牌友！茶楼已接入 Telegram 机器人管理员防作弊与筹码调控中枢。',
      author: 'Telegram 总管',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ],
};

let dbCache: DatabaseSchema | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let pendingSave = false;

function ensureDbIntegrity(db: any): DatabaseSchema {
  if (!db.authorizedPhones || !Array.isArray(db.authorizedPhones) || db.authorizedPhones.length === 0) {
    db.authorizedPhones = ['13800138000', '13900139000', '13700137000', '13600136000'];
  }
  if (!db.adminPhones || !Array.isArray(db.adminPhones) || db.adminPhones.length === 0) {
    db.adminPhones = ['13800138000'];
  }
  if (!db.adminLogs || !Array.isArray(db.adminLogs)) {
    db.adminLogs = [...defaultDatabase.adminLogs];
  }
  if (!db.systemAnnouncements || !Array.isArray(db.systemAnnouncements)) {
    db.systemAnnouncements = [...defaultDatabase.systemAnnouncements];
  }
  if (!db.profiles) {
    db.profiles = {};
  }
  // Ensure default admin user and seed users exist, and cleanse deprecated game keys
  for (const [key, prof] of Object.entries(defaultDatabase.profiles)) {
    if (!db.profiles[key]) {
      db.profiles[key] = prof;
    }
  }

  // Cleanse legacy game records & stats
  if (Array.isArray(db.records)) {
    db.records = db.records.filter((r: any) => r.gameType === 'yansan' || r.gameType === 'shisanshui' || r.gameType === 'mahjong');
    if (db.records.length === 0) {
      db.records = [...defaultDatabase.records];
    }
  }

  for (const p of Object.values(db.profiles) as any[]) {
    if (p.stats) {
      delete p.stats.doudizhu;
      delete p.stats.chudadi;
      delete p.stats.paodekuai;
      if (!p.stats.yansan) p.stats.yansan = { played: 0, won: 0, highestScore: 0 };
      if (!p.stats.shisanshui) p.stats.shisanshui = { played: 0, won: 0, highestScore: 0 };
      if (!p.stats.mahjong) p.stats.mahjong = { played: 0, won: 0, highestScore: 0 };
    }
  }

  return db as DatabaseSchema;
}

export function loadDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      dbCache = ensureDbIntegrity(parsed);
      return dbCache;
    }
  } catch (err) {
    console.error('Failed reading database:', err);
  }
  dbCache = JSON.parse(JSON.stringify(defaultDatabase));
  flushDatabaseSync(dbCache!);
  return dbCache!;
}

export function flushDatabaseSync(data?: DatabaseSchema): void {
  const target = data || dbCache;
  if (!target) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(target, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    pendingSave = false;
  } catch (err) {
    console.error('Failed flushing database synchronously:', err);
  }
}

export function saveDatabase(data: DatabaseSchema): void {
  dbCache = data;
  pendingSave = true;

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!pendingSave || !dbCache) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      pendingSave = false;
    } catch (err) {
      console.error('Failed saving database asynchronously:', err);
    }
  }, 200);
}

export function recordAdminLog(
  action: string,
  operator: string,
  target: string,
  details: string,
  amount?: number
): void {
  const db = loadDatabase();
  const log: AdminLogData = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    operator,
    target,
    amount,
    details,
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  };
  db.adminLogs = [log, ...(db.adminLogs || []).slice(0, 99)];
  saveDatabase(db);
}

// Ensure pending data is flushed upon process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    if (pendingSave && dbCache) {
      flushDatabaseSync();
    }
  });
  process.on('SIGINT', () => {
    if (pendingSave && dbCache) {
      flushDatabaseSync();
    }
  });
}
