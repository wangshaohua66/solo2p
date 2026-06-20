import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/Layout/AppLayout";
import Home from "@/pages/Home";
import MemberDetailPage from "@/pages/MemberDetailPage";
import MemberProfilePage from "@/pages/MemberProfilePage";
import TrainingPlanPage from "@/pages/TrainingPlanPage";
import ProgressDashboardPage from "@/pages/ProgressDashboardPage";
import DietAdvicePage from "@/pages/DietAdvicePage";
import ExerciseLibraryPage from "@/pages/ExerciseLibraryPage";
import PlanTemplatesPage from "@/pages/PlanTemplatesPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/exercises" element={<ExerciseLibraryPage />} />
          <Route path="/templates" element={<PlanTemplatesPage />} />
          <Route path="/members/:id" element={<MemberDetailPage />}>
            <Route index element={<MemberProfilePage />} />
            <Route path="plan" element={<TrainingPlanPage />} />
            <Route path="progress" element={<ProgressDashboardPage />} />
            <Route path="diet" element={<DietAdvicePage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}
