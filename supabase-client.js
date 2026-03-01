const SUPABASE_URL = "https://invprmlglmgukgcxivff.supabase.co";
const SUPABASE_KEY = "sb_publishable_YpBpshZxMFW6yV-yOC8Nug_Kzs9wYIa";

if (!window.supabase) {
  throw new Error("Supabase library not loaded.");
}

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ACTIVE_STATUS_VALUES = new Set([
  "active",
  "paid",
  "premium",
  "pro",
  "subscriber",
  "subscribed",
  "trialing"
]);

function isTruthyFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    return ["true", "yes", "1", "active", "paid"].includes(value.toLowerCase());
  }
  return false;
}

function hasActiveStatus(value) {
  if (typeof value !== "string") return false;
  return ACTIVE_STATUS_VALUES.has(value.toLowerCase());
}

export function hasActiveSubscription(user) {
  if (!user) return false;

  const metadata = [user.user_metadata || {}, user.app_metadata || {}];

  for (const source of metadata) {
    if (
      isTruthyFlag(source.subscription_active) ||
      isTruthyFlag(source.is_subscriber) ||
      isTruthyFlag(source.has_paid_subscription) ||
      hasActiveStatus(source.subscription_status) ||
      hasActiveStatus(source.plan) ||
      hasActiveStatus(source.tier)
    ) {
      return true;
    }
  }

  return false;
}

export async function getAccessState() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const session = data.session;
  const user = session?.user || null;

  return {
    session,
    user,
    isLoggedIn: !!session,
    isSubscriber: hasActiveSubscription(user)
  };
}
