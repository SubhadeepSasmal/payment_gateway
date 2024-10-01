require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const PORT = 5000;

// Middlewares./////////////////////////////////////////
app.use(cors({ origin: 'http://localhost:5173' }));

app.use((req, res, next) => {
  if (req.originalUrl === '/webhooks') {
    next();  
  }
  else {
    bodyParser.json()(req, res, next);  
  }
});

app.use('/webhooks', bodyParser.raw({ type: 'application/json' }));

// Database setup.//////////////////////////////////////////////////
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: 'localhost',
  dialect: 'mysql',
});

// Sync db./////////////////////////////////////////////////////
sequelize.sync().then(() => {
  console.log('Database synced');
});

// create pyment db./////////////////////////////////////////////
const Payment = sequelize.define('Payment', {
  stripePaymentId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
});

// subscription db.////////////////////////////////////////////////////////
const Subscription = sequelize.define('Subscription', {
  stripeSubscriptionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  customerId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  currentPeriodEnd: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
});

//  Create Payment Intent.//////////////////////////////////////////
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 83,  
      currency: 'usd',
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  }
  catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).send('Error creating payment intent');
  }
});

// Webhook.//////////////////////////////////////////////////////////
app.post('/webhooks', async(req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
  
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }
  catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event.///////////////////////////////////////////////
  switch (event.type) {
    case 'payment_intent.succeeded':

      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful:', paymentIntent.id);
      
      //save payment in db/////////////////////////////////////
      try {
        await Payment.create({
          stripePaymentId: paymentIntent.id,
          amount: paymentIntent.amount,
          status: paymentIntent.status,
        });

        console.log('payment save in db');
      }
      catch (error) {
        console.log('error payment save in db', error);
      }

    break;
    
    case 'payment_intent.payment_failed':

      const failedPaymentIntent = event.data.object;
      console.error('Payment failed:', failedPaymentIntent.id);
      
    break;
    
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer;
      const currentPeriodEnd = new Date();

      // update subscription payment in db.///////////////////////////////////////////
      try {
        await Subscription.create({
          stripeSubscriptionId: subscriptionId,
          customerId: customerId,
          status: invoice.status,
          currentPeriodEnd:currentPeriodEnd,
        });

        console.log(`Subscription ${subscriptionId} is now active.`);
      }
      catch (error) {
        console.log('Error subscription:', error);
      }
    break;
    
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      const failedSubscriptionId = failedInvoice.subscription;

        console.log('error updating subscription', failedSubscriptionId);
    break;
    
    case 'customer.subscription.deleted':
    const deletedSubscription = event.data.object;
    const deletedSubscriptionId = deletedSubscription.id;

    // Update the subscription status in the database
    try {
      await Subscription.update(
      { status: 'canceled' },
      { where: { stripeSubscriptionId: deletedSubscriptionId } }
      );
      console.log(`Subscription ${deletedSubscriptionId} has been canceled.`);
    }
    catch (error) {
      console.log('Error updating subscription status:', error);
  }
  break;

    default:
    console.log(`Unhandled event type ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

// Create Subscription Route.//////////////////////////////////////////////////////
app.post('/create-subscription', async (req, res) => {
  const { customerEmail, paymentMethodId, priceId } = req.body;

  try {
    // Create a new customer.////////////////////////////////////////////////////////
    const customer = await stripe.customers.create({
      email: customerEmail,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Create a subscription.///////////////////////////////////////////////////
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],  
      expand: ['latest_invoice.payment_intent'],
    });

    // Respond with the client secret for confirmation
    res.send({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      customerId: customer.id,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).send('Error creating subscription');
  }
});

// Cancel Subscription Route.//////////////////////////////////////////////////////
app.post('/cancel-subscription', async (req, res) => {
  const { subscriptionId } = req.body;
  
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
        res.json({ success: true, subscription });
  }
  catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).send('Error cancelling subscription');
  }
});


// Start server.///////////////////////////////////////////////////////
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

