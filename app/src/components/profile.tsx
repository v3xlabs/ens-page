import type { IconTypes } from "solid-icons";
import { TbOutlineMail, TbOutlineWorld } from "solid-icons/tb";
import { createMemo, For, Show } from "solid-js";

import { useEnsAddress } from "../hooks/useEnsAddress";
import { useEnsAvatar } from "../hooks/useEnsAvatar";
import { useEnsTexts } from "../hooks/useEnsTexts";
import { resolveIpfsUri, shortenAddress } from "../utils/ens";
import { socialPlatforms } from "../utils/social";
import { zorbImageDataURI } from "../utils/zorb";

type ProfileProperties = {
  name: string;
};

export const ProfileBanner = (properties: ProfileProperties) => {
  const texts = useEnsTexts(() => properties.name);

  const headerImage = createMemo(() => {
    const value = texts.data?.find(record => record.key === "header")?.value;

    return value ? resolveIpfsUri(value) : undefined;
  });

  return (
    <Show when={headerImage()}>
      {value => <img alt="" class="aspect-3/1 w-full object-cover" src={value()} />}
    </Show>
  );
};

export const ProfileAvatar = (properties: ProfileProperties) => {
  const ensAvatar = useEnsAvatar(() => properties.name);

  return (
    <div class="size-20 shrink-0 overflow-hidden rounded-full">
      <Show
        when={ensAvatar.data?.avatar}
        fallback={<img alt="" class="size-full" src={zorbImageDataURI(properties.name)} />}
      >
        {avatar => <img alt="" class="size-full object-cover" src={avatar()} />}
      </Show>
    </div>
  );
};

export const ProfileAddress = (properties: ProfileProperties) => {
  const ensAddress = useEnsAddress(() => properties.name);

  return (
    <Show when={ensAddress.data?.address}>
      {address => <p class="text-sm text-text-secondary">{shortenAddress(address())}</p>}
    </Show>
  );
};

type SocialLink = {
  href: string;
  icon: IconTypes;
  key: string;
};

export const ProfileDetails = (properties: ProfileProperties) => {
  const texts = useEnsTexts(() => properties.name);

  const recordValue = (key: string) => texts.data?.find(record => record.key === key)?.value;

  const socialLinks = createMemo<SocialLink[]>(() => socialPlatforms.flatMap((platform) => {
    const value = recordValue(platform.key);

    if (!value) return [];

    return [{ href: platform.href(value), icon: platform.icon, key: platform.key }];
  }));

  return (
    <>
      <Show when={recordValue("description")}>
        {value => <p class="mt-4 break-words">{value()}</p>}
      </Show>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Show when={recordValue("url")}>
          {value => (
            <a aria-label="Website" class="icon-button size-10" href={value()} rel="noopener noreferrer" target="_blank">
              <TbOutlineWorld size={20} />
            </a>
          )}
        </Show>
        <Show when={recordValue("email")}>
          {value => (
            <a aria-label="Email" class="icon-button size-10" href={`mailto:${value()}`}>
              <TbOutlineMail size={20} />
            </a>
          )}
        </Show>
        <For each={socialLinks()}>
          {link => (
            <a
              aria-label={link.key}
              class="icon-button size-10"
              href={link.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <link.icon size={20} />
            </a>
          )}
        </For>
      </div>
    </>
  );
};
