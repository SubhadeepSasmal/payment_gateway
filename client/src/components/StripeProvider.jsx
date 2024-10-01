import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PropTypes from 'prop-types';

const stripePromise = loadStripe('pk_test_51PxSv0FLLht3FRDdSydVyf0cE9BWWKvdBzhn7Pt8zYjB2Z6JBb9xlail34F85JQsp1NLzFhlzExODlX4NgJDl5PM001w3rVUQv');

const StripeProvider = ({ children }) => {
  return <Elements stripe={stripePromise}>{children}</Elements>;
};

StripeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default StripeProvider;
