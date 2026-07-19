// Regenerates ensfairy-names.json: every .eth name currently held by
// ensfairy.eth (the name-donation public good), plus a curated top-200 by
// name quality. Run with: node scripts/fetch-ensfairy-names.mjs
//
// The subgraph list is only a candidate set — it can contain stale
// registrants, subnames, or otherwise non-.eth-2LD entries — so every label
// is verified on-chain: BaseRegistrar.ownerOf(labelhash) must be the fairy.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createPublicClient, http, labelhash, parseAbi } from "viem";
import { mainnet } from "viem/chains";

const ENSFAIRY_ADDRESS = "0x481f50a5bdccc0bc4322c4dca04301433ded50f0";
const SUBGRAPH_URL = "https://api.alpha.ensnode.io/subgraph";
const GRACE_SECONDS = 90 * 86_400;
const BASE_REGISTRAR_ADDRESS = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL ?? "https://ethereum.reth.rs/rpc";

const baseRegistrarAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const fetchPage = async (skip) => {
  const response = await fetch(SUBGRAPH_URL, {
    body: JSON.stringify({
      query: `{ registrations(first: 1000, skip: ${skip}, where: {registrant: "${ENSFAIRY_ADDRESS}"}) { labelName expiryDate } }`,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload = await response.json();

  if (!payload.data?.registrations) throw new Error(`Subgraph error: ${JSON.stringify(payload).slice(0, 200)}`);

  return payload.data.registrations;
};

const registrations = [];

for (let skip = 0; ; skip += 1000) {
  const page = await fetchPage(skip);

  registrations.push(...page);

  if (page.length < 1000) break;
}

const nowSeconds = Math.floor(Date.now() / 1000);

// Names past their grace period can no longer be renewed by anyone; labels
// containing dots are subnames/DNS/.reverse noise, never .eth 2LDs.
const renewable = registrations
  .filter(entry => typeof entry.labelName === "string" && entry.labelName.length > 0)
  .filter(entry => !entry.labelName.includes("."))
  .filter(entry => Number(entry.expiryDate) + GRACE_SECONDS > nowSeconds);

const candidates = [...new Map(renewable.map(entry => [entry.labelName, entry])).values()];

const client = createPublicClient({ chain: mainnet, transport: http(MAINNET_RPC_URL, { timeout: 60_000 }) });

const verified = [];

for (let index = 0; index < candidates.length; index += 400) {
  const batch = candidates.slice(index, index + 400);
  const owners = await client.multicall({
    allowFailure: true,
    contracts: batch.map(entry => ({
      abi: baseRegistrarAbi,
      address: BASE_REGISTRAR_ADDRESS,
      args: [BigInt(labelhash(entry.labelName))],
      functionName: "ownerOf",
    })),
  });

  for (const [batchIndex, entry] of batch.entries()) {
    const owner = owners[batchIndex];

    if (owner.status === "success" && owner.result.toLowerCase() === ENSFAIRY_ADDRESS) {
      verified.push(entry);
    }
  }
}

console.log(`${candidates.length} subgraph candidates → ${verified.length} verified on-chain`);

const unique = verified;

// Best 200 by name quality: pure lowercase alphabetics beat alphanumerics
// beat everything else; shorter beats longer within a class.
const classPenalty = (label) => {
  if (/^[a-z]+$/.test(label)) return 0;

  if (/^[a-z0-9]+$/.test(label)) return 1;

  return 2;
};

const ranked = [...unique].sort((first, second) => {
  const byClass = classPenalty(first.labelName) - classPenalty(second.labelName);

  if (byClass !== 0) return byClass;

  const byLength = first.labelName.length - second.labelName.length;

  if (byLength !== 0) return byLength;

  return first.labelName.localeCompare(second.labelName);
});

const output = {
  all: unique.map(entry => entry.labelName).sort((a, b) => a.localeCompare(b)),
  fetchedAt: new Date().toISOString(),
  top200: ranked.slice(0, 200).map(entry => entry.labelName),
};

writeFileSync(
  fileURLToPath(new URL("ensfairy-names.json", import.meta.url)),
  `${JSON.stringify(output, undefined, 2)}\n`,
);

console.log(`ensfairy holds ${output.all.length} renewable names; wrote top ${output.top200.length}`);
