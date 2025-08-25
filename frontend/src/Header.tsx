import React from 'react';
import { useAuth } from './AuthContext';
import './Header.css';

const Header: React.FC = () => {
  const { username, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-content">
        <h1>工作流管理系统</h1>
        <div className="user-info">
          <span>欢迎，{username}</span>
          <button onClick={logout} className="logout-btn">
            退出登录
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;