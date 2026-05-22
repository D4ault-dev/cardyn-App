declare type RootStackParams = {
  Tabs: undefined
  Home: undefined
  SellCard: { cardId?: number; currency?: string; inputType?: string; mode?: 'Fast' | 'Slow'; couponId?: number } | undefined
  OrderDetail: { order: string }
  OrderTracking: { orderId?: string }
  Wallet: undefined
  Transactions: undefined
  Withdraw: undefined
  AddBank: undefined
  SelectBank: undefined
  WithdrawDetail: { withdrawal: string }
  WithdrawalHistory: undefined
  Profile: undefined
  AccountSettings: undefined
  ProfileEdit: undefined
  ModifyPassword: { type: 'login' | 'withdraw' }
  WithdrawPassword: undefined
  UpdateEmail: undefined
  DeleteAccountConfirm: undefined
  VerifyIdentity: { next: 'ModifyPassword' | 'DeleteAccount'; type?: 'login' | 'withdraw' }
  SecuritySettings: undefined
  AccountDeletion: undefined
  DailyBonus: undefined
  Coupon: undefined
  Leaderboard: { newPoints?: number } | undefined
  Alerts: undefined
  Chat: { orderId?: number; orderNo?: string } | undefined
  Help: undefined
  ArticleDetail: { articleId: number }
  Referral: undefined
  CardPicker: undefined
  RateCalculator: { cardId?: number } | undefined
  BindPhone: undefined
  RateAlert: { cardId?: number; currency?: string; faceValue?: string; inputType?: string; rate?: number } | undefined
  RateAlertList: { success?: boolean } | undefined
  Login: { inviteCode?: string } | undefined
  Signup: { inviteCode?: string } | undefined
  PasswordReset: undefined
}

declare type GiftCardCategory = {
  id: string
  name: string
  icon: string
  rate: number        // NGN per $1
  minAmount: number
  maxAmount: number
  isPopular?: boolean
}

declare type Order = {
  id: string
  userId: string
  cardCategory: string
  cardAmount: number
  ngnAmount: number
  status: 'pending' | 'processing' | 'paid' | 'rejected'
  createdAt: number
  updatedAt: number
}

declare type BankAccount = {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
}

declare type User = {
  uid: string
  name: string
  email: string
  phone?: string
  country?: string        // e.g. 'Nigeria', 'Ghana' — set at registration, used to pick currency/rate
  walletBalance: number
  level: number
  xp: number
  referralCode: string
  bankAccounts: BankAccount[]
  notificationTokens: string[]
}

declare type Transaction = {
  id: string
  type: 'sell' | 'withdraw' | 'reward'
  amount: number
  status: 'pending' | 'completed' | 'failed'
  description: string
  createdAt: number
}
