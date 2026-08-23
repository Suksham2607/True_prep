import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "./services/api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

// "/" doesn't have its own page - it just sends the visitor straight to
// wherever they actually belong depending on whether they're logged in.
function RootRedirect() {
  return getToken() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
