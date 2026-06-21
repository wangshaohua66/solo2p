import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { EventWizard } from "@/components/EventWizard";
import ScheduleBoard from "@/pages/ScheduleBoard";
import ResourceMap from "@/pages/ResourceMap";
import EventList from "@/pages/EventList";
import Dashboard from "@/pages/Dashboard";
import Emergency from "@/pages/Emergency";
import Equipment from "@/pages/Equipment";
import VipBoxes from "@/pages/VipBoxes";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/schedule" replace />} />
        <Route element={<MainLayout />}>
          <Route path="/schedule" element={<ScheduleBoard />} />
          <Route path="/resources" element={<ResourceMap />} />
          <Route path="/events" element={<EventList />} />
          <Route path="/events/new" element={<EventList />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/emergency" element={<Emergency />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/vip-boxes" element={<VipBoxes />} />
        </Route>
      </Routes>
      <EventWizard />
    </Router>
  );
}
