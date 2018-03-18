export enum WalletName {
  BTC = 'btc',
  USD_1 = 'usd1',
  USD_2 = 'usd2',
  BDL_1 = 'bdl1',
  BDL_2 = 'bdl2',
  BDL_3 = 'bdl3'
};

export const WALLET_NAMES = [
  {
    name: WalletName.BTC,
    title: 'BTC',
    sticker: 'BTC',
    currency: 'bitcoin'
  },
  {
    name: WalletName.BDL_1,
    title: 'BDL 1',
    sticker: 'BDL',
    currency: 'bitdeal'
  },
  {
    name: WalletName.BDL_2,
    title: 'BDL 2',
    sticker: 'BDL',
    currency: 'bitdeal'
  },
  {
    name: WalletName.BDL_3,
    title: 'BDL 3',
    sticker: 'BDL',
    currency: 'bitdeal'
  },
  {
    name: WalletName.USD_1,
    title: 'USD 1',
    sticker: 'USD',
    currency: 'usd'
  },
  {
    name: WalletName.USD_2,
    title: 'USD 2',
    sticker: 'USD',
    currency: 'usd'
  }    
];