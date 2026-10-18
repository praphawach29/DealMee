import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Facebook Graph API Base URL (v21.0 is current LTS for Meta Graph API)
 */
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

export interface FacebookProfile {
  id: string
  name: string
  first_name?: string
  last_name?: string
  profile_pic?: string
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  recipientId?: string
  error?: string
}

/**
 * Verify Meta X-Hub-Signature-256 header using the Meta App Secret.
 * Uses timingSafeEqual to protect against timing attacks.
 */
export function verifyFacebookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined
): boolean {
  // If app secret is not configured yet in merchant settings, bypass with warning
  if (!appSecret || !appSecret.trim()) {
    console.warn('[Facebook Webhook] No app_secret configured; skipping signature verification.')
    return true
  }

  if (!signatureHeader) {
    console.warn('[Facebook Webhook] Missing x-hub-signature-256 header.')
    return false
  }

  const cleanSecret = appSecret.trim()
  const cleanHeader = signatureHeader.trim()

  // Header format: sha256=<hex_digest>
  const expectedPrefix = 'sha256='
  if (!cleanHeader.startsWith(expectedPrefix)) {
    console.warn('[Facebook Webhook] Header does not start with sha256=')
    return false
  }

  const signatureHash = cleanHeader.slice(expectedPrefix.length)

  try {
    const computedHash = createHmac('sha256', cleanSecret)
      .update(rawBody, 'utf8')
      .digest('hex')

    const sigBuffer = Buffer.from(signatureHash, 'hex')
    const compBuffer = Buffer.from(computedHash, 'hex')

    if (sigBuffer.length !== compBuffer.length) {
      return false
    }

    return timingSafeEqual(sigBuffer, compBuffer)
  } catch (err) {
    console.error('[Facebook Webhook] Error during signature comparison:', err)
    return false
  }
}

/**
 * Send a text message to a Facebook user via the Graph API /me/messages endpoint.
 */
export async function sendFacebookMessage(
  recipientPsid: string,
  text: string,
  pageAccessToken: string,
  options?: {
    messagingType?: 'RESPONSE' | 'MESSAGE_TAG' | 'UPDATE'
    tag?: string
  }
): Promise<SendMessageResult> {
  const cleanToken = pageAccessToken.trim()
  if (!cleanToken) {
    return {
      success: false,
      error: 'Facebook Page Access Token is missing',
    }
  }

  if (!recipientPsid || !text) {
    return {
      success: false,
      error: 'Recipient ID or message text is empty',
    }
  }

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const payload: Record<string, any> = {
      recipient: { id: recipientPsid },
      messaging_type: options?.messagingType || 'RESPONSE',
      message: { text },
    }
    if (options?.tag) {
      payload.tag = options.tag
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}: Failed to send Facebook message`
      console.error('[Facebook Send API Error]:', data)
      return {
        success: false,
        error: errorMsg,
      }
    }

    return {
      success: true,
      messageId: data.message_id,
      recipientId: data.recipient_id,
    }
  } catch (err: any) {
    console.error('[Facebook Send Exception]:', err)
    return {
      success: false,
      error: err?.message || 'Network error sending to Facebook Graph API',
    }
  }
}

/**
 * Set sender action (typing_on, typing_off, mark_seen) in Messenger chat
 */
export async function sendFacebookTypingIndicator(
  recipientPsid: string,
  pageAccessToken: string,
  action: 'typing_on' | 'typing_off' | 'mark_seen' = 'typing_on'
): Promise<void> {
  const cleanToken = pageAccessToken.trim()
  if (!cleanToken || !recipientPsid) return

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        sender_action: action,
      }),
    })
    if (!res.ok) {
      console.log(`[Facebook Typing Indicator Note] ${action}:`, res.status, await res.text())
    }
  } catch (err) {
    // Non-blocking indicator failure can be safely ignored
    console.log('[Facebook Typing Indicator Note]:', err)
  }
}

// Messenger drops the typing bubble after about 20 seconds on its own
const TYPING_REFRESH_MS = 15_000

/**
 * Runs `work` with Messenger's typing bubble showing, the counterpart of LINE's
 * loading animation: marks the message seen, keeps the bubble alive for long AI
 * runs, and clears it when the work fails (a sent message clears it otherwise).
 */
export async function withFacebookTyping<T>(
  recipientPsid: string,
  pageAccessToken: string | undefined,
  work: () => Promise<T>
): Promise<T> {
  if (!pageAccessToken) return work()
  await sendFacebookTypingIndicator(recipientPsid, pageAccessToken, 'mark_seen')
  sendFacebookTypingIndicator(recipientPsid, pageAccessToken, 'typing_on').catch(() => {})
  const timer = setInterval(() => {
    sendFacebookTypingIndicator(recipientPsid, pageAccessToken, 'typing_on').catch(() => {})
  }, TYPING_REFRESH_MS)
  try {
    return await work()
  } catch (err) {
    sendFacebookTypingIndicator(recipientPsid, pageAccessToken, 'typing_off').catch(() => {})
    throw err
  } finally {
    clearInterval(timer)
  }
}

/**
 * Fetch Facebook user profile by Page-Scoped ID (PSID).
 * Returns name & profile picture if permissions allow, or fallback name.
 */
export async function fetchFacebookUserProfile(
  psid: string,
  pageAccessToken: string
): Promise<FacebookProfile> {
  const defaultFallback: FacebookProfile = {
    id: psid,
    name: `ลูกค้า Facebook (${psid.slice(-6)})`,
  }

  const cleanToken = pageAccessToken.trim()
  if (!cleanToken || !psid) return defaultFallback

  try {
    const url = `${GRAPH_API_BASE}/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${encodeURIComponent(cleanToken)}`
    const response = await fetch(url)
    if (!response.ok) {
      return defaultFallback
    }

    const data = await response.json()
    const fullName = data.name || (data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : null)

    return {
      id: psid,
      name: fullName || defaultFallback.name,
      first_name: data.first_name,
      last_name: data.last_name,
      profile_pic: data.profile_pic,
    }
  } catch {
    return defaultFallback
  }
}

/**
 * Send Facebook Quick Reply buttons (e.g. for FAQs or menu options)
 */
export async function sendFacebookQuickReplies(
  recipientPsid: string,
  text: string,
  quickReplies: Array<{ title: string; payload: string }>,
  pageAccessToken: string
): Promise<SendMessageResult> {
  const cleanToken = pageAccessToken.trim()
  if (!cleanToken) {
    return { success: false, error: 'Token is missing' }
  }

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const payload = {
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE',
      message: {
        text,
        quick_replies: quickReplies.map((q) => ({
          content_type: 'text',
          title: q.title.slice(0, 20),
          payload: q.payload,
        })),
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { success: false, error: data?.error?.message || 'Quick reply error' }
    }

    return { success: true, messageId: data.message_id }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Quick reply exception' }
  }
}

export interface FacebookProductCard {
  id: string
  name: string
  price: number
  stock?: number | null
  description?: string | null
  image_url?: string | null
}

/**
 * Send Facebook Generic Template Carousel with Product Cards, Images, Prices & Order Buttons
 */
export async function sendFacebookProductCarousel(
  recipientPsid: string,
  products: FacebookProductCard[],
  pageAccessToken: string
): Promise<SendMessageResult> {
  const cleanToken = pageAccessToken.trim()
  if (!cleanToken || !recipientPsid || !products || products.length === 0) {
    return { success: false, error: 'Missing token, recipient, or products' }
  }

  const defaultImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'

  const elements = products.slice(0, 10).map((p) => {
    const img = p.image_url && p.image_url.startsWith('http') ? p.image_url : defaultImage
    const priceText = `฿${Number(p.price || 0).toLocaleString('th-TH')}`
    const stockText = p.stock !== null && p.stock !== undefined ? (Number(p.stock) > 0 ? `พร้อมส่ง ${p.stock} ชิ้น` : 'สินค้าหมดชั่วคราว') : 'พร้อมส่ง'
    const descText = p.description ? `\n${p.description.slice(0, 40)}` : ''
    const subtitle = `${priceText} • ${stockText}${descText}`

    return {
      title: p.name.slice(0, 80),
      image_url: img,
      subtitle: subtitle.slice(0, 80),
      buttons: [
        {
          type: 'postback',
          title: '🛒 สั่งซื้อสินค้านี้',
          payload: `สนใจสั่งซื้อ ${p.name}`,
        },
      ],
    }
  })

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const payload = {
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements,
          },
        },
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('[Facebook Product Carousel Error]:', data)
      return { success: false, error: data?.error?.message || 'Failed to send product carousel' }
    }

    return { success: true, messageId: data.message_id }
  } catch (err: any) {
    console.error('[Facebook Product Carousel Exception]:', err)
    return { success: false, error: err?.message || 'Exception sending product carousel' }
  }
}

/**
 * Send an image attachment to a Facebook user via the Graph API /me/messages endpoint.
 */
export async function sendFacebookImage(
  recipientPsid: string,
  imageUrl: string,
  pageAccessToken: string
): Promise<SendMessageResult> {
  const cleanToken = pageAccessToken.trim()
  if (!cleanToken || !recipientPsid || !imageUrl) {
    return { success: false, error: 'Missing token, recipient, or image URL' }
  }

  try {
    const url = `${GRAPH_API_BASE}/me/messages`
    const payload = {
      recipient: { id: recipientPsid },
      messaging_type: 'RESPONSE',
      message: {
        attachment: {
          type: 'image',
          payload: {
            url: imageUrl,
            is_reusable: true,
          },
        },
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('[Facebook Image Send Error]:', data)
      return { success: false, error: data?.error?.message || 'Failed to send image' }
    }

    return { success: true, messageId: data.message_id }
  } catch (err: any) {
    console.error('[Facebook Image Send Exception]:', err)
    return { success: false, error: err?.message || 'Exception sending image' }
  }
}

// Messenger's button template limits
const BUTTON_TEMPLATE_MAX_TEXT = 640
const BUTTON_TEMPLATE_MAX_BUTTONS = 3
const BUTTON_TITLE_MAX = 20

/**
 * Send text with up to three link buttons (Messenger button template), the
 * Messenger stand-in for a LINE Flex card such as a quotation. Falls back to
 * plain text with the links written out if the template is rejected.
 */
export async function sendFacebookLinkButtons(
  recipientPsid: string,
  text: string,
  links: Array<{ label: string; url: string }>,
  pageAccessToken: string
): Promise<SendMessageResult> {
  const cleanToken = pageAccessToken.trim()
  if (!cleanToken || !recipientPsid || !text) {
    return { success: false, error: 'Missing token, recipient, or text' }
  }
  const usable = links.filter((l) => l.url).slice(0, BUTTON_TEMPLATE_MAX_BUTTONS)
  const asPlainText = () =>
    sendFacebookMessage(recipientPsid, [text, ...links.map((l) => `${l.label}: ${l.url}`)].join('\n'), cleanToken)
  if (usable.length === 0) return asPlainText()

  try {
    const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        messaging_type: 'RESPONSE',
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: text.slice(0, BUTTON_TEMPLATE_MAX_TEXT),
              buttons: usable.map((l) => ({ type: 'web_url', url: l.url, title: l.label.slice(0, BUTTON_TITLE_MAX) })),
            },
          },
        },
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('[Facebook Button Template Error]:', data)
      return asPlainText()
    }
    return { success: true, messageId: data.message_id }
  } catch (err: any) {
    console.error('[Facebook Button Template Exception]:', err)
    return asPlainText()
  }
}
