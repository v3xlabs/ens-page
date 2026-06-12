import type { IconTypes } from "solid-icons";
import { SiFarcaster } from "solid-icons/si";
import { TbOutlineBrandBluesky, TbOutlineBrandDiscord, TbOutlineBrandGithub, TbOutlineBrandLinkedin, TbOutlineBrandMatrix, TbOutlineBrandReddit, TbOutlineBrandTelegram, TbOutlineBrandX } from "solid-icons/tb";

export type SocialPlatform = {
  href: (value: string) => string;
  icon: IconTypes;
  key: string;
};

export const socialPlatforms: SocialPlatform[] = [
  {
    href: value => `https://x.com/${value}`,
    icon: TbOutlineBrandX,
    key: "com.twitter",
  },
  {
    href: value => `https://github.com/${value}`,
    icon: TbOutlineBrandGithub,
    key: "com.github",
  },
  {
    href: value => `https://t.me/${value.replace(/^@/, "")}`,
    icon: TbOutlineBrandTelegram,
    key: "org.telegram",
  },
  {
    href: value => `https://discord.com/users/${value}`,
    icon: TbOutlineBrandDiscord,
    key: "com.discord",
  },
  {
    href: value => `https://reddit.com/user/${value}`,
    icon: TbOutlineBrandReddit,
    key: "com.reddit",
  },
  {
    href: value => `https://linkedin.com/in/${value}`,
    icon: TbOutlineBrandLinkedin,
    key: "com.linkedin",
  },
  {
    href: value => `https://warpcast.com/${value}`,
    icon: SiFarcaster,
    key: "com.farcaster",
  },
  {
    href: value => `https://bsky.app/profile/${value}`,
    icon: TbOutlineBrandBluesky,
    key: "com.bluesky",
  },
  {
    href: value => `https://matrix.to/#/${value}`,
    icon: TbOutlineBrandMatrix,
    key: "org.matrix",
  },
];

export const socialKeys = new Set(socialPlatforms.map(p => p.key));

export const profileKeys = new Set(["avatar", "description", "email", "header", "keywords", "name", "notice", "url"]);
