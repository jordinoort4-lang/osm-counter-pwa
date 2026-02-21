// ─────────────────────────────────────────────────────────────────────────────
//  STRIPE CONFIGURATION
//  Replace all placeholder values below with your actual Stripe credentials.
//  Stripe Dashboard: https://dashboard.stripe.com
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STEP 1 — Publishable Key
 * Find this at: Dashboard → Developers → API Keys
 * Starts with pk_live_  (production) or pk_test_ (testing)
 */
export const STRIPE_PUBLISHABLE_KEY =
  "pk_test_REPLACE_WITH_YOUR_STRIPE_PUBLISHABLE_KEY";

/**
 * STEP 2 — Price IDs
 * Create subscription products at: Dashboard → Products → Add product
 * Each price gets a unique ID starting with price_
 */
export const STRIPE_PRICE_IDS = {
  epic: "price_REPLACE_WITH_EPIC_MONTHLY_PRICE_ID", // €4.95 / month
  elite: "price_REPLACE_WITH_ELITE_MONTHLY_PRICE_ID", // €9.95 / month
  legendary: "price_REPLACE_WITH_LEGENDARY_MONTHLY_PRICE_ID", // €19.95 / month
  // Lifetime one-time purchases
  epic_lifetime: "price_REPLACE_WITH_EPIC_LIFETIME_PRICE_ID", // €119.95 one-time
  elite_lifetime: "price_REPLACE_WITH_ELITE_LIFETIME_PRICE_ID", // €169.95 one-time
  legendary_lifetime: "price_REPLACE_WITH_LEGENDARY_LIFETIME_PRICE_ID", // €249.95 one-time
} as const;

/**
 * STEP 3 — Payment Links (RECOMMENDED — easiest integration)
 * Create at: Dashboard → Payment Links → Create link
 * Each link is a ready-made hosted checkout page.
 * Format: https://buy.stripe.com/XXXXXXXX
 */
export const STRIPE_PAYMENT_LINKS = {
  epic: "https://buy.stripe.com/REPLACE_WITH_EPIC_PAYMENT_LINK",
  elite: "https://buy.stripe.com/REPLACE_WITH_ELITE_PAYMENT_LINK",
  legendary: "https://buy.stripe.com/REPLACE_WITH_LEGENDARY_PAYMENT_LINK",
  // Lifetime one-time purchase links
  epic_lifetime:
    "https://buy.stripe.com/REPLACE_WITH_EPIC_LIFETIME_PAYMENT_LINK",
  elite_lifetime:
    "https://buy.stripe.com/REPLACE_WITH_ELITE_LIFETIME_PAYMENT_LINK",
  legendary_lifetime:
    "https://buy.stripe.com/REPLACE_WITH_LEGENDARY_LIFETIME_PAYMENT_LINK",
} as const;

/**
 * STEP 4 — Success & Cancel redirect URLs
 * Update these once you know your production domain.
 */
export const STRIPE_REDIRECT_URLS = {
  success: `${window.location.origin}/?subscribed=true`,
  cancel: `${window.location.origin}/?checkout=cancelled`,
};

// ─────────────────────────────────────────────────────────────────────────────
//  TIER METADATA  (display information — no Stripe keys here)
// ─────────────────────────────────────────────────────────────────────────────

export type TierKey =
  | "epic"
  | "elite"
  | "legendary"
  | "epic_lifetime"
  | "elite_lifetime"
  | "legendary_lifetime";

export interface TierConfig {
  key: TierKey;
  name: string;
  price: string;
  period: string;
  tagline: string;
  image: string;
  tag?: { label: string; color: string };
  accent: string;
  features: string[];
}

export const TIER_CONFIGS: TierConfig[] = [
  {
    key: "epic",
    name: "Epic",
    price: "€4.95",
    period: "/month",
    tagline: "Dominate with precision tactics",
    image: "/images/epicproductcardimage.png",
    tag: { label: "MOST POPULAR", color: "#00aeef" },
    accent: "#00aeef",
    features: [
      "✅ Everything in Free",
      "7 advanced calculations / week",
      "Opponent tactic auto-preview",
      "Monthly Scouting Database",
      "OSM Basic Guide PDF",
      "Formation meta presets",
      "🔒 Secure Payment | 30-Day Money Back",
      "👥 2,400+ Managers | Used in 47 Leagues",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    price: "€9.95",
    period: "/month",
    tagline: "The pro manager's edge",
    image: "/images/eliteproductcardimage-removebg-preview.png",
    accent: "#a855f7",
    features: [
      "✅ Everything in Epic",
      "Unlimited advanced calculations",
      "National scouting databases",
      "CSV tactical export",
      "✅ Everything included in previous tiers",
      "Advanced match context inputs",
      "Early access to new features",
      "🔒 Secure Payment | 30-Day Money Back",
      "👥 2,400+ Managers | Used in 47 Leagues",
    ],
  },
  {
    key: "legendary",
    name: "Legendary",
    price: "€19.95",
    period: "/month",
    tagline: "Master the game — Legendary Architect",
    image: "/images/legendaryproductcardimage-removebg-preview.png",
    tag: { label: "BEST VALUE", color: "#ffd700" },
    accent: "#ffd700",
    features: [
      "✅ Everything in Epic & Elite",
      "Full Legendary Tactics Archive",
      "Real-time match adjustments",
      "Match-specific tactical blueprints",
      "OSM Bible PDF (complete guide)",
      "Private Discord role & community",
      "1-on-1 strategy consultation",
      "Dedicated account manager",
      "🔒 Secure Payment | 30-Day Money Back",
      "👥 2,400+ Managers | Used in 47 Leagues",
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════════
  //  LIFETIME TIERS (one-time purchase)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    key: "epic_lifetime",
    name: "Epic Lifetime",
    price: "€119.95",
    period: "one-time",
    tagline: "Dominate forever with precision tactics",
    image: "/images/epicproductcardimage.png",
    tag: { label: "LIFETIME DEAL", color: "#00c864" },
    accent: "#00c864",
    features: [
      "✅ Everything in Epic Monthly",
      "Lifetime access — pay once",
      "All future updates included",
      "7 advanced calculations / week",
      "Opponent tactic auto-preview",
      "Monthly Scouting Database",
      "OSM Basic Guide PDF",
      "🔒 Secure Payment | 30-Day Money Back",
      "👥 2,400+ Managers | Used in 47 Leagues",
    ],
  },
  {
    key: "elite_lifetime",
    name: "Elite Lifetime",
    price: "€169.95",
    period: "one-time",
    tagline: "The pro manager's edge — forever",
    image: "/images/eliteproductcardimage-removebg-preview.png",
    tag: { label: "LIFETIME DEAL", color: "#00c864" },
    accent: "#00c864",
    features: [
      "✅ Everything in Elite Monthly",
      "Lifetime access — pay once",
      "All future updates included",
      "Unlimited advanced calculations",
      "National scouting databases",
      "CSV tactical export",
      "✅ Everything included in previous tiers",
      "Advanced match context inputs",
      "Early access to new features",
      "🔒 Secure Payment | 30-Day Money Back",
      "👥 2,400+ Managers | Used in 47 Leagues",
    ],
  },
  {
    key: "legendary_lifetime",
    name: "Legendary Lifetime",
    price: "€249.95",
    period: "one-time",
    tagline: "Master the game forever — Legendary Architect",
    image: "/images/legendaryproductcardimage-removebg-preview.png",
    tag: { label: "BEST LIFETIME VALUE", color: "#00c864" },
    accent: "#00c864",
    features: [
      "✅ Everything in Legendary Monthly",
      "Lifetime access — pay once",
      "All future updates included",
      "Full Legendary Tactics Archive",
      "Real-time match adjustments",
      "Match-specific tactical blueprints",
      "OSM Bible PDF (complete guide)",
      "Private Discord role & community",
      "1-on-1 strategy consultation",
      "Dedicated account manager",
      "🔒 Secure Payment | 30-Day Money Back",
      "👥 2,400+ Managers | Used in 47 Leagues",
    ],
  },
];
