import { Link } from 'react-router-dom'
import { primaryNavigation } from '../data/customerNavigation'

export function StoreNavigation() {
  return (
    <nav aria-label="Main navigation">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {primaryNavigation.map((item) => (
          <li key={item.to}>
            <Link className="text-sm font-medium text-slate-700 hover:text-green-800" to={item.to}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}