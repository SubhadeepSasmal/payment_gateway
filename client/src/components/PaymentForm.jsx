import { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import axios from 'axios';

const PaymentForm = () => {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSubscription, setIsSubscription] = useState(false); // State to toggle between payment and subscription
  const stripe = useStripe();
  const elements = useElements();

  const priceId = 'price_1Q2caxFLLht3FRDdBF1kZEfC';

  // handel one-time payment./////////////////////////////////////////////
  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    try {
      const { data: { clientSecret } } = await axios.post('http://localhost:5000/create-payment-intent', { amount });
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (error) {
        console.error('Payment failed:', error.message);
        alert('Payment failed');
      }
      else if (paymentIntent.status === 'succeeded') {
        alert('Payment successful!');
      }
    }
    catch (error) {
      console.error('Error processing payment:', error.message);
      alert('Payment error');
    }
    finally {
      setLoading(false);
    }
  };

  // handel subscription payment./////////////////////////////////////////////////
  const handleSubscriptionSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    try {
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
        billing_details: {
          email,
        },
      });

      if (error) {
        console.error('Error creating payment method:', error.message);
        return;
      }

      const { data } = await axios.post('http://localhost:5000/create-subscription', {
        customerEmail: email,
        paymentMethodId: paymentMethod.id,
        priceId,
      });

      const { clientSecret } = data;

      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret); 
      if (confirmError) {
        console.error('Payment failed:', confirmError.message);
        alert('Payment failed');
      }
      else {
        alert('Subscription successful');
      }
    }
    catch (error) {
      console.error('Error processing subscription:', error.message);
      alert('Subscription failed');
    }
    finally {
      setLoading(false);
    }
  };

  // handel cancel subscription.////////////////////////////////////////////////
  const handleCancelSubscription = async () => {
    try {
      const subscriptionId = prompt("Enter the subscription ID to cancel:");  // Adjust this to retrieve the actual subscription ID
      if (!subscriptionId) {
        alert('No active subscription found');
        return;
      }
      await axios.post('http://localhost:5000/cancel-subscription', { subscriptionId });
      alert('Subscription canceled successfully');
    } catch (error) {
      console.error('Error canceling subscription:', error.message);
      alert('Failed to cancel subscription');
    }
  };
  
  return (
    <div>
      <div>
        <button onClick={() => setIsSubscription(false)}>One-Time Payment</button>
        <button onClick={() => setIsSubscription(true)}>Subscription</button>

      </div>
      <form onSubmit={isSubscription ? handleSubscriptionSubmit : handlePaymentSubmit}>
        {isSubscription && (
          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='Enter email'
            required
          />
        )}
        {!isSubscription && (
          <input
            type="number"
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in USD"
            required
          />
        )}
        <CardElement />
        <button type="submit" disabled={!stripe || loading}>
          {loading ? 'Processing...' : isSubscription ? 'Subscribe' : 'Pay'}
        </button>
      </form>
      {isSubscription && <button onClick={handleCancelSubscription}>Cancel Subscription</button>}
    </div>
  );
};

export default PaymentForm;
