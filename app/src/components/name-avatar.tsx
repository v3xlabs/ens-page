import { ErrorBoundary, Show, Suspense } from "solid-js";

import { useEnsAvatar } from "../hooks/useEnsAvatar";
import { zorbImageDataURI } from "../utils/zorb";

type AvatarSize = "medium" | "small";

type NameAvatarProperties = {
  name: string;
  size?: AvatarSize;
};

const sizeClass: Record<AvatarSize, string> = {
  medium: "size-9",
  small: "size-6",
};

const AvatarPlaceholder = (properties: { name: string; size: AvatarSize; }) => (
  <img
    alt=""
    aria-hidden="true"
    class={`shrink-0 rounded-full ${sizeClass[properties.size]}`}
    src={zorbImageDataURI(properties.name)}
  />
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
