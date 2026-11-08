
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './context/CartContext'
import { ProductProvider } from './context/ProductContext'
import { CategoryProvider } from './context/CategoryContext'
import { StoreProvider } from './context/StoreContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
    <CategoryProvider>
      <ProductProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </ProductProvider>
    </CategoryProvider>
    </StoreProvider>
  </StrictMode>,
)
