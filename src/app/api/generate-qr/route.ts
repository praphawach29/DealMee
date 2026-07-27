import { NextRequest, NextResponse } from 'next/server';
import generatePayload from 'promptpay-qr';
import qrcode from 'qrcode';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, promptpayId } = body;

    if (!promptpayId) {
      return NextResponse.json({ error: 'promptpayId is required' }, { status: 400 });
    }

    // Generate PromptPay Payload
    // if amount is not provided or is 0, it generates a generic QR without amount
    const payload = generatePayload(promptpayId, { amount: amount ? parseFloat(amount) : undefined });
    
    // Generate QR Code Image as Data URL
    const qrImage = await qrcode.toDataURL(payload, {
      color: { dark: '#000', light: '#fff' },
    });

    return NextResponse.json({ 
      payload,
      qrImage 
    });
  } catch (error) {
    console.error('QR Generate Error:', error);
    return NextResponse.json({ error: 'Failed to generate QR Code' }, { status: 500 });
  }
}
