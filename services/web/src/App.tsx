import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Auth } from "./components/Auth";
import { Callback } from "./components/Callback";
import { Logout } from "./components/Logout";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/" element={<Auth />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
