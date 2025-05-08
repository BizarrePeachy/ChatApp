import "../styles/HomePage.css";
import React from "react";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <>
      <div className="HomePageDiv">
        <h1 className="MainHomeHeader">Welcome to Chat App!</h1>
        <p className="Description">
          Connect, Collaborate, and communicate with ease.
        </p>
        <div className="ButtonContainer">
          <Link to="/login" className="loginButton">
            Login
          </Link>
          <Link className="SignupButton" to="/register">
            Sign Up
          </Link>
        </div>
      </div>
    </>
  );
};

export default HomePage;
