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
