import StripeProvider from './components/StripeProvider';
import PaymentForm from './components/PaymentForm';

const App = () => (
  <StripeProvider>
    <div className="App">
      <h1>Stripe Payment Integration</h1>
      <PaymentForm />
    </div>
  </StripeProvider>
);

export default App;
