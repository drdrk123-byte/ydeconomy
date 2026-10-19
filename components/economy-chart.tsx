"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Account } from "@/lib/types";
export default function EconomyChart({
  accounts,
  currency,
  kind,
}: {
  accounts: Account[];
  currency: string;
  kind: "distribution" | "assets";
}) {
  const data =
    kind === "assets"
      ? [
          { name: "내 통장", value: accounts[0]?.balance ?? 0 },
          { name: "저축", value: accounts[0]?.savings ?? 0 },
        ]
      : [
          { name: "1천 미만", value: 0 },
          { name: "1천~2천", value: 0 },
          { name: "2천~3천", value: 0 },
          { name: "3천~4천", value: 0 },
          { name: "4천 이상", value: 0 },
        ];
  if (kind === "distribution")
    for (const a of accounts)
      data[Math.min(4, Math.floor((a.balance + a.savings) / 1000))].value++;
  return (
    <div
      className="chart"
      role="img"
      aria-label={data
        .map(
          (d) => `${d.name} ${d.value}${kind === "assets" ? currency : "명"}`,
        )
        .join(", ")}
    >
      <ResponsiveContainer width="100%" height={235}>
        <BarChart
          data={data}
          margin={{ top: 24, right: 8, left: -25, bottom: 0 }}
          barSize={kind === "assets" ? 60 : 46}
        >
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#ecf0f5"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#7b8794", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#9aa4b0", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "#f5f8ff" }}
            formatter={(v) => [
              `${v}${kind === "assets" ? currency : "명"}`,
              kind === "assets" ? "금액" : "학생 수",
            ]}
          />
          <Bar dataKey="value" radius={[7, 7, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={
                  kind === "assets"
                    ? i === 0
                      ? "#3182f6"
                      : "#7fbbff"
                    : i === 1
                      ? "#3182f6"
                      : "#b7d5ff"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
