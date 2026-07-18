default:
    just --list

install:
    cd app && pnpm install
    cd page && pnpm install

app:
    cd app && pnpm dev

page:
    cd page && pnpm dev

contracts:
    cd contracts && forge test

fork:
    #!/usr/bin/env bash
    set -euo pipefail
    rpc_url="${MAINNET_RPC_URL:-https://ethereum.reth.rs/rpc}"
    anvil_rpc_url="http://127.0.0.1:8545"
    test_account="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    funded_account="0x6bf9Ea00A82797bCB5c94ba86fA3f68f6dB090a6"
    eth_controller="0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5"
    base_registrar="0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85"
    mkdir -p .tmp
    anvil --fork-url "$rpc_url" --chain-id 31337 --mnemonic "test test test test test test test test test test test junk" --port 8545 > .tmp/anvil.log 2>&1 &
    anvil_pid=$!
    trap 'kill "$anvil_pid" 2>/dev/null || true' EXIT
    for attempt in {1..30}; do
        if cast chain-id --rpc-url "$anvil_rpc_url" >/dev/null 2>&1; then break; fi
        sleep 1
    done
    cast chain-id --rpc-url "$anvil_rpc_url" >/dev/null
    cast rpc anvil_setBalance "$test_account" "0x21e19e0c9bab2400000" --rpc-url "$anvil_rpc_url" >/dev/null
    cast rpc anvil_setBalance "$funded_account" "0x21e19e0c9bab2400000" --rpc-url "$anvil_rpc_url" >/dev/null
    ultra_bulk=$(cd contracts && forge create --broadcast --json --rpc-url "$anvil_rpc_url" --unlocked --from "$test_account" src/UltraBulk.sol:UltraBulk --constructor-args "$eth_controller" | node -e 'let output=""; process.stdin.on("data", chunk => { output += chunk; }); process.stdin.on("end", () => { console.log(JSON.parse(output).deployedTo); });')
    factory=$(cd contracts && forge create --broadcast --json --rpc-url "$anvil_rpc_url" --unlocked --from "$test_account" src/RenewalPoolFactory.sol:RenewalPoolFactory --constructor-args "$test_account" | node -e 'let output=""; process.stdin.on("data", chunk => { output += chunk; }); process.stdin.on("end", () => { console.log(JSON.parse(output).deployedTo); });')
    cast send --unlocked --from "$test_account" --rpc-url "$anvil_rpc_url" "$factory" "setProtocolContracts(address,address)" "$ultra_bulk" "$base_registrar" >/dev/null
    cast send --unlocked --from "$test_account" --rpc-url "$anvil_rpc_url" "$factory" "setDurationAllowed(uint256,bool)" 31536000 true >/dev/null
    printf 'VITE_ANVIL_RPC_URL=%s\nVITE_RENEWAL_POOL_FACTORY_ADDRESS=%s\n' "$anvil_rpc_url" "$factory" > app/.env.local
    printf 'Anvil fork ready at %s\nRenewalPoolFactory: %s\n' "$anvil_rpc_url" "$factory"
    wait "$anvil_pid"
