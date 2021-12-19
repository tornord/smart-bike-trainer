import { TimeSeriesChart } from "./TimeSeriesChart";

export function ChartTest() {
  const records = [...Array(100)].map((d, i) => ({ timestamp: (i + 1) * 1000, value: 200 + i }));
  return (
    <div>
      <TimeSeriesChart
        startTimestamp={0}
        series={[{ timestamps: records.map((d) => d.timestamp), values: records.map((d) => d.value) }]}
      />
    </div>
  );
}
