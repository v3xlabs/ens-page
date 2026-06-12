import { Show, Suspense } from "solid-js";

import { useEnsAvatar } from "../hooks/useEnsAvatar";

type NameAvatarProperties = {
  name: string;
};

const AvatarPlaceholder = (properties: NameAvatarProperties) => (
  <span
    aria-hidden="true"
    class="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-background-disabled text-[0.5625rem] font-bold text-text-secondary"
  >
    {properties.name.slice(0, 2).toUpperCase()}
  </span>
);

const AvatarImage = (properties: NameAvatarProperties) => {
  const avatar = useEnsAvatar(() => properties.name);

  return (
    <Show when={avatar.data?.avatar} fallback={<AvatarPlaceholder name={properties.name} />}>
      {source => <img alt="" class="size-6 shrink-0 rounded-full object-cover" src={source()} />}
    </Show>
  );
};

export const NameAvatar = (properties: NameAvatarProperties) => (
  <Suspense fallback={<AvatarPlaceholder name={properties.name} />}>
    <AvatarImage name={properties.name} />
  </Suspense>
);
