import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
app.set("trust proxy", 1);

// JSON for normal routes
app.use(cors());
app.use(express.json());

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUCCESS_URL,
  CANCEL_URL
} = process.env;

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Health check
app.get("/", (req, res) => {
  res.send("NourishLink Stripe server running");
});

// Create Stripe Checkout Session
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { amount, organization, destinationAccountId } = req.body;

    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 100 || amt > 1000000) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Donation to ${organization}` },
            unit_amount: amt
          },
          quantity: 1
        }
      ],
      payment_intent_data: {
        transfer_data: {
          destination: destinationAccountId
        }
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook (raw body required)
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        // Later: record donation in database
      }

      res.json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

const port = process.env.PORT || 4242;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
