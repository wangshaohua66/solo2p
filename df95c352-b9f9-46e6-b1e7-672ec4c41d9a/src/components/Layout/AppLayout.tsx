import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import RightPanel from "./RightPanel";

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </div>
      </main>
      <RightPanel />
    </div>
  );
}
