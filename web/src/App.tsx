import {
  BrowserRouter,
  Route,
  RouteProps,
  Switch,
  Redirect,
} from "react-router-dom";
import { GlobalStyles } from "./components/GlobalStyle";
import Layout from "./components/Layout";
import { Loading } from "./components/Loading";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { isAuthenticated, usePrepareApp } from "./helper/auth";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";

function App() {
  const { isLoading } = usePrepareApp();

  if (isLoading) {
    return <Loading />;
  }

  return (
    <BrowserRouter>
      <GlobalStyles />
      <ErrorBoundary>
        <Layout>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <AuthRoute path="/" component={Home} />
          </Switch>
        </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

const AuthRoute = (props: RouteProps) => {
  if (isAuthenticated()) {
    return <Route {...props} />;
  }
  return <Redirect to="/login" />;
};

export default App;
