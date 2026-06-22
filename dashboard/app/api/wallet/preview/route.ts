import { NextResponse } from 'next/server'
import { hasWalletCredentials, getGasPrice, getConfig } from '../../../../lib/wallet-engine'

export async function POST(request: Request) {
  if (!hasWalletCredentials()) {
    return NextResponse.json({ error: 'Wallet not initialized' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { to, amount, token } = body

    if (!to || !amount) {
      return NextResponse.json({ error: 'Missing to or amount' }, { status: 400 })
    }

    const gas = await getGasPrice()
    const config = getConfig()
    const tokenLower = (token || 'eth').toLowerCase()
    const isUsdc = tokenLower === 'usdc'

    const gasCostEth = parseFloat(gas.estimateEthTransfer)
    const gasCostUsd = gasCostEth * 3000

    const amountNum = parseFloat(amount)
    const totalUsd = isUsdc ? amountNum + gasCostUsd * 0.001 : amountNum * 3000 + gasCostUsd

    return NextResponse.json({
      to,
      amount,
      token: tokenLower,
      gasPrice: gas.price,
      gasCostEth: gas.estimateEthTransfer,
      gasCostUsd: gasCostUsd.toFixed(4),
      totalUsd: totalUsd.toFixed(2),
      network: config.network,
      warning: gasCostUsd > 1 ? 'High gas cost detected' : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
