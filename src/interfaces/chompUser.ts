interface Wallet {
  address: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface IChompUser {
  id: string;
  isAdmin: boolean;
  telegramId: number | null;
  telegramUsername: string | null;
  isBotSubscriber: boolean;
  username: string | null;
  wallets: Wallet[];
}
