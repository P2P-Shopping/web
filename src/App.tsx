import RegistrationPage from './pages/RegistrationPage';
import './App.css'; // THIS IS THE IMPORT THAT MAKES IT WORK!

function App() {
  const handleAuthSuccess = (authResult: any) => {
    console.info('Authentication successful');
    // TODO: Switch view state or navigate to authenticated app flow
    // For now, logging the auth result
  };

  return (
    <div className="auth-container">
      <RegistrationPage onAuthSuccess={handleAuthSuccess} />
    </div>
  );
}

export default App;