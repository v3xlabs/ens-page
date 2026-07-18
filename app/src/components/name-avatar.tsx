import { ErrorBoundary, Show, Suspense } from "solid-js";

import { useEnsAvatar } from "../hooks/useEnsAvatar";

type AvatarSize = "medium" | "small";

type NameAvatarProperties = {
  name: string;
  size?: AvatarSize;
};

const sizeClass: Record<AvatarSize, string> = {
  medium: "size-9 text-[0.6875rem]",
  small: "size-6 text-[0.5625rem]",
};

const AvatarPlaceholder = (properties: { name: string; size: AvatarSize; }) => (
  <span
    aria-hidden="true"
    class={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-background-disabled font-bold text-text-secondary ${sizeClass[properties.size]}`}
  >
    {properties.name.slice(0, 2).toUpperCase()}
  </span>
);

const AvatarImage = (properties: { name: string; size: AvatarSize; }) => {
  const avatar = useEnsAvatar(() => properties.name);

  return (
    <Show when={avatar.data?.avatar} fallback={<AvatarPlaceholder name={properties.name} size={properties.size} />}>
      {source => <img alt="" class={`shrink-0 rounded-full object-cover ${sizeClass[properties.size]}`} src={source()} />}
    </Show>
  );
};

// Avatars are decorative: a failed lookup (dead RPC, or an EIP-3668 offchain
// gateway that is down) must degrade to the placeholder, never reach the
// page-level error boundary.
export const NameAvatar = (properties: NameAvatarProperties) => (
  <ErrorBoundary fallback={<AvatarPlaceholder name={properties.name} size={properties.size ?? "small"} />}>
    <Suspense fallback={<AvatarPlaceholder name={properties.name} size={properties.size ?? "small"} />}>
      <AvatarImage name={properties.name} size={properties.size ?? "small"} />
    </Suspense>
  </ErrorBoundary>
);
