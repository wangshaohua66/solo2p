import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import MainLayout from './components/Layout/MainLayout'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import TaskBoard from './pages/TaskBoard'
import ReviewWorkflow from './pages/ReviewWorkflow'
import ChangeRequest from './pages/ChangeRequest'
import DesignVersion from './pages/DesignVersion'
import ClientPortal from './pages/ClientPortal'
import RequireAuth from './components/Auth/RequireAuth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="tasks" element={<TaskBoard />} />
        <Route path="reviews" element={<ReviewWorkflow />} />
        <Route path="changes" element={<ChangeRequest />} />
        <Route path="versions" element={<DesignVersion />} />
        <Route path="client" element={<ClientPortal />} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}

export default App
