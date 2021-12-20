require("dotenv").config();

interface EnvironmentVariables {
  REACT_APP_SERVER_URL: string;
  REACT_APP_SERVER_PORT: string;
}

const { REACT_APP_SERVER_URL: SERVER_URL, REACT_APP_SERVER_PORT: SERVER_PORT } =
  process.env as unknown as EnvironmentVariables;

export { SERVER_URL, SERVER_PORT };
