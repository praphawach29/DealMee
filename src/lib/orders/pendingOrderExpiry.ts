/** Default hours an unpaid order stays open; a shop can override with features.pending_order_expiry_hours */
export const DEFAULT_PENDING_ORDER_EXPIRY_HOURS = 24

/** Choices on /dashboard/modules; 0 means unpaid orders are never cancelled automatically */
export const PENDING_ORDER_EXPIRY_OPTIONS = [0, 1, 3, 6, 12, 24, 48, 72]
