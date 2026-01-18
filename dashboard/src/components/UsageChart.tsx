import { MessageSquare, Users, MessagesSquare } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer } from "recharts"
import { useQuery } from "convex/react"
import { api } from "../../../convex-backend/convex/_generated/api"
import { useTenant } from "../lib/tenant"
import { Id } from "../../../convex-backend/convex/_generated/dataModel"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./ui/chart"

const chartConfig = {
  messages: {
    label: "Messages",
    color: "#3b82f6",
  },
} satisfies ChartConfig

export function UsageChart() {
  const { tenant } = useTenant()

  const stats = useQuery(
    api.conversations.getUsageStats,
    tenant ? { tenantId: tenant.id as Id<"tenants"> } : "skip"
  )

  if (!stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-8 w-16 bg-gray-200 rounded mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-100 rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const chartData = stats.monthlyData.length > 0
    ? stats.monthlyData
    : [{ month: "No data", messages: 0 }]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total Conversations</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]:text-3xl">
              {stats.totalConversations.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessagesSquare className="h-4 w-4" />
              all time
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Messages</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]:text-3xl">
              {stats.totalMessages.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              all time
            </div>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Unique Sessions</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]:text-3xl">
              {stats.uniqueSessions.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              all time
            </div>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message Volume</CardTitle>
          <CardDescription>
            Messages over the last 6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" hideLabel />}
                />
                <Area
                  dataKey="messages"
                  type="linear"
                  fill="var(--color-messages)"
                  fillOpacity={0.4}
                  stroke="var(--color-messages)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
