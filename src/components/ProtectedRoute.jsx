import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute({ session }) {
    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;