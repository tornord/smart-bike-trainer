import * as d3 from "d3";
import { useState } from "react";
import * as math from "ts-math";
import { dateToString, epochToString, toEpoch } from "./dateHelper";

export interface TimeSeries {
  dates: string[];
  values: number[];
}

export function minMax(vs: number[]) {
  let vMin = Number.NaN;
  let vMax = Number.NaN;
  for (let i = 0; i < vs.length; i++) {
    const v = vs[i];
    if (Number.isNaN(vMin) || v < vMin) {
      vMin = v;
    }
    if (Number.isNaN(vMax) || v > vMax) {
      vMax = v;
    }
  }
  return [vMin, vMax];
}

export enum PointType {
  Circle = "Circle",
}

export interface Series {
  dates: string[];
  values: number[];
  color?: string;
  strokeWidth?: number;
  fillColor?: string;
  drawPath?: boolean;
  pointType?: PointType;
  pointSize?: number;
  strokeDasharray?: string;
}

interface Cursor {
  x: number;
  y: number;
  onMouseMove: (eventX: number, eventY: number) => void;
}

interface TimeSeriesChartProps {
  width?: number;
  height?: number;
  series: Series[];
  onMouseMove?: (date: string, value: number) => void;
  startDate?: string | null;
  endDate?: string | null;
  minValue?: number;
  maxValue?: number;
  logarithmic?: boolean;
  cursor?: Cursor;
}

interface Point {
  date: number;
  value: number;
}

interface Trace {
  index: number;
  d: string | null;
  series: Series;
  points: Point[];
}

const round2 = (x: number) => math.round(x, 2);

function createPathD(
  { dates, values }: TimeSeries,
  xScale: d3.ScaleTime<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>
) {
  const points: Point[] = dates.map((d, i) => ({ date: toEpoch(d), value: values[i] }));
  const lineXValue = (d: any, i: number) => round2(xScale(d.date));
  const lineYValue = (d: any, i: number) => round2(yScale(d.value));
  const line = d3.line().x(lineXValue).y(lineYValue);
  return line(points as any[]);
}

const isNumber = (x: any) => typeof x === "number";

export function useCursor(syncX: boolean, syncY: boolean) {
  const [{ x, y }, setState] = useState({ x: -1, y: -1 });
  const onMouseMove = (eventX: number, eventY: number) => {
    if (eventX === x && eventY === y) return;
    setState({ x: eventX, y: eventY });
  };
  return { x: syncX ? x : -1, y: syncY ? y : -1, onMouseMove };
}

export function TimeSeriesChart({
  width,
  height,
  series,
  onMouseMove,
  startDate,
  endDate,
  minValue,
  maxValue,
  logarithmic,
  cursor
}: TimeSeriesChartProps) {
  width = width ?? 600;
  height = height ?? 300;
  const marginTop = 0;
  const marginLeft = 14;
  const marginRight = 33.5;
  const xAxisHeight = 24.5;
  const textColor = "rgb(232, 213, 206)";
  const traceColors = ["rgb(10, 101, 158)", "hsl(122deg 88% 33%)", "rgb(230 42 42)", "rgb(234 184 38)"];
  const xTickSize = 5;
  const fontSize = 11;
  const fontColor = "#789";
  const yRelativeMargin = 0.1;

  // const data = dates.map((d, i) => ({ date: d, value: values[i] }));
  let totMinV = Number.NaN;
  let totMaxV = Number.NaN;
  let totStartD = "";
  let totEndD = "";
  for (let i = 0; i < series.length; i++) {
    const { dates, values } = series[i];
    const minMaxValues = minMax(values);
    const minv = minMaxValues[0] - yRelativeMargin * (minMaxValues[1] - minMaxValues[0]);
    const maxv = minMaxValues[1] + yRelativeMargin * (minMaxValues[1] - minMaxValues[0]);
    if (Number.isNaN(totMinV) || minv < totMinV) {
      totMinV = minv;
    }
    if (Number.isNaN(totMaxV) || maxv > totMaxV) {
      totMaxV = maxv;
    }
    for (let j = 0; j < dates.length; j++) {
      const date = dates[j];
      if (!totStartD || date < totStartD) {
        totStartD = date;
      }
      if (!totEndD || date > totEndD) {
        totEndD = date;
      }
    }
  }
  if (!isNumber(minValue)) {
    minValue = totMinV;
  }
  if (!isNumber(maxValue)) {
    maxValue = totMaxV;
  }
  if (typeof startDate !== "string") {
    startDate = totStartD;
  }
  if (typeof endDate !== "string") {
    endDate = totEndD;
  }
  // console.log(minValue, maxValue, startDate, endDate);
  const yScale = logarithmic === true ? d3.scaleLog() : d3.scaleLinear();
  yScale.domain([minValue as number, maxValue as number]).range([height - xAxisHeight - marginTop, marginTop]);
  const yTicks = yScale.ticks(5);
  const xScale = d3
    .scaleTime()
    .domain([toEpoch(startDate as string), toEpoch(endDate as string)])
    .range([marginLeft, width - marginRight]);
  const xTicks = xScale.ticks(5);
  let traces: Trace[] = [];
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i];
    traces.push({
      index: i,
      d: s.drawPath !== false ? (createPathD(s, xScale, yScale) as string) : null,
      points: s.dates.map((d, i) => ({ date: toEpoch(d), value: s.values[i] })),
      series: s,
    });
  }
  if (cursor && (cursor.x >= 0)) {
    traces.push({
      index: series.length,
      d: `M${cursor.x},${yScale(minValue as number)} L${cursor.x},${yScale(maxValue as number)}`,
      points: [],
      series: {
        dates: [],
        values: [],
        strokeDasharray: "3 4",
        strokeWidth: 1,
        color: "rgb(232, 213, 206)",
      },
    });
  }

  // console.log(minValue, maxValue, yScale(minValue), yScale(maxValue), yTicks);
  return (
    <svg
      width={width}
      height={height}
      onMouseMove={(e) => {
        const x = e.nativeEvent.offsetX;
        const y = e.nativeEvent.offsetY;
        const date = epochToString(xScale.invert(x) as any as number);
        const value = yScale.invert(y);
        if (onMouseMove) {
          onMouseMove(date, value);
        }
        if (cursor) {
          cursor.onMouseMove(x,y);
        }
      }}
    >
      <g transform={`translate(${0},${height - xAxisHeight})`}>
        <line x1="0" y1="0" x2={width} y2="0" stroke={textColor} strokeWidth="1" />
        {xTicks.map((d, i) => (
          <g key={i} transform={`translate(${xScale(d)},${0})`}>
            <line x1="0" y1="0" x2="0" y2={xTickSize} stroke={textColor} strokeWidth="1" />
            <text
              x="0"
              y={xTickSize + (xAxisHeight - xTickSize - fontSize) / 2 + 0.5}
              textAnchor="middle"
              alignmentBaseline="hanging"
              style={{ fontSize, color: fontColor, fill: fontColor }}
            >
              {dateToString(d)}
            </text>
          </g>
        ))}
      </g>
      <g>
        {yTicks.map((d, i) => (
          <g key={i} transform={`translate(${0},${yScale(d)})`}>
            <line x1="0" y1="0" x2={width} y2="0" stroke={textColor} strokeWidth="1" strokeDasharray="4,3" />
            <text
              x={(width as number) - 1}
              y={-2}
              textAnchor="end"
              style={{ fontSize, color: fontColor, fill: fontColor }}
            >
              {d.toFixed(0)}
            </text>
          </g>
        ))}
      </g>
      <g>
        {traces
          .filter((d) => d.points && d.series.pointType === PointType.Circle)
          .map((trace: Trace, i: number) => (
            <g key={i}>
              {trace.points.map((p, j) => (
                <circle
                  key={j}
                  cx={xScale(p.date)}
                  cy={yScale(p.value)}
                  r={trace.series.pointSize ?? 2}
                  fill={trace.series.fillColor ?? "none"}
                  stroke={trace.series.color ?? traceColors[trace.index % traceColors.length]}
                  strokeWidth={trace.series.strokeWidth ?? 2}
                />
              ))}
            </g>
          ))}
      </g>
      <g>
        {traces
          .filter((d) => d.d !== null)
          .map((trace: Trace, i: number) => (
            <path
              key={i}
              d={trace.d as string}
              fill={trace.series.fillColor ?? "none"}
              stroke={trace.series.color ?? traceColors[trace.index % traceColors.length]}
              strokeWidth={trace.series.strokeWidth ?? 2}
              strokeDasharray={trace.series.strokeDasharray ?? "none"}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
      </g>
    </svg>
  );
}
