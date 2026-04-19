import React, { Component, ReactNode } from "react";
import styled from "@emotion/styled";
import { GENERICS } from "./GlobalStyle";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  handleBackToList = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorStyled>
          <div className="error-container">
            <h2>出错了</h2>
            <p>{this.state.error?.message || "页面发生了意外错误"}</p>
            <div className="error-actions">
              <button className="retry-btn" onClick={this.handleRetry}>
                重试
              </button>
              <button className="back-btn" onClick={this.handleBackToList}>
                返回列表
              </button>
            </div>
          </div>
        </ErrorStyled>
      );
    }

    return this.props.children;
  }
}

const ErrorStyled = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${GENERICS.bgColor};

  .error-container {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    max-width: 400px;

    h2 {
      color: ${GENERICS.colorBlackCalm};
      margin-bottom: 16px;
    }

    p {
      color: ${GENERICS.colorGray};
      margin-bottom: 24px;
    }

    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;

      button {
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        border: none;

        &.retry-btn {
          background: ${GENERICS.colorBlackCalm};
          color: white;

          &:hover {
            background: #333;
          }
        }

        &.back-btn {
          background: white;
          color: ${GENERICS.colorBlackCalm};
          border: 1px solid #ccc;

          &:hover {
            background: #f5f5f5;
          }
        }
      }
    }
  }
`;
