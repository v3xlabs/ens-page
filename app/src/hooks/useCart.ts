import { createStoredSignal } from "../utils/storage";

export type PriceTier = "3char" | "4char" | "standard";

export type CartItem = {
  expiryDate: number;
  name: string;
  tier: PriceTier;
};

export const PRICE_PER_YEAR_USD: Record<PriceTier, number> = {
  "3char": 640,
  "4char": 160,
  "standard": 5,
};

const getTier = (name: string): PriceTier => {
  const label = name.replace(".eth", "");

  if (label.length <= 3) return "3char";

  if (label.length === 4) return "4char";

  return "standard";
};

const isCartItem = (raw: unknown): raw is CartItem => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<CartItem>;

  return typeof candidate.name === "string"
    && typeof candidate.expiryDate === "number"
    && typeof candidate.tier === "string"
    && candidate.tier in PRICE_PER_YEAR_USD;
};

const parseItems = (raw: unknown): Record<string, CartItem> | undefined => {
  if (typeof raw !== "object" || raw === null) return;

  const items = "items" in raw ? (raw as { items: unknown; }).items : raw;

  if (typeof items !== "object" || items === null) return;

  return Object.fromEntries(
    Object.entries(items).filter((entry): entry is [string, CartItem] => isCartItem(entry[1])),
  );
};

const [items, setItems] = createStoredSignal<Record<string, CartItem>>({
  defaultValue: {},
  parse: parseItems,
  storageKey: "ens-manager-cart",
});

const cartItems = () => Object.values(items());

const cartCount = () => cartItems().length;

const selectedTier = (): PriceTier | undefined => cartItems()[0]?.tier;

const isValidSelection = () => {
  const tier = selectedTier();

  return tier !== undefined && cartItems().every(item => item.tier === tier);
};

const totalPriceUsd = (years: number) => {
  const tier = selectedTier();

  if (!tier) return 0;

  return cartCount() * PRICE_PER_YEAR_USD[tier] * years;
};

const addItem = (name: string, expiryDate: number) => {
  const normalized = name.toLowerCase();

  setItems(previous => ({
    ...previous,
    [normalized]: { expiryDate, name: normalized, tier: getTier(normalized) },
  }));
};

const removeItem = (name: string) => {
  const normalized = name.toLowerCase();

  setItems(previous => Object.fromEntries(
    Object.entries(previous).filter(([key]) => key !== normalized),
  ));
};

const toggleItem = (name: string, expiryDate: number) => {
  if (items()[name.toLowerCase()]) {
    removeItem(name);
  }
  else {
    addItem(name, expiryDate);
  }
};

const isSelected = (name: string) => Boolean(items()[name.toLowerCase()]);

const clearCart = () => {
  setItems(() => ({}));
};

export const useCart = () => ({
  addItem,
  cartCount,
  cartItems,
  clearCart,
  isSelected,
  isValidSelection,
  removeItem,
  selectedTier,
  toggleItem,
  totalPriceUsd,
});
