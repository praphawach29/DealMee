/**
 * Messenger / Instagram event handling shared by both webhooks: the per-shop route
 * (/api/webhook/facebook/[shop_id], for shops that set up their own Meta app) and the
 * platform route (/api/webhook/facebook, DealMee's reviewed app, which finds the shop
 * from the page id). Both verify the request, answer Meta, then call this in after().
 */
import { notifyQuotaExhausted } from '@/lib/billing/ownerAlerts'
import { adminPausePayload, isPauseExpired, resumePayload } from '@/lib/inbox/adminPause'
import { isHandoffRequest } from '@/lib/ai/thaiMatch'
import { alertIfUpset } from '@/lib/ai/upsetAlert'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendFacebookMessage,
  withFacebookTyping,
  fetchFacebookUserProfile,
  sendFacebookProductCarousel,
  sendFacebookImage,
  sendFacebookLinkButtons,
} from '@/lib/facebook/messengerHelper'
import { processSalesAgentChat, detectIntent } from '@/lib/ai/salesAgentEngine'
import { incrementUsage } from '@/lib/billing/usage'
import { upsertCustomerProfile } from '@/lib/customerMemory'
import { settleSlipImage } from '@/lib/slip/settleSlip'
import {
  isKeywordProductQuery,
  isProductCardSuppressed,
  mergeProductCards,
  resolveChannelProductCards,
} from '@/lib/ai/productCards'
import { scheduleCustomerMessage } from '@/lib/ai/proactiveFollowUp'
import { shopSkillsTelemetryEnabled } from '@/lib/ai/shopSkillsRollout'

const supabase = createAdminClient()

export async function processMessengerEntries({
  entries, shop, shopId: shop_id, pageToken, features, isAutoReplyEnabled, isFacebook, isInstagram, targetPlatform,
}: {
  entries: any[]
  shop: Record<string, any>
  shopId: string
  pageToken: string
  features: Record<string, boolean>
  isAutoReplyEnabled: boolean
  isFacebook: boolean
  isInstagram: boolean
  targetPlatform: 'facebook' | 'instagram'
}) {
  // Upset-customer checks run alongside the bot's reply; awaited at the end so after() keeps them alive
  const upsetChecks: Promise<void>[] = []
  const skillsTelemetryEnabled = shopSkillsTelemetryEnabled(features)

  for (const entry of entries) {
    const messagingList = entry.messaging || []

    for (const event of messagingList) {
      // Skip message echoes (sent by page) or delivery confirmations
      if (event.message?.is_echo || event.delivery || event.read) {
        continue
      }

      const senderPsid = event.sender?.id
      const recipientPageId = event.recipient?.id
      const rawMessage = event.message?.text || event.postback?.payload || event.postback?.title

      // A picture with no text: most often a payment slip, checked the same way as on LINE
      const imageAttachment = (event.message?.attachments || []).find((a: any) => a?.type === 'image' && a?.payload?.url)
      if (senderPsid && imageAttachment && !event.message?.text) {
        if (pageToken && isAutoReplyEnabled && (await claimMessengerEvent(event.message?.mid, shop_id))) {
          if (features.slip_verify === false) {
            // Slip checks are switched off: same reply as LINE, an admin looks at it
            await sendFacebookMessage(senderPsid, 'ได้รับรูปภาพเรียบร้อยแล้วค่ะ แอดมินจะเข้ามาตรวจสอบให้นะคะ 😊', pageToken)
          } else {
            await withFacebookTyping(senderPsid, pageToken, () =>
              handleMessengerImage({ shop, shopId: shop_id, platform: targetPlatform, psid: senderPsid, url: imageAttachment.payload.url, mid: event.message?.mid, pageToken })
            )
          }
        }
        continue
      }

      if (!senderPsid || !rawMessage) {
        continue
      }

      // Meta redelivers when a webhook answers slowly or fails; never answer the same message twice
      if (event.message?.mid && !(await claimMessengerEvent(event.message.mid, shop_id))) {
        console.log(`[Facebook Webhook] Skipping already-processed message ${event.message.mid}`)
        continue
      }

      const cleanText = String(rawMessage).trim()

      // 3. Find or Create Conversation
      let { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('shop_id', shop_id)
        .eq('platform', targetPlatform)
        .eq('user_id', senderPsid)
        .maybeSingle()

      if (!conv) {
        // Attempt to fetch user profile (Facebook or Instagram fallback)
        const profile = isFacebook
          ? await fetchFacebookUserProfile(senderPsid, pageToken)
          : { name: `ลูกค้า Instagram (${senderPsid.slice(-4)})`, profile_pic: null }

        const { data: newConv, error: convCreateError } = await supabase
          .from('conversations')
          .insert({
            shop_id,
            user_id: senderPsid,
            platform_sender_id: senderPsid,
            channel_account_id: recipientPageId || shop.facebook_page_id || null,
            customer_name: profile.name,
            customer_avatar: profile.profile_pic || null,
            platform: targetPlatform,
            last_message: cleanText,
            status: 'ai',
            ai_mode: 'auto',
          })
          .select()
          .single()

        if (convCreateError || !newConv) {
          console.error('[Meta Webhook] Error creating conversation:', convCreateError)
          continue
        }
        conv = newConv
      } else {
        await supabase
          .from('conversations')
          .update({
            last_message: cleanText,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conv.id)
      }

      if (!conv) continue

      // 4. Update Customer Memory Profile
      await upsertCustomerProfile(shop_id, senderPsid, conv.customer_name)

      // 5. Save incoming message into chat_messages
      const { data: savedUserMsg } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conv.id,
          shop_id,
          sender_type: 'user',
          sender_name: conv.customer_name || (isInstagram ? 'ลูกค้า Instagram' : 'ลูกค้า Facebook'),
          message: cleanText,
          platform: targetPlatform,
          platform_message_id: event.message?.mid || null,
          ...(skillsTelemetryEnabled ? { intent: detectIntent(cleanText, []) } : {}),
        })
        .select('id')
        .single()

      upsetChecks.push(alertIfUpset({ shop, conversation: conv, message: cleanText }))

      // 6. Check for Pause/Admin Commands
      const isPauseCommand = isHandoffRequest(cleanText)

      if (isPauseCommand) {
        console.log(`[Facebook Webhook] Explicit pause command detected for PSID: ${senderPsid}`)
        await supabase.from('conversations').update(adminPausePayload()).eq('id', conv.id)

        if (pageToken) {
          await sendFacebookMessage(
            senderPsid,
            'รับเรื่องเรียบร้อยแล้วค่ะ น้องบอทได้หยุดการตอบชั่วคราวและประสานงานเจ้าหน้าที่แอดมินให้แล้วนะคะ สักครู่จะมีเจ้าหน้าที่เข้ามาดูแลค่ะ 😊',
            pageToken
          )
        }
        continue
      }

      // 7. Check if Admin Takeover is active
      if (conv.status === 'human') {
        const isExplicitReset = cleanText.startsWith('/ai') || (await isPauseExpired(supabase, conv))

        if (isExplicitReset) {
          console.log(`[Facebook Webhook] Auto-resuming AI mode for PSID ${senderPsid}`)
          await supabase.from('conversations').update(resumePayload()).eq('id', conv.id)
          conv.status = 'ai'
          conv.ai_mode = 'auto'
          if (cleanText.startsWith('/ai') && pageToken) {
            await sendFacebookMessage(
              senderPsid,
              'น้องบอท AI กลับมาพร้อมดูแลคุณลูกค้าต่อแล้วค่ะ มีอะไรให้ช่วยสอบถามได้เลยนะคะ ✨',
              pageToken
            )
            continue
          }
        } else {
          console.log(`[Facebook Webhook] Skipping AI reply for PSID ${senderPsid} (Admin Takeover active)`)
          continue
        }
      }

      if (!isAutoReplyEnabled) {
        console.log(`[Facebook Webhook] Skipping AI reply for shop ${shop_id} (Auto-Reply disabled)`)
        continue
      }

      // 8-9. Call AI Sales Agent Engine with the typing bubble showing until the answer is ready
      const agentResult = await withFacebookTyping(senderPsid, pageToken, () =>
        processSalesAgentChat({
          shop,
          userQuery: cleanText,
          userId: senderPsid,
          conversationId: conv.id,
          supabaseClient: supabase,
        })
      )
      if (agentResult.quotaExceeded) {
        notifyQuotaExhausted(shop).catch((err) => console.error('[FB Webhook] quota alert failed:', err))
      }

      const aiReplyText = agentResult?.text?.trim() || ''

      // Same carousel choice as LINE: tool rows first, keyword fallback only when
      // search_products / check_stock returned nothing. One carousel per reply.
      const toolNames = (agentResult.toolCallsExecuted || []).map((t) => t.name)
      const suppressProductCards =
        features.product_recommend === false || isProductCardSuppressed(cleanText, toolNames)
      const toolCards = suppressProductCards ? [] : mergeProductCards([], agentResult.productsData)
      let keywordCatalog: unknown[] = []
      if (!suppressProductCards && toolCards.length === 0 && pageToken && isKeywordProductQuery(cleanText)) {
        const { data: shopProducts } = await supabase
          .from('products')
          .select('id, name, price, stock, category, description, image_url')
          .eq('shop_id', shop_id)
          .limit(10)
        keywordCatalog = shopProducts || []
      }
      const fbProducts = resolveChannelProductCards({
        suppress: suppressProductCards,
        toolProducts: agentResult.productsData,
        userText: cleanText,
        catalogProducts: keywordCatalog,
      })

  // 10. Check conversation ai_mode:
  // - 'copilot': Save draft suggestion in chat_messages for admin approval
  // - 'auto': Deliver response to Facebook user via Graph API
  // - 'manual': Skip sending
  // ── Phase 0: auto-detect conversation outcome ───────────────────────────────
  // NOTE: 'conversion' is recorded by settleSlip.ts (actual payment).  Here we
  // only auto-tag 'handoff' (customer asked for a human), which is terminal.
  const executedTools = (agentResult.toolCallsExecuted || []).map((t) => t.name)
  const isHandoff = executedTools.includes('request_human_agent')
  if (skillsTelemetryEnabled && isHandoff) {
    const { error } = await supabase.rpc('set_conversation_outcome', {
      p_conversation_id: conv.id,
      p_outcome: 'handoff',
      p_shop_id: shop_id,
      p_source: `${targetPlatform}_handoff`,
    })
    if (error) console.error('[FB Webhook] set_conversation_outcome failed:', error.message)
  }

      if (conv.ai_mode === 'copilot') {
        console.log(`[Facebook Webhook] Conversation in Copilot mode for ${senderPsid}. Saving draft suggestion.`)
        if (savedUserMsg?.id && aiReplyText) {
          await supabase
            .from('chat_messages')
            .update({
              ai_suggested_reply: aiReplyText,
            })
            .eq('id', savedUserMsg.id)
        }
        continue
      }

      if (conv.ai_mode === 'auto' && (aiReplyText || fbProducts.length > 0)) {
        // Save AI reply message in database
        if (aiReplyText) {
          await supabase.from('chat_messages').insert({
            conversation_id: conv.id,
            shop_id,
            sender_type: 'agent',
            sender_name: shop.bot_name || 'น้องบอท Dealmee',
            message: aiReplyText,
            platform: targetPlatform,
            ...(skillsTelemetryEnabled
              ? { ai_confidence: agentResult.ai_confidence, intent: agentResult.intent }
              : {}),
          })

          // Update conversation last message
          await supabase
            .from('conversations')
            .update({
              last_message: aiReplyText,
              last_message_at: new Date().toISOString(),
            })
            .eq('id', conv.id)

          // Deliver text reply to customer on Facebook
          if (pageToken) {
            await sendFacebookMessage(senderPsid, aiReplyText, pageToken)
          }
        }

        // Deliver product carousel if products were found
        if (pageToken && fbProducts.length > 0) {
          await sendFacebookProductCarousel(senderPsid, fbProducts, pageToken)
        }

        // Deliver any immediate messages (e.g. PromptPay QR image)
        if (pageToken && agentResult.immediateMessages && agentResult.immediateMessages.length > 0) {
          for (const im of agentResult.immediateMessages) {
            if (im.type === 'image' && im.content) {
              await sendFacebookImage(senderPsid, im.content, pageToken)
            } else if (im.type === 'text' && im.content) {
              await sendFacebookMessage(senderPsid, im.content, pageToken)
            } else if (im.type === 'flex' && im.content) {
              // LINE Flex cards (quotations, official letters) can't render here: send their links as buttons
              await sendFacebookLinkButtons(senderPsid, im.content, im.links || [], pageToken)
            }
          }
        }

        // Messages the AI asked to send later (schedule_followup), delivered by the follow-up cron
        for (const scheduled of agentResult.scheduledMessages) {
          await scheduleCustomerMessage({
            shopId: shop_id,
            conversationId: conv.id,
            userId: senderPsid,
            message: scheduled.message.content,
            delayMs: scheduled.delayMs,
          })
        }

        // Bill message usage
        incrementUsage(shop_id, { totalTokens: agentResult.usage?.totalTokens || 0 }).catch((err) =>
          console.error('[Billing Usage Error]:', err)
        )
        if (agentResult.usage) {
          const { incrementProviderUsage } = await import('@/lib/billing/usage')
          incrementProviderUsage(shop_id, agentResult.usage).catch((err) =>
            console.error('[Provider Usage Error]:', err)
          )
        }
      }
    }
  }

  await Promise.allSettled(upsetChecks)
}

/**
 * Records a Messenger message id so a redelivered image isn't checked (and
 * possibly settled) twice. Fails open when the table is unavailable.
 */
async function claimMessengerEvent(mid: string | undefined, shopId: string): Promise<boolean> {
  if (!mid) return true
  const { error } = await supabase.from('processed_webhook_events').insert({ event_id: `fb:${mid}`, shop_id: shopId })
  if (!error) return true
  if (error.code === '23505') return false
  console.warn('[FB Webhook] Could not record event (dedupe skipped):', error.message)
  return true
}

const MAX_SLIP_IMAGE_BYTES = 8 * 1024 * 1024

async function handleMessengerImage(args: {
  shop: Record<string, any>
  shopId: string
  platform: 'facebook' | 'instagram'
  psid: string
  url: string
  mid?: string
  pageToken: string
}) {
  const { shop, shopId, platform, psid, url, mid, pageToken } = args
  const send = async (text: string) => { await sendFacebookMessage(psid, text, pageToken) }
  try {
    // Attachment URLs point at Meta's CDN; anything else is not something we fetch
    const host = new URL(url).hostname
    if (!/(^|\.)(fbcdn\.net|fbsbx\.com|cdninstagram\.com|facebook\.com)$/.test(host)) {
      console.warn('[FB SlipVerify] Ignoring image from unexpected host:', host)
      await send('ได้รับรูปภาพแล้วค่ะ แอดมินจะเข้ามาตรวจสอบให้นะคะ 😊')
      return
    }
    const res = await fetch(url)
    const size = Number(res.headers.get('content-length') || 0)
    if (!res.ok || size > MAX_SLIP_IMAGE_BYTES) {
      await send('❌ ไม่สามารถเปิดรูปที่ส่งมาได้ค่ะ กรุณาส่งใหม่อีกครั้งนะคะ')
      return
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.byteLength > MAX_SLIP_IMAGE_BYTES) {
      await send('❌ รูปมีขนาดใหญ่เกินไปค่ะ กรุณาส่งภาพหน้าจอสลิปแทนนะคะ')
      return
    }
    await settleSlipImage({
      shop,
      shopId,
      platform,
      userId: psid,
      image: { base64: buffer.toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' },
      imageRef: mid || 'unknown',
      sendToCustomer: send,
    })
  } catch (err) {
    console.error('[FB SlipVerify Exception]:', err)
    await send('❌ ระบบตรวจสลิปขัดข้องชั่วคราวค่ะ กรุณาแจ้งแอดมินนะคะ 🙏').catch(() => {})
  }
}
