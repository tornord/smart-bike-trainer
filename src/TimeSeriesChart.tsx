import * as d3 from "d3";
import { type } from "os";
import { useState } from "react";
import * as math from "ts-math";

const { round, floor } = Math;

export interface TimeSeries {
  timestamps: number[];
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
  timestamps: number[];
  values: number[];
  color?: string;
  strokeWidth?: number;
  fillColor?: string;
  drawPath?: boolean;
  pointType?: PointType;
  pointSize?: number;
  strokeDasharray?: string;
  secondaryAxis?: boolean;
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
  onMouseMove?: (timestamp: number, value: number) => void;
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  minValue?: number;
  maxValue?: number;
  logarithmic?: boolean;
  cursor?: Cursor;
}

interface Point {
  timestamp: number;
  value: number;
}

interface Trace {
  index: number;
  d: string | null;
  series: Series;
  points: Point[];
}

interface Axis {
  minValue: number;
  maxValue: number;
  relativeMargin: number;
  scale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number> | null;
}

function createAxis(relativeMargin: number) {
  return { minValue: Number.NaN, maxValue: Number.NaN, relativeMargin, scale: null };
}

function updateAxis(axis: Axis, values: number[]) {
  const minMaxValues = minMax(values);
  const rm = axis.relativeMargin * (minMaxValues[1] - minMaxValues[0]);
  const minv = minMaxValues[0] - rm;
  const maxv = minMaxValues[1] + rm;
  if (Number.isNaN(axis.minValue) || minv < axis.minValue) {
    axis.minValue = minv;
  }
  if (Number.isNaN(axis.maxValue) || maxv > axis.maxValue) {
    axis.maxValue = maxv;
  }
}

interface Axes {
  x: Axis;
  y: Axis;
  secondaryY: Axis | null;
}

type Scale = d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;

const round2 = (x: number) => math.round(x, 2);

function createPathD({ timestamps, values }: TimeSeries, xScale: Scale, yScale: Scale) {
  const points: Point[] = timestamps.map((d: number, i: number) => ({ timestamp: d, value: values[i] }));
  const lineXValue = (d: any, i: number): number => round2(xScale(d.timestamp));
  const lineYValue = (d: any, i: number): number => round2(yScale(d.value));
  const line = d3.line().x(lineXValue).y(lineYValue);
  return line(points as any[]);
}

const isNumber = (x: any) => typeof x === "number" && Number.isFinite(x);

function timestampToString(t: number) {
  // t elapsed time in ms
  let s = round(t / 1000);
  const m = floor(s / 60);
  s = s % 60;
  return `${m}:${s.toFixed(0).padStart(2, "0")}`;
}

function checkIsNumber(value: number | null | undefined, defaultValue: number) {
  if (isNumber(value)) return value as number;
  return defaultValue;
}

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
  startTimestamp,
  endTimestamp,
  minValue,
  maxValue,
  logarithmic,
  cursor,
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

  const axes: Axes = { x: createAxis(0), y: createAxis(yRelativeMargin), secondaryY: null };
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const { timestamps, values } = s;
    const secondaryAxis = s.secondaryAxis === true;
    if (secondaryAxis && axes.secondaryY === null) {
      axes.secondaryY = createAxis(0);
    }
    updateAxis(axes.x, timestamps);
    updateAxis(!secondaryAxis ? axes.y : (axes.secondaryY as any), values);
  }
  minValue = checkIsNumber(minValue, axes.y.minValue);
  maxValue = checkIsNumber(maxValue, axes.y.maxValue);
  startTimestamp = checkIsNumber(startTimestamp, axes.x.minValue);
  endTimestamp = checkIsNumber(endTimestamp, axes.x.maxValue);
  axes.y.scale = logarithmic === true ? d3.scaleLog() : d3.scaleLinear();
  const yRange = [height - xAxisHeight - marginTop, marginTop];
  axes.y.scale.domain([minValue as number, maxValue as number]).range(yRange);
  if (axes.secondaryY !== null) {
    const a = axes.secondaryY;
    a.scale = logarithmic === true ? d3.scaleLog() : d3.scaleLinear();
    a.scale.domain([a.minValue, a.maxValue]).range(yRange);
  }
  const yTicks = axes.y.scale.ticks(5);
  axes.x.scale = d3
    .scaleLinear()
    .domain([startTimestamp as number, endTimestamp as number])
    .range([marginLeft, width - marginRight]);
  const xTicks = axes.x.scale.ticks(5);
  let traces: Trace[] = [];
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i];
    traces.push({
      index: i,
      d:
        s.drawPath !== false
          ? (createPathD(
              s,
              axes.x.scale,
              s.secondaryAxis !== true ? axes.y.scale : ((axes.secondaryY as Axis).scale as Scale)
            ) as string)
          : null,
      points: s.timestamps.map((d, i) => ({ timestamp: d, value: s.values[i] })),
      series: s,
    });
  }
  if (cursor && cursor.x >= 0) {
    traces.push({
      index: series.length,
      d: `M${cursor.x},${axes.y.scale(minValue as number)} L${cursor.x},${axes.y.scale(maxValue as number)}`,
      points: [],
      series: {
        timestamps: [],
        values: [],
        strokeDasharray: "3 4",
        strokeWidth: 1,
        color: "rgb(232, 213, 206)",
      },
    });
  }
  const xScale = axes.x.scale;
  const yScale = axes.y.scale;
  // const secondaryYTicks = axes.secondaryY ? yTicks.map((d) => axes.secondaryY?.scale?.(yScale.invert(d))) : null;
  const secondaryYTicks = axes.secondaryY ? yTicks.map((d) => axes.secondaryY?.scale?.invert(yScale(d))) : null;
  const fontStyle = { fontSize, color: fontColor, fill: fontColor };
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={(e) => {
        const x = e.nativeEvent.offsetX;
        const y = e.nativeEvent.offsetY;
        const timestamp = xScale.invert(x) ?? 0;
        const value = yScale.invert(y) ?? 0;
        if (onMouseMove) {
          onMouseMove(timestamp, value);
        }
        if (cursor) {
          cursor.onMouseMove(x, y);
        }
      }}
    >
      <g transform={`translate(${0},${height - xAxisHeight})`}>
        <line x1="0" y1="0" x2={width} y2="0" stroke={textColor} strokeWidth="1" />
        {xTicks.map((t, i) => (
          <g key={i} transform={`translate(${xScale(t)},${0})`}>
            <line x1="0" y1="0" x2="0" y2={xTickSize} stroke={textColor} strokeWidth="1" />
            <text
              x="0"
              y={xTickSize + (xAxisHeight - xTickSize - fontSize) / 2 + 0.5}
              textAnchor="middle"
              alignmentBaseline="hanging"
              style={fontStyle}
            >
              {timestampToString(t)}
            </text>
          </g>
        ))}
      </g>
      <g>
        {yTicks.map((d, i) => (
          <g key={i} transform={`translate(${0},${yScale(d)})`}>
            <line x1="0" y1="0" x2={width} y2="0" stroke={textColor} strokeWidth="1" strokeDasharray="4,3" />
            <text x={(width as number) - 1} y={-2} textAnchor="end" style={fontStyle}>
              {d.toFixed(0)}
            </text>
            {secondaryYTicks ? (
              <text x={0} y={-2} style={fontStyle}>
                {secondaryYTicks[i]?.toFixed(0)}
              </text>
            ) : null}
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
                  cx={xScale(p.timestamp)}
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
