import { TimeSeriesChart } from "./TimeSeriesChart";
import { useEffect, useMemo } from "react";
import { readFitFile } from "./fitFile";
import records from "./data/7764875397_records.json";
import { HeartRateModel } from "./HeartRateModel";

export function ChartTest() {
  const hrm: HeartRateModel = useMemo(() => {
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
    hrm.addRecords(records as any);
    return hrm;
  }, []);
  const params = {
    startTime: 480, //600
    endTime: 7200,
    heartRatePausTime: 240, //300
    startHeartRate: 115,
    pausStartTime: 5,
  };
  const indicies = hrm.filterRecords(null, params);
  const res = hrm.train(null, params);
  console.log("weights", res.weights);
  return (
    <div>
      <TimeSeriesChart
        startTimestamp={0}
        series={[
          { timestamps: indicies.map((d) => hrm.records[d.index].elapsedTime * 1000), values: res.ys },
          { timestamps: hrm.records.map((d) => d.elapsedTime * 1000), values: records.map((d) => d.heartRate) },
        ]}
      />
    </div>
  );
}
