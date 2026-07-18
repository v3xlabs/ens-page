import { encodeAbiParameters, type Hex, keccak256, labelhash, parseAbi } from "viem";

export const baseRegistrarAddress = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

export const ensRegistryAddress = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

export const ensRegistryAbi = parseAbi([
  "function owner(bytes32 node) view returns (address)",
  "function setResolver(bytes32 node, address resolver)",
]);

export const publicResolverAddress = "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63";

export const publicResolverAbi = parseAbi([
  "function text(bytes32 node, string key) view returns (string)",
]);

export const oldEthControllerAddress = "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5";

export const testAccountAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

export const baseRegistrarAbi = parseAbi([
  "function available(uint256 id) view returns (bool)",
  "function register(uint256 id, address owner, uint256 duration) returns (uint256)",
  "function nameExpires(uint256 id) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

export const labelToTokenId = (label: string): bigint => BigInt(labelhash(label));

const expiriesMappingSlot = 9n;

export const expiryStorageSlot = (tokenId: bigint): Hex =>
  keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [tokenId, expiriesMappingSlot],
    ),
  );
