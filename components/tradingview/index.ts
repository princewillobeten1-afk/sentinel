import dynamic from "next/dynamic";

export const TVChartContainer = dynamic(
  () => import("./tv-chart-container").then((mod) => mod.TVChartContainer),
  { ssr: false }
);
