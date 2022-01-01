import { Record } from "./ActivitySession";
import { numeric, stdev } from "ts-math";

// https://www.cyclinganalytics.com/blog/2018/06/how-does-your-cycling-power-output-compare

const powerScaleFactor = 300;
const isNumber = (value: any) => typeof value === "number" && isFinite(value);

export interface EmaDefinition {
  averageSeconds: number;
  powerExponent: number;
}

interface PowerEmas {
  previousIndex: number;
  values: number[] | null;
}

interface TssRecord {
  value: number;
  total: number;
}

interface TrainParameters {
  startTime: number;
  endTime: number;
  heartRatePausTime: number;
  startHeartRate: number;
  pausStartTime: number;
}

export interface RecordIndex {
  index: number;
  elapsedTime: number;
  currentStartTime: number;
}

export interface TrainResult {
  indicies: RecordIndex[];
  predictedHeartRates: number[];
  weights: number[];
  stdev: number;
}

export function linearRegression(xs: number[][], ys: number[]) {
  const xsT = numeric.transpose(xs);
  const xsTxs = numeric.dot(xsT, xs);
  const xsTys = numeric.dot(xsT, ys);
  const weights: number[] = numeric.solve(xsTxs, xsTys);
  const resYs: number[] = numeric.dot(xs, weights);
  const errors = numeric.sub(resYs, ys);
  return { weights, ys: resYs, stdev: stdev(errors) };
}

const defaultEmaDefinitions = [
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
const defaultFtp = 300;
const defaultTssExponents = [1, 0.5];
const defaultTrainParams = {
  startTime: 480, //480
  endTime: 7200,
  heartRatePausTime: 240, //240
  startHeartRate: 115,
  pausStartTime: 5,
};

export class HeartRateModel {
  constructor(
    emaDefinitions: EmaDefinition[] | null = null,
    tssExponents: number[] | null = null,
    ftp: number | null = null
  ) {
    this.emaDefinitions = emaDefinitions ?? defaultEmaDefinitions;
    this.emaDecayFactors = this.emaDefinitions.map((d) => 1 - 2 / (d.averageSeconds + 1));
    this.tssExponents = tssExponents ?? defaultTssExponents;
    this.ftp = ftp ?? defaultFtp;
    this.records = [];
    this.powerEmas = [];
    this.tss = [];
    this.trainResult = null;
  }

  emaDefinitions: EmaDefinition[];
  emaDecayFactors: number[];
  tssExponents: number[];
  records: Record[];
  powerEmas: PowerEmas[];
  tss: TssRecord[];
  ftp: number;
  trainResult: TrainResult | null;

  calcPower(index: number | null = null) {
    if (index === null) {
      index = this.powerEmas.length - 1;
    }
    if (index < 0 || index > this.powerEmas.length - 1) return null;
    let emas = this.powerEmas[index];
    if (emas.values === null) {
      if (emas.previousIndex === -1) return null;
      emas = this.powerEmas[emas.previousIndex];
    }
    const vals = emas.values as number[];
    const res = vals.map((d, i) => {
      const { powerExponent } = this.emaDefinitions[i];
      return vals[i] ** (1 / powerExponent) * powerScaleFactor;
    });
    return res;
  }

  addRecords(records: Record[]) {
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      this.addRecord(r);
    }
  }

  addRecord(record: Record) {
    const nd = this.emaDefinitions.length;
    const nr = this.powerEmas.length;
    let newPowerEmas: PowerEmas = { previousIndex: -1, values: null };
    if (nr > 0) {
      const prevPowerEma = this.powerEmas[nr - 1];
      newPowerEmas.previousIndex = prevPowerEma.values !== null ? nr - 1 : prevPowerEma.previousIndex;
    }
    if (isNumber(record.power)) {
      newPowerEmas.values = new Array(nd);
      const prevElapsedTime = this.records[newPowerEmas.previousIndex]?.elapsedTime ?? null;
      for (let i = 0; i < nd; i++) {
        const { powerExponent } = this.emaDefinitions[i];
        const alpha = this.emaDecayFactors[i];
        const prevPowerEma = this.powerEmas[newPowerEmas.previousIndex]?.values?.[i] ?? 0;
        const dt = prevElapsedTime !== null ? record.elapsedTime - prevElapsedTime : 0;
        const prevWeightSum = dt > 0 ? alpha ** dt / (1 - alpha) : 0;
        const newPower = isNumber(record.power) ? ((record.power as number) / powerScaleFactor) ** powerExponent : 0;
        const newPowerEma = (newPower + prevPowerEma * prevWeightSum) / (1 + prevWeightSum);
        newPowerEmas.values[i] = newPowerEma;
      }
    }
    const totalTss = this.tss[newPowerEmas.previousIndex]?.total ?? 0;
    const tss = ((record.power ?? 0) / this.ftp) ** 2 / 36;
    const tr = { total: totalTss + tss, value: tss };
    this.records.push(record);
    this.powerEmas.push(newPowerEmas);
    this.tss.push(tr);
  }

  filterRecords(maxIndex: number | null = null, params: TrainParameters | null = null): RecordIndex[] {
    const { startTime, endTime, heartRatePausTime, startHeartRate, pausStartTime } = params ?? defaultTrainParams;
    if (maxIndex === null) {
      maxIndex = this.records.length - 1;
    }
    if (maxIndex < 0) return [];
    const res = [];
    let previousElapsedTime = null;
    let currentStartTime = startTime;
    for (let i = 0; i <= maxIndex; i++) {
      const r = this.records[i];
      if (
        previousElapsedTime !== null &&
        r.elapsedTime - previousElapsedTime > pausStartTime &&
        r.elapsedTime > currentStartTime
      ) {
        currentStartTime = r.elapsedTime;
      }
      previousElapsedTime = r.elapsedTime;
      if (r.power === null || r.heartRate === null || r.heartRate < startHeartRate) continue;
      if (r.elapsedTime < startTime || r.elapsedTime >= endTime) continue;
      if (r.elapsedTime - currentStartTime < heartRatePausTime) continue;
      res.push({ index: i, elapsedTime: r.elapsedTime, currentStartTime });
    }
    return res;
  }

  predict(index: number, weights: number[]) {
    const { x } = this.getSample(index);
    const res = numeric.dot(weights, x);
    return res;
  }

  getSample(index: number) {
    const tss = this.tss[index].total;
    const ts = this.tssExponents.map((d) => tss ** d);
    const ps = this.calcPower(index);
    if (ps === null) {
      throw new Error("calcPower failed");
    }
    const x = [1, ...ts, ...(ps as number[])];
    const y = this.records[index].heartRate as number;
    return { x, y };
  }

  train(maxIndex: number | null = null, params: TrainParameters | null = null) {
    this.trainResult = null;
    const trainIndicies = this.filterRecords(maxIndex, params);
    const xs: number[][] = [];
    const ys: number[] = [];
    for (let i = 0; i < trainIndicies.length; i++) {
      const { index } = trainIndicies[i];
      const { x, y } = this.getSample(index);
      xs.push(x);
      ys.push(y);
    }
    if (xs.length === 0) return null;
    const reg = linearRegression(xs, ys);
    this.trainResult = { indicies: trainIndicies, predictedHeartRates: reg.ys, stdev: reg.stdev, weights: reg.weights };
    return this.trainResult
  }
}
