import { Routes, Route, } from 'react-router-dom';
import ListDetail from './pages/ListDetail';

function App() {
  return (
 
      <Routes>
        <Route path="/list/:id" element={<ListDetail />} />
      </Routes>
   
  );
}

export default App;