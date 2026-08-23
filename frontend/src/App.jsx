import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "./services/api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ConsentScreen from "./pages/ConsentScreen";
import FaceCheck from "./pages/FaceCheck";

// "/" doesn't have its own page - it just sends the visitor straight to
// wherever they actually belong depending on whether they're logged in.
function RootRedirect() {
  return getToken() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

// Wraps any route that needs a logged-in user. Both Dashboard and the
// consent screen need this, so it lives here once instead of each page
// repeating its own "no token -> back to login" check.
function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/consent"
          element={
            <RequireAuth>
              <ConsentScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/face-check"
          element={
            <RequireAuth>
              <FaceCheck />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
