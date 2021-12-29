import { HeartRateModel } from "./HeartRateModel";
import { Record } from "./ActivitySession";
import { round } from "ts-math";
import { readFitFile, toRecords } from "./fitFile";

const roundArray = (array: number[]) => array.map((d) => round(d, 4));

test("HeartRateModel empty", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  expect(hrm.calcPower()).toBe(null);
});

test("HeartRateModel null power", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  const r: Record = {
    elapsedTime: 1,
    power: null,
    heartRate: 150,
    lapIndex: 0,
    cadence: null,
    leftRightBalance: null,
  };
  hrm.addRecord(r);
  // console.log(hrm.calcPower());
  expect(hrm.calcPower()).toBe(null);
});

test("HeartRateModel first record", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  const r: Record = {
    elapsedTime: 1,
    power: 123,
    heartRate: 150,
    lapIndex: 0,
    cadence: null,
    leftRightBalance: null,
  };
  hrm.addRecord(r);
  // console.log(hrm.calcPower());
  expect(roundArray(hrm.calcPower() as number[])).toEqual([123, 123]);
});

test("HeartRateModel five records", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  for (let i = 0; i < 5; i++) {
    const r: Record = {
      elapsedTime: i + 1,
      power: 100 * (i + 1),
      heartRate: 150,
      lapIndex: 0,
      cadence: null,
      leftRightBalance: null,
    };
    hrm.addRecord(r);
  }
  // console.log(hrm.powerEmas);
  // console.log(roundArray(hrm.calcPower() as number[]));
  expect(roundArray(hrm.calcPower() as number[])).toEqual([339.5062, 297.7834]);
});

test("HeartRateModel start combinations", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const es = [
    null,
    [100, 100],
    [200, 200],
    [133.3333, 124.3163],
    [300, 300],
    [185.7143, 164.5824],
    [233.3333, 221.5647],
    [188.8889, 170.3181],
  ];
  for (let i = 0; i < 8; i++) {
    const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
    for (let j = 0; j < 3; j++) {
      const r: Record = {
        elapsedTime: j + 1,
        power: (i >> j) & 1 ? 100 * (j + 1) : null,
        heartRate: 150,
        lapIndex: 0,
        cadence: null,
        leftRightBalance: null,
      };
      hrm.addRecord(r);
    }
    const ps = hrm.calcPower();
    // if (ps) {
    //   console.log(
    //     i,
    //     ps.map((d) => round(d, 4))
    //   );
    // } else {
    //   console.log(i, ps);
    // }
    expect(ps ? ps.map((d) => round(d, 4)) : null).toEqual(es[i]);
  }
});

test("HeartRateModel 400 records", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const dt = 1;
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  for (let i = 0; i < 400; i++) {
    const r: Record = {
      elapsedTime: dt * (i + 1),
      power: 201 + i,
      heartRate: 150,
      lapIndex: 0,
      cadence: null,
      leftRightBalance: null,
    };
    hrm.addRecord(r);
  }
  // console.log(roundArray(hrm.calcPower() as number[]));
  expect(roundArray(hrm.calcPower() as number[])).toEqual([598, 595.5208]);
});

test("HeartRateModel 400 records with gap", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  for (let i = 0; i < 400; i++) {
    const r: Record = {
      elapsedTime: i + 1,
      power: i >= 390 && i < 395 ? null : 201 + i,
      heartRate: 150,
      lapIndex: 0,
      cadence: null,
      leftRightBalance: null,
    };
    hrm.addRecord(r);
  }
  expect([0, 1, 2, 3, 4].map((d) => (hrm.calcPower(395 + d) as number[]).map((e) => round(e, 4)))).toEqual([
    [594.3322, 589.4974],
    [595.2215, 590.8686],
    [596.1477, 592.1716],
    [597.0984, 593.419],
    [598.0656, 594.621],
  ]);
});

test("HeartRateModel tss", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, 300);
  for (let i = 0; i < 5; i++) {
    const r: Record = {
      elapsedTime: i + 1,
      power: 100 * (i + 1),
      heartRate: 150,
      lapIndex: 0,
      cadence: null,
      leftRightBalance: null,
    };
    hrm.addRecord(r);
  }
  expect(hrm.tss[hrm.tss.length - 1].total).toBe(0.1697530864197531);
});

test("HeartRateModel tss one hour", async () => {
  const emaDefinitions = [
    { averageSeconds: 5, powerExponent: 1 },
    { averageSeconds: 10, powerExponent: 2 },
  ];
  const ftp = 290;
  const tssExponents = [1];
  const hrm = new HeartRateModel(emaDefinitions, tssExponents, ftp);
  for (let i = 0; i < 3600; i++) {
    const r: Record = {
      elapsedTime: i + 1,
      power: ftp,
      heartRate: 150,
      lapIndex: 0,
      cadence: null,
      leftRightBalance: null,
    };
    hrm.addRecord(r);
  }
  expect(round(hrm.tss[hrm.tss.length - 1].total, 4)).toBe(100);
});

test("HeartRateModel on a fit file", async () => {
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
  const fitData: any = await readFitFile("7764875397");
  const session = fitData.activity.sessions[0];
  const recs = toRecords(session);
  hrm.addRecords(recs);

  const params = {
    startTime: 480, //600
    endTime: 7200,
    heartRatePausTime: 240, //300
    startHeartRate: 115,
    pausStartTime: 5,
  };
  const res = hrm.train(null, params);
  expect(round(res?.stdev as number, 4)).toBe(1.9885);
});

test.only("HeartRateModel filterRecords", async () => {
  const hrm = new HeartRateModel([], [], 300);
  for (let i = 0; i < 30; i++) {
    const r: Record = {
      elapsedTime: i + 1,
      power: i % 10 !== 9 ? 300 : null,
      heartRate: i % 10 !== 7 ? 150 : 50,
      lapIndex: 0,
      cadence: null,
      leftRightBalance: null,
    };
    hrm.addRecord(r);
  }
  const res = hrm.filterRecords(null, {
    startTime: 8,
    endTime: 24,
    heartRatePausTime: 6,
    startHeartRate: 100,
    pausStartTime: 4,
  });
  // console.log(res);
  expect(res.map((d) => d.index).join(",")).toBe("13,14,15,16,18,20,21,22");
});
