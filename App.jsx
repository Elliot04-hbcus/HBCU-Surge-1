import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import ProtectedRoute from "@/components/ProtectedRoute";
import { SportProvider } from "@/components/SportContext";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Scores from "@/pages/Scores";
import Standings from "@/pages/Standings";
import Teams from "@/pages/Teams";
import TeamDetail from "@/pages/TeamDetail";
import MyRankings from "@/pages/MyRankings";
import StatLeaders from "@/pages/StatLeaders";
import FanTalk from "@/pages/FanTalk";
import GameDetail from "@/pages/GameDetail";
import PlayerDetail from "@/pages/PlayerDetail";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Profile from "@/pages/Profile";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <SportProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/scores" element={<Scores />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/games/:id" element={<GameDetail />} />
          <Route path="/my-rankings" element={<MyRankings />} />
          <Route path="/stat-leaders" element={<StatLeaders />} />
          <Route path="/fan-talk" element={<FanTalk />} />
          <Route path="/fan-talk/:topicId" element={<FanTalk />} />
          <Route
            element={
              <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />
            }
          >
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </SportProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App