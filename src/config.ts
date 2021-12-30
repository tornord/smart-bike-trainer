require("dotenv").config();

interface EnvironmentVariables {
  REACT_APP_SERVER_URL: string;
  REACT_APP_SERVER_PORT: string;
  REACT_APP_CADENCE_UUID?: string | null;
  REACT_APP_HEART_RATE_UUID?: string | null;
  REACT_APP_POWER_UUID?: string | null;
}

const { REACT_APP_SERVER_URL: SERVER_URL, REACT_APP_SERVER_PORT: SERVER_PORT } =
  process.env as unknown as EnvironmentVariables;

let {
  REACT_APP_CADENCE_UUID: CADENCE_UUID,
  REACT_APP_HEART_RATE_UUID: HEART_RATE_UUID,
  REACT_APP_POWER_UUID: POWER_UUID,
} = process.env as unknown as EnvironmentVariables;

CADENCE_UUID = CADENCE_UUID ?? null;
HEART_RATE_UUID = HEART_RATE_UUID ?? null;
POWER_UUID = POWER_UUID ?? null;

export { SERVER_URL, SERVER_PORT, CADENCE_UUID, HEART_RATE_UUID, POWER_UUID };
