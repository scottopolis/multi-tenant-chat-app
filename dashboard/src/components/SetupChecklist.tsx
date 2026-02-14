import { Link } from "@tanstack/react-router"
import { CheckCircle2, Circle, ArrowRight } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"

export type SetupStepStatus = "complete" | "pending" | "optional"

export interface SetupStep {
  id: string
  title: string
  description: string
  status: SetupStepStatus
  to?: string
  params?: Record<string, string>
  search?: Record<string, string>
  hash?: string
  cta?: string
}

interface SetupChecklistProps {
  title?: string
  description?: string
  steps: SetupStep[]
  compact?: boolean
}

const statusStyles: Record<SetupStepStatus, { icon: typeof CheckCircle2; text: string; dot: string }> = {
  complete: {
    icon: CheckCircle2,
    text: "text-green-700",
    dot: "bg-green-100 border-green-200 text-green-700",
  },
  pending: {
    icon: Circle,
    text: "text-gray-900",
    dot: "bg-white border-gray-200 text-gray-500",
  },
  optional: {
    icon: Circle,
    text: "text-gray-700",
    dot: "bg-amber-50 border-amber-200 text-amber-700",
  },
}

export function SetupChecklist({
  title = "Launch Checklist",
  description = "Complete these steps to get your first agent live.",
  steps,
  compact = false,
}: SetupChecklistProps) {
  const completedCount = steps.filter((step) => step.status === "complete").length
  const totalCount = steps.length

  const headerClassName = compact ? "gap-1.5" : "gap-2"
  const contentClassName = compact ? "space-y-3" : "space-y-4"
  const itemClassName = compact
    ? "flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
    : "flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4"
  const iconWrapperClassName = compact ? "flex h-7 w-7 items-center justify-center rounded-full border" : "flex h-8 w-8 items-center justify-center rounded-full border"
  const titleClassName = compact ? "text-sm font-medium" : "text-sm font-medium"
  const descriptionClassName = compact ? "mt-1 text-xs text-gray-500" : "mt-1 text-sm text-gray-500"
  const ctaClassName = compact ? "mt-2" : "mt-3"
  const ctaTextClassName = compact ? "inline-flex items-center text-xs font-medium text-gray-900 hover:text-gray-600" : "inline-flex items-center text-sm font-medium text-gray-900 hover:text-gray-600"

  return (
    <Card>
      <CardHeader className={headerClassName}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
            {completedCount} / {totalCount} done
          </div>
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>
        {steps.map((step) => {
          const styles = statusStyles[step.status]
          const Icon = styles.icon

          return (
            <div key={step.id} className={itemClassName}>
              <div className={`${iconWrapperClassName} ${styles.dot}`}>
                <Icon className={`h-4 w-4 ${styles.text}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className={`${titleClassName} ${styles.text}`}>{step.title}</p>
                  {step.status === "complete" && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Done
                    </span>
                  )}
                  {step.status === "optional" && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Recommended
                    </span>
                  )}
                </div>
                <p className={descriptionClassName}>{step.description}</p>
                {step.to && step.cta && (
                  <div className={ctaClassName}>
                    <Link
                      to={step.to}
                      params={step.params}
                      search={step.search}
                      hash={step.hash}
                      className={ctaTextClassName}
                    >
                      {step.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
