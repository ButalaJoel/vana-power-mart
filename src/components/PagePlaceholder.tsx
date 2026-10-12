type PagePlaceholderProps = {
  title: string
  description: string
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section aria-labelledby="page-title" className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900" id="page-title">
        {title}
      </h1>
      <p className="max-w-2xl text-slate-600">{description}</p>
    </section>
  )
}