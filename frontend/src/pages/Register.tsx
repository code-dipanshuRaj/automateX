// Register page removed — authentication now uses Google OAuth.
// This file is kept as a redirect to prevent import errors.
import { Navigate } from 'react-router-dom';
export default function Register() {
  return <Navigate to="/login" replace />;
}
