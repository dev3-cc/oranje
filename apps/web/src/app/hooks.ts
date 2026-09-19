import { useDispatch, useSelector } from 'react-redux'

import type { AppDispatch, RootState } from './store'

/** Usar estos, no `useDispatch`/`useSelector` pelados: pierden el tipado del store. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
