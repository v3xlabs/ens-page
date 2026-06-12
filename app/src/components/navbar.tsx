import { Dialog } from "@kobalte/core/dialog";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Link } from "@tanstack/solid-router";
import {
  type Connector,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "@wagmi/solid";
import {
  TbOutlineChevronDown,
  TbOutlineMoon,
  TbOutlineSun,
  TbOutlineWallet,
  TbOutlineX,
} from "solid-icons/tb";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";

import { shortenAddress } from "../config";
import { useEnsAvatar, useEnsName } from "../hooks";
import { ChainSelector } from "./chain-selector";

type NavbarProperties = {
  navigate: (to: "/$name" | "/names" | "/settings", parameters?: { name: string; }) => void;
};

export const Navbar = (properties: NavbarProperties) => {
  const [theme, setTheme] = createSignal<"light" | "dark">(getInitialTheme());
  const [error, setError] = createSignal("");
  const [connectOpen, setConnectOpen] = createSignal(false);
  const [connectingConnector, setConnectingConnector] = createSignal("");
  const connectMutation = useConnect();
  const connection = useConnection();
  const connectors = useConnectors();
  const disconnectMutation = useDisconnect();
  const connectedAddress = createMemo(() => connection().address);
  const profileName = useEnsName(connectedAddress);
  const profileAvatar = useEnsAvatar(() => profileName.data);

  createEffect(() => {
    const nextTheme = theme();

    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
  });

  const connectWallet = async (connector: Connector) => {
    setError("");
    setConnectingConnector(connector["id"]);

    try {
      await connectMutation.mutateAsync({ connector });
      setConnectOpen(false);
    }
    catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Unable to connect wallet.");
    }
    finally {
      setConnectingConnector("");
    }
  };

  const disconnectWallet = async () => {
    setError("");
    await disconnectMutation.mutateAsync({});
  };

  return (
    <>
      <header class="flex flex-col gap-4 rounded-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/" class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            app.ens.page
          </Link>
          <p class="mt-1 text-sm font-bold text-text-secondary">
            Manage names from the browser
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            aria-label={theme() === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            class="icon-button"
            type="button"
            onClick={() => setTheme(theme() === "dark" ? "light" : "dark")}
          >
            <Show when={theme() === "dark"} fallback={<TbOutlineMoon size={18} aria-hidden="true" />}>
              <TbOutlineSun size={18} aria-hidden="true" />
            </Show>
          </button>
          <ChainSelector />
          <Show
            when={connectedAddress()}
            fallback={(
              <ConnectWalletDialog
                open={connectOpen()}
                setOpen={setConnectOpen}
                connectors={connectors()}
                connectingConnector={connectingConnector()}
                connectWallet={connectWallet}
              />
            )}
          >
            {address => (
              <ProfileDropdown
                address={address()}
                avatar={profileAvatar.data}
                disconnectWallet={disconnectWallet}
                name={profileName.data}
                navigate={properties.navigate}
              />
            )}
          </Show>
        </div>
      </header>

      <Show when={error()}>
        <p class="rounded-button bg-red-surface px-3 py-2 text-sm font-bold text-red-primary">{error()}</p>
      </Show>
    </>
  );
};

type ProfileDropdownProperties = {
  address: Address;
  avatar?: string;
  disconnectWallet: () => Promise<void>;
  navigate: (to: "/$name" | "/names" | "/settings", parameters?: { name: string; }) => void;
  name?: string;
};

const ProfileDropdown = (properties: ProfileDropdownProperties) => {
  const label = createMemo(() => properties.name ?? shortenAddress(properties.address));

  return (
    <DropdownMenu placement="bottom-end" gutter={8}>
      <DropdownMenu.Trigger class="profile-trigger" type="button">
        <Avatar avatar={properties.avatar} label={label()} />
        <span class="max-w-36 truncate font-bold">{label()}</span>
        <TbOutlineChevronDown size={16} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="dropdown-content">
          <Show when={properties.name}>
            {name => (
              <DropdownMenu.Item class="dropdown-item" onSelect={() => properties.navigate("/$name", { name: name() })}>
                My Profile
              </DropdownMenu.Item>
            )}
          </Show>
          <DropdownMenu.Item class="dropdown-item" onSelect={() => properties.navigate("/names")}>
            My names
          </DropdownMenu.Item>
          <DropdownMenu.Item class="dropdown-item" onSelect={() => properties.navigate("/settings")}>
            Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator class="dropdown-separator" />
          <DropdownMenu.Item class="dropdown-item danger" onSelect={properties.disconnectWallet}>
            Disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
};

type AvatarProperties = {
  avatar?: string;
  label: string;
};

const Avatar = (properties: AvatarProperties) => (
  <span class="profile-avatar">
    <Show when={properties.avatar} fallback={properties.label.slice(0, 2).toUpperCase()}>
      {avatar => <img src={avatar()} alt="" class="size-full object-cover" />}
    </Show>
  </span>
);

type ConnectWalletDialogProperties = {
  open: boolean;
  setOpen: (open: boolean) => void;
  connectors: readonly Connector[];
  connectingConnector: string;
  connectWallet: (connector: Connector) => Promise<void>;
};

const ConnectWalletDialog = (properties: ConnectWalletDialogProperties) => (
  <Dialog open={properties.open} onOpenChange={properties.setOpen}>
    <Dialog.Trigger class="button primary" type="button">
      <TbOutlineWallet size={18} aria-hidden="true" />
      Connect wallet
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay class="dialog-overlay" />
      <div class="dialog-positioner">
        <Dialog.Content class="dialog-content">
          <div class="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title class="text-2xl font-bold tracking-tight">
                Connect wallet
              </Dialog.Title>
              <Dialog.Description class="mt-2 text-text-secondary">
                Choose an available connector to continue.
              </Dialog.Description>
            </div>
            <Dialog.CloseButton class="icon-button" type="button" aria-label="Close wallet connector modal">
              <TbOutlineX size={20} aria-hidden="true" />
            </Dialog.CloseButton>
          </div>

          <div class="mt-6 grid gap-3">
            <Show when={properties.connectors.length > 0} fallback={<p class="rounded-button border border-border bg-background-secondary p-4 text-text-secondary">No wallet connectors are available in this browser.</p>}>
              <For each={properties.connectors}>
                {connector => (
                  <button
                    class="connector-button"
                    type="button"
                    disabled={Boolean(properties.connectingConnector)}
                    onClick={() => properties.connectWallet(connector)}
                  >
                    <span class="grid size-10 place-items-center rounded-button bg-blue-surface text-blue-primary">
                      <Show when={connector.icon} fallback={<TbOutlineWallet size={20} aria-hidden="true" />}>
                        {icon => <img src={icon()} alt="" class="size-5 rounded-sm object-contain" />}
                      </Show>
                    </span>
                    <span class="grid gap-1 text-left">
                      <span class="font-bold">{connector.name}</span>
                      <span class="text-sm text-text-secondary">
                        {properties.connectingConnector === connector["id"] ? "Connecting..." : connector.type}
                      </span>
                    </span>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </Dialog.Content>
      </div>
    </Dialog.Portal>
  </Dialog>
);

const getInitialTheme = (): "light" | "dark" => {
  const stored = localStorage.getItem("theme");

  if (stored === "light" || stored === "dark") return stored;

  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
