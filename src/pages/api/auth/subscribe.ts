import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { stripe } from "../../../services/stripe";

const subscribe = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).end("Method not allowed");
  }

  try {
    const { user } = await getSession({ req });

    const stripeCustomer = await stripe.customers.create({
      email: user.email,
    });

    const { priceId } = req.body;

    const stripeCheckoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      payment_method_types: ["card"],
      billing_address_collection: "required",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: process.env.STRIPE_CHECKOUT_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CHECKOUT_CANCEL_URL,
    });

    return res.status(200).json({ sessionId: stripeCheckoutSession.id });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: error.message });
  }
};

export default subscribe;
