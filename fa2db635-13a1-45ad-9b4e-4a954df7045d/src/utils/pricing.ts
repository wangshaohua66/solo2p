import type { Quote, QuoteItem, Package, Addon, PackageItem } from '@/types'

export interface PricingInput {
  pkg: Package
  guests: number
  serviceIds: number[]
  addons: { addon: Addon; qty: number }[]
  discountCoefficient: number
}

function perGuestAdjust(guests: number): number {
  if (guests <= 8) return 0
  return (guests - 8) * 320
}

export function calcQuote(input: PricingInput): Quote {
  const { pkg, guests, serviceIds, addons, discountCoefficient } = input
  const items: QuoteItem[] = []

  for (const item of pkg.items.filter((i) => i.included)) {
    items.push({ name: item.name, cost: item.cost, price: item.price, qty: 1 })
  }

  const optional = pkg.items.filter((i) => !i.included && serviceIds.includes(i.id))
  for (const item of optional) {
    items.push({ name: item.name, cost: item.cost, price: item.price, qty: 1 })
  }

  const guestAdjCost = Math.round(perGuestAdjust(guests) * 0.7)
  const guestAdjPrice = perGuestAdjust(guests)
  if (guests > 8) {
    items.push({
      name: `超桌加位（${guests - 8}桌）`,
      cost: guestAdjCost,
      price: guestAdjPrice,
      qty: 1,
    })
  }

  for (const { addon, qty } of addons) {
    if (qty <= 0) continue
    items.push({ name: `${addon.name} ×${qty}`, cost: addon.cost * qty, price: addon.price * qty, qty })
  }

  const cost = items.reduce((s, i) => s + i.cost, 0)
  const grossPrice = items.reduce((s, i) => s + i.price, 0) + pkg.basePrice
  const basePriceCost = Math.round(pkg.basePrice * 0.55)
  items.unshift({ name: '套餐基础服务', cost: basePriceCost, price: pkg.basePrice, qty: 1 })

  const totalCost = cost + basePriceCost
  const discount = Math.round(grossPrice * (1 - discountCoefficient))
  const total = grossPrice - discount
  const profit = total - totalCost
  const margin = total > 0 ? Math.round((profit / total) * 1000) / 10 : 0

  return { items, cost: totalCost, price: grossPrice, discount, total, profit, margin }
}

export function calcPackageMargin(pkg: Package): { cost: number; price: number; margin: number } {
  const cost = pkg.items.reduce((s, i) => s + (i.included ? i.cost : 0), 0) + Math.round(pkg.basePrice * 0.55)
  const price = pkg.basePrice
  const margin = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0
  return { cost, price, margin }
}

export function summarizePackage(pkg: Package): { services: PackageItem[]; costs: PackageItem[] } {
  return {
    services: pkg.items.filter((i) => i.type === 'SERVICE'),
    costs: pkg.items.filter((i) => i.type === 'COST'),
  }
}
