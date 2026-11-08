import { useEffect } from 'react'

const SITE_NAME = 'Vana Power Mart'
export const DEFAULT_DESCRIPTION =
  'Shop fridges, freezers, washing machines, kitchen appliances, furniture and electronics online at Vana Power Mart. Delivery across Uganda. Pay on delivery or with mobile money.'

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = url
}

// Sets the browser tab title, the meta description and the social preview
// text for the current page.
export function usePageTitle(title: string, description: string = DEFAULT_DESCRIPTION) {
  useEffect(() => {
    const fullTitle = title === 'Home' ? `${SITE_NAME} | Home appliances, furniture and electronics in Uganda` : `${title} | ${SITE_NAME}`
    const text = description.replace(/\s+/g, ' ').trim().slice(0, 160)
    const url = window.location.origin + window.location.pathname

    document.title = fullTitle
    setMeta('name', 'description', text)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', text)
    setMeta('property', 'og:url', url)
    setCanonical(url)
  }, [title, description])
}
