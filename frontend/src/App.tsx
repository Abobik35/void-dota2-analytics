import { Link, Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import MatchPage from "./pages/Match";
import AccountMenu from "./components/AccountMenu";
import PatchNotes from "./components/PatchNotes";
import ComparePage from "./pages/Compare";
import PlayerPage from "./pages/Player";

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <header className="bar">
        <Link to="/" className="brand"><span className="mark" />VOID<small>Dota 2 Analytics</small></Link>
        <nav className="nav"><Link to="/compare">Сравнить игроков</Link><PatchNotes /><AccountMenu /></nav>
      </header>
      <main className="wrap">
        <div key={pathname} className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match/:matchId" element={<MatchPage />} />
          <Route path="/player/:accountId" element={<PlayerPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<p className="empty">Такой страницы нет. Вернитесь на главную.</p>} />
        </Routes>
        </div>
      </main>
    </>
  );
}
