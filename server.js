import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
app.set("trust proxy", 1);
app.use(cors());

const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUCCESS_URL,
  CANCEL_URL
} = process.env;

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!SUCCESS_URL) throw new Error("Missing SUCCESS_URL");
if (!CANCEL_URL) throw new Error("Missing CANCEL_URL");

const stripe = new Stripe(STRIPE_SECRET_KEY);

// --- Webhook MUST use raw body and MUST be defined before express.json() ---
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
    }

    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    // Handle events you care about
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      console.log("checkout.session.completed:", session.id);
      // TODO: write donation record to your database
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

// Create checkout session (destination charge to connected nonprofit)
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { amount, organization, destinationAccountId } = req.body;

    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 100 || amt > 1000000) {
      return res.status(400).json({ error: "Invalid amount (cents)." }); // $1–$10,000
    }
    if (!organization || typeof organization !== "string") {
      return res.status(400).json({ error: "Invalid organization." });
    }
    if (!destinationAccountId || typeof destinationAccountId !== "string") {
      return res.status(400).json({ error: "Missing destinationAccountId." });
    }

    // IMPORTANT (pre-launch security requirement):
    // Do not accept destinationAccountId directly from the app in production.
    // Instead accept orgId and look up the connected account ID server-side
    // after verifying the org is approved.

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
        transfer_data: { destination: destinationAccountId }
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// MUST listen on process.env.PORT for Render
const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`Server running on port ${port}`));
