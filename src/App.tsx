import axios from "axios";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChartTest } from "./ChartTest";
import socketIOClient from "socket.io-client";
import { ActivitySession, CadenceEvent, calcCadence, HeartRateEvent, PowerEvent, Record } from "./ActivitySession";
import "./App.scss";
import { TimeSeriesChart } from "./TimeSeriesChart";

interface Events {
  heartRate: HeartRateEvent[] | null;
  cadence: CadenceEvent[] | null;
  power: PowerEvent[] | null;
}

interface State {
  index: number;
  session: ActivitySession | null;
  events: Events;
}

interface PlayButtonProps {
  session: ActivitySession | null;
  onFetch: (responceData: any, buttonState: string) => void;
}

function PlayButton({ session, onFetch }: PlayButtonProps) {
  const buttonState = session === null ? "Start" : session.stopTimestamp === null ? "Stop" : "Reset";
  return (
    <button
      type="button"
      onClick={(e) => {
        fetch(`http://localhost:3001/${buttonState.toLowerCase()}`)
          .then((response: Response) => response.json())
          .then((data) => {
            if (onFetch) {
              onFetch(data, buttonState);
            }
          });
      }}
    >
      {buttonState}
    </button>
  );
}

function toSeries(records: Record[], field: string) {
  let lastNonNullIndex = records.length - 1;
  while (lastNonNullIndex > 0 && (records[lastNonNullIndex] as any)[field] === null) {
    lastNonNullIndex--;
  }
  const timestamps = [];
  const values = [];
  for (let i = 0; i <= lastNonNullIndex; i++) {
    const r = records[i];
    timestamps.push(r.elapsedTime);
    values.push(Number((r as any)[field]));
  }
  return { timestamps, values };
}

function MainView() {
  const [{ index, session, events }, setState] = useState({
    index: 0,
    session: null,
    events: { heartRate: null, cadence: null, power: null },
  } as State);

  useEffect(() => {
    const url = `http://localhost:3001/session`;
    axios.get(url).then(({ data }) => {
      let s: ActivitySession | null = null;
      let e: Events = { heartRate: null, cadence: null, power: null };
      if (data !== null) {
        const ss = data as unknown as ActivitySession;
        s = new ActivitySession(ss.startTimestamp);
        s.stopTimestamp = ss.stopTimestamp;
        s.records = ss.records;
        s.heartRateEvents = ss.heartRateEvents;
        s.powerEvents = ss.powerEvents;
        s.cadenceEvents = ss.cadenceEvents;
      }
      setState((state) => ({ index: state.index + 1, session: s, events: e }));
    });
    const socket = socketIOClient("http://localhost:3001");
    socket.on("HeartRate", (data) => {
      setState((state: State) => {
        if (state.session && !state.session.stopTimestamp) {
          state.session?.pushHeartRateEvent(data);
        } else {
          state.events.heartRate = [data];
        }
        return { index: state.index + 1, session: state.session, events: state.events };
      });
    });
    socket.on("Cadence", (data) => {
      setState((state: State) => {
        if (state.session && !state.session.stopTimestamp) {
          state.session?.pushCadenceEvent(data);
        } else {
          const {cadence: cadenceEvents}=state.events
          if (cadenceEvents === null) {
            state.events.cadence = [data];
          } else {
            cadenceEvents.push(data);
            while (cadenceEvents.length>20) {
              cadenceEvents.shift();
            }
          }
        }
        return { index: state.index + 1, session: state.session, events: state.events };
      });
    });
    socket.on("Power", (data) => {
      setState((state: State) => {
        if (state.session && !state.session.stopTimestamp) {
          state.session?.pushPowerEvent(data);
        } else {
          state.events.power = [data];
        }
        return { index: state.index + 1, session: state.session, events: state.events };
      });
    });
  }, []);
  // console.log("state index", index, session ? session.records.length : "null");
  let cadence = "";
  let heartRate = "";
  let power = "";
  if (session && !session.stopTimestamp) {
    if (session.cadenceEvents.length > 0) {
      const r = calcCadence(session.cadenceEvents.length - 1, session.cadenceEvents);
      if (typeof r === "number") {
        cadence = r.toFixed(0);
      }
    }
    if (session.heartRateEvents.length > 0) {
      const r = session.heartRateEvents[session.heartRateEvents.length - 1].value;
      if (typeof r === "number") {
        heartRate = r.toFixed(0);
      }
    }
    if (session.powerEvents.length > 0) {
      const r = session.powerEvents[session.powerEvents.length - 1].value;
      if (typeof r === "number") {
        power = r.toFixed(0);
      }
    }
  } else {
    if (events.cadence && events.cadence.length > 0) {
      const r = calcCadence(events.cadence.length - 1, events.cadence);
      if (typeof r === "number") {
        cadence = r.toFixed(0);
      }
    }
    if (events.heartRate && events.heartRate.length > 0) {
      const r = events.heartRate[events.heartRate.length - 1].value;
      if (typeof r === "number") {
        heartRate = r.toFixed(0);
      }
    }
    if (events.power && events.power.length > 0) {
      const r = events.power[events.power.length - 1].value;
      if (typeof r === "number") {
        power = r.toFixed(0);
      }
    }
  }
  return (
    <div className="mainview">
      <div className="row">
        <div className="box width4">
          <PlayButton
            session={session}
            onFetch={(data, buttonState) => {
              setState((state) => {
                let newSession = null;
                if (buttonState === "Start") {
                  newSession = new ActivitySession((data as any).startTimestamp);
                } else if (buttonState === "Stop" && state.session && (data as any).stopTimestamp) {
                  newSession = state.session;
                  newSession.stopTimestamp = (data as any).stopTimestamp;
                } else if (buttonState === "Reset") {
                  newSession = null;
                }
                return { index: state.index + 1, session: newSession, events: state.events };
              });
            }}
          />
          <p>Records: {session && session.records.length >= 0 ? session.records.length : ""}</p>
        </div>
        <div className="box width4">
          <span className="label">Heart rate</span>
          <span className="big-number">{heartRate}</span>
        </div>
        <div className="box width4">
          <span className="label">Cadence</span>
          <span className="big-number">{cadence}</span>
        </div>
        <div className="box width4">
          <span className="label">Power</span>
          <span className="big-number">{power}</span>
        </div>
      </div>
      <div className="row">
        {session && session.records.length >= 0 ? (
          <div className="box width1">
            <TimeSeriesChart startTimestamp={0} series={[toSeries(session.records, "heartRate")]} />
          </div>
        ) : null}
      </div>
    </div>
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
