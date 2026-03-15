import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { UserState, Goal, Transaction, AmmConfig } from './types';

// --- Database setup ---
const DB_DIR = path.join(process.cwd(), 'data');
fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(path.join(DB_DIR, 'tapyield.db'));
db.pragma('journal_mode = WAL');

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    address             TEXT PRIMARY KEY,
    seed                TEXT NOT NULL,
    regular_key_seed    TEXT,
    regular_key_address TEXT,
    original_deposit_xrp REAL NOT NULL DEFAULT 0,
    lp_token_balance    REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS goals (
    id              TEXT PRIMARY KEY,
    user_address    TEXT NOT NULL,
    name            TEXT NOT NULL,
    target_amount   REAL NOT NULL,
    escrow_sequence INTEGER NOT NULL,
    finish_after    TEXT NOT NULL,
    status          TEXT NOT NULL,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address  TEXT NOT NULL,
    type          TEXT NOT NULL,
    amount        REAL NOT NULL,
    tx_hash       TEXT NOT NULL DEFAULT '',
    timestamp     TEXT NOT NULL,
    merchant_name TEXT
  );

  CREATE TABLE IF NOT EXISTS cards (
    uid               TEXT PRIMARY KEY,
    address           TEXT NOT NULL,
    regular_key_seed  TEXT NOT NULL,
    name              TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pending_regular_keys (
    address TEXT PRIMARY KEY,
    seed    TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_address);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_address);
  CREATE INDEX IF NOT EXISTS idx_cards_address ON cards(address);
`);

// --- Prepared statements ---
const stmts = {
  getUser:        db.prepare('SELECT * FROM users WHERE address = ?'),
  upsertUser:     db.prepare(`INSERT INTO users (address, seed, regular_key_seed, regular_key_address, original_deposit_xrp, lp_token_balance)
                              VALUES (@address, @seed, @regular_key_seed, @regular_key_address, @original_deposit_xrp, @lp_token_balance)
                              ON CONFLICT(address) DO UPDATE SET
                                seed=excluded.seed,
                                regular_key_seed=excluded.regular_key_seed,
                                regular_key_address=excluded.regular_key_address,
                                original_deposit_xrp=excluded.original_deposit_xrp,
                                lp_token_balance=excluded.lp_token_balance`),
  getGoals:       db.prepare('SELECT * FROM goals WHERE user_address = ?'),
  deleteGoals:    db.prepare('DELETE FROM goals WHERE user_address = ?'),
  insertGoal:     db.prepare(`INSERT OR REPLACE INTO goals (id, user_address, name, target_amount, escrow_sequence, finish_after, status, created_at)
                              VALUES (@id, @user_address, @name, @target_amount, @escrow_sequence, @finish_after, @status, @created_at)`),
  getTxns:        db.prepare('SELECT * FROM transactions WHERE user_address = ? ORDER BY id'),
  deleteTxns:     db.prepare('DELETE FROM transactions WHERE user_address = ?'),
  insertTxn:      db.prepare(`INSERT INTO transactions (user_address, type, amount, tx_hash, timestamp, merchant_name)
                              VALUES (@user_address, @type, @amount, @tx_hash, @timestamp, @merchant_name)`),
  getCard:        db.prepare('SELECT * FROM cards WHERE uid = ?'),
  upsertCard:     db.prepare('INSERT OR REPLACE INTO cards (uid, address, regular_key_seed, name) VALUES (@uid, @address, @regular_key_seed, @name)'),
  deleteCard:     db.prepare('DELETE FROM cards WHERE uid = ?'),
  findCardByAddr: db.prepare('SELECT * FROM cards WHERE address = ? LIMIT 1'),
  getPending:     db.prepare('SELECT * FROM pending_regular_keys WHERE address = ?'),
  upsertPending:  db.prepare('INSERT OR REPLACE INTO pending_regular_keys (address, seed) VALUES (?, ?)'),
  deletePending:  db.prepare('DELETE FROM pending_regular_keys WHERE address = ?'),
};

// --- User functions ---

export const getUser = (address: string): UserState | undefined => {
  const row = stmts.getUser.get(address) as any;
  if (!row) return undefined;

  const goals = (stmts.getGoals.all(address) as any[]).map((g): Goal => ({
    id: g.id,
    name: g.name,
    targetAmount: g.target_amount,
    escrowSequence: g.escrow_sequence,
    finishAfter: g.finish_after,
    status: g.status,
    createdAt: g.created_at,
  }));

  const transactions = (stmts.getTxns.all(address) as any[]).map((t): Transaction => ({
    type: t.type,
    amount: t.amount,
    txHash: t.tx_hash,
    timestamp: t.timestamp,
    merchantName: t.merchant_name || undefined,
  }));

  return {
    address: row.address,
    seed: row.seed,
    regularKeySeed: row.regular_key_seed || undefined,
    regularKeyAddress: row.regular_key_address || undefined,
    originalDepositXrp: row.original_deposit_xrp,
    lpTokenBalance: row.lp_token_balance,
    goals,
    transactions,
  };
};

const _setUser = db.transaction((address: string, state: UserState) => {
  stmts.upsertUser.run({
    address: state.address,
    seed: state.seed,
    regular_key_seed: state.regularKeySeed || null,
    regular_key_address: state.regularKeyAddress || null,
    original_deposit_xrp: state.originalDepositXrp,
    lp_token_balance: state.lpTokenBalance,
  });

  // Replace goals
  stmts.deleteGoals.run(address);
  for (const g of state.goals) {
    stmts.insertGoal.run({
      id: g.id,
      user_address: address,
      name: g.name,
      target_amount: g.targetAmount,
      escrow_sequence: g.escrowSequence,
      finish_after: g.finishAfter,
      status: g.status,
      created_at: g.createdAt,
    });
  }

  // Replace transactions
  stmts.deleteTxns.run(address);
  for (const t of state.transactions) {
    stmts.insertTxn.run({
      user_address: address,
      type: t.type,
      amount: t.amount,
      tx_hash: t.txHash,
      timestamp: t.timestamp,
      merchant_name: t.merchantName || null,
    });
  }
});

export const setUser = (address: string, state: UserState): void => {
  _setUser(address, state);
};

export const ensureUser = (address: string, seed: string): UserState => {
  let user = getUser(address);
  if (!user) {
    console.log(`🔄 Creating user ${address}`);
    user = {
      address,
      seed,
      originalDepositXrp: 0,
      lpTokenBalance: 0,
      goals: [],
      transactions: [],
    };
    setUser(address, user);
  }
  return user;
};

// --- Card registry ---

export interface CardEntry {
  uid: string;
  address: string;
  regularKeySeed: string;
  name: string;
}

export const getCard = (uid: string): CardEntry | undefined => {
  const row = stmts.getCard.get(uid) as any;
  if (!row) return undefined;
  return {
    uid: row.uid,
    address: row.address,
    regularKeySeed: row.regular_key_seed,
    name: row.name,
  };
};

export const setCard = (uid: string, entry: CardEntry): void => {
  stmts.upsertCard.run({
    uid: entry.uid,
    address: entry.address,
    regular_key_seed: entry.regularKeySeed,
    name: entry.name,
  });
};

export const deleteCard = (uid: string): boolean => {
  const result = stmts.deleteCard.run(uid);
  return result.changes > 0;
};

export const findCardByAddress = (address: string): CardEntry | undefined => {
  const row = stmts.findCardByAddr.get(address) as any;
  if (!row) return undefined;
  return {
    uid: row.uid,
    address: row.address,
    regularKeySeed: row.regular_key_seed,
    name: row.name,
  };
};

// --- Pending regular keys ---

export const setPendingRegularKey = (address: string, seed: string): void => {
  stmts.upsertPending.run(address, seed);
};

export const getPendingRegularKey = (address: string) => {
  const row = stmts.getPending.get(address) as any;
  if (!row) return undefined;
  return { seed: row.seed, address: row.address };
};

export const deletePendingRegularKey = (address: string): boolean => {
  const result = stmts.deletePending.run(address);
  return result.changes > 0;
};

// --- AMM config (stays in memory — set once from env vars) ---

export let ammConfig: AmmConfig = {
  issuerAddress: '',
  issuerSeed: '',
  ammAccountAddress: '',
  tokenCurrency: 'TYD',
};

export const setAmmConfig = (config: AmmConfig): void => {
  ammConfig = config;
};
