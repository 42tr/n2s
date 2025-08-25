import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import "./Login.css";

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin
        ? `${import.meta.env.VITE_API_URL}/api/login`
        : `${import.meta.env.VITE_API_URL}/api/register`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        login(data.token, username);
      } else {
        setError(
          isLogin
            ? "登录失败，请检查用户名和密码"
            : "注册失败，用户名可能已存在",
        );
      }
    } catch (err) {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>{isLogin ? "登录" : "注册"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "处理中..." : isLogin ? "登录" : "注册"}
          </button>
        </form>
        <p>
          {isLogin ? "还没有账号？" : "已有账号？"}
          <button
            type="button"
            className="link-button"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "注册" : "登录"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
