import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
app.set("trust proxy", 1);
app.use(cors());

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUCCESS_URL, CANCEL_URL } = process.env;
if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Stripe webhook MUST be raw body and must be registered BEFORE express.json()
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      // TODO: record donation in DB
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// JSON parser for all NON-webhook routes
app.use(express.json());

// Health check
app.get("/", (req, res) => res.send("NourishLink Stripe server running"));

// Create checkout session
app.post("/create-checkout-session", async (req, res) => {
  // your existing logic
});
