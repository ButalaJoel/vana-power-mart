import { PagePlaceholder } from '../components/PagePlaceholder'
import { usePageTitle } from '../hooks/usePageTitle'

type CustomerPageProps = {
  title: string
  description: string
}

export function CustomerPage({ title, description }: CustomerPageProps) {
  usePageTitle(title)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <PagePlaceholder title={title} description={description} />
    </div>
  )
}