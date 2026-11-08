import type { ReactNode } from 'react'
import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { MapPin, MessageCircle, Phone, Search, Truck } from 'lucide-react'
import { usePageTitle } from '../hooks/usePageTitle'
import { useStore } from '../context/StoreContext'
import { SearchBar } from '../components/store/SearchBar'

const LAST_UPDATED = '8 November 2026'

function useContactDetails() {
  const { config } = useStore()
  const phone = config?.storePhone?.trim() || ''
  const whatsapp = phone.replace(/\D/g, '').replace(/^0/, '256')
  return {
    storeName: config?.storeName || 'Vana Power Mart',
    phone,
    whatsapp,
    address: config?.collectionAddress?.trim() || '',
    returnDays: config?.returnWindowDays ?? 7,
  }
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-[#f5f6f5] px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#e1e7e2] bg-white p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold text-[#10231b]">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {LAST_UPDATED}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-7 text-[#26382e] [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#10231b] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </article>
    </div>
  )
}

function ContactLine() {
  const { phone, address } = useContactDetails()
  return (
    <p>
      Contact us on {phone ? <a className="font-semibold underline" href={`tel:${phone}`}>{phone}</a> : 'our store phone line'}
      {address ? `, or visit us at ${address}` : ''}.
    </p>
  )
}

export function PrivacyPage() {
  usePageTitle('Privacy policy', 'How Vana Power Mart collects, uses and protects your personal information.')
  const { storeName } = useContactDetails()

  return (
    <LegalLayout title="Privacy policy">
      <p>
        {storeName} ("we", "us") sells home appliances, furniture and electronics online in Uganda. This policy explains
        what personal information we collect when you use our website, why we need it and the choices you have. We
        handle your information in line with the Data Protection and Privacy Act, 2019 of Uganda.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, phone number and, if you give it, your email address.</li>
        <li>Your delivery area, address and delivery instructions.</li>
        <li>What you order, your order history, returns and reviews.</li>
        <li>For mobile money payments: the paying phone number, the amount and the transaction reference. We never see or store your mobile money PIN.</li>
        <li>If you create an account: a securely scrambled (hashed) copy of your password. We cannot read your password.</li>
        <li>Basic technical information such as your browser type, pages visited and approximate location, to keep the site secure and understand how it is used.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To process, source, deliver and support your orders.</li>
        <li>To send you SMS updates about your order, payment, delivery and returns, and one-time codes to verify your phone number.</li>
        <li>To take payments and give refunds.</li>
        <li>To prevent fraud and fake orders and to protect your account.</li>
        <li>To improve our products, prices and website.</li>
        <li>To meet legal duties such as tax and accounting records.</li>
      </ul>
      <p>We do not sell your personal information. We only send promotional messages if you agree to receive them, and you can stop them at any time.</p>

      <h2>Who we share it with</h2>
      <p>Only what each party needs to do its job:</p>
      <ul>
        <li>Suppliers who provide the products you order (product and, when they deliver directly, your name, phone and delivery address).</li>
        <li>Our delivery riders and courier partners (your name, phone and delivery address).</li>
        <li>Our payment provider and mobile money networks (MTN, Airtel) to collect payments and send refunds.</li>
        <li>Our SMS provider, to deliver text messages to you.</li>
        <li>Companies that host our website and database, and our website analytics provider.</li>
        <li>Authorities, when the law requires it.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep order and payment records for as long as the law requires for tax and accounting purposes. Other
        information is kept while your account is active or while we need it for the purposes above, then deleted or
        anonymised.
      </p>

      <h2>Cookies and storage on your device</h2>
      <p>
        We store your cart, saved items and sign-in on your device so the site works between visits. If analytics is
        switched on, it uses cookies to count visits and see which pages are useful. You can clear these through your
        browser settings.
      </p>

      <h2>Security</h2>
      <p>
        We use encrypted connections, hashed passwords, one-time SMS codes and limits on repeated attempts to protect
        your information. Staff access is restricted to people who need it to serve you.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see the personal information we hold about you, have it corrected or deleted, or object to how
        we use it. To do so, contact us using the details below. If you are not satisfied with our response, you can
        complain to the Personal Data Protection Office of Uganda.
      </p>

      <h2>Children</h2>
      <p>Our website is meant for adults. We do not knowingly collect information from children.</p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version.</p>

      <h2>Contact</h2>
      <ContactLine />
    </LegalLayout>
  )
}

export function TermsPage() {
  usePageTitle('Terms and conditions', 'The terms for ordering, paying, delivery and returns at Vana Power Mart.')
  const { storeName, returnDays } = useContactDetails()

  return (
    <LegalLayout title="Terms and conditions">
      <p>
        These terms apply when you browse or buy from {storeName}. By placing an order you agree to them.
      </p>

      <h2>Orders</h2>
      <ul>
        <li>Placing an order is an offer to buy. We confirm it by SMS once the products are confirmed available.</li>
        <li>Some products come from our supplier partners. If a product turns out to be unavailable, we will call you to offer an alternative or cancel that item, and refund anything you paid for it.</li>
        <li>We may decline or cancel orders that look fraudulent, contain an obvious pricing error or cannot be delivered to the given address.</li>
      </ul>

      <h2>Prices and payment</h2>
      <ul>
        <li>Prices are in Uganda Shillings (UGX). The total, including any delivery fee and discount, is shown before you place your order.</li>
        <li>You can pay cash on delivery or with mobile money where offered. A mobile money order is only marked paid after the payment is confirmed by the network.</li>
        <li>Voucher codes are subject to their conditions and cannot be exchanged for cash.</li>
      </ul>

      <h2>Delivery</h2>
      <ul>
        <li>Delivery fees depend on your delivery area and are shown at checkout. Delivery times are estimates.</li>
        <li>Delivery may be made by our riders, a courier or directly by the supplier. You will receive the rider's details by SMS.</li>
        <li>Please check your items when they arrive and tell the rider or call us straight away if anything is damaged or missing.</li>
      </ul>

      <h2>Returns and refunds</h2>
      <ul>
        <li>You can request a return within {returnDays} days of delivery from the order tracking page.</li>
        <li>Items should be unused, complete and in their original packaging, unless they are faulty.</li>
        <li>Once we receive and check a returned item, we refund it by the original payment method or mobile money.</li>
        <li>Manufacturer warranties apply where provided with the product.</li>
      </ul>

      <h2>Accounts</h2>
      <p>
        Keep your password private and never share the one-time codes we send by SMS. We will never ask you for your
        password, codes or mobile money PIN.
      </p>

      <h2>Liability</h2>
      <p>
        We take care to describe products accurately. To the extent the law allows, our responsibility for an order is
        limited to the amount you paid for it. Nothing in these terms affects your rights under Ugandan law.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of Uganda.</p>

      <h2>Contact</h2>
      <ContactLine />
    </LegalLayout>
  )
}

export function ContactPage() {
  usePageTitle('Contact us', 'Call, WhatsApp or visit Vana Power Mart for help with orders, delivery and returns.')
  const { phone, whatsapp, address } = useContactDetails()

  const cards = [
    phone && {
      icon: <Phone size={22} />,
      title: 'Call us',
      text: phone,
      href: `tel:${phone}`,
      action: 'Call now',
    },
    whatsapp && {
      icon: <MessageCircle size={22} />,
      title: 'WhatsApp',
      text: 'Chat with us about products and orders.',
      href: `https://wa.me/${whatsapp}`,
      action: 'Open WhatsApp',
    },
    address && {
      icon: <MapPin size={22} />,
      title: 'Visit or collect',
      text: address,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      action: 'Open map',
    },
  ].filter(Boolean) as Array<{ icon: ReactNode; title: string; text: string; href: string; action: string }>

  return (
    <div className="bg-[#f5f6f5] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-extrabold text-[#10231b]">Contact us</h1>
        <p className="mt-2 text-gray-600">We're happy to help with orders, delivery, payments and returns.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <a
              key={card.title}
              href={card.href}
              target={card.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="rounded-2xl border border-[#e1e7e2] bg-white p-6 transition hover:border-[var(--vana-green)]"
            >
              <span className="text-[var(--vana-green)]">{card.icon}</span>
              <p className="mt-3 font-bold">{card.title}</p>
              <p className="mt-1 text-sm text-gray-600 break-words">{card.text}</p>
              <p className="mt-4 text-sm font-semibold text-[var(--vana-green)]">{card.action} →</p>
            </a>
          ))}
          <Link
            to="/track"
            className="rounded-2xl border border-[#e1e7e2] bg-white p-6 transition hover:border-[var(--vana-green)]"
          >
            <span className="text-[var(--vana-green)]"><Truck size={22} /></span>
            <p className="mt-3 font-bold">Where is my order?</p>
            <p className="mt-1 text-sm text-gray-600">Track it with your order number and phone.</p>
            <p className="mt-4 text-sm font-semibold text-[var(--vana-green)]">Track order →</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  usePageTitle('Page not found', 'The page you were looking for could not be found.')

  return (
    <div className="bg-[#f5f6f5] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-[#e1e7e2] bg-white p-8 text-center sm:p-12">
        <p className="text-6xl font-extrabold text-[var(--vana-green)]">404</p>
        <h1 className="mt-4 text-2xl font-bold text-[#10231b]">We couldn't find that page</h1>
        <p className="mt-2 text-gray-600">The link may be old or the product may no longer be available. Try a search:</p>
        <div className="mt-6 text-left">
          <SearchBar />
        </div>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white">Go to the home page</Link>
          <Link to="/products" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7e1d9] px-6 py-3 font-semibold">
            <Search size={16} /> Browse all products
          </Link>
        </div>
      </div>
    </div>
  )
}

// Shown if a page crashes, so customers never see a blank screen.
export function ErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f5] px-4">
      <div className="max-w-md rounded-2xl border border-[#e1e7e2] bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-[#10231b]">Something went wrong</h1>
        <p className="mt-2 text-gray-600">Please reload the page. If it keeps happening, call us and we'll help with your order.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-[var(--vana-green)] px-6 py-3 font-semibold text-white">
            Reload
          </button>
          <a href="/" className="rounded-full border border-[#d7e1d9] px-6 py-3 font-semibold">Home</a>
        </div>
      </div>
    </div>
  )
}
