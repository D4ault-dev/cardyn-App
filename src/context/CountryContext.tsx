/**
 * CountryContext — global selected country state.
 *
 * Design:
 *   - homeCountry  = user's registered country (fetched from /tuka/wallet/my which includes country)
 *   - selectedCountry = what the user is currently viewing (can be different)
 *   - isHomeCountry = selectedCountry.id === homeCountry.id
 *
 * Balance rule:
 *   - isHomeCountry → show real balance + transactions
 *   - !isHomeCountry → show 0 balance, empty transactions ("No activity in X")
 *
 * Performance:
 *   - Countries are persisted to AsyncStorage (TTL 30 min) so cold starts show
 *     data instantly without waiting for the network.
 */
import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fetchCountries, Country } from '../api/country'
import { useAuth } from './AuthContext'
import client from '../api/client'

const COUNTRIES_CACHE_KEY = '@cardyn_countries_cache'
const COUNTRIES_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

async function loadCachedCountries(): Promise<Country[] | null> {
  try {
    const raw = await AsyncStorage.getItem(COUNTRIES_CACHE_KEY)
    if (!raw) return null
    const { data, time } = JSON.parse(raw)
    if (Date.now() - time > COUNTRIES_CACHE_TTL) return null
    return data as Country[]
  } catch { return null }
}

async function saveCachedCountries(data: Country[]) {
  try {
    await AsyncStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify({ data, time: Date.now() }))
  } catch { /* non-critical */ }
}

type CountryContextType = {
  selectedCountry: Country | null
  homeCountry: Country | null
  isHomeCountry: boolean
  countries: Country[]
  setSelectedCountry: (c: Country) => void
  loading: boolean
}

const CountryContext = createContext<CountryContextType>({
  selectedCountry: null,
  homeCountry: null,
  isHomeCountry: true,
  countries: [],
  setSelectedCountry: () => {},
  loading: true,
})

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [countries, setCountries]             = useState<Country[]>([])
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [homeCountry, setHomeCountry]         = useState<Country | null>(null)
  const [homeLoaded, setHomeLoaded]           = useState(false)
  const [loading, setLoading]                 = useState(true)

  useEffect(() => {
    const isLoggedIn = user.isPresent()

    const resolveHomeCountry = async (list: Country[]) => {
      if (!isLoggedIn) {
        const first = list[0]
        setHomeCountry(first)
        setSelectedCountry(first)
        setHomeLoaded(true)
        return
      }

      let countryName: string | null = null

      // 1. Try cached user object (fast, available immediately)
      const u = user.getOrThrow()
      if (u.country) {
        countryName = u.country as string
      }

      // 2. If not in cached user, fetch from backend
      if (!countryName) {
        try {
          const res = await client.get('/getInfo')
          countryName = res.data?.country || null
        } catch { /* ignore network errors */ }
      }

      // 3. Final fallback — first country in list
      const home = countryName
        ? list.find(c => c.name.toLowerCase() === countryName!.toLowerCase()) ?? list[0]
        : list[0]

      setHomeCountry(home)
      setHomeLoaded(true)
      setSelectedCountry(home)
    }

    // Step 1: Show cached countries instantly (no loading flash on cold start)
    loadCachedCountries().then(async cached => {
      if (cached && cached.length > 0) {
        setCountries(cached)
        setLoading(false)
        await resolveHomeCountry(cached)
      }

      // Step 2: Always refresh from network in background
      try {
        const fresh = await fetchCountries(true) // force bypass in-memory cache too
        if (fresh.length > 0) {
          setCountries(fresh)
          saveCachedCountries(fresh)
          // Only re-resolve home if we didn't have cached data
          if (!cached || cached.length === 0) {
            await resolveHomeCountry(fresh)
          }
        }
      } catch { /* keep cached data */ }

      if (!cached || cached.length === 0) {
        setHomeLoaded(true)
        setLoading(false)
      }
    })
  }, [user]) // re-runs on login/logout

  // isHomeCountry logic:
  //   - not loaded yet → true (safe default, shows real data while loading)
  //   - loaded, no homeCountry → true (can't determine, show real data)
  //   - loaded → strict ID comparison
  const isHomeCountry = !homeLoaded || !homeCountry
    ? true
    : !!(selectedCountry && selectedCountry.id === homeCountry.id)

  return (
    <CountryContext.Provider value={{
      selectedCountry,
      homeCountry,
      isHomeCountry,
      countries,
      setSelectedCountry,
      loading,
    }}>
      {children}
    </CountryContext.Provider>
  )
}

export function useCountry() {
  return useContext(CountryContext)
}
