import React from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../Auth/LoginForm"; // Adjust the import path as needed
import "../styles/LoginPage.css";

interface LoginPageProps {}

const LoginPage: React.FC<LoginPageProps> = () => {
  const navigate = useNavigate();

  return (
    <div className="LoginPageDiv">
      <h1 className="LoginPageHeader">Welcome Back!</h1>
      <div className="LoginFormWrapper">
        <LoginForm onLoginSuccess={() => navigate("/chat")} />
        <p className="NoAccountParagraph">
          Don't have an account? <a href="/register">Sign Up</a>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
