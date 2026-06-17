import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { restoreAuth, scheduleTokenRefresh } from './store/authSlice'

function App() {
  const dispatch = useAppDispatch()
  const { isAuthenticated } = useAppSelector((state) => state.auth)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      dispatch(restoreAuth())
      scheduleTokenRefresh(dispatch)
    }
  }, [dispatch])

  useEffect(() => {
    if (isAuthenticated) {
      scheduleTokenRefresh(dispatch)
    }
  }, [isAuthenticated, dispatch])

  return <RouterProvider router={router} />
}

export default App
