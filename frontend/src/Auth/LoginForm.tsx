import React, { useState, FormEvent } from "react";
import { login } from "../services/api"; // Adjust the import path as needed
import "../styles/LoginPage.css";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const response = await login({ username, password });
      console.log("Login successful", response.data);
      // Handle successful login actions here, like storing token if needed
      localStorage.setItem("authToken", response.data.token || "");
      localStorage.setItem("username", username || "");
      onLoginSuccess(); // Call the callback to navigate
    } catch (error: any) {
      setError(error?.response?.data?.message || "Login failed");
      console.error("Login error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div>
        <label htmlFor="username">Username:</label>
        <input
          type="text"
          id="username"
          className="UsernameInput"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          className="PasswordInput"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="LoginButton">
        Login
      </button>
    </form>
  );
};

export default LoginForm;
