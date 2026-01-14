import * as React from "react"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm ${className ?? ""}`}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`flex flex-col space-y-1.5 p-6 ${className ?? ""}`}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={`text-lg font-semibold leading-none tracking-tight ${className ?? ""}`}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={`text-sm text-gray-500 ${className ?? ""}`}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={`p-6 pt-0 ${className ?? ""}`} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={`flex items-center p-6 pt-0 ${className ?? ""}`}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
