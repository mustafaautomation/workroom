import { NextResponse } from "next/server";
import { markInvoicePaid } from "@/lib/work/service";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = await getStripe();
  if (!stripe || !secret) return NextResponse.json({ received: false, mode: "mock" });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });
  const payload = await request.text();
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);
    if (event.type === "checkout.session.completed") {
      const invoiceId = event.data.object.metadata?.invoiceId;
      if (invoiceId && event.data.object.payment_status === "paid") {
        await markInvoicePaid(invoiceId);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return new NextResponse("Invalid signature", { status: 400 });
  }
}
