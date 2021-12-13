import { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import Stripe from "stripe";
import { stripe } from "../../services/stripe";
import { saveSubscription } from "./_handlers/manageSubscription";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable: Readable) {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

enum Events {
  CHECKOUT_SESSION_COMPLETED = "checkout.session.completed",
}

const events = new Set([Events.CHECKOUT_SESSION_COMPLETED as string]);

const webhookHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).end("Method not allowed");
  }

  const buf = await buffer(req);

  const secret = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      secret,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  const { type } = event;

  if (events.has(type)) {
    try {
      switch (type) {
        case Events.CHECKOUT_SESSION_COMPLETED:
          const checkoutSession = event.data.object as Stripe.Checkout.Session;

          await saveSubscription(
            checkoutSession.subscription.toString(),
            checkoutSession.customer.toString()
          );
          break;
        default:
          throw new Error("Unhandled event");
      }
    } catch (error) {
      console.error(error);
      return res.json({ error: "Webhook handler failed" });
    }
  }

  return res.json({ received: true });
};

export default webhookHandler;
