import { Navigate } from "react-router-dom";

// This file is kept for backward compatibility but all routing is now in App.tsx
// It simply redirects to the dashboard which is handled by ShopLayout
export default function Index() {
  return <Navigate to="/dashboard" replace />;
}
