import { cartLineKey, parseStoredCart, type CartItem } from './cart-storage'

export type { CartItem } from './cart-storage'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'lunders_panier_v1'
const MAX_QUANTITY = 10
const MAX_ORDER_LINES = 20

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'key' | 'quantity'>, quantity?: number) => boolean
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  subtotal: 0,
  add: () => true,
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
})

function readStoredCart(): CartItem[] {
  try {
    return parseStoredCart(localStorage.getItem(STORAGE_KEY))
  } catch {
    /* stockage local indisponible (mode privé) : panier vide */
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStoredCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* quota dépassé ou stockage bloqué : le panier reste en mémoire */
    }
  }, [items])

  const add = useCallback((item: Omit<CartItem, 'key' | 'quantity'>, quantity = 1) => {
    const key = cartLineKey(item.productId, item.variantId, item.selectedColor ?? null)
    const alreadyInCart = items.some((line) => line.key === key)
    if (!alreadyInCart && items.length >= MAX_ORDER_LINES) return false

    setItems((current) => {
      const existing = current.find((line) => line.key === key)
      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(MAX_QUANTITY, line.quantity + quantity) }
            : line
        )
      }
      return current.length >= MAX_ORDER_LINES
        ? current
        : [...current, { ...item, key, quantity: Math.min(MAX_QUANTITY, Math.max(1, quantity)) }]
    })
    return true
  }, [items])

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(MAX_QUANTITY, Math.max(0, Math.round(quantity))) }
            : line
        )
        .filter((line) => line.quantity > 0)
    )
  }, [])

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((line) => line.key !== key))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((total, line) => total + line.quantity, 0)
    const subtotal = items.reduce((total, line) => total + line.unitPriceDzd * line.quantity, 0)
    return { items, count, subtotal, add, setQuantity, remove, clear }
  }, [items, add, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
