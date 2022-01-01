import { TimeSeriesChart } from "./TimeSeriesChart";
import { useMemo } from "react";
import records from "./data/7764875397_records.json";
import { HeartRateModel } from "./HeartRateModel";
import { Record } from "./ActivitySession";

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

function chartSeries(model: HeartRateModel) {
  const timestamps = model.records.map((d) => d.elapsedTime * 1000);
  const powerValues = model.records.map((d) => d.power ?? 0);
  // const heartRates = session.records.map((d) => d.heartRate ?? 0);
  const res = [];
  if (model && model.records.length > 0 && model.trainResult) {
    res.push({
      timestamps: model.trainResult.indicies.map((d) => model.records[d.index].elapsedTime * 1000),
      values: model.trainResult.predictedHeartRates,
      color: "#e1415b",
    });
  }
  res.push({ ...toSeries(model.records, "heartRate"), color: "#e17741" });
  res.push({
    secondaryAxis: true,
    timestamps: [...timestamps, ...timestamps.slice().reverse(), timestamps[0]],
    values: [...powerValues, ...powerValues.map((d) => 0), powerValues[0]],
    color: "none",
    fillColor: "rgba(10, 101, 158, 50%)",
  });
  return res;
}

export function ChartTest() {
  const model: HeartRateModel = useMemo(() => {
    const hrm = new HeartRateModel();
    hrm.addRecords(records as any);
    hrm.train();
    return hrm;
  }, []);

  const timestamps = model.records.map((d) => d.elapsedTime * 1000);
  const powerValues = model.records.map((d) => d.power ?? 0);
  return (
    <div>
      <TimeSeriesChart startTimestamp={0} series={chartSeries(model)} />
      <TimeSeriesChart startTimestamp={0} series={[{ timestamps, values: powerValues }]} />
    </div>
  );
}
