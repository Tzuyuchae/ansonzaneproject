import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAuth: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const user = localStorage.getItem('user');
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default RequireAuth;
