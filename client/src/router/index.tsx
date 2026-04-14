import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminContext } from '../context/AdminContext';

// Pages
import Landing from '../pages/Landing';
import JoinPage from '../pages/student/JoinPage';
import BuzzerPage from '../pages/student/BuzzerPage';
import StudentGamePage from '../pages/student/StudentGamePage';
import LeaderboardPage from '../pages/student/LeaderboardPage';

// Admin
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminDashboard from '../pages/admin/AdminDashboard';
import CoursesPage from '../pages/admin/CoursesPage';
import QuestionBankPage from '../pages/admin/QuestionBankPage';
import GameLaunchPage from '../pages/admin/GameLaunchPage';
import ImportPage from '../pages/admin/ImportPage';
import SessionHistoryPage from '../pages/admin/SessionHistoryPage';
import SettingsPage from '../pages/admin/SettingsPage';

// Game host views
import JeopardyHostView from '../pages/games/JeopardyHostView';
import JeopardyDisplayView from '../pages/games/JeopardyDisplayView';
import KahootHostView from '../pages/games/KahootHostView';
import SpeedRoundHostView from '../pages/games/SpeedRoundHostView';
import BattleRoyaleHostView from '../pages/games/BattleRoyaleHostView';
import MillionaireHostView from '../pages/games/MillionaireHostView';
import WagerHostView from '../pages/games/WagerHostView';
import BingoHostView from '../pages/games/BingoHostView';
import RankedHostView from '../pages/games/RankedHostView';
import TeamTakeoverHostView from '../pages/games/TeamTakeoverHostView';
import EscapeRoomHostView from '../pages/games/EscapeRoomHostView';
import HotSeatHostView from '../pages/games/HotSeatHostView';
import CodeBreakerHostView from '../pages/games/CodeBreakerHostView';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminContext();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Student Routes */}
      <Route path="/join" element={<JoinPage />} />
      <Route path="/student/game" element={<StudentGamePage />} />
      <Route path="/student/buzzer" element={<BuzzerPage />} />
      <Route path="/student/leaderboard" element={<LeaderboardPage />} />

      {/* Admin Auth */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Admin Protected Routes */}
      <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/courses" element={<RequireAdmin><CoursesPage /></RequireAdmin>} />
      <Route path="/admin/banks" element={<RequireAdmin><QuestionBankPage /></RequireAdmin>} />
      <Route path="/admin/launch" element={<RequireAdmin><GameLaunchPage /></RequireAdmin>} />
      <Route path="/admin/import" element={<RequireAdmin><ImportPage /></RequireAdmin>} />
      <Route path="/admin/history" element={<RequireAdmin><SessionHistoryPage /></RequireAdmin>} />
      <Route path="/admin/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />

      {/* Game Host Views */}
      <Route path="/game/jeopardy" element={<RequireAdmin><JeopardyHostView /></RequireAdmin>} />
      <Route path="/game/jeopardy/display" element={<JeopardyDisplayView />} />
      <Route path="/game/kahoot" element={<RequireAdmin><KahootHostView /></RequireAdmin>} />
      <Route path="/game/speedround" element={<RequireAdmin><SpeedRoundHostView /></RequireAdmin>} />
      <Route path="/game/battleroyale" element={<RequireAdmin><BattleRoyaleHostView /></RequireAdmin>} />
      <Route path="/game/millionaire" element={<RequireAdmin><MillionaireHostView /></RequireAdmin>} />
      <Route path="/game/wager" element={<RequireAdmin><WagerHostView /></RequireAdmin>} />
      <Route path="/game/bingo" element={<RequireAdmin><BingoHostView /></RequireAdmin>} />
      <Route path="/game/ranked" element={<RequireAdmin><RankedHostView /></RequireAdmin>} />
      <Route path="/game/teamtakeover" element={<RequireAdmin><TeamTakeoverHostView /></RequireAdmin>} />
      <Route path="/game/escaperoom" element={<RequireAdmin><EscapeRoomHostView /></RequireAdmin>} />
      <Route path="/game/hotseat" element={<RequireAdmin><HotSeatHostView /></RequireAdmin>} />
      <Route path="/game/codebreaker" element={<RequireAdmin><CodeBreakerHostView /></RequireAdmin>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
