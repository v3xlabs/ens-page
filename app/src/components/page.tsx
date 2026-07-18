import type { JSX } from "solid-js";

type PageWidth = "narrow" | "wide";

type PageProperties = {
  children: JSX.Element;
  hasCheckoutClearance?: boolean;
  width: PageWidth;
};

const widthClass: Record<PageWidth, string> = {
  narrow: "max-w-2xl",
  wide: "max-w-4xl",
};

export const Page = (properties: PageProperties) => (
  <div
    classList={{
      "mx-auto w-full pb-16": true,
      "pb-[28rem] sm:pb-80": properties.hasCheckoutClearance,
      [widthClass[properties.width]]: true,
    }}
  >
    {properties.children}
  </div>
);
