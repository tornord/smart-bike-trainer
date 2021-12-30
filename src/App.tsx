import axios from "axios";
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChartTest } from "./ChartTest";
import socketIOClient from "socket.io-client";
import { ActivitySession, CadenceEvent, calcCadence, HeartRateEvent, PowerEvent, Record } from "./ActivitySession";
import "./App.scss";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { Plus, Minus } from "./icons";
import { SERVER_URL, SERVER_PORT } from "./config";
import { HeartRateModel, RecordIndex } from "./HeartRateModel";

const { max, min } = Math;

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

interface Model {
  ys: number[];
  hrm: HeartRateModel;
  indicies: RecordIndex[];
}

function chartSeries(session: ActivitySession, model: Model) {
  if (!session || session.records.length === 0) return [];
  const timestamps = session.records.map((d) => d.elapsedTime * 1000);
  const powerValues = session.records.map((d) => d.power ?? 0);
  // const heartRates = session.records.map((d) => d.heartRate ?? 0);
  const res = [];
  if (model && model.hrm.records.length > 0) {
    res.push({
      timestamps: model.indicies.map((d) => model.hrm.records[d.index].elapsedTime * 1000),
      values: model.ys,
      color: "#e1415b",
    });
  }
  res.push({ ...toSeries(session.records, "heartRate"), color: "#e17741" });
  res.push({
    secondaryAxis: true,
    timestamps: [...timestamps, ...timestamps.slice().reverse(), timestamps[0]],
    values: [...powerValues, ...powerValues.map((d) => 0), powerValues[0]],
    color: "none",
    fillColor: "rgba(10, 101, 158, 50%)",
  });
  return res;
}

function useTick(delay: number, initialIndex: number) {
  const [tick, setTick] = useState(initialIndex ? initialIndex : 0);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        setTick((tick) => tick + 1);
      }
    }, delay);
    return () => clearInterval(interval);
  }, []);
  return tick;
}

function PlayButton({ session, onFetch }: PlayButtonProps) {
  const buttonState = session === null ? "Start" : session.stopTimestamp === null ? "Stop" : "Reset";
  return (
    <button
      type="button"
      onClick={(e) => {
        fetch(`${SERVER_URL}:${SERVER_PORT}/${buttonState.toLowerCase()}`)
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
    timestamps.push(r.elapsedTime * 1000);
    values.push(Number((r as any)[field]));
  }
  return { timestamps, values };
}

function PowerDigit({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="power-digit column">
      <div className="button" onClick={() => onChange?.(1)}>
        <Plus />
      </div>
      <div className="digit">{value}</div>
      <div className="button" onClick={() => onChange?.(-1)}>
        <Minus />
      </div>
    </div>
  );
}

function PowerControlBox({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const s = value % 10;
  const r = (value - s) / 10;
  const h = r % 10;
  const c = (r - h) / 10;
  return (
    <div className="power-control-box box width1">
      <div className="row">
        <PowerDigit value={c} onChange={(v) => onChange?.(100 * v)} />
        <PowerDigit value={h} onChange={(v) => onChange?.(10 * v)} />
        <PowerDigit value={s} onChange={(v) => onChange?.(v)} />
      </div>
    </div>
  );
}

function MainView() {
  const tick = useTick(15000, 0);
  const [{ session, events }, setState] = useState({
    index: 0,
    session: null,
    events: { heartRate: null, cadence: null, power: null },
  } as State);
  const [controlPower, setControlPower] = useState(50);
  const [model, setModel] = useState(null as unknown as Model);

  useEffect(() => {
    const url = `${SERVER_URL}:${SERVER_PORT}/session`;
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
    const socket = socketIOClient(`${SERVER_URL}:${SERVER_PORT}`);
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
          const { cadence: cadenceEvents } = state.events;
          if (cadenceEvents === null) {
            state.events.cadence = [data];
          } else {
            cadenceEvents.push(data);
            while (cadenceEvents.length > 20) {
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
    // socket.on("ControlPower", (data) => {
    //   console.log("ControlPower", data);
    //   setControlPower(data.value);
    // });
    // socket.on("connect_failed", function () {
    //   console.log("Sorry, there seems to be an issue with the connection!");
    // });
  }, []);
  useEffect(() => {
    const url = `${SERVER_URL}:${SERVER_PORT}/writepower?watt=${controlPower}`;
    axios.get(url).then(({ data }) => {
      console.log("writepower", data);
    });
  }, [controlPower]);
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
  useEffect(() => {
    if (!session || session.records.length === 0) return;
    setModel(() => {
      const emaDefinitions = [
        { averageSeconds: 15, powerExponent: 1 },
        { averageSeconds: 30, powerExponent: 1 },
        { averageSeconds: 60, powerExponent: 1 },
        { averageSeconds: 120, powerExponent: 1 },
        { averageSeconds: 240, powerExponent: 1 },
        { averageSeconds: 15, powerExponent: 2 },
        { averageSeconds: 30, powerExponent: 2 },
        { averageSeconds: 60, powerExponent: 2 },
        { averageSeconds: 120, powerExponent: 2 },
        { averageSeconds: 240, powerExponent: 2 },
        { averageSeconds: 240, powerExponent: 4 },
      ];
      const ftp = 290;
      const tssExponents = [1, 0.5];
      const hrm = new HeartRateModel(emaDefinitions, tssExponents, ftp);
      hrm.addRecords(session.records);
      const params = {
        startTime: 60, //480
        endTime: 7200,
        heartRatePausTime: 30, //240
        startHeartRate: 40,
        pausStartTime: 5,
      };
      const indicies = hrm.filterRecords(null, params);
      const res = hrm.train(null, params);
      return { hrm, ys: res.ys, indicies };
    });
  }, [tick]);
  // console.log("controlPower", controlPower);
  // console.log("tick", tick);
  return (
    <div className="mainview">
      <div className="row">
        <div className="box width1">
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
          <p>
            Server URL: {SERVER_URL}:{SERVER_PORT}
          </p>
        </div>
        <div className="box width1">
          <span className="label">Heart rate</span>
          <span className="big-number">{heartRate}</span>
        </div>
        <div className="box width1">
          <span className="label">Cadence</span>
          <span className="big-number">{cadence}</span>
        </div>
        <div className="box width1">
          <span className="label">Power</span>
          <span className="big-number">{power}</span>
        </div>
        <PowerControlBox
          value={controlPower}
          onChange={(v: number) => setControlPower((p) => min(max(p + v, 0), 999))}
        />
      </div>
      <div className="row">
        {session && session.records.length > 0 ? (
          <div className="box width3">
            <TimeSeriesChart startTimestamp={0} series={chartSeries(session, model)} />
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
