import axios from "axios";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChartTest } from "./ChartTest";
import socketIOClient from "socket.io-client";
import { ActivitySession, calcCadence } from "./ActivitySession";
import "./App.css";

interface State {
  index: number;
  session: ActivitySession | null;
}

function MainView() {
  const [{ index, session }, setState] = useState({ index: 0, session: null } as State);

  useEffect(() => {
    const url = `http://localhost:3001/session`;
    axios.get(url).then(({ data }) => {
      if (data === null) {
        setState((state) => ({ index: state.index + 1, session: null }));
      } else {
        const ss = data as unknown as ActivitySession;
        const s = new ActivitySession(ss.startTimestamp);
        s.records = ss.records;
        s.heartRateEvents = ss.heartRateEvents;
        s.powerEvents = ss.powerEvents;
        s.cadenceEvents = ss.cadenceEvents;
        setState((state) => ({ index: state.index + 1, session: s }));
      }
    });
    const socket = socketIOClient("http://localhost:3001");
    socket.on("HeartRate", (data) => {
      if (session) {
        session.pushHeartRateEvent(data);
        setState((state) => ({ index: state.index + 1, session: state.session }));
      }
    });
    socket.on("Cadence", (data) => {
      console.log(session, data);
      if (session) {
        session.pushCadenceEvent(data);
        setState((state) => ({ index: state.index + 1, session: state.session }));
      }
    });
    socket.on("Power", (data) => {
      if (session) {
        session.pushPowerEvent(data);
        setState((state) => ({ index: state.index + 1, session: state.session }));
      }
    });
  }, []);
  if (session) console.log(session);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          fetch("http://localhost:3001/start")
            .then((response: Response) => response.json())
            .then((data) => {
              setState((state) => ({ index: index + 1, session: new ActivitySession((data as any).startTimestamp) }));
            });
        }}
      >
        Start
      </button>
      <p>
        Heart rate:{" "}
        {session && session.heartRateEvents.length > 0
          ? session.heartRateEvents[session.heartRateEvents.length - 1].value
          : ""}
      </p>
      <p>
        Cadence:{" "}
        {session && session.cadenceEvents.length > 0
          ? calcCadence(session.cadenceEvents.length - 1, session.cadenceEvents)
          : ""}
      </p>
      <p>
        Power:{" "}
        {session && session.cadenceEvents.length > 0 ? session.powerEvents[session.powerEvents.length - 1].value : ""}
      </p>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/charttest" element={<ChartTest />} />
        <Route path="/" element={<MainView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
