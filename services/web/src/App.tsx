import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Auth } from "./components/Auth";
import { Callback } from "./components/Callback";
import { Logout } from "./components/Logout";
import { SignUp } from "./pages/SignUp";
import { ConfirmSignUp } from "./pages/ConfirmSignUp";
import { ProtectedPage } from "./pages/ProtectedPage";
import { Home } from "./pages/Home";
import { SignIn } from "./pages/SignIn";
import { ConfigureDomain } from "./pages/ConfigureDomain";
import { ConfigureSSO } from "./pages/ConfigureSSO";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route
            path="/home"
            element={
              <ProtectedPage>
                <Home />
              </ProtectedPage>
            }
          />
          <Route
            path="/configure-domain"
            element={
              <ProtectedPage>
                <ConfigureDomain />
              </ProtectedPage>
            }
          />
          <Route
            path="/configure-sso"
            element={
              <ProtectedPage>
                <ConfigureSSO />
              </ProtectedPage>
            }
          />
          <Route path="/confirm-sign-up" element={<ConfirmSignUp />} />
          <Route path="/" element={<Auth />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
