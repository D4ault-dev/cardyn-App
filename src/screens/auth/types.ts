import { Country } from '../../api/country'

export type Step =
  | 'landing'
  | 'login'
  | 'login_password'
  | 'biometric_setup'
  | 'signup'
  | 'signup_otp'
  | 'signup_password'
  | 'forgot'
  | 'forgot_otp'
  | 'forgot_newpassword'
  | 'password_success'

export const FALLBACK_COUNTRY: Country = {
  id: 0,
  name: 'Nigeria',
  todayRate: 0,
  registerBonus: 0,
  withdrawFee: 0,
  currencyName: 'Naira',
  currencySymbol: '₦',
  phonePrefix: '234',
}

export const BIOMETRIC_KEY  = '@fufu_biometric_enabled'
export const BIOMETRIC_USER = '@fufu_biometric_user'
export const BIOMETRIC_PASS = '@fufu_biometric_pass'

export const ONBOARDING_SLIDES = [
  {
    id: '1',
    title: 'Sell Gift Cards Instantly',
    subtitle: 'Get the best rates for your gift cards, paid directly to your bank account.',
    illustration: 'cards',
  },
  {
    id: '2',
    title: 'Fast & Secure Payments',
    subtitle: 'Your transactions are protected with bank-level security and instant payouts.',
    illustration: 'money',
  },
  {
    id: '3',
    title: 'Track Your Earnings',
    subtitle: 'Monitor your wallet balance, transaction history, and withdrawal status in real-time.',
    illustration: 'wallet',
  },
]
