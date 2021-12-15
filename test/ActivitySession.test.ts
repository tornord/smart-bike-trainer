import { ActivitySession, indexOf, Record, calcCadence, CadenceEvent } from "./ActivitySession";
import fs from "fs";

test("indexOf", () => {
  let xs = [...Array(50)].map((d, i) => i);
  const comp = (t: number, v: any) => t - v;
  expect(indexOf(0, xs, comp)).toBe(0);
  expect(indexOf(7, xs, comp)).toBe(7);
  expect(indexOf(Math.PI, xs, comp)).toBe(3);
  expect(indexOf(39.5, xs, comp)).toBe(39);
  expect(indexOf(99, xs, comp)).toBe(49);
  expect(indexOf(-2, xs, comp)).toBe(-1);
});

test("indexOf objects", () => {
  let xs = [...Array(8)].map((d, i) => ({ t: 10 * (i + 1) }));
  const comp = (t: number, v: any) => t - v.t;
  expect(indexOf(0, xs, comp)).toBe(-1);
  expect(indexOf(75, xs, comp)).toBe(6);
  expect(indexOf(31, xs, comp)).toBe(2);
  expect(indexOf(39, xs, comp)).toBe(2);
  expect(indexOf(99, xs, comp)).toBe(7);
  expect(indexOf(-2, xs, comp)).toBe(-1);
});

test("create ActivitySession", () => {
  const st = 1639577760214;
  let s = new ActivitySession(st);
  expect(s.startTimestamp).toBe(st);
});

test("pushHeartRateEvent", () => {
  const st = 100;
  let s = new ActivitySession(st);
  s.recordsTimestep = 10;
  s.pushHeartRateEvent({ timestamp: 125, value: 60 });
  const toString = (s: ActivitySession) => s.records.map((d: Record) => d.heartRate ?? "null").join(",");
  expect(toString(s)).toBe("null,60,60");
  s.pushHeartRateEvent({ timestamp: 151, value: 65 });
  expect(toString(s)).toBe("null,60,60,null,65,65");
  s.pushHeartRateEvent({ timestamp: 157, value: 70 });
  expect(toString(s)).toBe("null,60,60,null,65,70");
  s.pushHeartRateEvent({ timestamp: 169, value: 75 });
  expect(toString(s)).toBe("null,60,60,null,65,70,75");
  s.pushHeartRateEvent({ timestamp: 168, value: 75 });
  expect(toString(s)).toBe("null,60,60,null,65,70,75");
});

test("pushPowerEvent", () => {
  const st = 200;
  let s = new ActivitySession(st);
  s.recordsTimestep = 50;
  const toString = (s: ActivitySession) => s.records.map((d: Record) => d.power ?? "null").join(",");
  s.pushPowerEvent({ timestamp: 195, value: 300 });
  expect(toString(s)).toBe("");
  s.pushPowerEvent({ timestamp: 207, value: 300 });
  expect(toString(s)).toBe("300");
  s.pushPowerEvent({ timestamp: 325, value: 310 });
  expect(toString(s)).toBe("300,310,310");
  s.pushPowerEvent({ timestamp: 349, value: 315 });
  expect(toString(s)).toBe("300,310,315");
  s.pushPowerEvent({ timestamp: 350, value: 320 });
  expect(toString(s)).toBe("300,310,315,320");
});

test("calcCadence", () => {
  const events1 = [
    { revolutions: 4718, eventTime: 46.91796875, timestamp: 1639483917862 },
    { revolutions: 4719, eventTime: 47.775390625, timestamp: 1639483918859 },
    { revolutions: 4720, eventTime: 48.6259765625, timestamp: 1639483919856 },
    { revolutions: 4721, eventTime: 49.48828125, timestamp: 1639483920853 },
  ];
  let v = calcCadence(0, events1);
  expect(v).toBe(null);
  v = calcCadence(1, events1);
  expect(v).toBe(69.97722095671982);
  v = calcCadence(3, events1);
  expect(v).toBe(69.58097395243487);
  const events2 = [
    { revolutions: 4582, eventTime: 63.8095703125, timestamp: 1639483807137 },
    { revolutions: 4584, eventTime: 1.3671875, timestamp: 1639483808135 },
  ];
  v = calcCadence(1, events2);
  expect(v).toBe(77.04075235109718);
  const events3 = [
    { revolutions: 4619, eventTime: 28.7646484375, timestamp: 1639483836066 },
    { revolutions: 4621, eventTime: 30.3232421875, timestamp: 1639483837063 },
    { revolutions: 4622, eventTime: 31.1005859375, timestamp: 1639483838059 },
    { revolutions: 4622, eventTime: 31.1005859375, timestamp: 1639483838060 },
  ];
  v = calcCadence(3, events3);
  expect(v).toBe(77.1859296482412);
  const events4 = [
    { revolutions: 4731, eventTime: 57.9482421875, timestamp: 1639483928835 },
    { revolutions: 4732, eventTime: 58.8115234375, timestamp: 1639483929832 },
    { revolutions: 4733, eventTime: 59.6572265625, timestamp: 1639483930830 },
    { revolutions: 4733, eventTime: 59.6572265625, timestamp: 1639483931827 },
    { revolutions: 4733, eventTime: 59.6572265625, timestamp: 1639483932824 },
    { revolutions: 4733, eventTime: 59.6572265625, timestamp: 1639483933822 },
    { revolutions: 4733, eventTime: 59.6572265625, timestamp: 1639483934820 },
  ];
  v = calcCadence(5, events4);
  expect(v).toBe(70.94688221709006);
  v = calcCadence(6, events4);
  expect(v).toBe(0);
});

test("pushCadenceEvent", () => {
  let s = new ActivitySession(1639480352742);
  const events = [
    { revolutions: 43, eventTime: 0.9892578125, timestamp: 1639480352742 },
    { revolutions: 44, eventTime: 2.1396484375, timestamp: 1639480353740 },
    { revolutions: 45, eventTime: 3.27734375, timestamp: 1639480355734 },
    { revolutions: 46, eventTime: 4.423828125, timestamp: 1639480355735 },
    { revolutions: 46, eventTime: 4.423828125, timestamp: 1639480355735 },
    { revolutions: 47, eventTime: 5.5517578125, timestamp: 1639480356732 },
    { revolutions: 48, eventTime: 6.693359375, timestamp: 1639480357730 },
    { revolutions: 49, eventTime: 7.841796875, timestamp: 1639480358727 },
    { revolutions: 50, eventTime: 8.978515625, timestamp: 1639480359725 },
    { revolutions: 50, eventTime: 8.978515625, timestamp: 1639480359726 },
    { revolutions: 50, eventTime: 8.978515625, timestamp: 1639480360724 },
    { revolutions: 51, eventTime: 10.125, timestamp: 1639480361720 },
    { revolutions: 52, eventTime: 11.2841796875, timestamp: 1639480362718 },
  ];
  events.forEach((e) => {
    s.pushCadenceEvent(e);
  });
  // console.log(s.cadenceEvents.map((e) => e.revolutions).join("\n"));
  // console.log(s.cadenceEvents.map((e) => e.eventTime.toFixed(10).replace(".", ",")).join("\n"));
  // console.log(s.cadenceEvents.map((e) => e.timestamp).join("\n"));
  // console.log(s.records.map((r) => r.cadence?.toFixed(2).replace(".", ",")).join("\n"));
  const r = s.records.map((r) => r.cadence?.toFixed(2)).join(",");
  expect(r).toBe("52.16,52.74,52.33,53.19,52.56,52.24,52.78,52.78,52.33,51.76");
});

// test("x", () => {
//   const events: CadenceEvent[] = JSON.parse(fs.readFileSync("../cadenceEvents.json", "utf-8"));
//   let s = new ActivitySession(events[0].timestamp);
//   events.forEach((e) => {
//     s.pushCadenceEvent(e);
//   });
//   const r = s.records.map((r) => r.cadence?.toFixed(2).replace(".", ",") ?? "").join("\n");
//   fs.writeFileSync("./cadenceTimeSeries.csv", r, "utf-8");
// });
