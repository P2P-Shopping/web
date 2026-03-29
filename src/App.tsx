import { Routes, Route, Navigate } from 'react-router-dom';
import ListDetail from './pages/ListDetail';
function App() {
  return (
      <Routes>
        <Route path="/list/:id" element={<ListDetail />} />
        <Route path="/" element={<Navigate to="/list/default" replace />} />
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
  );
}
export default App;