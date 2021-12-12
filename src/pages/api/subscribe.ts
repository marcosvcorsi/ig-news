import { NextApiRequest, NextApiResponse } from "next";
import { query as q } from "faunadb";
import { getSession } from "next-auth/react";
import { fauna } from "../../services/fauna";
import { stripe } from "../../services/stripe";

type User = {
  ref: {
    id: string;
  };
  data: {
    email: string;
    stripe_customer_id?: string;
  };
};

const createStripCheckoutSession = (customerId: string, priceId: string) => {
  return stripe.checkout.sessions.create({
    customer: customerId,
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
};

const findUserByEmail = (email: string) => {
  return fauna.query<User>(
    q.Get(q.Match(q.Index("user_by_email"), q.Casefold(email)))
  );
};

const saveUserWithCustomerInfo = (userId: string, customerId: string) => {
  return fauna.query(
    q.Update(q.Ref(q.Collection("users"), userId), {
      data: {
        stripe_customer_id: customerId,
      },
    })
  );
};

const subscribe = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).end("Method not allowed");
  }

  try {
    const session = await getSession({ req });

    const { email } = session.user;

    const user = await findUserByEmail(email);

    let customerId = user.data.stripe_customer_id;

    if (!customerId) {
      const stripeCustomer = await stripe.customers.create({
        email,
      });

      customerId = stripeCustomer.id;

      await saveUserWithCustomerInfo(user.ref.id, customerId);
    }

    const { priceId } = req.body;

    const stripeCheckoutSession = await createStripCheckoutSession(
      customerId,
      priceId
    );

    return res.status(200).json({ sessionId: stripeCheckoutSession.id });
  } catch (error) {
    console.error(error);

    return res.status(500).json({ error: error.message });
  }
};

export default subscribe;
