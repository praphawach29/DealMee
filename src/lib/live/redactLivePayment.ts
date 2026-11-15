/** Drop payable PromptPay fields before a live session leaves the server. */
export function redactLivePayment<T extends {
  latest_cf_order?: {
    qr_data_url?: string
    promptpay_payload?: string
  } | null
}>(state: T): T {
  if (!state.latest_cf_order) return state
  const order = { ...state.latest_cf_order }
  delete order.qr_data_url
  delete order.promptpay_payload
  return { ...state, latest_cf_order: order }
}
