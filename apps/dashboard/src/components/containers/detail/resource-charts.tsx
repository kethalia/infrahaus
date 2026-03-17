"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRrdData, type RrdDataPoint } from "@/hooks/use-rrd-data";
import { formatBytes } from "@/lib/utils/format";

// ============================================================================
// Types
// ============================================================================

interface ResourceChartsProps {
  nodeName: string;
  vmid: number;
  /** Only fetch RRD data when container is running */
  isRunning: boolean;
}

// ============================================================================
// Chart configurations
// ============================================================================

const cpuConfig = {
  cpu: { label: "CPU %", color: "var(--chart-1)" },
} satisfies ChartConfig;

const memConfig = {
  mem: { label: "Memory", color: "var(--chart-2)" },
} satisfies ChartConfig;

const diskConfig = {
  disk: { label: "Disk", color: "var(--chart-3)" },
} satisfies ChartConfig;

const networkConfig = {
  netin: { label: "In", color: "var(--chart-4)" },
  netout: { label: "Out", color: "var(--chart-5)" },
} satisfies ChartConfig;

// ============================================================================
// Data transformation
// ============================================================================

function transformRrdData(data: RrdDataPoint[]) {
  return data.map((point) => ({
    time: point.time,
    // CPU is a ratio (0-1) from Proxmox — multiply by 100 for percentage display
    cpu: point.cpu != null ? Math.round(point.cpu * 100 * 10) / 10 : null,
    mem: point.mem ?? null,
    maxmem: point.maxmem ?? null,
    disk: point.disk ?? null,
    maxdisk: point.maxdisk ?? null,
    netin: point.netin ?? null,
    netout: point.netout ?? null,
  }));
}

// ============================================================================
// Time formatter
// ============================================================================

function formatTime(timestamp: number, timeframe: "hour" | "day") {
  const date = new Date(timestamp * 1000);
  if (timeframe === "hour") {
    // 1-min resolution — show HH:MM
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  // ~20-min resolution — show hour only to reduce label clutter
  return date.toLocaleTimeString([], { hour: "2-digit" });
}

// ============================================================================
// ResourceCharts component
// ============================================================================

export function ResourceCharts({
  nodeName,
  vmid,
  isRunning,
}: ResourceChartsProps) {
  const [timeframe, setTimeframe] = useState<"hour" | "day">("hour");

  const { data, isLoading } = useRrdData({
    nodeName,
    vmid,
    timeframe,
    enabled: isRunning,
  });

  const chartData = data ? transformRrdData(data) : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="size-4" />
            Resource History
          </CardTitle>
          <Tabs
            value={timeframe}
            onValueChange={(v) => setTimeframe(v as "hour" | "day")}
          >
            <TabsList>
              <TabsTrigger value="hour">1 Hour</TabsTrigger>
              <TabsTrigger value="day">24 Hours</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {!isRunning ? (
          // Stopped container placeholder
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Monitor className="mb-3 size-8 opacity-30" />
            <p className="text-sm">
              No data available — container is stopped
            </p>
          </div>
        ) : isLoading ? (
          // Loading skeletons
          <div className="space-y-8">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* CPU Chart */}
            <div>
              <h4 className="mb-2 text-sm font-medium">CPU Usage</h4>
              <ChartContainer config={cpuConfig} className="min-h-[200px] w-full">
                <AreaChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(ts) => formatTime(ts, timeframe)}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) {
                            return new Date(
                              payload[0].payload.time * 1000,
                            ).toLocaleString();
                          }
                          return "";
                        }}
                        formatter={(value) => [`${value}%`, "CPU"]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    fill="var(--color-cpu)"
                    fillOpacity={0.3}
                    stroke="var(--color-cpu)"
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>

            {/* Memory Chart */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Memory Usage</h4>
              <ChartContainer config={memConfig} className="min-h-[200px] w-full">
                <AreaChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(ts) => formatTime(ts, timeframe)}
                  />
                  <YAxis tickFormatter={(v) => formatBytes(v)} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) {
                            return new Date(
                              payload[0].payload.time * 1000,
                            ).toLocaleString();
                          }
                          return "";
                        }}
                        formatter={(value) => [
                          formatBytes(value as number),
                          "Memory",
                        ]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="mem"
                    fill="var(--color-mem)"
                    fillOpacity={0.3}
                    stroke="var(--color-mem)"
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>

            {/* Disk Chart */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Disk Usage</h4>
              <ChartContainer config={diskConfig} className="min-h-[200px] w-full">
                <AreaChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(ts) => formatTime(ts, timeframe)}
                  />
                  <YAxis tickFormatter={(v) => formatBytes(v)} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) {
                            return new Date(
                              payload[0].payload.time * 1000,
                            ).toLocaleString();
                          }
                          return "";
                        }}
                        formatter={(value) => [
                          formatBytes(value as number),
                          "Disk",
                        ]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="disk"
                    fill="var(--color-disk)"
                    fillOpacity={0.3}
                    stroke="var(--color-disk)"
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>

            {/* Network I/O Chart (stacked) */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Network I/O</h4>
              <ChartContainer
                config={networkConfig}
                className="min-h-[200px] w-full"
              >
                <AreaChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(ts) => formatTime(ts, timeframe)}
                  />
                  <YAxis
                    tickFormatter={(v) => `${formatBytes(v)}/s`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          if (payload?.[0]?.payload?.time) {
                            return new Date(
                              payload[0].payload.time * 1000,
                            ).toLocaleString();
                          }
                          return "";
                        }}
                        formatter={(value, name) => [
                          `${formatBytes(value as number)}/s`,
                          name === "netin" ? "In" : "Out",
                        ]}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="netin"
                    stackId="1"
                    fill="var(--color-netin)"
                    fillOpacity={0.3}
                    stroke="var(--color-netin)"
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="netout"
                    stackId="1"
                    fill="var(--color-netout)"
                    fillOpacity={0.3}
                    stroke="var(--color-netout)"
                    connectNulls
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
