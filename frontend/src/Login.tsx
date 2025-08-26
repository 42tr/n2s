import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import "./Login.css";

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
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
        body: JSON.stringify(
          isLogin
            ? { username, password }
            : { username, password, registration_code: registrationCode },
        ),
      });

      if (response.ok) {
        const data = await response.json();
        login(data.token, username);
      } else {
        if (!isLogin) {
          // 注册错误处理
          switch (response.status) {
            case 400:
              setError("密码长度至少6位");
              break;
            case 403:
              setError("注册码错误，请检查注册码");
              break;
            case 409:
              setError("用户名已存在，请选择其他用户名");
              break;
            default:
              setError("注册失败，请稍后重试");
          }
        } else {
          // 登录错误处理
          switch (response.status) {
            case 401:
              setError("用户名或密码错误");
              break;
            default:
              setError("登录失败，请稍后重试");
          }
        }
      }
    } catch (err) {
      setError("网络错误，请稍后重试：" + err);
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
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="registrationCode">注册码</label>
              <input
                type="text"
                id="registrationCode"
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value)}
                placeholder="请输入注册码"
                required
              />
            </div>
          )}
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
