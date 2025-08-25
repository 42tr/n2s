import React from 'react';
import { useAuth } from './AuthContext';
import Login from './Login';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return <>{children}</>;
};

export default PrivateRoute;