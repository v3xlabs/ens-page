type PoolDetailTabsProperties = {
  activeTab: "funding" | "overview";
  onChange: (tab: "funding" | "overview") => void;
};

export const PoolDetailTabs = (properties: PoolDetailTabsProperties) => (
  <div aria-label={t("pools.poolDetails")} class="flex border-b border-border" role="tablist">
    <button
      aria-selected={properties.activeTab === "overview"}
      classList={{
        "border-b-2 border-blue-primary text-text-primary": properties.activeTab === "overview",
        "border-b-2 border-transparent text-text-secondary": properties.activeTab !== "overview",
        "cursor-pointer px-4 py-3 font-bold": true,
      }}
      onClick={() => properties.onChange("overview")}
      role="tab"
      type="button"
    >
      Overview
    </button>
    <button
      aria-selected={properties.activeTab === "funding"}
      classList={{
        "border-b-2 border-blue-primary text-text-primary": properties.activeTab === "funding",
        "border-b-2 border-transparent text-text-secondary": properties.activeTab !== "funding",
        "cursor-pointer px-4 py-3 font-bold": true,
      }}
      onClick={() => properties.onChange("funding")}
      role="tab"
      type="button"
    >
      Funding history
    </button>
  </div>
);
import { t } from "../i18n";
