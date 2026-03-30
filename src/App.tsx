import RegistrationPage from './pages/RegistrationPage';
import './App.css'; // THIS IS THE IMPORT THAT MAKES IT WORK!

function App() {
  return (
    <div className="auth-container">
      <RegistrationPage />
    </div>
  );
}

export default App;