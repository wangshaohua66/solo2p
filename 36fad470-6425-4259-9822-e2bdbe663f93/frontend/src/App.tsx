import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useAppDispatch } from './store/hooks'
import { restoreAuth } from './store/authSlice'

function App() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      dispatch(restoreAuth())
    }
  }, [dispatch])

  return <RouterProvider router={router} />
}

export default App
