import * as React from "react"
import { Tooltip as RechartsTooltip } from "recharts"

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    color?: string
  }
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }
  return context
}

function ChartContainer({
  config,
  children,
  className,
}: {
  config: ChartConfig
  children: React.ReactNode
  className?: string
}) {
  const cssVars = React.useMemo(() => {
    const vars: Record<string, string> = {}
    Object.entries(config).forEach(([key, value]) => {
      if (value.color) {
        vars[`--color-${key}`] = value.color
      }
    })
    return vars
  }, [config])

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={`h-[200px] w-full ${className ?? ""}`}
        style={cssVars as React.CSSProperties}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
}

function ChartTooltip<T extends object>({
  cursor = true,
  content,
  ...props
}: React.ComponentProps<typeof RechartsTooltip<number, string>> & {
  cursor?: boolean
  content?: React.ReactElement
}) {
  return (
    <RechartsTooltip
      cursor={cursor ? { stroke: "hsl(var(--border))", strokeWidth: 1 } : false}
      content={content}
      {...props}
    />
  )
}

function ChartTooltipContent({
  active,
  payload,
  hideLabel,
  indicator = "dot",
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; payload: Record<string, unknown> }>
  hideLabel?: boolean
  indicator?: "dot" | "line" | "dashed"
}) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-md">
      {payload.map((item, index) => {
        const configItem = config[item.dataKey]
        return (
          <div key={index} className="flex items-center gap-2">
            {indicator === "dot" && (
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: configItem?.color }}
              />
            )}
            <span className="text-sm text-gray-500">
              {configItem?.label ?? item.dataKey}:
            </span>
            <span className="text-sm font-medium">{item.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
