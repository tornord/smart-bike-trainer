import { TimeSeriesChart } from "./TimeSeriesChart";
import { useMemo } from "react";
import records from "./data/7764875397_records.json";
import { HeartRateModel, RecordIndex } from "./HeartRateModel";

interface Model {
  ys: number[];
  hrm: HeartRateModel;
  indicies: RecordIndex[];
}

export function ChartTest() {
  const model: Model = useMemo(() => {
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
    const params = {
      startTime: 480, //600
      endTime: 7200,
      heartRatePausTime: 240, //300
      startHeartRate: 115,
      pausStartTime: 5,
    };
    const indicies = hrm.filterRecords(null, params);
    const res = hrm.train(null, params);
    // console.log("weights", res.weights);
    return { hrm, ys: res.ys, indicies };
  }, []);

  const timestamps = model.hrm.records.map((d) => d.elapsedTime * 1000);
  const powerValues = model.hrm.records.map((d) => d.power ?? 0);
  return (
    <div>
      <TimeSeriesChart
        startTimestamp={0}
        series={[
          { timestamps: model.indicies.map((d) => model.hrm.records[d.index].elapsedTime * 1000), values: model.ys },
          { timestamps: timestamps, values: model.hrm.records.map((d) => d.heartRate ?? 0) },
          {
            secondaryAxis: true,
            timestamps: [...timestamps, ...timestamps.slice().reverse(), timestamps[0]],
            values: [...powerValues, ...powerValues.map((d) => 0), powerValues[0]],
            color: "none",
            fillColor: "rgba(10, 101, 158, 50%)",
          },
        ]}
      />
      <TimeSeriesChart startTimestamp={0} series={[{ timestamps, values: powerValues }]} />
    </div>
  );
}
