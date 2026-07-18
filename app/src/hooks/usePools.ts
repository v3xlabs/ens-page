import { createSignal } from "solid-js";

import { createStoredSignal } from "../utils/storage";

export type PoolMember = {
  isOwned: boolean;
  name: string;
};

export type PoolDeposit = {
  amountEth: number;
  atMs: number;
  method: "direct" | "stream" | "swap";
};

// Local prototype of the future pool contract: balances and automation settings
// live in localStorage until the on-chain pool exists.
export type Pool = {
  balanceEth: number;
  bufferPercent: number;
  deposits: PoolDeposit[];
  gasCeilingGwei: number;
  hasStreaming: boolean;
  hasUsdcSwap: boolean;
  label: string;
  members: PoolMember[];
  poolId: string;
  renewHorizonDays: number;
  tipPercent: number;
};

const isPoolMember = (raw: unknown): raw is PoolMember => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<PoolMember>;

  return typeof candidate.name === "string" && typeof candidate.isOwned === "boolean";
};

const isPoolDeposit = (raw: unknown): raw is PoolDeposit => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<PoolDeposit>;

  return typeof candidate.amountEth === "number"
    && typeof candidate.atMs === "number"
    && (candidate.method === "direct" || candidate.method === "stream" || candidate.method === "swap");
};

type StoredPool = Partial<Pool> & Pick<Pool, "balanceEth" | "label" | "members" | "poolId">;

const isStoredPool = (raw: unknown): raw is StoredPool => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<Pool>;

  return typeof candidate.poolId === "string"
    && typeof candidate.label === "string"
    && typeof candidate.balanceEth === "number"
    && Array.isArray(candidate.members)
    && candidate.members.every(isPoolMember);
};

const normalizePool = (stored: StoredPool): Pool => ({
  balanceEth: stored.balanceEth,
  bufferPercent: typeof stored.bufferPercent === "number" ? stored.bufferPercent : 10,
  deposits: Array.isArray(stored.deposits) ? stored.deposits.filter(isPoolDeposit) : [],
  gasCeilingGwei: typeof stored.gasCeilingGwei === "number" ? stored.gasCeilingGwei : 15,
  hasStreaming: stored.hasStreaming === true,
  hasUsdcSwap: stored.hasUsdcSwap === true,
  label: stored.label,
  members: stored.members,
  poolId: stored.poolId,
  renewHorizonDays: typeof stored.renewHorizonDays === "number" ? stored.renewHorizonDays : 30,
  tipPercent: typeof stored.tipPercent === "number" ? stored.tipPercent : 0.5,
});

const parsePools = (raw: unknown): Pool[] | undefined => {
  if (!Array.isArray(raw)) return;

  return raw.filter(isStoredPool).map(normalizePool);
};

const [pools, setPools] = createStoredSignal<Pool[]>({
  defaultValue: [],
  parse: parsePools,
  storageKey: "ens-manager-pools",
});

// Selection handed over from the names tab ("Pool these names"); not persisted.
const [poolSeed, setPoolSeed] = createSignal<string[]>([]);

const buildPool = (input: { balanceEth: number; label: string; members: PoolMember[]; }, poolId: string): Pool => ({
  balanceEth: input.balanceEth,
  bufferPercent: 10,
  deposits: input.balanceEth > 0
    ? [{ amountEth: input.balanceEth, atMs: Date.now(), method: "direct" }]
    : [],
  gasCeilingGwei: 15,
  hasStreaming: false,
  hasUsdcSwap: false,
  label: input.label,
  members: input.members,
  poolId,
  renewHorizonDays: 30,
  tipPercent: 0.5,
});

// A redeployed local factory mints pools at the same CREATE addresses as the
// previous fork session, so an entry with this poolId may already exist —
// creating always replaces it, stale label and history included.
const createPool = (input: { balanceEth: number; label: string; members: PoolMember[]; }, poolId: string = crypto.randomUUID()): string => {
  setPools(previous => [
    ...previous.filter(existing => existing.poolId.toLowerCase() !== poolId.toLowerCase()),
    buildPool(input, poolId),
  ]);

  return poolId;
};

const renamePool = (poolId: string, label: string) => {
  setPools((previous) => {
    const isKnown = previous.some(pool => pool.poolId.toLowerCase() === poolId.toLowerCase());

    if (!isKnown) return [...previous, buildPool({ balanceEth: 0, label, members: [] }, poolId)];

    return previous.map(pool => (pool.poolId.toLowerCase() === poolId.toLowerCase() ? { ...pool, label } : pool));
  });
};

const updatePool = (poolId: string, update: (pool: Pool) => Pool) => {
  setPools(previous => previous.map(pool => (pool.poolId === poolId ? update(pool) : pool)));
};

const depositToPool = (poolId: string, amountEth: number, method: PoolDeposit["method"]) => {
  updatePool(poolId, pool => ({
    ...pool,
    balanceEth: pool.balanceEth + amountEth,
    deposits: [...pool.deposits, { amountEth, atMs: Date.now(), method }],
  }));
};

const removePool = (poolId: string) => {
  setPools(previous => previous.filter(pool => pool.poolId !== poolId));
};

export const usePools = () => ({
  createPool,
  depositToPool,
  poolSeed,
  pools,
  removePool,
  renamePool,
  setPoolSeed,
  updatePool,
});
