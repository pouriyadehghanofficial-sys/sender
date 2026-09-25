import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function OwnerRoute() {
  const { user } = useAuth();
  if (!user?.isOwner) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { token } = useAuth();
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
