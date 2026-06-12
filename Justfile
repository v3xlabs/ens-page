default:
    just --list

install:
    pnpm install

app:
    cd app && pnpm dev

page:
    cd page && pnpm dev
