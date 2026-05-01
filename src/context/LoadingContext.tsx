import React, { createContext, useContext, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import Colors from '../constants/Colors'

export type LoadingContextType = {
  push: () => void
  pop: () => void
}

export const LoadingContext = createContext<LoadingContextType>({} as any)

export const useLoading: () => (<T>(f: () => Promise<T>) => Promise<T>) = () => {
  const ctx = useContext(LoadingContext)
  return async f => {
    ctx.push()
    try {
      return await f()
    } catch (err) {
      return Promise.reject(err)
    } finally {
      ctx.pop()
    }
  }
}

export const LoadingContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [loadingCnt, setLoadingCnt] = useState(0)
  return (
    <LoadingContext.Provider value={{
      push: () => setLoadingCnt(c => c + 1),
      pop: () => setLoadingCnt(c => c - 1),
    }}>
      {children}
      {loadingCnt > 0 && (
        <View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
          zIndex: 1001, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
    </LoadingContext.Provider>
  )
}
