import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TryOnPage from './pages/TryOnPage';
import FAQPage from './pages/FAQPage';
import AccountPage from './pages/AccountPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/try-on" element={<TryOnPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
