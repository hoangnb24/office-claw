import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceRoute } from "../App";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<WorkspaceRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
